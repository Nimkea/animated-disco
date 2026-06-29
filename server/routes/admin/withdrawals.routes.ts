import type { Express } from "express";
import type { RouteContext } from "../../routes";

export function registerAdminWithdrawalRoutes(app: Express, ctx: RouteContext) {
  const {
    storage,
    prisma,
    requireAuth,
    requireAdmin,
    validateCSRF,
    STAKING_TIERS,
    Prisma,
    notifyUser,
    sendPushNotification,
    verifyBscUsdtDeposit,
    ethers,
    mintXNRT,
    isTokenServiceReady,
    getTxExplorerUrl,
    generateAnonymizedHandle,
    MINING_SESSION_DURATION_MS,
    MINING_SESSION_XNRT_REWARD,
    MINING_SESSION_XP_REWARD,
    getWalletRates,
    decimalValueToNumber,
    isSameLocalDay,
    normalizeBscAddress,
    getBalanceSourceKey,
    getOrCreateUserDepositAddress,
    normalizeLeaderboardPeriodParam,
    getLeaderboardDateFilter,
    clampLeaderboardLimit,
    toLeaderboardNumber,
    syncUserTasksForActiveTasks,
    serializeTask,
    serializeUserTaskWithTask,
    parseTaskPayload,
    awardUserXp,
    parseAchievementPayload,
    profileUpdateSchema,
    pushSubscriptionLimiter,
    VAPID_PUBLIC_KEY,
    TRUST_LOAN_CONFIG,
    getDirectReferralStats,
    insertAnnouncementSchema,
    z,
  } = ctx;
  app.get(
    "/api/admin/withdrawals/pending",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const pendingWithdrawals = await storage.getPendingTransactions(
          "withdrawal"
        );
        res.json(pendingWithdrawals);
      } catch (error) {
        console.error("Error fetching pending withdrawals:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch pending withdrawals" });
      }
    }
  );

  // Admin approve/reject withdrawals
  app.post(
    "/api/admin/withdrawals/:id/approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes } = req.body || {};
        const withdrawal = await storage.getTransactionById(id);

        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }

        if (withdrawal.status === "approved") {
          return res.json({
            message: "Withdrawal already approved",
            onChainTxHash: withdrawal.transactionHash ?? null,
            explorerUrl: withdrawal.transactionHash
              ? getTxExplorerUrl(withdrawal.transactionHash)
              : null,
          });
        }

        if (withdrawal.status !== "pending" && withdrawal.status !== "processing") {
          return res.status(400).json({ message: "Withdrawal already processed" });
        }

        const withdrawAmount = Number(withdrawal.amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res.status(400).json({ message: "Invalid withdrawal amount" });
        }

        const normalizedWallet = normalizeBscAddress(withdrawal.walletAddress);
        if (!normalizedWallet) {
          return res.status(400).json({ message: "Withdrawal has an invalid destination wallet" });
        }

        const sourceBalanceKey = getBalanceSourceKey(withdrawal.source);
        const meta = (withdrawal.verificationData || {}) as Record<string, any>;
        const alreadyReserved = meta.reservedBalance === true;
        let onChainTxHash: string | undefined = withdrawal.transactionHash || undefined;

        // Older pending withdrawals may not have been reserved at request time.
        // Reserve them once before approval so admin approval cannot overdraw balances.
        if (withdrawal.status === "pending" && !alreadyReserved) {
          await prisma.$transaction(async (tx) => {
            const liveBalance = await tx.balance.findUnique({
              where: { userId: withdrawal.userId },
            });
            const liveAmount = decimalValueToNumber((liveBalance as any)?.[sourceBalanceKey]);
            if (withdrawAmount > liveAmount) {
              throw new Error(`Insufficient balance: need ${withdrawAmount}, have ${liveAmount}`);
            }
            const locked = await tx.transaction.updateMany({
              where: { id, status: "pending" },
              data: {
                status: "processing",
                verificationData: {
                  ...(meta as any),
                  reservedBalance: true,
                  reservedAt: new Date().toISOString(),
                  reservedBy: req.authUser!.id,
                  sourceBalanceKey,
                } as any,
              },
            });
            if (locked.count === 0) throw new Error("Withdrawal is already being processed");
            await tx.balance.update({
              where: { userId: withdrawal.userId },
              data: { [sourceBalanceKey]: new Prisma.Decimal(liveAmount - withdrawAmount) },
            });
          });
        } else if (withdrawal.status === "pending") {
          const locked = await prisma.transaction.updateMany({
            where: { id, status: "pending" },
            data: { status: "processing" },
          });
          if (locked.count === 0) {
            return res.status(409).json({
              message: "Withdrawal is currently being processed. Retry after a moment.",
            });
          }
        }

        if (isTokenServiceReady() && !onChainTxHash) {
          try {
            onChainTxHash = await mintXNRT(normalizedWallet, withdrawal.netAmount?.toString() || withdrawal.amount.toString());
            await prisma.transaction.update({
              where: { id },
              data: { transactionHash: onChainTxHash },
            });
          } catch (mintErr: unknown) {
            await prisma.transaction.update({ where: { id }, data: { status: "pending" } });
            const msg = mintErr instanceof Error ? mintErr.message : String(mintErr);
            console.error(`[Withdrawal] On-chain mint failed; reserved balance kept pending: ${msg}`);
            throw mintErr;
          }
        }

        await prisma.transaction.update({
          where: { id },
          data: {
            status: "approved",
            ...(onChainTxHash ? { transactionHash: onChainTxHash } : {}),
            approvedBy: req.authUser!.id,
            approvedAt: new Date(),
            adminNotes: notes ?? withdrawal.adminNotes,
            verificationData: {
              ...((withdrawal.verificationData || {}) as any),
              reservedBalance: true,
              approvedAt: new Date().toISOString(),
              approvedBy: req.authUser!.id,
              withdrawalMode: getWalletRates().withdrawalMode,
              withdrawalToken: getWalletRates().withdrawalToken,
            } as any,
          },
        });

        await storage.createActivity({
          userId: withdrawal.userId,
          type: "withdrawal_approved",
          description: `Withdrawal of ${withdrawAmount.toLocaleString()} XNRT approved${
            onChainTxHash ? ` – tx: ${onChainTxHash}` : ""
          }`,
        });

        res.json({
          message: "Withdrawal approved successfully",
          onChainTxHash: onChainTxHash ?? null,
          explorerUrl: onChainTxHash ? getTxExplorerUrl(onChainTxHash) : null,
        });
      } catch (error: any) {
        console.error("Error approving withdrawal:", error);
        res.status(500).json({ message: error?.message || "Failed to approve withdrawal" });
      }
    }
  );

  app.post(
    "/api/admin/withdrawals/:id/reject",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes } = req.body || {};
        const withdrawal = await storage.getTransactionById(id);

        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }
        if (!["pending", "processing"].includes(withdrawal.status)) {
          return res.status(400).json({ message: "Withdrawal already processed" });
        }
        if (withdrawal.status === "processing" && withdrawal.transactionHash) {
          return res.status(400).json({
            message: "Withdrawal already has an on-chain transaction. Approve/finalize it instead of rejecting.",
          });
        }

        const withdrawAmount = Number(withdrawal.amount);
        const sourceBalanceKey = getBalanceSourceKey(withdrawal.source);
        const meta = (withdrawal.verificationData || {}) as Record<string, any>;
        const shouldRefund = meta.reservedBalance === true;

        await prisma.$transaction(async (tx) => {
          if (shouldRefund) {
            await tx.balance.upsert({
              where: { userId: withdrawal.userId },
              create: {
                userId: withdrawal.userId,
                [sourceBalanceKey]: new Prisma.Decimal(withdrawAmount),
              } as any,
              update: {
                [sourceBalanceKey]: { increment: new Prisma.Decimal(withdrawAmount) },
              } as any,
            });
          }

          await tx.transaction.update({
            where: { id },
            data: {
              status: "rejected",
              adminNotes: notes ?? withdrawal.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
              verificationData: {
                ...(meta as any),
                refundedReservedBalance: shouldRefund,
                rejectedAt: new Date().toISOString(),
                rejectedBy: req.authUser!.id,
              } as any,
            },
          });
        });

        await storage.createActivity({
          userId: withdrawal.userId,
          type: "withdrawal_rejected",
          description: `Withdrawal of ${withdrawAmount.toLocaleString()} XNRT rejected${
            shouldRefund ? " and reserved balance refunded" : ""
          }${notes ? ` - ${notes}` : ""}`,
        });

        res.json({ message: "Withdrawal rejected", refunded: shouldRefund });
      } catch (error: any) {
        console.error("Error rejecting withdrawal:", error);
        res.status(500).json({ message: error?.message || "Failed to reject withdrawal" });
      }
    }
  );
}
