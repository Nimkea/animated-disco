import type { Express } from "express";
import type { RouteContext } from "../../../routes";
import { appendTransactionAuditTrail, recordAdminAuditLog } from "../../../services/audit.service";

function isFinalDepositStatus(status: string) {
  return status === "approved" || status === "rejected";
}

async function sendDepositApprovedSideEffects(
  ctx: RouteContext,
  userId: string,
  amount: string,
  transactionId: string
) {
  const { storage, notifyUser } = ctx;
  const parsedAmount = Number(amount);

  await storage.distributeReferralCommissions(userId, parsedAmount, `tx:${transactionId}`);

  await storage.createActivity({
    userId,
    type: "deposit_approved",
    description: `Deposit of ${parsedAmount.toLocaleString()} XNRT approved`,
  });

  void notifyUser(userId, {
    type: "deposit_approved",
    title: "💰 Deposit Approved!",
    message: `Your deposit of ${parsedAmount.toLocaleString()} XNRT has been approved and credited to your account`,
    url: "/wallet",
    metadata: { amount, transactionId },
  }).catch((err) => {
    console.error("Error sending deposit notification (non-blocking):", err);
  });
}

export function registerAdminDepositPendingRoutes(app: Express, ctx: RouteContext) {
  const {
    storage,
    prisma,
    requireAuth,
    requireAdmin,
    validateCSRF,
    Prisma,
    verifyBscUsdtDeposit,
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
          minAmount: deposit.usdtAmount ? Number(deposit.usdtAmount) : undefined,
          requiredConf: Number.parseInt(process.env.BSC_CONFIRMATIONS ?? "12", 10),
        });

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
        if (isFinalDepositStatus(deposit.status)) {
          return res.status(400).json({ message: "Deposit already processed" });
        }

        const forceApprove = force === true;
        if (!deposit.verified && !forceApprove) {
          await recordAdminAuditLog({
            req,
            targetUserId: deposit.userId,
            entityType: "deposit",
            entityId: id,
            action: "deposit_approve_blocked_unverified",
            status: "blocked",
            summary: `Blocked unverified deposit approval for ${deposit.amount} XNRT`,
            metadata: { transactionHash: deposit.transactionHash || null },
          });
          return res.status(409).json({
            message: "Deposit is not verified on-chain. Re-run verification or submit with force approval.",
            requiresForce: true,
          });
        }

        const override = !deposit.verified || forceApprove;
        await prisma.$transaction(async (tx) => {
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

          await tx.transaction.update({
            where: { id },
            data: {
              status: "approved",
              adminNotes: notes ?? deposit.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
              verificationData: appendTransactionAuditTrail((deposit.verificationData || {}) as any, {
                action: "deposit_approved",
                adminUserId: req.authUser!.id,
                forceApproved: override,
                verified: deposit.verified,
                notes: notes ?? null,
              }) as any,
            },
          });

          if (override) {
            await tx.activity.create({
              data: {
                userId: req.authUser!.id,
                type: "ADMIN_DEPOSIT_OVERRIDE",
                description: `Force-approved deposit ${id} for user ${deposit.userId} (scanner: ${deposit.verified ? "verified" : "failed/unverified"})`,
              },
            });
          }
        });

        await recordAdminAuditLog({
          req,
          targetUserId: deposit.userId,
          entityType: "deposit",
          entityId: id,
          action: override ? "deposit_force_approved" : "deposit_approved",
          summary: `${override ? "Force-approved" : "Approved"} deposit of ${deposit.amount} XNRT`,
          metadata: { transactionHash: deposit.transactionHash || null, verified: deposit.verified, notes: notes ?? null },
        });

        await sendDepositApprovedSideEffects(ctx, deposit.userId, deposit.amount, id);
        res.json({ ok: true, override });
      } catch (error) {
        console.error("Error approving deposit:", error);
        return res.status(500).json({ message: "Failed to approve deposit" });
      }
    }
  );

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
        if (isFinalDepositStatus(deposit.status)) {
          return res.status(400).json({ message: "Deposit already processed" });
        }

        await storage.updateTransaction(id, {
          status: "rejected",
          adminNotes: notes ?? deposit.adminNotes,
        });

        await recordAdminAuditLog({
          req,
          targetUserId: deposit.userId,
          entityType: "deposit",
          entityId: id,
          action: "deposit_rejected",
          summary: `Rejected deposit of ${deposit.amount} XNRT`,
          metadata: { notes: notes ?? null, transactionHash: deposit.transactionHash || null },
        });

        await storage.createActivity({
          userId: deposit.userId,
          type: "deposit_rejected",
          description: `Deposit of ${Number(deposit.amount).toLocaleString()} XNRT rejected${notes ? ` - ${notes}` : ""}`,
        });

        res.json({ message: "Deposit rejected" });
      } catch (error) {
        console.error("Error rejecting deposit:", error);
        res.status(500).json({ message: "Failed to reject deposit" });
      }
    }
  );

  app.post(
    "/api/admin/deposits/bulk-approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { depositIds, notes, force } = req.body;
        if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
          return res.status(400).json({ message: "Invalid deposit IDs" });
        }

        const successful: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        const errors: string[] = [];

        for (const id of depositIds) {
          try {
            const deposit = await storage.getTransactionById(id);
            if (!deposit || deposit.type !== "deposit") throw new Error(`Deposit ${id} not found`);
            if (isFinalDepositStatus(deposit.status)) throw new Error(`Deposit ${id} already processed`);

            const forceApprove = force === true;
            if (!deposit.verified && !forceApprove) {
              throw new Error(`Deposit ${id} is unverified and requires force approval`);
            }
            const override = !deposit.verified || forceApprove;

            await prisma.$transaction(async (tx) => {
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

              await tx.transaction.update({
                where: { id },
                data: {
                  status: "approved",
                  adminNotes: notes ?? deposit.adminNotes,
                  approvedBy: req.authUser!.id,
                  approvedAt: new Date(),
                  verificationData: appendTransactionAuditTrail((deposit.verificationData || {}) as any, {
                    action: "deposit_bulk_approved",
                    adminUserId: req.authUser!.id,
                    forceApproved: override,
                    verified: deposit.verified,
                    notes: notes ?? null,
                  }) as any,
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

            await recordAdminAuditLog({
              req,
              targetUserId: deposit.userId,
              entityType: "deposit",
              entityId: id,
              action: override ? "deposit_force_approved_bulk" : "deposit_approved_bulk",
              summary: `${override ? "Force-approved" : "Approved"} deposit of ${deposit.amount} XNRT via bulk action`,
              metadata: { transactionHash: deposit.transactionHash || null, verified: deposit.verified, notes: notes ?? null },
            });

            await sendDepositApprovedSideEffects(ctx, deposit.userId, deposit.amount, id);
            successful.push(id);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
            if (!deposit || deposit.type !== "deposit") throw new Error(`Deposit ${id} not found`);
            if (isFinalDepositStatus(deposit.status)) throw new Error(`Deposit ${id} already processed`);

            await storage.updateTransaction(id, {
              status: "rejected",
              adminNotes: notes || deposit.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
            });

            await recordAdminAuditLog({
              req,
              targetUserId: deposit.userId,
              entityType: "deposit",
              entityId: id,
              action: "deposit_rejected_bulk",
              summary: `Rejected deposit of ${deposit.amount} XNRT via bulk action`,
              metadata: { notes: notes ?? null, transactionHash: deposit.transactionHash || null },
            });

            await storage.createActivity({
              userId: deposit.userId,
              type: "deposit_rejected",
              description: `Deposit of ${Number(deposit.amount).toLocaleString()} XNRT rejected${notes ? ` - ${notes}` : ""}`,
            });

            successful.push(id);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
}
