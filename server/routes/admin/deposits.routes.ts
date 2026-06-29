import type { Express } from "express";
import type { RouteContext } from "../../routes";

export function registerAdminDepositRoutes(app: Express, ctx: RouteContext) {
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

}
