// file: server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, generateAnonymizedHandle } from "./storage";
import { requireAuth, requireAdmin, validateCSRF } from "./auth/middleware";
import authRoutes from "./auth/routes";

// Shared schema/types
import {
  STAKING_TIERS,
  type StakingTier,
  insertAnnouncementSchema,
} from "../shared/schema";
import { PrismaClient, Prisma } from "@prisma/client";
import { notifyUser, sendPushNotification } from "./notifications";
import webpush from "web-push";
import rateLimit from "express-rate-limit";
import { verifyBscUsdtDeposit } from "./services/verifyBscUsdt";
import { ethers } from "ethers";
import { deriveDepositAddress } from "./services/hdWallet";
import { mintXNRT, isTokenServiceReady, getTxExplorerUrl } from "./services/tokenService";

export const prisma = new PrismaClient();

/* ─────────────────────── Trust Loan configuration ──────────────────────── */
const TRUST_LOAN_CONFIG = {
  programKey: "trust_loan",
  durationDays: 30,
  amountXnrt: 10000,
  requiredReferrals: 3,
  requiredInvestingReferrals: 2,
  minInvestUsdtPerReferral: 100,
} as const;

/* ----------------------------- Trust Loan helper ---------------------------- */
async function getDirectReferralStats(userId: string) {
  // Count L1 referrals
  const directs = await prisma.referral.findMany({
    where: { referrerId: userId, level: 1 },
    select: { referredUserId: true },
  });
  const directCount = directs.length;
  if (!directCount) return { directCount: 0, investingCount: 0 };

  // Of those L1 referrals, count how many have >= min USDT approved deposits
  const ids = directs.map((d) => d.referredUserId);
  const investingRows = await prisma.transaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: ids },
      type: "deposit",
      status: "approved",
      usdtAmount: {
        gte: new Prisma.Decimal(TRUST_LOAN_CONFIG.minInvestUsdtPerReferral),
      },
    },
    _count: { _all: true },
  });
  const investingCount = investingRows.length;

  return { directCount, investingCount };
}
/* --------------------------- end Trust Loan helper -------------------------- */

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || "")
  .replace(/^"publicKey":"/, "")
  .replace(/"$/, "");
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || "")
  .replace(/^"privateKey":"/, "")
  .replace(/}$/, "")
  .replace(/"$/, "");
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@xnrt.org";

const MINING_BASE_REWARD_XP = 5;
const MINING_XP_TO_XNRT_RATE = 4; // not used here but kept for consistency

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const pushSubscriptionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many subscription requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

/* ------------------------ Default Achievements Seed ------------------------ */

const DEFAULT_ACHIEVEMENTS = [
  // 🟢 Earnings
  {
    title: "Sign-in Bonus",
    description: "Claim your first daily check-in reward",
    icon: "✅",
    category: "streaks",
    requirement: 1, // 1 din ka streak
    xpReward: 5,
  },
  {
    title: "First Earnings",
    description: "Earn a total of 1,000 XNRT from any source",
    icon: "💰",
    category: "earnings",
    requirement: 1000,
    xpReward: 25,
  },
  {
    title: "Rising Earner",
    description: "Earn a total of 5,000 XNRT",
    icon: "📈",
    category: "earnings",
    requirement: 5000,
    xpReward: 75,
  },
  {
    title: "Pro Earner",
    description: "Earn a total of 25,000 XNRT",
    icon: "🏅",
    category: "earnings",
    requirement: 25000,
    xpReward: 150,
  },

  // 🧑‍🤝‍🧑 Referrals
  {
    title: "First Referral",
    description: "Invite your first friend to XNRT",
    icon: "👥",
    category: "referrals",
    requirement: 1,
    xpReward: 25,
  },
  {
    title: "Team Builder",
    description: "Refer 5 direct users",
    icon: "🧱",
    category: "referrals",
    requirement: 5,
    xpReward: 75,
  },
  {
    title: "Community Leader",
    description: "Refer 25 direct users",
    icon: "👑",
    category: "referrals",
    requirement: 25,
    xpReward: 200,
  },

  // 🔥 Streaks
  {
    title: "3-Day Streak",
    description: "Check in 3 days in a row",
    icon: "🔥",
    category: "streaks",
    requirement: 3,
    xpReward: 30,
  },
  {
    title: "Weekly Grinder",
    description: "Maintain a 7-day login streak",
    icon: "📆",
    category: "streaks",
    requirement: 7,
    xpReward: 70,
  },
  {
    title: "Monthly Legend",
    description: "Maintain a 30-day login streak",
    icon: "🏆",
    category: "streaks",
    requirement: 30,
    xpReward: 200,
  },

  // ⛏ Mining
  {
    title: "First Mining Session",
    description: "Complete your first mining session",
    icon: "⛏️",
    category: "mining",
    requirement: 1,
    xpReward: 15,
  },
  {
    title: "Daily Miner",
    description: "Complete 10 mining sessions",
    icon: "🪙",
    category: "mining",
    requirement: 10,
    xpReward: 60,
  },
  {
    title: "Pro Miner",
    description: "Complete 50 mining sessions",
    icon: "⚙️",
    category: "mining",
    requirement: 50,
    xpReward: 200,
  },
];

function parseAchievementPayload(body: any) {
  const {
    title,
    description,
    icon = "🏆",
    category = "earnings",
    requirement,
    xpReward,
  } = body || {};

  if (!title || !description) {
    throw new Error("Title and description are required");
  }

  const requirementNum = Number(requirement);
  const xpRewardNum = Number(xpReward);

  if (!Number.isFinite(requirementNum) || requirementNum < 0) {
    throw new Error("Invalid requirement");
  }
  if (!Number.isFinite(xpRewardNum) || xpRewardNum < 0) {
    throw new Error("Invalid XP reward");
  }

  const allowedCategories = new Set(["earnings", "referrals", "streaks", "mining"]);

  return {
    title: String(title),
    description: String(description),
    icon: String(icon || "🏆"),
    category: allowedCategories.has(category) ? category : "earnings",
    requirement: Math.floor(requirementNum),
    xpReward: Math.floor(xpRewardNum),
  };
}

async function ensureDefaultAchievements() {
  for (const def of DEFAULT_ACHIEVEMENTS) {
    try {
      await prisma.achievement.upsert({
        where: { title: def.title }, // title must be unique in schema
        create: def,
        update: {
          description: def.description,
          icon: def.icon,
          category: def.category,
          requirement: def.requirement,
          xpReward: def.xpReward,
        },
      });
    } catch (err) {
      console.error(
        "[Achievements] Failed to upsert default achievement",
        def.title,
        err
      );
    }
  }
}

/* -------------------------------------------------------------------------- */

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed / ensure default achievements exist once for everyone
  await ensureDefaultAchievements();

  // CSP violation report endpoint
  app.post("/csp-report", (req, res) => {
    console.log("[CSP Violation]", JSON.stringify(req.body, null, 2));
    res.status(204).end();
  });

  // Auth routes
  app.use("/auth", authRoutes);

  // Token info (XNRT contract address for UI)
  app.get("/api/token/info", (_req, res) => {
    const tokenAddress = process.env.XNRT_TOKEN_ADDRESS || "";
    res.json({
      address: tokenAddress,
      symbol: "XNRT",
      decimals: 18,
      network: "BSC Testnet",
      chainId: 97,
      explorerUrl: tokenAddress
        ? `https://testnet.bscscan.com/token/${tokenAddress}`
        : null,
    });
  });

  // Balance routes
  app.get("/api/balance", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const balance = await storage.getBalance(userId);
      res.json(
        balance || {
          xnrtBalance: "0",
          stakingBalance: "0",
          miningBalance: "0",
          referralBalance: "0",
          totalEarned: "0",
        }
      );
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Stats route
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      const miningSessions = await storage.getMiningHistory(userId);
      const referrals = await storage.getReferralsByReferrer(userId);
      const recentActivity = await storage.getActivities(userId, 5);

      res.json({
        activeStakes: stakes.filter((s) => s.status === "active").length,
        miningSessions: miningSessions.filter((s) => s.status === "completed").length,
        totalReferrals: referrals.length,
        recentActivity,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Staking routes
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
  app.post("/api/mining/start", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      const currentSession = await storage.getCurrentMiningSession(userId);
      if (currentSession && currentSession.status === "active") {
        return res.status(400).json({ message: "You already have an active mining session" });
      }

      const startTime = new Date();
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const session = await storage.createMiningSession({
        userId,
        baseReward: MINING_BASE_REWARD_XP,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: MINING_BASE_REWARD_XP,
        startTime,
        endTime,
        nextAvailable: new Date(),
        status: "active",
      });

      res.json(session);
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });

  // Referral routes
  app.get("/api/referrals/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const referrals = await storage.getReferralsByReferrer(userId);
      const balance = await storage.getBalance(userId);

      const level1Total = referrals
        .filter((r) => r.level === 1)
        .reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level2Total = referrals
        .filter((r) => r.level === 2)
        .reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level3Total = referrals
        .filter((r) => r.level === 3)
        .reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const directCommissions = level1Total + level2Total + level3Total;
      const actualBalance = parseFloat(balance?.referralBalance || "0");
      const companyCommissions = actualBalance - directCommissions;

      const stats = {
        level1Count: referrals.filter((r) => r.level === 1).length,
        level2Count: referrals.filter((r) => r.level === 2).length,
        level3Count: referrals.filter((r) => r.level === 3).length,
        level1Commission: level1Total.toString(),
        level2Commission: level2Total.toString(),
        level3Commission: level3Total.toString(),
        totalCommission: referrals
          .reduce((sum, r) => sum + parseFloat(r.totalCommission), 0)
          .toString(),
        actualBalance: actualBalance.toString(),
        companyCommissions: companyCommissions.toString(),
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.get("/api/referrals/tree", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const referrals = await storage.getReferralsByReferrer(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referral tree:", error);
      res.status(500).json({ message: "Failed to fetch referral tree" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.authUser!.id;

      // Ownership check without loading all notifications
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Mark as read using existing storage API
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post(
    "/api/notifications/mark-all-read",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        await storage.markAllNotificationsAsRead(userId);
        res.json({ message: "All notifications marked as read" });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ message: "Failed to mark all notifications as read" });
      }
    }
  );

  // Push Notification routes
  app.get("/api/push/vapid-public-key", async (_req, res) => {
    try {
      res.json({ publicKey: VAPID_PUBLIC_KEY });
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      res.status(500).json({ message: "Failed to get VAPID public key" });
    }
  });

  app.post(
    "/api/push/subscribe",
    requireAuth,
    pushSubscriptionLimiter,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { endpoint, keys, expirationTime } = req.body;

        if (!endpoint || typeof endpoint !== "string") {
          return res.status(400).json({ message: "Invalid endpoint" });
        }
        if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
          return res.status(400).json({ message: "Invalid subscription keys" });
        }
        if (!endpoint.startsWith("https://")) {
          return res.status(400).json({ message: "Endpoint must be HTTPS URL" });
        }

        const base64Regex = /^[A-Za-z0-9+/=_-]+$/;
        if (!base64Regex.test(keys.p256dh) || !base64Regex.test(keys.auth)) {
          return res.status(400).json({ message: "Keys must be valid base64 strings" });
        }

        const subscription = await storage.createPushSubscription({
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          expirationTime: expirationTime || null,
        });

        res.json(subscription);
      } catch (error) {
        console.error("Error creating push subscription:", error);
        res.status(500).json({ message: "Failed to create push subscription" });
      }
    }
  );

  app.delete(
    "/api/push/unsubscribe",
    requireAuth,
    pushSubscriptionLimiter,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { endpoint } = req.body;

        if (!endpoint || typeof endpoint !== "string") {
          return res.status(400).json({ message: "Invalid endpoint" });
        }

        await storage.deletePushSubscription(userId, endpoint);
        res.json({ message: "Successfully unsubscribed from push notifications" });
      } catch (error) {
        console.error("Error deleting push subscription:", error);
        res.status(500).json({ message: "Failed to delete push subscription" });
      }
    }
  );

  app.get("/api/push/subscriptions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const subscriptions = await storage.getUserPushSubscriptions(userId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error getting push subscriptions:", error);
      res.status(500).json({ message: "Failed to get push subscriptions" });
    }
  });

  app.post("/api/admin/push/test", requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { userId, title, body } = req.body;

      if (!userId || !title || !body) {
        return res.status(400).json({ message: "userId, title, and body are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      await sendPushNotification(userId, { title, body });
      res.json({ message: "Test push notification sent successfully" });
    } catch (error) {
      console.error("Error sending test push notification:", error);
      res.status(500).json({ message: "Failed to send test push notification" });
    }
  });

  // Leaderboard routes
  app.get("/api/leaderboard/referrals", requireAuth, async (req, res) => {
    try {
      const period = (req.query.period as string) || "all-time";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const currentUserId = req.authUser!.id;

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;

      let dateFilter: string | null = null;
      const now = new Date();

      if (period === "daily") {
        dateFilter = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        ).toISOString();
      } else if (period === "weekly") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = weekAgo.toISOString();
      } else if (period === "monthly") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = monthAgo.toISOString();
      }

      const query = `
        SELECT 
          u.id as "userId",
          u.username,
          u.email,
          COUNT(r.id) as "totalReferrals",
          COALESCE(SUM(r."totalCommission"), 0) as "totalCommission",
          COUNT(CASE WHEN r.level = 1 THEN 1 END) as "level1Count",
          COUNT(CASE WHEN r.level = 2 THEN 1 END) as "level2Count",
          COUNT(CASE WHEN r.level = 3 THEN 1 END) as "level3Count"
        FROM "User" u
        LEFT JOIN "Referral" r ON r."referrerId" = u.id
          ${dateFilter ? `AND r."createdAt" >= $1` : ""}
        GROUP BY u.id, u.username, u.email
        HAVING COUNT(r.id) > 0
        ORDER BY COUNT(r.id) DESC, COALESCE(SUM(r."totalCommission"), 0) DESC
        LIMIT $${dateFilter ? "2" : "1"}
      `;

      const leaderboard: any[] = dateFilter
        ? await storage.raw(query, [dateFilter, limit])
        : await storage.raw(query, [limit]);

      const userQuery = `
        SELECT 
          u.id as "userId",
          u.username,
          u.email,
          COUNT(r.id) as "totalReferrals",
          COALESCE(SUM(r."totalCommission"), 0) as "totalCommission",
          COUNT(CASE WHEN r.level = 1 THEN 1 END) as "level1Count",
          COUNT(CASE WHEN r.level = 2 THEN 1 END) as "level2Count",
          COUNT(CASE WHEN r.level = 3 THEN 1 END) as "level3Count"
        FROM "User" u
        LEFT JOIN "Referral" r ON r."referrerId" = u.id
          ${dateFilter ? `AND r."createdAt" >= $1` : ""}
        WHERE u.id = $${dateFilter ? "2" : "1"}
        GROUP BY u.id, u.username, u.email
      `;

      const userStats: any[] = dateFilter
        ? await storage.raw(userQuery, [dateFilter, currentUserId])
        : await storage.raw(userQuery, [currentUserId]);

      const userIndexInLeaderboard = leaderboard.findIndex(
        (item) => item.userId === currentUserId
      );

      const formattedLeaderboard = leaderboard.map((item, index) => {
        const baseData = {
          totalReferrals: parseInt(item.totalReferrals),
          totalCommission: item.totalCommission.toString(),
          level1Count: parseInt(item.level1Count),
          level2Count: parseInt(item.level2Count),
          level3Count: parseInt(item.level3Count),
          rank: index + 1,
        };

        if (isAdmin) {
          return {
            ...baseData,
            userId: item.userId,
            username: item.username,
            email: item.email,
            displayName: item.username || item.email,
          };
        } else {
          return {
            ...baseData,
            displayName: generateAnonymizedHandle(item.userId),
          };
        }
      });

      let userPosition: any = null;
      if (userStats.length > 0) {
        const raw = userStats[0];
        const baseData = {
          totalReferrals: parseInt(raw.totalReferrals),
          totalCommission: raw.totalCommission.toString(),
          level1Count: parseInt(raw.level1Count),
          level2Count: parseInt(raw.level2Count),
          level3Count: parseInt(raw.level3Count),
          rank: userIndexInLeaderboard === -1 ? null : userIndexInLeaderboard + 1,
        };

        if (isAdmin) {
          userPosition = {
            ...baseData,
            userId: raw.userId,
            username: raw.username,
            email: raw.email,
            displayName: raw.username || raw.email,
          };
        } else {
          userPosition = {
            ...baseData,
            displayName: userIndexInLeaderboard === -1 ? "You" : "You",
          };
        }
      }

      res.json({
        leaderboard: formattedLeaderboard,
        userPosition,
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/xp", requireAuth, async (req, res) => {
    try {
      const period = (req.query.period as string) || "all-time";
      const category = (req.query.category as string) || "overall";
      const currentUserId = req.authUser!.id;

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;

      const result = await storage.getXPLeaderboard(
        currentUserId,
        period,
        category,
        isAdmin
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching XP leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch XP leaderboard" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const transactions = await storage.getTransactionsByUser(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/deposits", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const deposits = await storage.getTransactionsByUser(userId, "deposit");
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  app.get("/api/transactions/withdrawals", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const withdrawals = await storage.getTransactionsByUser(
        userId,
        "withdrawal"
      );
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Wallet Linking API
  app.get("/api/wallet/me", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const wallets = await prisma.linkedWallet.findMany({
        where: { userId, active: true },
        select: { address: true, linkedAt: true },
        orderBy: { linkedAt: "desc" },
      });
      res.json(wallets.map((w) => w.address));
    } catch (error) {
      console.error("Error fetching linked wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.get("/api/wallet/link/challenge", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const address = String(req.query.address || "").toLowerCase();

      if (!/^0x[a-f0-9]{40}$/.test(address)) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      // 6-digit numeric nonce; avoids NaN issues and is easy for users to verify
      const nonce = Math.floor(100000 + Math.random() * 900000);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const issuedAt = new Date();

      await prisma.walletNonce.upsert({
        where: { userId_address: { userId, address } },
        update: { nonce: String(nonce), expiresAt },
        create: { userId, address, nonce: String(nonce), expiresAt },
      });

      const message = `XNRT Wallet Link

Address: ${address}
Nonce: ${nonce}
Issued: ${issuedAt.toISOString()}`;

      res.json({
        message,
        nonce: String(nonce),
        issuedAt: issuedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).json({ message: "Failed to generate challenge" });
    }
  });

  app.post(
    "/api/wallet/link/confirm",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { address, signature, nonce, issuedAt } = req.body;
        const normalized = String(address || "").toLowerCase();

        if (!address || !signature || !nonce || !issuedAt) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const rec = await prisma.walletNonce.findUnique({
          where: {
            userId_address: { userId, address: normalized },
          },
        });

        if (
          !rec ||
          String(rec.nonce) !== String(nonce) ||
          !rec.expiresAt ||
          rec.expiresAt < new Date()
        ) {
          return res.status(400).json({ message: "Invalid or expired challenge" });
        }

        const message = `XNRT Wallet Link

Address: ${normalized}
Nonce: ${nonce}
Issued: ${issuedAt}`;

        let recoveredAddress: string;
        try {
          recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
        } catch {
          return res.status(400).json({ message: "Invalid signature" });
        }

        if (recoveredAddress !== normalized) {
          return res
            .status(400)
            .json({ message: "Signature does not match address" });
        }

        const existing = await prisma.linkedWallet.findFirst({
          where: { address: normalized, active: true },
        });

        if (existing && existing.userId !== userId) {
          return res
            .status(409)
            .json({ message: "This wallet is already linked to another account" });
        }

        if (existing && existing.userId === userId) {
          return res.json({ address: existing.address, alreadyLinked: true });
        }

        await prisma.$transaction([
          prisma.walletNonce.delete({ where: { id: rec.id } }),
          prisma.linkedWallet.create({
            data: {
              userId,
              address: normalized,
              signature,
              nonce: rec.nonce,
            },
          }),
        ]);

        res.json({ address: normalized });
      } catch (error) {
        console.error("Error linking wallet:", error);
        res.status(500).json({ message: "Failed to link wallet" });
      }
    }
  );

  // User Deposit Address API
  app.get("/api/wallet/deposit-address", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      let user = await prisma.user.findUnique({
        where: { id: userId },
        select: { depositAddress: true, derivationIndex: true },
      });

      if (!user?.depositAddress || user?.derivationIndex === null) {
        // NOTE: production should use a counter/lock; this is best-effort within current model.
        const maxIndexUser = await prisma.user.findFirst({
          where: { derivationIndex: { not: null } },
          orderBy: { derivationIndex: "desc" },
          select: { derivationIndex: true },
        });

        const nextIndex = (maxIndexUser?.derivationIndex ?? -1) + 1;
        const address = deriveDepositAddress(nextIndex);

        await prisma.user.update({
          where: { id: userId },
          data: { depositAddress: address, derivationIndex: nextIndex },
        });

        return res.json({
          address,
          network: "BSC (BEP-20)",
          token: "USDT",
          instructions: [
            "Send USDT (BEP-20) from your exchange to this address",
            "Deposits will be automatically detected and credited",
            "No gas fees or wallet connection needed",
            "Minimum 12 block confirmations required",
          ],
        });
      }

      res.json({
        address: user.depositAddress,
        network: "BSC (BEP-20)",
        token: "USDT",
        instructions: [
          "Send USDT (BEP-20) from your exchange to this address",
          "Deposits will be automatically detected and credited",
          "No gas fees or wallet connection needed",
          "Minimum 12 block confirmations required",
        ],
      });
    } catch (error) {
      console.error("Error getting deposit address:", error);
      res.status(500).json({ message: "Failed to get deposit address" });
    }
  });

  app.post(
    "/api/wallet/report-deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        let { transactionHash, amount, description } = req.body;

        if (!transactionHash || amount === undefined || amount === null) {
          return res
            .status(400)
            .json({ message: "Transaction hash and amount required" });
        }

        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return res.status(400).json({ message: "Invalid amount" });
        }

        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res
            .status(400)
            .json({ message: "Invalid transaction hash format" });
        }

        const existingTx = await prisma.transaction.findFirst({
          where: { transactionHash },
        });
        if (existingTx) {
          return res.status(409).json({
            message: "This deposit has already been credited",
            alreadyProcessed: true,
          });
        }

        const existingReport = await prisma.depositReport.findFirst({
          where: { txHash: transactionHash },
        });
        if (existingReport) {
          return res
            .status(409)
            .json({ message: "This deposit has already been reported" });
        }

        const treasuryAddress = process.env.XNRT_WALLET || "";
        const verification = await verifyBscUsdtDeposit({
          txHash: transactionHash,
          expectedTo: treasuryAddress,
          minAmount: amountNum,
          requiredConf: parseInt(process.env.BSC_CONFIRMATIONS ?? "12", 10),
        });

        if (!verification.verified) {
          const report = await prisma.depositReport.create({
            data: {
              userId,
              txHash: transactionHash,
              amount: new Prisma.Decimal(amountNum),
              notes: description || `Verification: ${verification.reason}`,
              status: "pending",
            },
          });

          return res.json({
            message: "Report submitted for admin review",
            reportId: report.id,
            reason: verification.reason,
          });
        }

        const provider = new ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
        const receipt = await provider.getTransactionReceipt(transactionHash);
        const transaction = await provider.getTransaction(transactionHash);
        const fromAddress = transaction?.from?.toLowerCase() || "";

        const linkedWallet = await prisma.linkedWallet.findFirst({
          where: { userId, address: fromAddress, active: true },
        });

        const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
        const platformFeeBps = parseFloat(process.env.PLATFORM_FEE_BPS || "0");
        const usdtAmount = verification.amountOnChain ?? amountNum;
        const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * xnrtRate;

        if (linkedWallet) {
          await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
              data: {
                userId,
                type: "deposit",
                amount: new Prisma.Decimal(xnrtAmount),
                usdtAmount: new Prisma.Decimal(usdtAmount),
                transactionHash,
                walletAddress: fromAddress,
                status: "approved",
                verified: true,
                confirmations: verification.confirmations,
                verificationData: {
                  autoVerified: true,
                  reportSubmitted: true,
                  verifiedAt: new Date().toISOString(),
                  blockNumber: receipt?.blockNumber,
                } as any,
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
          });

          console.log(
            `[ReportDeposit] Auto-credited ${xnrtAmount} XNRT to user ${userId}`
          );

          const { sendDepositNotification } = await import(
            "./services/depositScanner"
          );
          void sendDepositNotification(
            userId,
            xnrtAmount,
            transactionHash
          ).catch((err) => {
            console.error("[ReportDeposit] Notification error:", err);
          });

          // Distribute referral commissions + activity for auto-approved deposit
          await storage.distributeReferralCommissions(userId, xnrtAmount);
          await storage.createActivity({
            userId,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via auto-detection`,
          });

          return res.json({
            message: "Deposit verified and credited automatically!",
            credited: true,
            amount: xnrtAmount,
          });
        } else {
          await prisma.unmatchedDeposit.create({
            data: {
              fromAddress,
              toAddress: treasuryAddress,
              amount: new Prisma.Decimal(usdtAmount),
              transactionHash,
              blockNumber: receipt?.blockNumber ?? 0,
              confirmations: verification.confirmations ?? 0,
              matched: false,
            },
          });

          return res.json({
            message:
              "Deposit verified on blockchain. Admin will credit your account shortly.",
            verified: true,
            pendingAdminReview: true,
          });
        }
      } catch (error: any) {
        console.error("Error reporting deposit:", error);

        if (error.code === "P2002" && error.meta?.target?.includes("transactionHash")) {
          return res.status(409).json({
            message: "This transaction has already been processed",
            alreadyProcessed: true,
          });
        }
        res.status(500).json({ message: "Failed to process deposit report" });
      }
    }
  );

  app.post(
    "/api/transactions/deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        let { usdtAmount, transactionHash, proofImageUrl } = req.body;

        if (!usdtAmount || !transactionHash) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const usdt = Number(usdtAmount);
        if (!Number.isFinite(usdt) || usdt <= 0) {
          return res.status(400).json({ message: "Invalid USDT amount" });
        }

        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res
            .status(400)
            .json({ message: "Invalid transaction hash format" });
        }

        const existing = await prisma.transaction.findFirst({
          where: { transactionHash },
        });
        if (existing) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit.",
          });
        }

        if (proofImageUrl) {
          const isBase64DataUrl = proofImageUrl.startsWith("data:image/");
          const isValidUrl = /^https?:\/\//.test(proofImageUrl);
          if (!isBase64DataUrl && !isValidUrl) {
            return res
              .status(400)
              .json({ message: "Invalid proof image URL format" });
          }
        }

        const rate = parseFloat(process.env.XNRT_RATE_USDT ?? "100");
        const feeBps = parseFloat(process.env.PLATFORM_FEE_BPS ?? "0");
        const netUsdt = usdt * (1 - feeBps / 10_000);
        const xnrtAmount = netUsdt * rate;

        const transaction = await storage.createTransaction({
          userId,
          type: "deposit",
          amount: xnrtAmount.toString(),
          usdtAmount: usdt.toString(),
          transactionHash,
          walletAddress: process.env.XNRT_WALLET!,
          ...(proofImageUrl && { proofImageUrl }),
          status: "pending",
          verified: false,
          confirmations: 0,
        });

        res.json(transaction);
      } catch (error: any) {
        if (error.code === "P2002" && error.meta?.target?.includes("transactionHash")) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit.",
          });
        }
        console.error("Error creating deposit:", error);
        res.status(500).json({ message: "Failed to create deposit" });
      }
    }
  );

  app.post(
    "/api/transactions/withdrawal",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { source, amount, walletAddress } = req.body;

        if (!source || amount === undefined || amount === null || !walletAddress) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const withdrawAmount = Number(amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res
            .status(400)
            .json({ message: "Withdrawal amount must be a positive number" });
        }

        const fee = (withdrawAmount * 2) / 100;
        const netAmount = withdrawAmount - fee;
        const usdtAmount = netAmount / 100;

        const balance = await storage.getBalance(userId);
        if (!balance) {
          return res.status(404).json({ message: "Balance not found" });
        }

        let availableBalance = 0;

        switch (source) {
          case "main":
            availableBalance = parseFloat(balance.xnrtBalance || "0");
            break;
          case "staking":
            availableBalance = parseFloat(balance.stakingBalance || "0");
            break;
          case "mining":
            availableBalance = parseFloat(balance.miningBalance || "0");
            break;
          case "referral":
            availableBalance = parseFloat(balance.referralBalance || "0");
            break;
          default:
            return res.status(400).json({ message: "Invalid source" });
        }

        if (withdrawAmount > availableBalance) {
          return res.status(400).json({ message: "Insufficient balance" });
        }

        if (source === "referral" && withdrawAmount < 5000) {
          return res.status(400).json({
            message: "Minimum withdrawal from referral balance is 5,000 XNRT",
          });
        }

        if (source === "mining" && withdrawAmount < 5000) {
          return res
            .status(400)
            .json({ message: "Minimum withdrawal from mining balance is 5,000 XNRT" });
        }

        const transaction = await storage.createTransaction({
          userId,
          type: "withdrawal",
          amount: withdrawAmount.toString(),
          usdtAmount: usdtAmount.toString(),
          source,
          walletAddress,
          status: "pending",
          fee: fee.toString(),
          netAmount: netAmount.toString(),
        });

        res.json(transaction);
      } catch (error) {
        console.error("Error creating withdrawal:", error);
        res.status(500).json({ message: "Failed to create withdrawal" });
      }
    }
  );

  // Task routes
  app.get("/api/tasks/user", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const userTasks = await storage.getUserTasks(userId);
      const allTasks = await storage.getAllTasks();

      const populated = await Promise.all(
        userTasks.map(async (ut) => {
          const task = allTasks.find((t) => t.id === ut.taskId);
          return { ...ut, task };
        })
      );

      res.json(populated);
    } catch (error) {
      console.error("Error fetching user tasks:", error);
      res.status(500).json({ message: "Failed to fetch user tasks" });
    }
  });

  app.post(
    "/api/tasks/:taskId/complete",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { taskId } = req.params;

        const userTasks = await storage.getUserTasks(userId);
        const userTask = userTasks.find((ut) => ut.taskId === taskId);

        if (!userTask) return res.status(404).json({ message: "Task not found" });
        if (userTask.completed) {
          return res.status(400).json({ message: "Task already completed" });
        }

        const allTasks = await storage.getAllTasks();
        const task = allTasks.find((t) => t.id === taskId);
        if (!task) return res.status(404).json({ message: "Task not found" });

        await storage.updateUserTask(userTask.id, {
          completed: true,
          completedAt: new Date(),
          progress: userTask.maxProgress,
        });

        const user = await storage.getUser(userId);
        const balance = await storage.getBalance(userId);

        if (user) {
          await storage.updateUser(userId, {
            xp: (user.xp || 0) + task.xpReward,
          });
        }

        if (balance && parseFloat(task.xnrtReward) > 0) {
          const xnrtAmount = parseFloat(task.xnrtReward);
          await storage.updateBalance(userId, {
            xnrtBalance: (
              parseFloat(balance.xnrtBalance) + xnrtAmount
            ).toString(),
            totalEarned: (
              parseFloat(balance.totalEarned) + xnrtAmount
            ).toString(),
          });
        }

        await storage.createActivity({
          userId,
          type: "task_completed",
          description: `Completed task: ${task.title}`,
        });

        await storage.checkAndUnlockAchievements(userId);

        res.json({
          xpReward: task.xpReward,
          xnrtReward: task.xnrtReward,
        });
      } catch (error) {
        console.error("Error completing task:", error);
        res.status(500).json({ message: "Failed to complete task" });
      }
    }
  );

  // Achievement routes
  app.get("/api/achievements", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const allAchievements = await storage.getAllAchievements();
      const userAchievements = await storage.getUserAchievements(userId);

      const populated = allAchievements.map((achievement: any) => {
        const ua = (userAchievements as any[]).find(
          (x) => x.achievementId === achievement.id
        );

        const unlocked = !!ua;
        const claimed = !!ua?.claimed;
        const claimedAt = ua?.claimedAt ?? null;

        return {
          ...achievement,
          unlocked,
          unlockedAt: ua?.unlockedAt ?? ua?.createdAt ?? null,
          claimed,
          claimedAt,
          // handy flag for UI
          claimable: unlocked && !claimed,
        };
      });

      res.json(populated);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Claim an unlocked achievement (marks claimed/claimedAt only; XP is already granted on unlock)
  app.post(
    "/api/achievements/:id/claim",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const achievementId = req.params.id;

        const achievement = await prisma.achievement.findUnique({
          where: { id: achievementId },
        });
        if (!achievement) {
          return res.status(404).json({ message: "Achievement not found" });
        }

        const userAchievement = await prisma.userAchievement.findFirst({
          where: { userId, achievementId },
        });

        if (!userAchievement) {
          return res
            .status(400)
            .json({ message: "Achievement not unlocked yet" });
        }

        if (userAchievement.claimed) {
          return res
            .status(400)
            .json({ message: "Achievement already claimed" });
        }

        const updated = await prisma.userAchievement.update({
          where: { id: userAchievement.id },
          data: {
            claimed: true,
            claimedAt: new Date(),
          },
        });

        await storage.createActivity({
          userId,
          type: "achievement_claimed",
          description: `Claimed achievement: ${achievement.title}`,
        });

        res.json({
          achievementId,
          claimed: updated.claimed,
          claimedAt: updated.claimedAt,
        });
      } catch (error) {
        console.error("Error claiming achievement:", error);
        res.status(500).json({ message: "Failed to claim achievement" });
      }
    }
  );

  // Admin Achievement Management
  app.get(
    "/api/admin/achievements",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const [achievements, unlockGroups] = await Promise.all([
          prisma.achievement.findMany({
            orderBy: { createdAt: "asc" },
          }),
          prisma.userAchievement.groupBy({
            by: ["achievementId"],
            _count: { achievementId: true },
          }),
        ]);

        const unlockMap = new Map<string, number>();
        (unlockGroups as any[]).forEach((row) => {
          const count =
            row?._count?.achievementId ??
            row?._count?._all ??
            row?._count ??
            0;
          unlockMap.set(row.achievementId, Number(count) || 0);
        });

        const result = achievements.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          icon: a.icon,
          category: a.category,
          requirement: a.requirement,
          xpReward: a.xpReward,
          unlockCount: unlockMap.get(a.id) ?? 0,
        }));

        res.json(result);
      } catch (error) {
        console.error("Error fetching admin achievements:", error);
        res.status(500).json({ message: "Failed to fetch achievements" });
      }
    }
  );

  app.post(
    "/api/admin/achievements",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        let payload;
        try {
          payload = parseAchievementPayload(req.body);
        } catch (e: any) {
          return res
            .status(400)
            .json({ message: e?.message ?? "Invalid achievement payload" });
        }

        const achievement = await prisma.achievement.create({
          data: payload,
        });

        res.status(201).json({
          ...achievement,
          unlockCount: 0,
        });
      } catch (error: any) {
        console.error("Error creating achievement:", error);
        if (error.code === "P2002") {
          return res.status(409).json({
            message: "An achievement with this title already exists",
          });
        }
        res.status(500).json({ message: "Failed to create achievement" });
      }
    }
  );

  app.put(
    "/api/admin/achievements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;

        let payload;
        try {
          payload = parseAchievementPayload(req.body);
        } catch (e: any) {
          return res
            .status(400)
            .json({ message: e?.message ?? "Invalid achievement payload" });
        }

        const achievement = await prisma.achievement.update({
          where: { id },
          data: payload,
        });

        const unlockCount = await prisma.userAchievement.count({
          where: { achievementId: id },
        });

        res.json({
          ...achievement,
          unlockCount,
        });
      } catch (error: any) {
        console.error("Error updating achievement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Achievement not found" });
        }
        if (error.code === "P2002") {
          return res.status(409).json({
            message: "An achievement with this title already exists",
          });
        }
        res.status(500).json({ message: "Failed to update achievement" });
      }
    }
  );

  app.delete(
    "/api/admin/achievements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.achievement.delete({ where: { id } });
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting achievement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Achievement not found" });
        }
        res.status(500).json({ message: "Failed to delete achievement" });
      }
    }
  );

  // Profile stats route
  app.get("/api/profile/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      const miningSessions = await storage.getMiningHistory(userId);
      const referrals = await storage.getReferralsByReferrer(userId);
      const userTasks = await storage.getUserTasks(userId);
      const userAchievements = await storage.getUserAchievements(userId);

      res.json({
        totalReferrals: referrals.length,
        activeStakes: stakes.filter((s) => s.status === "active").length,
        totalStaked: stakes.reduce(
          (sum, s) => sum + parseFloat(s.amount),
          0
        ),
        miningSessions: miningSessions.filter(
          (s) => s.status === "completed"
        ).length,
        totalMined: miningSessions.reduce(
          (sum, s) => sum + s.finalReward,
          0
        ),
        referralEarnings: referrals.reduce(
          (sum, r) => sum + parseFloat(r.totalCommission),
          0
        ),
        tasksCompleted: userTasks.filter((t) => t.completed).length,
        achievementsUnlocked: userAchievements.length,
      });
    } catch (error) {
      console.error("Error fetching profile stats:", error);
      res.status(500).json({ message: "Failed to fetch profile stats" });
    }
  });

  // Daily check-in route
  app.post("/api/checkin", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      const now = new Date();
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
      const lastCheckInDay = lastCheckIn
        ? new Date(
            lastCheckIn.getFullYear(),
            lastCheckIn.getMonth(),
            lastCheckIn.getDate()
          )
        : null;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = 1;
      if (
        lastCheckInDay &&
        lastCheckInDay.getTime() === yesterday.getTime()
      ) {
        newStreak = (user.streak || 0) + 1;
      }

      const streakReward = Math.min(newStreak * 10, 100);
      const xpReward = Math.min(newStreak * 5, 50);

      if (
        lastCheckIn &&
        lastCheckInDay &&
        lastCheckInDay.getTime() === today.getTime()
      ) {
        return res.status(400).json({ message: "Already checked in today" });
      }

      await storage.updateUser(userId, {
        lastCheckIn: now,
        streak: newStreak,
        xp: (user.xp || 0) + xpReward,
      });

      const balance = await storage.getBalance(userId);
      if (balance) {
        await storage.updateBalance(userId, {
          xnrtBalance: (
            parseFloat(balance.xnrtBalance) + streakReward
          ).toString(),
          totalEarned: (
            parseFloat(balance.totalEarned) + streakReward
          ).toString(),
        });
      }

      await storage.createActivity({
        userId,
        type: "daily_checkin",
        description: `Day ${newStreak} streak! Earned ${streakReward} XNRT and ${xpReward} XP`,
      });

      await storage.checkAndUnlockAchievements(userId);

      res.json({
        streak: newStreak,
        xnrtReward: streakReward,
        xpReward,
        message: `Day ${newStreak} check-in complete!`,
      });
    } catch (error) {
      console.error("Error during check-in:", error);
      res.status(500).json({ message: "Failed to check in" });
    }
  });

  // Check-in history route
  app.get("/api/checkin/history", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { year, month } = req.query;

      const now = new Date();
      const targetYear = year
        ? parseInt(year as string, 10)
        : now.getFullYear();

      let targetMonth: number;
      if (typeof month !== "undefined") {
        const monthNum = parseInt(month as string, 10); // expect 1-12 from client
        const clamped = Math.min(Math.max(monthNum, 1), 12);
        targetMonth = clamped - 1; // JS Date months are 0-based
      } else {
        targetMonth = now.getMonth();
      }

      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(
        targetYear,
        targetMonth + 1,
        0,
        23,
        59,
        59,
        999
      );

      const checkinActivities = await prisma.activity.findMany({
        where: {
          userId,
          type: "daily_checkin",
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: "asc" },
      });

      const checkinDates = checkinActivities.map(
        (activity: { createdAt: Date | null }) =>
          new Date(activity.createdAt!).toISOString().split("T")[0]
      );

      res.json({ dates: checkinDates, year: targetYear, month: targetMonth });
    } catch (error) {
      console.error("Error fetching check-in history:", error);
      res.status(500).json({ message: "Failed to fetch check-in history" });
    }
  });

  // Admin routes
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
          parseFloat(deposit.amount)
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
              parseFloat(deposit.amount)
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
        await storage.distributeReferralCommissions(userId, xnrtAmount);
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
            xnrtAmount
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

        await storage.raw(`DELETE FROM "Referral"`);
        console.log("[RECONCILE] Cleared existing referral records");

        await storage.raw(`UPDATE "Balance" SET "referralBalance" = 0`);
        console.log("[RECONCILE] Reset all referral balances");

        let totalProcessed = 0;
        for (const deposit of approvedDeposits) {
          const amount = parseFloat(deposit.amount);
          console.log(
            `[RECONCILE] Processing deposit ${deposit.id}: ${amount} XNRT for user ${deposit.userId}`
          );
          await storage.distributeReferralCommissions(
            deposit.userId,
            amount
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
        const withdrawal = await storage.getTransactionById(id);

        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }

        // Idempotency: already fully approved — return cached result.
        if (withdrawal.status === "approved") {
          return res.json({
            message: "Withdrawal already approved",
            onChainTxHash: withdrawal.transactionHash ?? null,
            explorerUrl: withdrawal.transactionHash
              ? getTxExplorerUrl(withdrawal.transactionHash)
              : null,
          });
        }

        // "processing" + no txHash: mint is currently in-flight from a concurrent
        // request. Reject to avoid a second mint submission.
        if (withdrawal.status === "processing" && !withdrawal.transactionHash) {
          return res.status(409).json({
            message: "Withdrawal mint is currently in progress. Retry after a moment.",
          });
        }

        // "processing" + txHash: previous mint confirmed on-chain but the
        // balance deduction / status update did not persist. Allow retry to
        // complete the approval (the $transaction block below is idempotent).

        // Reject any other terminal status (rejected, cancelled, etc.)
        if (withdrawal.status !== "pending" && withdrawal.status !== "processing") {
          return res
            .status(400)
            .json({ message: "Withdrawal already processed" });
        }

        const withdrawAmount = Number(withdrawal.amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res
            .status(400)
            .json({ message: "Invalid withdrawal amount" });
        }

        const balance = await storage.getBalance(withdrawal.userId);
        if (!balance) {
          return res.status(400).json({
            message: "User balance not found; cannot approve withdrawal",
          });
        }

        let sourceBalanceKey:
          | "xnrtBalance"
          | "stakingBalance"
          | "miningBalance"
          | "referralBalance";

        switch (withdrawal.source) {
          case "main":
            sourceBalanceKey = "xnrtBalance";
            break;
          case "staking":
            sourceBalanceKey = "stakingBalance";
            break;
          case "mining":
            sourceBalanceKey = "miningBalance";
            break;
          case "referral":
            sourceBalanceKey = "referralBalance";
            break;
          default:
            sourceBalanceKey = "xnrtBalance";
        }

        const currentBalance = parseFloat(balance[sourceBalanceKey] || "0");

        // Use the canonical Prisma Decimal string directly to avoid float
        // precision loss. withdrawAmount (a JS number) is only used for
        // balance arithmetic, not for the on-chain wei conversion.
        const netAmt: string = withdrawal.netAmount
          ? withdrawal.netAmount.toString()
          : withdrawal.amount.toString();

        let onChainTxHash: string | undefined;

        if (isTokenServiceReady()) {
          if (!withdrawal.walletAddress) {
            return res.status(400).json({
              message: "Cannot approve: withdrawal has no destination wallet address",
            });
          }

          // Idempotency: if the tx hash was already stored (previous mint
          // succeeded but DB commit failed), skip re-minting.
          if (withdrawal.transactionHash) {
            onChainTxHash = withdrawal.transactionHash;
            console.log(
              `[Withdrawal] Reusing prior on-chain mint: ${onChainTxHash}`
            );
          } else {
            // Atomic compare-and-set: only the request that successfully flips
            // pending→processing (count === 1) is allowed to mint.
            // Any concurrent request that reads count === 0 (another request
            // already transitioned the state) returns 409 without calling mint.
            // updateMany is required because Prisma `update` only accepts unique-only filters.
            const { count: acquiredLock } = await prisma.transaction.updateMany({
              where: { id, status: "pending" },
              data:  { status: "processing" },
            });

            if (acquiredLock === 0) {
              // Another request holds the lock — refuse to mint.
              return res.status(409).json({
                message: "Withdrawal mint is currently in progress. Retry after a moment.",
              });
            }

            try {
              onChainTxHash = await mintXNRT(withdrawal.walletAddress, netAmt);
            } catch (mintErr: unknown) {
              // Mint failed — reset to pending so the admin can retry via the UI.
              await prisma.transaction.updateMany({
                where: { id, status: "processing" },
                data:  { status: "pending" },
              });
              const msg = mintErr instanceof Error ? mintErr.message : String(mintErr);
              console.error(`[Withdrawal] On-chain mint FAILED: ${msg}`);
              throw mintErr; // propagate → outer catch returns 500
            }

            // Persist tx hash immediately after confirmation.
            // If subsequent writes fail, the stored hash prevents a second
            // mint on retry (checked at the top of this block).
            await prisma.transaction.update({
              where: { id },
              data: { transactionHash: onChainTxHash },
            });

            console.log(
              `[Withdrawal] On-chain mint OK: ${onChainTxHash} → ${withdrawal.walletAddress}`
            );
          }
        }

        // Atomically: deduct balance + mark approved in a single DB transaction.
        // Guards inside ensure this is idempotent:
        //   - Re-read live withdrawal status inside the tx to detect if a
        //     concurrent request already completed the debit+approval.
        //   - Only deduct and flip status when the record is still pending/processing.
        //   - Checking inside the transaction prevents race conditions between
        //     concurrent approve attempts.
        await prisma.$transaction(async (ptx) => {
          // Re-read current state inside the transaction (prevents TOCTOU).
          const live = await ptx.transaction.findUnique({ where: { id } });
          if (!live || live.status === "approved") {
            // Already approved (concurrent request beat us here) — safe no-op.
            return;
          }

          const liveBalance = await ptx.balance.findUnique({
            where: { userId: withdrawal.userId },
          });
          const liveAmount = parseFloat(
            liveBalance?.[sourceBalanceKey]?.toString() ?? "0"
          );

          if (withdrawAmount > liveAmount) {
            throw new Error(
              `Insufficient balance: need ${withdrawAmount}, have ${liveAmount}`
            );
          }

          const newAmount = new Prisma.Decimal(liveAmount - withdrawAmount);
          await ptx.balance.update({
            where: { userId: withdrawal.userId },
            data: { [sourceBalanceKey]: newAmount },
          });

          await ptx.transaction.update({
            where: { id },
            data: { status: "approved" },
          });
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
      } catch (error) {
        console.error("Error approving withdrawal:", error);
        res.status(500).json({ message: "Failed to approve withdrawal" });
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
        const withdrawal = await storage.getTransactionById(id);

        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }
        if (withdrawal.status !== "pending") {
          return res
            .status(400)
            .json({ message: "Withdrawal already processed" });
        }

        await storage.updateTransaction(id, { status: "rejected" });

        await storage.createActivity({
          userId: withdrawal.userId,
          type: "withdrawal_rejected",
          description: `Withdrawal of ${parseFloat(
            withdrawal.amount
          ).toLocaleString()} XNRT rejected`,
        });

        res.json({ message: "Withdrawal rejected" });
      } catch (error) {
        console.error("Error rejecting withdrawal:", error);
        res.status(500).json({ message: "Failed to reject withdrawal" });
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

        // Ensure tier exists
        const tierKey = TRUST_LOAN_CONFIG.programKey as unknown as StakingTier;
        const tier = STAKING_TIERS[tierKey];
        if (!tier) {
          return res
            .status(400)
            .json({ message: "Trust Loan tier not configured." });
        }

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
          unlockMet: false,
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

  const httpServer = createServer(app);
  return httpServer;
}
