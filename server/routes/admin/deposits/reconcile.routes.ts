import type { Express } from "express";
import type { RouteContext } from "../../../routes";

export function registerAdminDepositReconcileRoutes(app: Express, ctx: RouteContext) {
  const { storage, requireAuth, requireAdmin, validateCSRF } = ctx;

  app.post(
    "/api/admin/reconcile-referrals",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (_req, res) => {
      try {
        console.log("[RECONCILE] Starting referral commission reconciliation...");

        const approvedDeposits = await storage.raw(`
          SELECT id, "userId", amount, "createdAt"
          FROM "Transaction"
          WHERE type = 'deposit' AND status = 'approved'
          ORDER BY "createdAt" ASC
        `);

        console.log(`[RECONCILE] Found ${approvedDeposits.length} approved deposits to process`);

        await storage.raw(`DELETE FROM "ReferralCommission"`);
        await storage.raw(`UPDATE "Referral" SET "totalCommission" = 0`);
        await storage.raw(`UPDATE "Balance" SET "referralBalance" = 0`);

        let totalProcessed = 0;
        for (const deposit of approvedDeposits) {
          const amount = Number(deposit.amount);
          await storage.distributeReferralCommissions(deposit.userId, amount, `tx:${deposit.id}`, {
            creditTotalEarned: false,
          });
          totalProcessed += 1;
        }

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
