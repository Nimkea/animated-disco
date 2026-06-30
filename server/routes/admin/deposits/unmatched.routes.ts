import type { Express } from "express";
import type { RouteContext } from "../../../routes";
import { recordAdminAuditLog } from "../../../services/audit.service";

export function registerAdminDepositUnmatchedRoutes(app: Express, ctx: RouteContext) {
  const { storage, prisma, requireAuth, requireAdmin, validateCSRF, Prisma } = ctx;

  app.get(
    "/api/admin/unmatched-deposits",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const unmatched = await prisma.unmatchedDeposit.findMany({
          where: { matched: false },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        res.json(unmatched);
      } catch (error) {
        console.error("Error fetching unmatched deposits:", error);
        res.status(500).json({ message: "Failed to fetch unmatched deposits" });
      }
    }
  );

  app.post(
    "/api/admin/unmatched-deposits/:id/match",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).json({ message: "User ID required" });
        }

        const unmatchedDeposit = await prisma.unmatchedDeposit.findUnique({ where: { id } });
        if (!unmatchedDeposit) {
          return res.status(404).json({ message: "Unmatched deposit not found" });
        }
        if (unmatchedDeposit.matched) {
          return res.status(400).json({ message: "Deposit already matched" });
        }

        const usdtAmount = Number(unmatchedDeposit.amount.toString());
        const xnrtRate = Number.parseFloat(process.env.XNRT_RATE_USDT || "100");
        const platformFeeBps = Number.parseFloat(process.env.PLATFORM_FEE_BPS || "0");
        const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * xnrtRate;
        const txHash = unmatchedDeposit.transactionHash;

        await prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              userId,
              type: "deposit",
              amount: new Prisma.Decimal(xnrtAmount),
              usdtAmount: new Prisma.Decimal(usdtAmount),
              transactionHash: txHash,
              walletAddress: unmatchedDeposit.toAddress,
              status: "approved",
              verified: true,
              confirmations: unmatchedDeposit.confirmations ?? 0,
              verificationData: {
                manualMatch: true,
                matchedBy: req.authUser!.id,
                matchedAt: new Date().toISOString(),
              } as any,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
            },
          });

          await tx.balance.upsert({
            where: { userId },
            create: {
              userId,
              xnrtBalance: new Prisma.Decimal(xnrtAmount),
              totalEarned: new Prisma.Decimal(xnrtAmount),
            },
            update: {
              xnrtBalance: { increment: new Prisma.Decimal(xnrtAmount) },
              totalEarned: { increment: new Prisma.Decimal(xnrtAmount) },
            },
          });

          await tx.unmatchedDeposit.update({
            where: { id },
            data: { matched: true, matchedUserId: userId, matchedAt: new Date() },
          });
        });

        await storage.distributeReferralCommissions(userId, xnrtAmount, `unmatched:${id}`);
        await storage.createActivity({
          userId,
          type: "deposit_approved",
          description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via manual match`,
        });

        await recordAdminAuditLog({
          req,
          targetUserId: userId,
          entityType: "unmatched_deposit",
          entityId: id,
          action: "unmatched_deposit_matched",
          summary: `Matched unmatched deposit and credited ${xnrtAmount.toLocaleString()} XNRT`,
          metadata: { transactionHash: txHash || null, usdtAmount, xnrtAmount },
        });

        res.json({ message: "Deposit matched and credited successfully" });
      } catch (error) {
        console.error("Error matching deposit:", error);
        res.status(500).json({ message: "Failed to match deposit" });
      }
    }
  );
}
