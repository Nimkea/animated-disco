import type { Express } from "express";
import type { RouteContext } from "../../../routes";
import { recordAdminAuditLog } from "../../../services/audit.service";

export function registerAdminDepositReportsRoutes(app: Express, ctx: RouteContext) {
  const { storage, prisma, requireAuth, requireAdmin, validateCSRF, Prisma } = ctx;

  app.get(
    "/api/admin/deposit-reports",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const reports = await prisma.depositReport.findMany({
          where: { status: { in: ["pending", "open"] } },
          include: { user: { select: { email: true, username: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        res.json(reports);
      } catch (error) {
        console.error("Error fetching deposit reports:", error);
        res.status(500).json({ message: "Failed to fetch deposit reports" });
      }
    }
  );

  app.post(
    "/api/admin/deposit-reports/:id/resolve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { resolution, adminNotes } = req.body;

        if (!resolution || !["approved", "rejected"].includes(resolution)) {
          return res.status(400).json({ message: "Invalid resolution" });
        }

        const report = await prisma.depositReport.findUnique({ where: { id } });
        if (!report) return res.status(404).json({ message: "Report not found" });
        if (!["pending", "open"].includes(report.status)) {
          return res.status(400).json({ message: "Report already resolved" });
        }

        if (resolution === "approved") {
          const xnrtRate = Number.parseFloat(process.env.XNRT_RATE_USDT || "100");
          const platformFeeBps = Number.parseFloat(process.env.PLATFORM_FEE_BPS || "0");
          const usdtAmount = report.amount ? Number(report.amount.toString()) : 0;
          const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
          const xnrtAmount = netUsdt * xnrtRate;

          await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
              data: {
                userId: report.userId,
                type: "deposit",
                amount: new Prisma.Decimal(xnrtAmount),
                usdtAmount: new Prisma.Decimal(usdtAmount),
                transactionHash: report.txHash,
                walletAddress: report.fromAddress,
                status: "approved",
                verified: true,
                verificationData: {
                  depositReportId: id,
                  approvedFromReport: true,
                  approvedBy: req.authUser!.id,
                  approvedAt: new Date().toISOString(),
                } as any,
                adminNotes: adminNotes || "Credited from deposit report",
                approvedBy: req.authUser!.id,
                approvedAt: new Date(),
              },
            });

            await tx.balance.upsert({
              where: { userId: report.userId },
              create: {
                userId: report.userId,
                xnrtBalance: new Prisma.Decimal(xnrtAmount),
                totalEarned: new Prisma.Decimal(xnrtAmount),
              },
              update: {
                xnrtBalance: { increment: new Prisma.Decimal(xnrtAmount) },
                totalEarned: { increment: new Prisma.Decimal(xnrtAmount) },
              },
            });

            await tx.depositReport.update({
              where: { id },
              data: { status: "approved", resolvedAt: new Date(), notes: adminNotes || null },
            });
          });

          await storage.distributeReferralCommissions(report.userId, xnrtAmount, `deposit-report:${id}`);
          await storage.createActivity({
            userId: report.userId,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved from deposit report`,
          });
        } else {
          await prisma.depositReport.update({
            where: { id },
            data: { status: "rejected", resolvedAt: new Date(), notes: adminNotes || null },
          });
        }

        await recordAdminAuditLog({
          req,
          targetUserId: report.userId,
          entityType: "deposit_report",
          entityId: id,
          action: resolution === "approved" ? "deposit_report_approved" : "deposit_report_rejected",
          summary: `Deposit report ${resolution}`,
          metadata: { txHash: report.txHash || null, amount: report.amount?.toString() || null, notes: adminNotes || null },
        });

        res.json({ message: `Report ${resolution} successfully` });
      } catch (error) {
        console.error("Error resolving deposit report:", error);
        res.status(500).json({ message: "Failed to resolve report" });
      }
    }
  );
}
