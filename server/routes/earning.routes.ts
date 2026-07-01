import type { Express } from "express";
import type { RouteContext } from "../routes";
import type { StakingTier } from "../../shared/schema";
import {
  getCurrentMiningSessionForUser,
  getMiningHistoryForUser,
  processMiningRewardsForUser,
  startMiningSessionForUser,
} from "../services/mining.service";
import {
  createStakeForUser,
  getStakesForUser,
  getStakingSummaryForUser,
  processStakingRewardsForUser,
  StakingServiceError,
  withdrawStakeForUser,
} from "../services/staking.service";
import { recordMissionEvent } from "../services/reward.service";

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
      const stakes = await getStakesForUser(userId);
      res.json(stakes);
    } catch (error) {
      console.error("Error fetching stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });

  app.get("/api/stakes/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const summary = await getStakingSummaryForUser(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching staking summary:", error);
      res.status(500).json({ message: "Failed to fetch staking summary" });
    }
  });

  app.post("/api/stakes", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stake = await createStakeForUser(userId, req.body ?? {});
      await recordMissionEvent(userId, "stake_created", 1);
      res.status(201).json(stake);
    } catch (error: any) {
      const statusCode = error instanceof StakingServiceError ? error.statusCode : 500;
      if (statusCode >= 500) console.error("Error creating stake:", error);
      res.status(statusCode).json({ message: error?.message || "Failed to create stake" });
    }
  });

  app.post("/api/stakes/process-rewards", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const result = await processStakingRewardsForUser(userId);
      res.json(result);
    } catch (error) {
      console.error("Error processing staking rewards:", error);
      res.status(500).json({ message: "Failed to process staking rewards" });
    }
  });

  app.post("/api/stakes/:id/withdraw", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const result = await withdrawStakeForUser(userId, req.params.id);
      res.json(result);
    } catch (error: any) {
      const statusCode = error instanceof StakingServiceError ? error.statusCode : 500;
      if (statusCode >= 500) console.error("Error withdrawing stake:", error);
      res.status(statusCode).json({ message: error?.message || "Failed to withdraw stake" });
    }
  });

  // Mining routes
  app.get("/api/mining/current", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const currentSession = await getCurrentMiningSessionForUser(userId);
      res.json(currentSession ?? null);
    } catch (error) {
      console.error("Error loading current mining session:", error);
      res.status(500).json({ message: "Failed to load current mining session" });
    }
  });

  app.get("/api/mining/history", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const sessions = await getMiningHistoryForUser(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error loading mining history:", error);
      res.status(500).json({ message: "Failed to load mining history" });
    }
  });

  app.post("/api/mining/process-rewards", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const result = await processMiningRewardsForUser(userId);
      if (Number(result?.processedCount || 0) > 0) {
        await recordMissionEvent(userId, "mining_completed", Number(result.processedCount || 1));
      }
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error processing mining rewards:", error);
      res.status(500).json({ message: "Failed to process mining rewards" });
    }
  });

  app.post("/api/mining/start", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const result = await startMiningSessionForUser(userId);

      if (!result.ok) {
        return res.status(result.status).json({ message: result.message });
      }

      await recordMissionEvent(userId, "mining_started", 1);
      res.json(result.session);
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });

}
