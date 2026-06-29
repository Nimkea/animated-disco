import type { Express } from "express";
import type { RouteContext } from "../routes";

export function registerAdminRoutes(app: Express, ctx: RouteContext) {
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
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allDeposits = await storage.getAllTransactions("deposit");
      const allWithdrawals = await storage.getAllTransactions("withdrawal");
      const activeStakes = await storage.getAllActiveStakes();

      const pendingDeposits = allDeposits.filter(
        (d) => d.status === "pending"
      );
      const pendingWithdrawals = allWithdrawals.filter(
        (w) => w.status === "pending"
      );

      const totalDeposits = allDeposits
        .filter((d) => d.status === "approved")
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const totalWithdrawals = allWithdrawals
        .filter((w) => w.status === "approved")
        .reduce((sum, w) => sum + parseFloat(w.amount), 0);

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const todayDeposits = allDeposits
        .filter(
          (d) =>
            d.status === "approved" &&
            d.createdAt &&
            new Date(d.createdAt) >= today
        )
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);

      const todayWithdrawals = allWithdrawals
        .filter(
          (w) =>
            w.status === "approved" &&
            w.createdAt &&
            new Date(w.createdAt) >= today
        )
        .reduce((sum, w) => sum + parseFloat(w.amount), 0);

      const todayNewUsers = allUsers.filter(
        (u) => u.createdAt && new Date(u.createdAt) >= today
      ).length;

      const activeStakesCount = activeStakes.length;

      res.json({
        totalUsers: allUsers.length,
        totalDeposits: totalDeposits.toString(),
        totalWithdrawals: totalWithdrawals.toString(),
        pendingDepositsCount: pendingDeposits.length,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        todayDeposits: todayDeposits.toString(),
        todayWithdrawals: todayWithdrawals.toString(),
        todayNewUsers,
        activeStakesCount,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get(
    "/api/admin/deposits/pending",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const pendingDeposits = await storage.getPendingTransactions("deposit");
        res.json(pendingDeposits);
      } catch (error) {
        console.error("Error fetching pending deposits:", error);
        res.status(500).json({ message: "Failed to fetch pending deposits" });
      }
    }
  );

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

  // Verify deposit on-chain (admin)
  app.post(
    "/api/admin/deposits/:id/verify",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const deposit = await storage.getTransactionById(id);

        if (!deposit || deposit.type !== "deposit") {
          return res.status(404).json({ message: "Deposit not found" });
        }
        if (!deposit.transactionHash) {
          return res.status(400).json({ message: "No transaction hash provided" });
        }

        const result = await verifyBscUsdtDeposit({
          txHash: deposit.transactionHash,
          expectedTo: deposit.walletAddress || process.env.XNRT_WALLET!,
          minAmount: deposit.usdtAmount
            ? parseFloat(deposit.usdtAmount)
            : undefined,
          requiredConf: parseInt(
            process.env.BSC_CONFIRMATIONS ?? "12",
            10
          ),
        });

        // persist verification state; admin UI can decide next step
        await prisma.transaction.update({
          where: { id },
          data: {
            verified: !!result.verified,
            confirmations: result.confirmations ?? 0,
            verificationData: {
              verifiedAt: new Date().toISOString(),
              reason: result.reason || null,
              amountOnChain: result.amountOnChain ?? null,
            } as any,
          },
        });

        res.json(result);
      } catch (error) {
        console.error("Error verifying deposit:", error);
        res.status(500).json({ message: "Failed to verify deposit" });
      }
    }
  );

  // Approve deposit (admin) – allows overriding failed/unverified as long as not already approved/rejected
  app.post(
    "/api/admin/deposits/:id/approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes, force } = req.body;
        const deposit = await storage.getTransactionById(id);

        if (!deposit || deposit.type !== "deposit") {
          return res.status(404).json({ message: "Deposit not found" });
        }

        // Only block if already approved or rejected
        if (
          deposit.status === "approved" ||
          deposit.status === "rejected"
        ) {
          return res.status(400).json({ message: "Deposit already processed" });
        }

        // Scanner bypass – if not verified OR admin explicitly forces
        const override = !deposit.verified || !!force;

        await prisma.$transaction(async (tx) => {
          // Credit user balance
          await tx.balance.upsert({
            where: { userId: deposit.userId },
            create: {
              userId: deposit.userId,
              xnrtBalance: new Prisma.Decimal(deposit.amount),
              totalEarned: new Prisma.Decimal(deposit.amount),
            },
            update: {
              xnrtBalance: { increment: new Prisma.Decimal(deposit.amount) },
              totalEarned: { increment: new Prisma.Decimal(deposit.amount) },
            },
          });

          // Mark transaction approved
          await tx.transaction.update({
            where: { id },
            data: {
              status: "approved",
              adminNotes: notes ?? deposit.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
              verificationData: deposit.verificationData as any,
            },
          });

          if (override) {
            await tx.activity.create({
              data: {
                userId: req.authUser!.id,
                type: "ADMIN_DEPOSIT_OVERRIDE",
                description: `Force-approved deposit ${id} for user ${deposit.userId} (scanner: ${
                  deposit.verified ? "verified" : "failed/unverified"
                })`,
              },
            });
          }
        });

        // Referral commissions + activity + notification
        await storage.distributeReferralCommissions(
          deposit.userId,
          parseFloat(deposit.amount),
          `tx:${id}`
        );

        await storage.createActivity({
          userId: deposit.userId,
          type: "deposit_approved",
          description: `Deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT approved`,
        });

        void notifyUser(deposit.userId, {
          type: "deposit_approved",
          title: "💰 Deposit Approved!",
          message: `Your deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT has been approved and credited to your account`,
          url: "/wallet",
          metadata: { amount: deposit.amount, transactionId: id },
        }).catch((err) => {
          console.error(
            "Error sending deposit notification (non-blocking):",
            err
          );
        });

        res.json({ ok: true, override });
      } catch (error) {
        console.error("Error approving deposit:", error);
        return res.status(500).json({ message: "Failed to approve deposit" });
      }
    }
  );

  // Reject deposit (admin) – also works for failed/unverified, blocks only approved/rejected
  app.post(
    "/api/admin/deposits/:id/reject",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes } = req.body;
        const deposit = await storage.getTransactionById(id);

        if (!deposit || deposit.type !== "deposit") {
          return res.status(404).json({ message: "Deposit not found" });
        }

        if (
          deposit.status === "approved" ||
          deposit.status === "rejected"
        ) {
          return res.status(400).json({ message: "Deposit already processed" });
        }

        await storage.updateTransaction(id, {
          status: "rejected",
          adminNotes: notes ?? deposit.adminNotes,
        });

        await storage.createActivity({
          userId: deposit.userId,
          type: "deposit_rejected",
          description: `Deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT rejected${
            notes ? ` - ${notes}` : ""
          }`,
        });

        res.json({ message: "Deposit rejected" });
      } catch (error) {
        console.error("Error rejecting deposit:", error);
        res.status(500).json({ message: "Failed to reject deposit" });
      }
    }
  );

  // Bulk approve deposits – same override logic, skip already approved/rejected
  app.post(
    "/api/admin/deposits/bulk-approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { depositIds, notes } = req.body;

        if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
          return res.status(400).json({ message: "Invalid deposit IDs" });
        }

        const successful: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        const errors: string[] = [];

        for (const id of depositIds) {
          try {
            const deposit = await storage.getTransactionById(id);

            if (!deposit || deposit.type !== "deposit") {
              throw new Error(`Deposit ${id} not found`);
            }
            if (
              deposit.status === "approved" ||
              deposit.status === "rejected"
            ) {
              throw new Error(`Deposit ${id} already processed`);
            }

            const override = !deposit.verified;

            await prisma.$transaction(async (tx) => {
              await tx.balance.upsert({
                where: { userId: deposit.userId },
                create: {
                  userId: deposit.userId,
                  xnrtBalance: new Prisma.Decimal(deposit.amount),
                  totalEarned: new Prisma.Decimal(deposit.amount),
                },
                update: {
                  xnrtBalance: {
                    increment: new Prisma.Decimal(deposit.amount),
                  },
                  totalEarned: {
                    increment: new Prisma.Decimal(deposit.amount),
                  },
                },
              });

              await tx.transaction.update({
                where: { id },
                data: {
                  status: "approved",
                  adminNotes: notes ?? deposit.adminNotes,
                  approvedBy: req.authUser!.id,
                  approvedAt: new Date(),
                },
              });

              if (override) {
                await tx.activity.create({
                  data: {
                    userId: req.authUser!.id,
                    type: "ADMIN_DEPOSIT_OVERRIDE",
                    description: `Force-approved deposit ${id} for user ${deposit.userId} via bulk`,
                  },
                });
              }
            });

            await storage.distributeReferralCommissions(
              deposit.userId,
              parseFloat(deposit.amount),
              `tx:${id}`
            );

            await storage.createActivity({
              userId: deposit.userId,
              type: "deposit_approved",
              description: `Deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT approved${
                notes ? ` - ${notes}` : ""
              }`,
            });

            void notifyUser(deposit.userId, {
              type: "deposit_approved",
              title: "💰 Deposit Approved!",
              message: `Your deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT has been approved and credited to your account`,
              url: "/wallet",
              metadata: { amount: deposit.amount, transactionId: id },
            }).catch((err) => {
              console.error(
                "Error sending bulk deposit notification (non-blocking):",
                err
              );
            });

            successful.push(id);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            failed.push({ id, error: errorMessage });
            errors.push(`${id}: ${errorMessage}`);
          }
        }

        res.json({
          approved: successful.length,
          failed: failed.length,
          total: depositIds.length,
          successful,
          failures: failed,
          errors,
        });
      } catch (error) {
        console.error("Error bulk approving deposits:", error);
        res.status(500).json({ message: "Failed to process bulk approval" });
      }
    }
  );

  // Bulk reject deposits – allow rejecting pending/failed/unverified, block only approved/rejected
  app.post(
    "/api/admin/deposits/bulk-reject",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { depositIds, notes } = req.body;

        if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
          return res.status(400).json({ message: "Invalid deposit IDs" });
        }

        const successful: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        const errors: string[] = [];

        for (const id of depositIds) {
          try {
            const deposit = await storage.getTransactionById(id);

            if (!deposit || deposit.type !== "deposit") {
              throw new Error(`Deposit ${id} not found`);
            }
            if (
              deposit.status === "approved" ||
              deposit.status === "rejected"
            ) {
              throw new Error(`Deposit ${id} already processed`);
            }

            await storage.updateTransaction(id, {
              status: "rejected",
              adminNotes: notes || deposit.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
            });

            await storage.createActivity({
              userId: deposit.userId,
              type: "deposit_rejected",
              description: `Deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT rejected${
                notes ? ` - ${notes}` : ""
              }`,
            });

            successful.push(id);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            failed.push({ id, error: errorMessage });
            errors.push(`${id}: ${errorMessage}`);
          }
        }

        res.json({
          rejected: successful.length,
          failed: failed.length,
          total: depositIds.length,
          successful,
          failures: failed,
          errors,
        });
      } catch (error) {
        console.error("Error bulk rejecting deposits:", error);
        res.status(500).json({ message: "Failed to process bulk rejection" });
      }
    }
  );

  // Unmatched Deposits Admin API
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
        res
          .status(500)
          .json({ message: "Failed to fetch unmatched deposits" });
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

        const unmatchedDeposit = await prisma.unmatchedDeposit.findUnique({
          where: { id },
        });
        if (!unmatchedDeposit) {
          return res
            .status(404)
            .json({ message: "Unmatched deposit not found" });
        }
        if ((unmatchedDeposit as any).resolved) {
          return res
            .status(400)
            .json({ message: "Deposit already matched" });
        }

        const usdtAmount = parseFloat(unmatchedDeposit.amount.toString());
        const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
        const platformFeeBps = parseFloat(process.env.PLATFORM_FEE_BPS || "0");
        const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * xnrtRate;

        const txHash =
          (unmatchedDeposit as any).txHash ??
          (unmatchedDeposit as any).transactionHash;

        await prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              userId,
              type: "deposit",
              amount: new Prisma.Decimal(xnrtAmount),
              usdtAmount: new Prisma.Decimal(usdtAmount),
              transactionHash: txHash,
              walletAddress: unmatchedDeposit.fromAddress,
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
            data: { resolved: true } as any,
          });
        });

        // Referral commissions + activity for matched deposit
        await storage.distributeReferralCommissions(
          userId,
          xnrtAmount,
          `unmatched:${id}`
        );
        await storage.createActivity({
          userId,
          type: "deposit_approved",
          description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via manual match`,
        });

        res.json({
          message: "Deposit matched and credited successfully",
        });
      } catch (error) {
        console.error("Error matching deposit:", error);
        res.status(500).json({ message: "Failed to match deposit" });
      }
    }
  );

  // Deposit Reports Admin API
  app.get(
    "/api/admin/deposit-reports",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const reports = await prisma.depositReport.findMany({
          where: { status: "pending" },
          include: { user: { select: { email: true, username: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        res.json(reports);
      } catch (error) {
        console.error("Error fetching deposit reports:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch deposit reports" });
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

        const report = await prisma.depositReport.findUnique({
          where: { id },
        });
        if (!report) {
          return res.status(404).json({ message: "Report not found" });
        }
        if (report.status !== "pending") {
          return res
            .status(400)
            .json({ message: "Report already resolved" });
        }

        if (resolution === "approved") {
          const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
          const platformFeeBps = parseFloat(
            process.env.PLATFORM_FEE_BPS || "0"
          );
          const usdtAmount = report.amount
            ? parseFloat(report.amount.toString())
            : 0;
          const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
          const xnrtAmount = netUsdt * xnrtRate;

          await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
              data: {
                userId: report.userId!,
                type: "deposit",
                amount: new Prisma.Decimal(xnrtAmount),
                usdtAmount: new Prisma.Decimal(usdtAmount),
                transactionHash: report.txHash,
                status: "approved",
                adminNotes: adminNotes || "Credited from deposit report",
                approvedBy: req.authUser!.id,
                approvedAt: new Date(),
              },
            });

            await tx.balance.upsert({
              where: { userId: report.userId! },
              create: {
                userId: report.userId!,
                xnrtBalance: new Prisma.Decimal(xnrtAmount),
                totalEarned: new Prisma.Decimal(xnrtAmount),
              },
              update: {
                xnrtBalance: {
                  increment: new Prisma.Decimal(xnrtAmount),
                },
                totalEarned: {
                  increment: new Prisma.Decimal(xnrtAmount),
                },
              },
            });

            await tx.depositReport.update({
              where: { id },
              data: {
                status: "approved",
                resolvedAt: new Date(),
                notes: adminNotes || null,
              },
            });
          });

          // Referral commissions + activity for approved report
          await storage.distributeReferralCommissions(
            report.userId!,
            xnrtAmount,
            `deposit-report:${id}`
          );
          await storage.createActivity({
            userId: report.userId!,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved from deposit report`,
          });
        } else {
          await prisma.depositReport.update({
            where: { id },
            data: {
              status: "rejected",
              resolvedAt: new Date(),
              notes: adminNotes || null,
            },
          });
        }

        res.json({ message: `Report ${resolution} successfully` });
      } catch (error) {
        console.error("Error resolving deposit report:", error);
        res.status(500).json({ message: "Failed to resolve report" });
      }
    }
  );

  // Recalculate all referral commissions from approved deposits
  app.post(
    "/api/admin/reconcile-referrals",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (_req, res) => {
      try {
        console.log(
          "[RECONCILE] Starting referral commission reconciliation..."
        );

        const approvedDeposits = await storage.raw(`
        SELECT id, "userId", amount, "createdAt"
        FROM "Transaction"
        WHERE type = 'deposit' AND status = 'approved'
        ORDER BY "createdAt" ASC
      `);

        console.log(
          `[RECONCILE] Found ${approvedDeposits.length} approved deposits to process`
        );

        await storage.raw(`DELETE FROM "ReferralCommission"`);
        console.log("[RECONCILE] Cleared referral commission ledger only");

        await storage.raw(`UPDATE "Referral" SET "totalCommission" = 0`);
        console.log("[RECONCILE] Preserved referral tree and reset referral totals");

        await storage.raw(`UPDATE "Balance" SET "referralBalance" = 0`);
        console.log("[RECONCILE] Reset referral balances");

        let totalProcessed = 0;
        for (const deposit of approvedDeposits) {
          const amount = parseFloat(deposit.amount);
          console.log(
            `[RECONCILE] Processing deposit ${deposit.id}: ${amount} XNRT for user ${deposit.userId}`
          );
          await storage.distributeReferralCommissions(
            deposit.userId,
            amount,
            `tx:${deposit.id}`,
            { creditTotalEarned: false }
          );
          totalProcessed++;
        }

        console.log(
          `[RECONCILE] Reconciliation complete. Processed ${totalProcessed} deposits.`
        );

        res.json({
          message: "Referral commissions reconciled successfully",
          depositsProcessed: totalProcessed,
        });
      } catch (error) {
        console.error("Error reconciling referrals:", error);
        res.status(500).json({ message: "Failed to reconcile referrals" });
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

  // Admin users list with balances & stats
  app.get(
    "/api/admin/users",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const allUsers = await storage.getAllUsers();

        const usersWithData = await Promise.all(
          allUsers.map(async (user) => {
            const balance = await storage.getBalance(user.id);
            const stakes = await storage.getStakes(user.id);
            const referrals = await storage.getReferralsByReferrer(user.id);
            const transactions = await storage.getTransactionsByUser(
              user.id
            );

            const activeStakes = stakes.filter(
              (s) => s.status === "active"
            ).length;
            const totalStaked = stakes
              .filter((s) => s.status === "active")
              .reduce((sum, s) => sum + parseFloat(s.amount), 0);

            const depositCount = transactions.filter(
              (t) => t.type === "deposit" && t.status === "approved"
            ).length;
            const withdrawalCount = transactions.filter(
              (t) => t.type === "withdrawal" && t.status === "approved"
            ).length;

            return {
              id: user.id,
              email: user.email,
              username: user.username,
              referralCode: user.referralCode,
              isAdmin: user.isAdmin,
              xp: user.xp,
              level: user.level,
              streak: user.streak,
              createdAt: user.createdAt,
              balance: balance
                ? {
                    xnrtBalance: balance.xnrtBalance,
                    stakingBalance: balance.stakingBalance,
                    miningBalance: balance.miningBalance,
                    referralBalance: balance.referralBalance,
                    totalEarned: balance.totalEarned,
                  }
                : null,
              stats: {
                activeStakes,
                totalStaked: totalStaked.toString(),
                referralsCount: referrals.length,
                depositCount,
                withdrawalCount,
              },
            };
          })
        );

        res.json(usersWithData);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // Admin Analytics
  app.get(
    "/api/admin/analytics",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const allTransactions = await storage.getAllTransactions();
        const allUsers = await storage.getAllUsers();
        const allStakes = await storage.getAllActiveStakes();

        const dailyData: Record<
          string,
          { deposits: number; withdrawals: number; revenue: number }
        > = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        allTransactions.forEach((tx) => {
          if (tx.createdAt) {
            const txDate = new Date(tx.createdAt);
            if (txDate >= thirtyDaysAgo) {
              const dateKey = txDate.toISOString().split("T")[0];
              if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                  deposits: 0,
                  withdrawals: 0,
                  revenue: 0,
                };
              }

              if (tx.type === "deposit" && tx.status === "approved") {
                dailyData[dateKey].deposits += parseFloat(tx.amount);
              } else if (
                tx.type === "withdrawal" &&
                tx.status === "approved"
              ) {
                dailyData[dateKey].withdrawals += parseFloat(tx.amount);
                dailyData[dateKey].revenue +=
                  parseFloat(tx.amount) * 0.02; // 2% fee
              }
            }
          }
        });

        const dailyUsers: Record<string, number> = {};
        allUsers.forEach((user) => {
          if (user.createdAt) {
            const userDate = new Date(user.createdAt);
            if (userDate >= thirtyDaysAgo) {
              const dateKey = userDate.toISOString().split("T")[0];
              dailyUsers[dateKey] = (dailyUsers[dateKey] || 0) + 1;
            }
          }
        });

        const stakingTiers = {
          "Royal Sapphire": 0,
          "Legendary Emerald": 0,
          "Imperial Platinum": 0,
          "Mythic Diamond": 0,
        };

        allStakes.forEach((stake) => {
          const amount = parseFloat(stake.amount);
          if (amount >= 100000) stakingTiers["Mythic Diamond"]++;
          else if (amount >= 50000) stakingTiers["Imperial Platinum"]++;
          else if (amount >= 10000) stakingTiers["Legendary Emerald"]++;
          else stakingTiers["Royal Sapphire"]++;
        });

        const [balancesAgg, referralsAgg] = await Promise.all([
          prisma.balance.aggregate({
            _sum: { referralBalance: true },
          }),
          prisma.referral.groupBy({
            by: ["referrerId"],
            _count: { referrerId: true },
          }),
        ]);

        const totalReferralBalance = balancesAgg._sum.referralBalance || 0;
        const activeReferrers = referralsAgg.length;
        const totalReferrals = referralsAgg.reduce(
          (sum, r) => sum + (r._count.referrerId || 0),
          0
        );

        const referralStats = {
          totalCommissions: Number(totalReferralBalance),
          totalReferrals,
          activeReferrers,
        };

        const totalRevenue = Object.values(dailyData).reduce(
          (sum, day) => sum + day.revenue,
          0
        );

        res.json({
          dailyTransactions: Object.entries(dailyData)
            .map(([date, data]) => ({
              date,
              deposits: data.deposits,
              withdrawals: data.withdrawals,
              revenue: data.revenue,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          userGrowth: Object.entries(dailyUsers)
            .map(([date, count]) => ({ date, newUsers: count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          stakingTiers,
          referralStats,
          totalRevenue,
          totalUsers: allUsers.length,
          totalStakes: allStakes.length,
        });
      } catch (error) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );

  // Admin Real-time Analytics
  app.get(
    "/api/admin/analytics/realtime",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const activeUsers = await prisma.activity.groupBy({
          by: ["userId"],
          where: { createdAt: { gte: fifteenMinutesAgo } },
        });

        const todayDeposits = await prisma.transaction.aggregate({
          where: {
            type: "deposit",
            status: "approved",
            createdAt: { gte: startOfToday },
          },
          _count: true,
          _sum: { amount: true },
        });

        const todayWithdrawals = await prisma.transaction.aggregate({
          where: {
            type: "withdrawal",
            status: "approved",
            createdAt: { gte: startOfToday },
          },
          _count: true,
          _sum: { amount: true },
        });

        const [pendingDeposits, pendingWithdrawals] = await Promise.all([
          prisma.transaction.count({
            where: { type: "deposit", status: "pending" },
          }),
          prisma.transaction.count({
            where: { type: "withdrawal", status: "pending" },
          }),
        ]);

        res.json({
          activeUsers: activeUsers.length,
          todayDeposits: {
            count: todayDeposits._count,
            total: Number(todayDeposits._sum.amount || 0),
          },
          todayWithdrawals: {
            count: todayWithdrawals._count,
            total: Number(todayWithdrawals._sum.amount || 0),
          },
          pendingTransactions: {
            deposits: pendingDeposits,
            withdrawals: pendingWithdrawals,
            total: pendingDeposits + pendingWithdrawals,
          },
        });
      } catch (error) {
        console.error("Error fetching real-time analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch real-time analytics" });
      }
    }
  );

  // Admin Analytics Export
  app.get(
    "/api/admin/analytics/export",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const format = (req.query.format as string) || "csv";

        const allTransactions = await storage.getAllTransactions();
        const allUsers = await storage.getAllUsers();
        const allStakes = await storage.getAllActiveStakes();

        const dailyData: Record<
          string,
          { deposits: number; withdrawals: number; revenue: number }
        > = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        allTransactions.forEach((tx) => {
          if (tx.createdAt) {
            const txDate = new Date(tx.createdAt);
            if (txDate >= thirtyDaysAgo) {
              const dateKey = txDate.toISOString().split("T")[0];
              if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                  deposits: 0,
                  withdrawals: 0,
                  revenue: 0,
                };
              }

              if (tx.type === "deposit" && tx.status === "approved") {
                dailyData[dateKey].deposits += parseFloat(tx.amount);
              } else if (
                tx.type === "withdrawal" &&
                tx.status === "approved"
              ) {
                dailyData[dateKey].withdrawals += parseFloat(tx.amount);
                dailyData[dateKey].revenue +=
                  parseFloat(tx.amount) * 0.02;
              }
            }
          }
        });

        const totalRevenue = Object.values(dailyData).reduce(
          (sum, day) => sum + day.revenue,
          0
        );

        if (format === "csv") {
          let csv = "Date,Deposits (XNRT),Withdrawals (XNRT),Revenue (XNRT)\n";
          Object.entries(dailyData)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([date, data]) => {
              csv += `${date},${data.deposits},${data.withdrawals},${data.revenue}\n`;
            });

          csv += `\nSummary\n`;
          csv += `Total Users,${allUsers.length}\n`;
          csv += `Total Active Stakes,${allStakes.length}\n`;
          csv += `Total Revenue (30 days),${totalRevenue}\n`;

          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=xnrt-analytics-${
              new Date().toISOString().split("T")[0]
            }.csv`
          );
          res.send(csv);
        } else {
          const jsonData = {
            exportDate: new Date().toISOString(),
            summary: {
              totalUsers: allUsers.length,
              totalActiveStakes: allStakes.length,
              totalRevenue30Days: totalRevenue,
            },
            dailyTransactions: Object.entries(dailyData)
              .map(([date, data]) => ({
                date,
                deposits: data.deposits,
                withdrawals: data.withdrawals,
                revenue: data.revenue,
              }))
              .sort((a, b) => a.date.localeCompare(b.date)),
          };

          res.setHeader("Content-Type", "application/json");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=xnrt-analytics-${
              new Date().toISOString().split("T")[0]
            }.json`
          );
          res.json(jsonData);
        }
      } catch (error) {
        console.error("Error exporting analytics:", error);
        res.status(500).json({ message: "Failed to export analytics" });
      }
    }
  );

  // Admin Activity Logs
  app.get(
    "/api/admin/activities",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;

        const adminUsers = await prisma.user.findMany({
          where: { isAdmin: true },
          select: { id: true },
        });
        const adminUserIds = adminUsers.map((u) => u.id);

        const activities = await prisma.activity.findMany({
          where: {
            OR: [
              { userId: { in: adminUserIds } },
              {
                type: {
                  in: [
                    "deposit_approved",
                    "deposit_rejected",
                    "withdrawal_approved",
                    "withdrawal_rejected",
                  ],
                },
              },
            ],
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                isAdmin: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        res.json(activities);
      } catch (error) {
        console.error("Error fetching admin activities:", error);
        res.status(500).json({ message: "Failed to fetch admin activities" });
      }
    }
  );

  // Platform Info
  app.get(
    "/api/admin/info",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const [
          totalUsers,
          totalDeposits,
          totalWithdrawals,
          totalStakes,
          totalActivities,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.transaction.count({ where: { type: "deposit" } }),
          prisma.transaction.count({ where: { type: "withdrawal" } }),
          prisma.stake.count(),
          prisma.activity.count(),
        ]);

        const stakingTiers = [
          {
            name: "Royal Sapphire",
            min: 50000,
            max: 1000000,
            apy: 402,
            duration: 15,
          },
          {
            name: "Legendary Emerald",
            min: 10000,
            max: 10000000,
            apy: 511,
            duration: 30,
          },
          {
            name: "Imperial Platinum",
            min: 5000,
            max: 10000000,
            apy: 547,
            duration: 47,
          },
          {
            name: "Mythic Diamond",
            min: 100,
            max: 10000000,
            apy: 730,
            duration: 90,
          },
        ];

        res.json({
          platform: {
            name: "XNRT",
            version: "1.0.0",
            environment: process.env.NODE_ENV || "development",
          },
          statistics: {
            totalUsers,
            totalDeposits,
            totalWithdrawals,
            totalStakes,
            totalActivities,
          },
          configuration: {
            stakingTiers,
            depositRate: 100,
            withdrawalFee: 2,
            // 🔐 now reading from env, with your old address as fallback
            companyWallet:
              process.env.XNRT_WALLET ??
              "0x715C32deC9534d2fB34e0B567288AF8d895efB59",
          },
        });
      } catch (error) {
        console.error("Error fetching platform info:", error);
        res.status(500).json({ message: "Failed to fetch platform info" });
      }
    }
  );

  // ===== ANNOUNCEMENTS =====
  app.get("/api/announcements", async (_req, res) => {
    try {
      const now = new Date();
      const announcements = await prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.get(
    "/api/admin/announcements",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const announcements = await prisma.announcement.findMany({
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        res.json(announcements);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch announcements" });
      }
    }
  );

  app.post(
    "/api/admin/announcements",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const validationResult = insertAnnouncementSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationResult.error.issues,
          });
        }

        const { title, content, type, isActive, expiresAt } =
          validationResult.data;

        const announcement = await prisma.announcement.create({
          data: {
            title,
            content,
            type: type || "info",
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.authUser!.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
        });

        res.status(201).json(announcement);
      } catch (error) {
        console.error("Error creating announcement:", error);
        res
          .status(500)
          .json({ message: "Failed to create announcement" });
      }
    }
  );

  app.put(
    "/api/admin/announcements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;

        const partialSchema = insertAnnouncementSchema.partial();
        const validationResult = partialSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationResult.error.issues,
          });
        }

        const { title, content, type, isActive, expiresAt } =
          validationResult.data;

        const announcement = await prisma.announcement.update({
          where: { id },
          data: {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            ...(type !== undefined && { type }),
            ...(isActive !== undefined && { isActive }),
            ...(expiresAt !== undefined && {
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            }),
          },
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
        });

        res.json(announcement);
      } catch (error: any) {
        console.error("Error updating announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res
          .status(500)
          .json({ message: "Failed to update announcement" });
      }
    }
  );

  app.delete(
    "/api/admin/announcements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.announcement.delete({ where: { id } });
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res
          .status(500)
          .json({ message: "Failed to delete announcement" });
      }
    }
  );
}
