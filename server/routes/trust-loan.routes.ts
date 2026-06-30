import type { Express } from "express";
import type { RouteContext } from "../routes";
import type { StakingTier } from "../../shared/schema";

export function registerTrustLoanRoutes(app: Express, ctx: RouteContext) {
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
  /* ------------------------------- TRUST LOAN ------------------------------- */
  // Claim Trust Loan stake
  app.post(
    "/api/trust-loan/claim",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;

        // Prevent duplicate claim: rely on existing stake "tier"
        const existing = await storage.getStakes(userId);
        const already = existing.find(
          (s: any) =>
            s.tier === TRUST_LOAN_CONFIG.programKey &&
            (s.status === "active" || s.status === "completed" || s.status === "withdrawn")
        );
        if (already) {
          return res
            .status(409)
            .json({ message: "Trust Loan already claimed." });
        }

        const { directCount, investingCount } = await getDirectReferralStats(userId);
        if (
          directCount < TRUST_LOAN_CONFIG.requiredReferrals ||
          investingCount < TRUST_LOAN_CONFIG.requiredInvestingReferrals
        ) {
          return res.status(403).json({
            message: `Trust Loan requires ${TRUST_LOAN_CONFIG.requiredReferrals} direct referrals and ${TRUST_LOAN_CONFIG.requiredInvestingReferrals} investing referrals.`,
            directCount,
            investingCount,
            requiredReferrals: TRUST_LOAN_CONFIG.requiredReferrals,
            requiredInvestingReferrals: TRUST_LOAN_CONFIG.requiredInvestingReferrals,
          });
        }

        const tierKey = TRUST_LOAN_CONFIG.programKey;
        const now = new Date();
        const endDate = new Date(
          now.getTime() +
            TRUST_LOAN_CONFIG.durationDays * 24 * 60 * 60 * 1000
        );

        // Create "virtual principal" stake – principal is NOT credited anywhere
        const stake = await storage.createStake({
          userId,
          tier: tierKey,
          amount: String(TRUST_LOAN_CONFIG.amountXnrt),
          duration: TRUST_LOAN_CONFIG.durationDays,
          // You can also move this daily rate into TRUST_LOAN_CONFIG if you prefer
          dailyRate: "1.3",
          startDate: now,
          endDate,
          totalProfit: "0",
          lastProfitDate: null,
          status: "active",
          // Trust Loan specific fields
          isLoan: true,
          loanProgram: tierKey,
          unlockMet: true,
          requiredReferrals: TRUST_LOAN_CONFIG.requiredReferrals,
          requiredInvestingReferrals:
            TRUST_LOAN_CONFIG.requiredInvestingReferrals,
          minInvestUsdtPerReferral: String(
            TRUST_LOAN_CONFIG.minInvestUsdtPerReferral
          ),
        });

        // Profits will be credited over time (e.g. by processStakingRewards)
        // into stakingBalance when unlock conditions are met.

        await storage.createActivity({
          userId,
          type: "trust_loan_claimed",
          description: `Trust Loan claimed: virtual ${TRUST_LOAN_CONFIG.amountXnrt} XNRT principal for ${TRUST_LOAN_CONFIG.durationDays} days (profits only).`,
        });

        return res.json({ ok: true, stake });
      } catch (e) {
        console.error("[trust-loan/claim] error:", e);
        return res
          .status(500)
          .json({ message: "Failed to claim Trust Loan" });
      }
    }
  );

  // Read Trust Loan status
  app.get("/api/trust-loan/status", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      const stakes = await storage.getStakes(userId);
      const loan = stakes.find(
        (s: any) => s.tier === TRUST_LOAN_CONFIG.programKey
      );

      const { directCount, investingCount } =
        await getDirectReferralStats(userId);

      // Use config for required thresholds
      const requiredReferrals = TRUST_LOAN_CONFIG.requiredReferrals;
      const requiredInvestingReferrals =
        TRUST_LOAN_CONFIG.requiredInvestingReferrals;
      const minInvestUsdtPerReferral =
        TRUST_LOAN_CONFIG.minInvestUsdtPerReferral;

      return res.json({
        hasLoanStake: Boolean(loan),
        stake: loan ?? null,
        directCount,
        investingCount,
        requiredReferrals,
        requiredInvestingReferrals,
        minInvestUsdtPerReferral: String(minInvestUsdtPerReferral),
        eligible: directCount >= requiredReferrals && investingCount >= requiredInvestingReferrals,
        program: TRUST_LOAN_CONFIG.programKey,
        amountXnrt: TRUST_LOAN_CONFIG.amountXnrt,
        durationDays: TRUST_LOAN_CONFIG.durationDays,
      });
    } catch (e) {
      console.error("[trust-loan/status] error:", e);
      return res
        .status(500)
        .json({ message: "Failed to get Trust Loan status" });
    }
  });
  /* ----------------------------- end TRUST LOAN ----------------------------- */
}
