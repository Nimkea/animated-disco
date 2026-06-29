import type { Express } from "express";
import type { RouteContext } from "../routes";
import type { StakingTier } from "../../shared/schema";

export function registerEarningRoutes(app: Express, ctx: RouteContext) {
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
  app.get("/api/stakes", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      res.json(stakes);
    } catch (error) {
      console.error("Error fetching stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });

  app.post("/api/stakes", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { tier, amount } = req.body;

      if (!STAKING_TIERS[tier as StakingTier]) {
        return res.status(400).json({ message: "Invalid staking tier" });
      }

      const tierConfig = STAKING_TIERS[tier as StakingTier];
      const stakeAmount = parseFloat(amount);

      if (stakeAmount < tierConfig.minAmount || stakeAmount > tierConfig.maxAmount) {
        return res.status(400).json({
          message: `Stake amount must be between ${tierConfig.minAmount} and ${tierConfig.maxAmount} XNRT`,
        });
      }

      const balance = await storage.getBalance(userId);
      if (!balance || parseFloat(balance.xnrtBalance) < stakeAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + tierConfig.duration * 24 * 60 * 60 * 1000
      );

      const stake = await storage.createStake({
        userId,
        tier,
        amount: amount.toString(),
        dailyRate: tierConfig.dailyRate.toString(),
        duration: tierConfig.duration,
        startDate,
        endDate,
        totalProfit: "0",
        lastProfitDate: null,
        status: "active",
      });

      // Deduct from balance
      await storage.updateBalance(userId, {
        xnrtBalance: (parseFloat(balance.xnrtBalance) - stakeAmount).toString(),
        stakingBalance: (parseFloat(balance.stakingBalance) + stakeAmount).toString(),
      });

      // Log activity
      await storage.createActivity({
        userId,
        type: "stake_created",
        description: `Staked ${stakeAmount.toLocaleString()} XNRT in ${tierConfig.name}`,
      });

      res.json(stake);
    } catch (error) {
      console.error("Error creating stake:", error);
      res.status(500).json({ message: "Failed to create stake" });
    }
  });

  app.post(
    "/api/stakes/process-rewards",
    requireAuth,
    validateCSRF,
    async (_req, res) => {
      try {
        await storage.processStakingRewards();
        res.json({ success: true, message: "Staking rewards processed successfully" });
      } catch (error) {
        console.error("Error processing staking rewards:", error);
        res.status(500).json({ message: "Failed to process staking rewards" });
      }
    }
  );

  app.post(
    "/api/stakes/:id/withdraw",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const stakeId = req.params.id;

        const stake = await storage.getStakeById(stakeId);

        if (!stake) return res.status(404).json({ message: "Stake not found" });
        if (stake.userId !== userId)
          return res.status(403).json({ message: "Unauthorized" });

        if (stake.status !== "completed" && stake.status !== "active") {
          return res.status(400).json({
            message: "Stake has already been withdrawn or is not ready for withdrawal",
          });
        }

        if (new Date(stake.endDate) > new Date()) {
          return res.status(400).json({ message: "Stake has not matured yet" });
        }

        const dailyRate = parseFloat(stake.dailyRate) / 100;
        const startDate = new Date(stake.startDate);
        const endDate = new Date(stake.endDate);
        const totalDurationDays = Math.floor(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const stakeAmount = parseFloat(stake.amount);
        const dailyProfit = stakeAmount * dailyRate;
        const totalProfit = dailyProfit * totalDurationDays;

        const withdrawnStake = await storage.atomicWithdrawStake(
          stakeId,
          totalProfit.toString()
        );
        if (!withdrawnStake)
          return res.status(409).json({ message: "Stake has already been withdrawn" });

        const balance = await storage.getBalance(userId);
        if (!balance) return res.status(404).json({ message: "Balance not found" });

        const totalWithdrawalAmount = stakeAmount + totalProfit;

        await storage.updateBalance(userId, {
          xnrtBalance: (parseFloat(balance.xnrtBalance) + totalWithdrawalAmount).toString(),
          stakingBalance: (parseFloat(balance.stakingBalance) - stakeAmount).toString(),
        });

        const tierConfig = STAKING_TIERS[stake.tier as StakingTier];
        await storage.createActivity({
          userId,
          type: "stake_withdrawn",
          description: `Withdrew ${stakeAmount.toLocaleString()} XNRT + ${totalProfit.toLocaleString()} profit from ${tierConfig.name}`,
        });

        res.json({ success: true, totalAmount: totalWithdrawalAmount, profit: totalProfit });
      } catch (error) {
        console.error("Error withdrawing stake:", error);
        res.status(500).json({ message: "Failed to withdraw stake" });
      }
    }
  );

  // Mining routes
  app.get("/api/mining/current", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      await storage.processMiningRewards(userId);
      const currentSession = await storage.getCurrentMiningSession(userId);
      res.json(currentSession ?? null);
    } catch (error) {
      console.error("Error loading current mining session:", error);
      res.status(500).json({ message: "Failed to load current mining session" });
    }
  });

  app.get("/api/mining/history", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const sessions = await storage.getMiningHistory(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error loading mining history:", error);
      res.status(500).json({ message: "Failed to load mining history" });
    }
  });

  app.post("/api/mining/process-rewards", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const result = await storage.processMiningRewards(userId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error processing mining rewards:", error);
      res.status(500).json({ message: "Failed to process mining rewards" });
    }
  });

  app.post("/api/mining/start", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      await storage.processMiningRewards(userId);

      const currentSession = await storage.getCurrentMiningSession(userId);
      if (currentSession && currentSession.status === "active") {
        return res.status(400).json({ message: "You already have an active mining session" });
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + MINING_SESSION_DURATION_MS);

      const session = await storage.createMiningSession({
        userId,
        baseReward: MINING_SESSION_XP_REWARD,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: MINING_SESSION_XP_REWARD,
        startTime,
        endTime,
        nextAvailable: endTime,
        status: "active",
      });

      res.json({
        ...session,
        reward: {
          xp: MINING_SESSION_XP_REWARD,
          xnrt: MINING_SESSION_XNRT_REWARD,
          durationHours: 24,
        },
      });
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });

}
