import type { Express } from "express";
import type { RouteContext } from "../../routes";
import { z } from "zod";
import { recordAdminAuditLog } from "../../services/audit.service";
import {
  getTrustLoanConfig,
  updateTrustLoanConfig,
  getDirectReferralStats,
} from "../../services/trustLoan.service";

const trustLoanConfigSchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  terms: z.string().trim().min(10).max(4000).optional(),
  amountXnrt: z.coerce.number().positive().max(1_000_000_000).optional(),
  dailyRate: z.coerce.number().min(0).max(100).optional(),
  durationDays: z.coerce.number().int().min(1).max(3650).optional(),
  requiredReferrals: z.coerce.number().int().min(0).max(10000).optional(),
  requiredInvestingReferrals: z.coerce.number().int().min(0).max(10000).optional(),
  minInvestUsdtPerReferral: z.coerce.number().min(0).max(1_000_000).optional(),
});

function projectedProfit(config: { amountXnrt: number; dailyRate: number; durationDays: number }) {
  return Number(((config.amountXnrt * config.dailyRate * config.durationDays) / 100).toFixed(8));
}

export function registerAdminTrustLoanRoutes(app: Express, ctx: RouteContext) {
  const { prisma, requireAdmin, validateCSRF } = ctx;

  app.get("/api/admin/trust-loan/config", requireAdmin, async (_req, res) => {
    try {
      const config = await getTrustLoanConfig();
      const [loanStakes, eligibleUsersSample] = await Promise.all([
        prisma.stake.findMany({
          where: { OR: [{ tier: config.programKey }, { loanProgram: config.programKey }] },
          select: { id: true, userId: true, status: true, amount: true, totalProfit: true, createdAt: true, endDate: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.user.findMany({ select: { id: true, username: true, email: true }, take: 100 }),
      ]);

      let eligibleCount = 0;
      for (const user of eligibleUsersSample) {
        const stats = await getDirectReferralStats(user.id, config);
        if (stats.directCount >= config.requiredReferrals && stats.investingCount >= config.requiredInvestingReferrals) {
          eligibleCount += 1;
        }
      }

      res.json({
        config,
        metrics: {
          claimedCount: loanStakes.length,
          activeCount: loanStakes.filter((stake) => stake.status === "active").length,
          completedCount: loanStakes.filter((stake) => stake.status === "completed").length,
          withdrawnCount: loanStakes.filter((stake) => stake.status === "withdrawn").length,
          eligibleSampleCount: eligibleCount,
          eligibleSampleSize: eligibleUsersSample.length,
          projectedProfitAtCurrentConfig: projectedProfit(config),
        },
        recentClaims: loanStakes,
      });
    } catch (error) {
      console.error("[AdminTrustLoan] Failed to load config:", error);
      res.status(500).json({ message: "Failed to load Trust Loan config" });
    }
  });

  app.patch("/api/admin/trust-loan/config", requireAdmin, validateCSRF, async (req, res) => {
    try {
      const input = trustLoanConfigSchema.parse(req.body ?? {});
      const previous = await getTrustLoanConfig();
      const updated = await updateTrustLoanConfig(input, req.authUser?.id ?? null);

      await recordAdminAuditLog({
        req,
        entityType: "trust_loan_config",
        entityId: updated.id,
        action: "trust_loan_config_updated",
        summary: `Updated Trust Loan config (${updated.enabled ? "enabled" : "disabled"})`,
        metadata: { previous, updated },
      });

      res.json({ config: updated, metrics: { projectedProfitAtCurrentConfig: projectedProfit(updated) } });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid Trust Loan config", errors: error.errors });
      }
      console.error("[AdminTrustLoan] Failed to update config:", error);
      res.status(500).json({ message: "Failed to update Trust Loan config" });
    }
  });
}
