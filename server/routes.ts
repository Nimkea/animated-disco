import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage, generateAnonymizedHandle } from "./storage";
import { requireAuth, requireAdmin, validateCSRF } from "./auth/middleware";
import authRoutes from "./auth/routes";
import { STAKING_TIERS, type StakingTier } from "@shared/schema";
import { PrismaClient, Prisma } from "@prisma/client";
import { notifyUser, sendPushNotification } from "./notifications";
import webpush from "web-push";
import rateLimit from "express-rate-limit";
import { verifyBscUsdtDeposit } from "./services/verifyBscUsdt";
import { ethers } from "ethers";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || "").replace(/^"publicKey":"/, '').replace(/"$/, '');
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || "").replace(/^"privateKey":"/, '').replace(/}$/, '').replace(/"$/, '');
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@xnrt.org";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const pushSubscriptionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many subscription requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // CSP violation report endpoint
  app.post('/csp-report', (req, res) => {
    console.log('[CSP Violation]', JSON.stringify(req.body, null, 2));
    res.status(204).end();
  });

  // Auth routes
  app.use('/auth', authRoutes);

  // Balance routes
  app.get('/api/balance', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const balance = await storage.getBalance(userId);
      res.json(balance || { xnrtBalance: "0", stakingBalance: "0", miningBalance: "0", referralBalance: "0", totalEarned: "0" });
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Stats route
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      const miningSessions = await storage.getMiningHistory(userId);
      const referrals = await storage.getReferralsByReferrer(userId);
      const recentActivity = await storage.getActivities(userId, 5);

      res.json({
        activeStakes: stakes.filter(s => s.status === "active").length,
        miningSessions: miningSessions.filter(s => s.status === "completed").length,
        totalReferrals: referrals.length,
        recentActivity,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Staking routes
  app.get('/api/stakes', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      res.json(stakes);
    } catch (error) {
      console.error("Error fetching stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });

  app.post('/api/stakes', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { tier, amount } = req.body;

      if (!STAKING_TIERS[tier as StakingTier]) {
        return res.status(400).json({ message: "Invalid staking tier" });
      }

      const tierConfig = STAKING_TIERS[tier as StakingTier];
      const stakeAmount = parseFloat(amount);

      if (stakeAmount < tierConfig.minAmount || stakeAmount > tierConfig.maxAmount) {
        return res.status(400).json({ message: `Stake amount must be between ${tierConfig.minAmount} and ${tierConfig.maxAmount} XNRT` });
      }

      const balance = await storage.getBalance(userId);
      if (!balance || parseFloat(balance.xnrtBalance) < stakeAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + tierConfig.duration * 24 * 60 * 60 * 1000);

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

  app.post('/api/stakes/process-rewards', requireAuth, validateCSRF, async (req, res) => {
    try {
      await storage.processStakingRewards();
      res.json({ success: true, message: "Staking rewards processed successfully" });
    } catch (error) {
      console.error("Error processing staking rewards:", error);
      res.status(500).json({ message: "Failed to process staking rewards" });
    }
  });

  app.post('/api/stakes/:id/withdraw', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakeId = req.params.id;

      const stake = await storage.getStakeById(stakeId);

      if (!stake) {
        return res.status(404).json({ message: "Stake not found" });
      }

      if (stake.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Check if stake has already been withdrawn
      if (stake.status !== "completed" && stake.status !== "active") {
        return res.status(400).json({ message: "Stake has already been withdrawn or is not ready for withdrawal" });
      }

      // Check if stake has matured
      if (new Date(stake.endDate) > new Date()) {
        return res.status(400).json({ message: "Stake has not matured yet" });
      }

      // Calculate final profit using the PERSISTED daily rate from stake creation
      const dailyRate = parseFloat(stake.dailyRate) / 100;
      const startDate = new Date(stake.startDate);
      const endDate = new Date(stake.endDate);
      const totalDurationDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate total profit for the full duration
      const stakeAmount = parseFloat(stake.amount);
      const dailyProfit = stakeAmount * dailyRate;
      const totalProfit = dailyProfit * totalDurationDays;

      // Atomic status update: only succeeds if status is still 'active'
      const withdrawnStake = await storage.atomicWithdrawStake(stakeId, totalProfit.toString());
      
      if (!withdrawnStake) {
        // Another request already withdrew this stake
        return res.status(409).json({ message: "Stake has already been withdrawn" });
      }

      // Get current balance
      const balance = await storage.getBalance(userId);
      if (!balance) {
        return res.status(404).json({ message: "Balance not found" });
      }

      const totalWithdrawalAmount = stakeAmount + totalProfit;

      // Transfer stake amount + profit to main balance
      await storage.updateBalance(userId, {
        xnrtBalance: (parseFloat(balance.xnrtBalance) + totalWithdrawalAmount).toString(),
        stakingBalance: (parseFloat(balance.stakingBalance) - stakeAmount).toString(),
      });

      // Log activity
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
  });

  // Mining routes
  app.get('/api/mining/current', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const session = await storage.getCurrentMiningSession(userId);
      
      if (!session) {
        // Check last session
        const history = await storage.getMiningHistory(userId);
        const lastSession = history[0];
        
        if (!lastSession) {
          // First time mining
          return res.json({ nextAvailable: new Date() });
        }
        
        res.json({ nextAvailable: lastSession.nextAvailable });
      } else {
        res.json(session);
      }
    } catch (error) {
      console.error("Error fetching mining session:", error);
      res.status(500).json({ message: "Failed to fetch mining session" });
    }
  });

  app.get('/api/mining/history', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const sessions = await storage.getMiningHistory(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching mining history:", error);
      res.status(500).json({ message: "Failed to fetch mining history" });
    }
  });

  app.post('/api/mining/start', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      
      // Check if user already has an active session
      const currentSession = await storage.getCurrentMiningSession(userId);
      if (currentSession && currentSession.status === "active") {
        return res.status(400).json({ message: "You already have an active mining session" });
      }

      const startTime = new Date();
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const session = await storage.createMiningSession({
        userId,
        baseReward: 10,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: 10,
        startTime,
        endTime,
        nextAvailable: new Date(), // Set to now so user can restart immediately after completion
        status: "active",
      });

      res.json(session);
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });

  // Auto-completion endpoint (processes expired mining sessions)
  app.post('/api/mining/process-rewards', requireAuth, validateCSRF, async (req, res) => {
    try {
      await storage.processMiningRewards();
      res.json({ success: true, message: "Mining rewards processed successfully" });
    } catch (error) {
      console.error("Error processing mining rewards:", error);
      res.status(500).json({ message: "Failed to process mining rewards" });
    }
  });

  app.post('/api/mining/stop', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const session = await storage.getCurrentMiningSession(userId);

      if (!session || session.status !== "active") {
        return res.status(400).json({ message: "No active mining session" });
      }

      await storage.updateMiningSession(session.id, {
        status: "completed",
        endTime: new Date(),
      });

      const xpReward = session.finalReward;
      const xnrtReward = session.finalReward * 0.5;

      // Update user XP
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUser(userId, {
          xp: (user.xp || 0) + xpReward,
        });
      }

      // Update user balance with XNRT rewards
      const balance = await storage.getBalance(userId);
      if (balance) {
        await storage.updateBalance(userId, {
          miningBalance: (parseFloat(balance.miningBalance) + xnrtReward).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + xnrtReward).toString(),
        });
      }

      // Log activity
      await storage.createActivity({
        userId,
        type: "mining_completed",
        description: `Completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(1)} XNRT`,
      });

      void notifyUser(userId, {
        type: "mining_completed",
        title: "⛏️ Mining Complete!",
        message: `You earned ${xpReward} XP and ${xnrtReward.toFixed(1)} XNRT from your mining session`,
        url: "/mining",
        metadata: {
          xpReward,
          xnrtReward: xnrtReward.toString(),
          sessionId: session.id,
        },
      }).catch(err => {
        console.error('Error sending mining notification (non-blocking):', err);
      });

      // Check and unlock achievements
      await storage.checkAndUnlockAchievements(userId);

      res.json({ xpReward, xnrtReward });
    } catch (error) {
      console.error("Error stopping mining:", error);
      res.status(500).json({ message: "Failed to stop mining" });
    }
  });

  // Referral routes
  app.get('/api/referrals/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const referrals = await storage.getReferralsByReferrer(userId);
      const balance = await storage.getBalance(userId);

      const level1Total = referrals.filter(r => r.level === 1).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level2Total = referrals.filter(r => r.level === 2).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level3Total = referrals.filter(r => r.level === 3).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const directCommissions = level1Total + level2Total + level3Total;
      const actualBalance = parseFloat(balance?.referralBalance || "0");
      const companyCommissions = actualBalance - directCommissions;

      const stats = {
        level1Count: referrals.filter(r => r.level === 1).length,
        level2Count: referrals.filter(r => r.level === 2).length,
        level3Count: referrals.filter(r => r.level === 3).length,
        level1Commission: level1Total.toString(),
        level2Commission: level2Total.toString(),
        level3Commission: level3Total.toString(),
        totalCommission: referrals.reduce((sum, r) => sum + parseFloat(r.totalCommission), 0).toString(),
        actualBalance: actualBalance.toString(),
        companyCommissions: companyCommissions.toString(),
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.get('/api/referrals/tree', requireAuth, async (req, res) => {
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
  app.get('/api/notifications', requireAuth, async (req, res) => {
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

  app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.authUser!.id;
      
      // Get all user notifications to verify ownership
      const userNotifications = await storage.getNotifications(userId, 1000);
      const notification = userNotifications.find(n => n.id === id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Push Notification routes
  app.get('/api/push/vapid-public-key', async (req, res) => {
    try {
      res.json({ publicKey: VAPID_PUBLIC_KEY });
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      res.status(500).json({ message: "Failed to get VAPID public key" });
    }
  });

  app.post('/api/push/subscribe', requireAuth, pushSubscriptionLimiter, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { endpoint, keys, expirationTime } = req.body;

      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ message: "Invalid endpoint" });
      }

      if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
        return res.status(400).json({ message: "Invalid subscription keys" });
      }

      if (!endpoint.startsWith('https://')) {
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
  });

  app.delete('/api/push/unsubscribe', requireAuth, pushSubscriptionLimiter, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { endpoint } = req.body;

      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ message: "Invalid endpoint" });
      }

      await storage.deletePushSubscription(userId, endpoint);
      res.json({ message: "Successfully unsubscribed from push notifications" });
    } catch (error) {
      console.error("Error deleting push subscription:", error);
      res.status(500).json({ message: "Failed to delete push subscription" });
    }
  });

  app.get('/api/push/subscriptions', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const subscriptions = await storage.getUserPushSubscriptions(userId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error getting push subscriptions:", error);
      res.status(500).json({ message: "Failed to get push subscriptions" });
    }
  });

  app.post('/api/admin/push/test', requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { userId, title, body } = req.body;

      if (!userId || !title || !body) {
        return res.status(400).json({ message: "userId, title, and body are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await sendPushNotification(userId, { title, body });
      res.json({ message: "Test push notification sent successfully" });
    } catch (error) {
      console.error("Error sending test push notification:", error);
      res.status(500).json({ message: "Failed to send test push notification" });
    }
  });

  // Leaderboard routes
  app.get('/api/leaderboard/referrals', requireAuth, async (req, res) => {
    try {
      const period = (req.query.period as string) || 'all-time';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const currentUserId = req.authUser!.id;
      
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;
      
      // Calculate date filter based on period
      let dateFilter: string | null = null;
      const now = new Date();
      
      if (period === 'daily') {
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (period === 'weekly') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = weekAgo.toISOString();
      } else if (period === 'monthly') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = monthAgo.toISOString();
      }

      // Use optimized query - single aggregation in database
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
          ${dateFilter ? `AND r."createdAt" >= $1` : ''}
        GROUP BY u.id, u.username, u.email
        HAVING COUNT(r.id) > 0
        ORDER BY COUNT(r.id) DESC, COALESCE(SUM(r."totalCommission"), 0) DESC
        LIMIT $${dateFilter ? '2' : '1'}
      `;

      const leaderboard: any[] = dateFilter 
        ? await storage.raw(query, [dateFilter, limit])
        : await storage.raw(query, [limit]);

      // Find current user's stats
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
          ${dateFilter ? `AND r."createdAt" >= $1` : ''}
        WHERE u.id = $${dateFilter ? '2' : '1'}
        GROUP BY u.id, u.username, u.email
      `;

      const userStats: any[] = dateFilter
        ? await storage.raw(userQuery, [dateFilter, currentUserId])
        : await storage.raw(userQuery, [currentUserId]);

      const userPosition = leaderboard.findIndex(item => item.userId === currentUserId);

      res.json({
        leaderboard: leaderboard.map((item, index) => {
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
        }),
        userPosition: userPosition === -1 && userStats.length > 0 ? (() => {
          const baseData = {
            totalReferrals: parseInt(userStats[0].totalReferrals),
            totalCommission: userStats[0].totalCommission.toString(),
            level1Count: parseInt(userStats[0].level1Count),
            level2Count: parseInt(userStats[0].level2Count),
            level3Count: parseInt(userStats[0].level3Count),
            rank: userPosition + 1,
          };
          
          if (isAdmin) {
            return {
              ...baseData,
              userId: userStats[0].userId,
              username: userStats[0].username,
              email: userStats[0].email,
              displayName: userStats[0].username || userStats[0].email,
            };
          } else {
            return {
              ...baseData,
              displayName: 'You',
            };
          }
        })() : null,
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get('/api/leaderboard/xp', requireAuth, async (req, res) => {
    try {
      const period = (req.query.period as string) || 'all-time';
      const category = (req.query.category as string) || 'overall';
      const currentUserId = req.authUser!.id;
      
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;

      const result = await storage.getXPLeaderboard(currentUserId, period, category, isAdmin);
      res.json(result);
    } catch (error) {
      console.error("Error fetching XP leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch XP leaderboard" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const transactions = await storage.getTransactionsByUser(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/transactions/deposits', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const deposits = await storage.getTransactionsByUser(userId, "deposit");
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  app.get('/api/transactions/withdrawals', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const withdrawals = await storage.getTransactionsByUser(userId, "withdrawal");
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Wallet Linking API
  app.get('/api/wallet/me', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const wallets = await prisma.linkedWallet.findMany({
        where: { userId, active: true },
        select: { address: true, linkedAt: true },
        orderBy: { linkedAt: 'desc' }
      });
      res.json(wallets.map(w => w.address));
    } catch (error) {
      console.error("Error fetching linked wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.get('/api/wallet/link/challenge', requireAuth, async (req, res) => {
    try {
      const { address } = req.query;
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ message: "Address required" });
      }

      const normalized = address.toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      const nonce = nanoid(16);
      const appDomain = process.env.APP_DOMAIN || 'localhost:5000';
      const message = `Sign this message to link your wallet to XNRT.\n\nAddress: ${normalized}\nNonce: ${nonce}\nDomain: ${appDomain}`;

      // Store nonce temporarily in session or memory (expires in 10 min)
      (req.session as any).walletLinkNonce = { nonce, address: normalized, expiresAt: Date.now() + 10 * 60 * 1000 };
      
      res.json({ message, nonce });
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).json({ message: "Failed to generate challenge" });
    }
  });

  app.post('/api/wallet/link/confirm', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { address, signature, nonce } = req.body;

      if (!address || !signature || !nonce) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify nonce from session
      const storedNonce = (req.session as any).walletLinkNonce;
      if (!storedNonce || storedNonce.nonce !== nonce || storedNonce.address !== address.toLowerCase()) {
        return res.status(400).json({ message: "Invalid or expired nonce" });
      }

      if (Date.now() > storedNonce.expiresAt) {
        return res.status(400).json({ message: "Nonce expired" });
      }

      // Reconstruct and verify signature
      const appDomain = process.env.APP_DOMAIN || 'localhost:5000';
      const message = `Sign this message to link your wallet to XNRT.\n\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nDomain: ${appDomain}`;
      
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.status(400).json({ message: "Signature verification failed" });
      }

      // Check if already linked to another user
      const existing = await prisma.linkedWallet.findFirst({
        where: { address: address.toLowerCase(), active: true }
      });

      if (existing && existing.userId !== userId) {
        return res.status(409).json({ message: "This wallet is already linked to another account" });
      }

      if (existing && existing.userId === userId) {
        return res.json({ address: existing.address, alreadyLinked: true });
      }

      // Link wallet
      const linked = await prisma.linkedWallet.create({
        data: {
          userId,
          address: address.toLowerCase(),
          signature,
          nonce
        }
      });

      // Clear nonce
      delete (req.session as any).walletLinkNonce;

      res.json({ address: linked.address });
    } catch (error) {
      console.error("Error linking wallet:", error);
      res.status(500).json({ message: "Failed to link wallet" });
    }
  });

  app.post('/api/wallet/report-deposit', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      let { transactionHash, amount, description } = req.body;

      if (!transactionHash || !amount) {
        return res.status(400).json({ message: "Transaction hash and amount required" });
      }

      // Normalize transaction hash
      transactionHash = String(transactionHash).trim().toLowerCase();

      // Validate transaction hash format
      if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
        return res.status(400).json({ message: "Invalid transaction hash format" });
      }

      // Check if already processed (in transactions table)
      const existingTx = await prisma.transaction.findFirst({
        where: { transactionHash }
      });

      if (existingTx) {
        return res.status(409).json({ 
          message: "This deposit has already been credited",
          alreadyProcessed: true 
        });
      }

      // Check if report already exists
      const existingReport = await prisma.depositReport.findFirst({
        where: { transactionHash }
      });

      if (existingReport) {
        return res.status(409).json({ message: "This deposit has already been reported" });
      }

      // Verify transaction on BSC
      const { verifyBscUsdtDeposit } = await import('./services/verifyBscUsdt');
      const treasuryAddress = process.env.XNRT_WALLET || "";
      const verification = await verifyBscUsdtDeposit({
        txHash: transactionHash,
        expectedTo: treasuryAddress,
        minAmount: amount,
        requiredConf: Number(process.env.BSC_CONFIRMATIONS || 12)
      });

      // If verification failed or insufficient confirmations
      if (!verification.verified) {
        // Create deposit report for admin review
        const report = await prisma.depositReport.create({
          data: {
            userId,
            transactionHash,
            amount: new Prisma.Decimal(amount),
            description: description || `Verification: ${verification.reason}`,
            status: 'pending'
          }
        });

        return res.json({ 
          message: "Report submitted for admin review",
          reportId: report.id,
          reason: verification.reason
        });
      }

      // Get transaction receipt to find sender address
      const provider = new (await import('ethers')).ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
      const receipt = await provider.getTransactionReceipt(transactionHash);
      const transaction = await provider.getTransaction(transactionHash);
      const fromAddress = transaction?.from?.toLowerCase() || "";

      // Check if sender is a linked wallet of this user
      const linkedWallet = await prisma.linkedWallet.findFirst({
        where: { 
          userId,
          address: fromAddress,
          active: true 
        }
      });

      const xnrtRate = Number(process.env.XNRT_RATE_USDT || 100);
      const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || 0);
      const usdtAmount = verification.amountOnChain || amount;
      const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
      const xnrtAmount = netUsdt * xnrtRate;

      if (linkedWallet) {
        // Auto-credit: TX is from user's linked wallet
        await prisma.$transaction(async (tx) => {
          // Create approved transaction
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
            }
          });

          // Credit balance atomically
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

        console.log(`[ReportDeposit] Auto-credited ${xnrtAmount} XNRT to user ${userId}`);

        // Send notification (non-blocking)
        const { sendDepositNotification } = await import('./services/depositScanner');
        void sendDepositNotification(userId, xnrtAmount, transactionHash).catch(err => {
          console.error("[ReportDeposit] Notification error:", err);
        });

        return res.json({ 
          message: "Deposit verified and credited automatically!",
          credited: true,
          amount: xnrtAmount
        });
      } else {
        // Create unmatched deposit with user hint (for exchange deposits)
        await prisma.unmatchedDeposit.create({
          data: {
            fromAddress,
            toAddress: treasuryAddress,
            amount: new Prisma.Decimal(usdtAmount),
            transactionHash,
            blockNumber: receipt?.blockNumber || 0,
            confirmations: verification.confirmations,
            reportedByUserId: userId,
            matched: false,
          }
        });

        return res.json({ 
          message: "Deposit verified on blockchain. Admin will credit your account shortly.",
          verified: true,
          pendingAdminReview: true
        });
      }
    } catch (error: any) {
      console.error("Error reporting deposit:", error);
      
      // Check for duplicate key error
      if (error.code === 'P2002' && error.meta?.target?.includes('transactionHash')) {
        return res.status(409).json({ 
          message: "This transaction has already been processed",
          alreadyProcessed: true
        });
      }
      
      res.status(500).json({ message: "Failed to process deposit report" });
    }
  });

  app.post('/api/transactions/deposit', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      let { usdtAmount, transactionHash, proofImageUrl } = req.body;

      if (!usdtAmount || !transactionHash) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Normalize transaction hash to lowercase
      transactionHash = String(transactionHash).trim().toLowerCase();

      // Transaction hash format validation (must be 64-char hex with 0x prefix)
      if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
        return res.status(400).json({ message: "Invalid transaction hash format" });
      }

      // Check for duplicate transaction hash
      const existing = await prisma.transaction.findFirst({
        where: { transactionHash }
      });
      
      if (existing) {
        return res.status(409).json({ 
          message: "This transaction hash was already used for a deposit." 
        });
      }

      // Validate proofImageUrl if provided (should be base64 data URL or valid URL)
      if (proofImageUrl) {
        const isBase64DataUrl = proofImageUrl.startsWith('data:image/');
        const isValidUrl = /^https?:\/\//.test(proofImageUrl);
        
        if (!isBase64DataUrl && !isValidUrl) {
          return res.status(400).json({ message: "Invalid proof image URL format" });
        }
      }

      const rate = Number(process.env.XNRT_RATE_USDT ?? 100);
      const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 0);
      const usdt = Number(usdtAmount);
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
      // Handle unique constraint violation from database
      if (error.code === 'P2002' && error.meta?.target?.includes('transactionHash')) {
        return res.status(409).json({
          message: "This transaction hash was already used for a deposit."
        });
      }
      console.error("Error creating deposit:", error);
      res.status(500).json({ message: "Failed to create deposit" });
    }
  });

  app.post('/api/transactions/withdrawal', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { source, amount, walletAddress } = req.body;

      if (!source || !amount || !walletAddress) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const withdrawAmount = parseFloat(amount);
      const fee = (withdrawAmount * 2) / 100;
      const netAmount = withdrawAmount - fee;
      const usdtAmount = netAmount / 100;

      const balance = await storage.getBalance(userId);
      let availableBalance = 0;
      
      switch (source) {
        case "main":
          availableBalance = parseFloat(balance?.xnrtBalance || "0");
          break;
        case "staking":
          availableBalance = parseFloat(balance?.stakingBalance || "0");
          break;
        case "mining":
          availableBalance = parseFloat(balance?.miningBalance || "0");
          break;
        case "referral":
          availableBalance = parseFloat(balance?.referralBalance || "0");
          break;
        default:
          return res.status(400).json({ message: "Invalid source" });
      }

      if (withdrawAmount > availableBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      if (source === "referral" && withdrawAmount < 5000) {
        return res.status(400).json({ message: "Minimum withdrawal from referral balance is 5,000 XNRT" });
      }

      if (source === "mining" && withdrawAmount < 5000) {
        return res.status(400).json({ message: "Minimum withdrawal from mining balance is 5,000 XNRT" });
      }

      const transaction = await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount: amount.toString(),
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
  });

  // Task routes
  app.get('/api/tasks/user', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const userTasks = await storage.getUserTasks(userId);
      const allTasks = await storage.getAllTasks();
      
      // Populate task details
      const populated = await Promise.all(
        userTasks.map(async (ut) => {
          const task = allTasks.find(t => t.id === ut.taskId);
          return { ...ut, task };
        })
      );

      res.json(populated);
    } catch (error) {
      console.error("Error fetching user tasks:", error);
      res.status(500).json({ message: "Failed to fetch user tasks" });
    }
  });

  app.post('/api/tasks/:taskId/complete', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { taskId } = req.params;

      const userTasks = await storage.getUserTasks(userId);
      const userTask = userTasks.find(ut => ut.taskId === taskId);

      if (!userTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (userTask.completed) {
        return res.status(400).json({ message: "Task already completed" });
      }

      const allTasks = await storage.getAllTasks();
      const task = allTasks.find(t => t.id === taskId);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Mark as completed
      await storage.updateUserTask(userTask.id, {
        completed: true,
        completedAt: new Date(),
        progress: userTask.maxProgress,
      });

      // Update user XP and balance
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
          xnrtBalance: (parseFloat(balance.xnrtBalance) + xnrtAmount).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + xnrtAmount).toString(),
        });
      }

      // Log activity
      await storage.createActivity({
        userId,
        type: "task_completed",
        description: `Completed task: ${task.title}`,
      });

      // Check and unlock achievements
      await storage.checkAndUnlockAchievements(userId);

      res.json({ xpReward: task.xpReward, xnrtReward: task.xnrtReward });
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Achievement routes
  app.get('/api/achievements', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const allAchievements = await storage.getAllAchievements();
      const userAchievements = await storage.getUserAchievements(userId);

      const populated = allAchievements.map(achievement => {
        const unlocked = userAchievements.find(ua => ua.achievementId === achievement.id);
        return {
          ...achievement,
          unlocked: !!unlocked,
          unlockedAt: unlocked?.unlockedAt,
        };
      });

      res.json(populated);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Profile stats route
  app.get('/api/profile/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      const miningSessions = await storage.getMiningHistory(userId);
      const referrals = await storage.getReferralsByReferrer(userId);
      const userTasks = await storage.getUserTasks(userId);
      const userAchievements = await storage.getUserAchievements(userId);

      res.json({
        totalReferrals: referrals.length,
        activeStakes: stakes.filter(s => s.status === "active").length,
        totalStaked: stakes.reduce((sum, s) => sum + parseFloat(s.amount), 0),
        miningSessions: miningSessions.filter(s => s.status === "completed").length,
        totalMined: miningSessions.reduce((sum, s) => sum + s.finalReward, 0),
        referralEarnings: referrals.reduce((sum, r) => sum + parseFloat(r.totalCommission), 0),
        tasksCompleted: userTasks.filter(t => t.completed).length,
        achievementsUnlocked: userAchievements.length,
      });
    } catch (error) {
      console.error("Error fetching profile stats:", error);
      res.status(500).json({ message: "Failed to fetch profile stats" });
    }
  });

  // Daily check-in route
  app.post('/api/checkin', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStart = today.toISOString();

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
      const lastCheckInDay = lastCheckIn ? new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate()) : null;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = 1;
      if (lastCheckInDay && lastCheckInDay.getTime() === yesterday.getTime()) {
        newStreak = (user.streak || 0) + 1;
      }

      const streakReward = Math.min(newStreak * 10, 100);
      const xpReward = Math.min(newStreak * 5, 50);

      // Check if already checked in today
      if (lastCheckIn && lastCheckInDay && lastCheckInDay.getTime() === today.getTime()) {
        return res.status(400).json({ message: "Already checked in today" });
      }

      // Update user with new check-in data
      await storage.updateUser(userId, {
        lastCheckIn: now,
        streak: newStreak,
        xp: (user.xp || 0) + xpReward,
      });

      const balance = await storage.getBalance(userId);
      if (balance) {
        await storage.updateBalance(userId, {
          xnrtBalance: (parseFloat(balance.xnrtBalance) + streakReward).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + streakReward).toString(),
        });
      }

      await storage.createActivity({
        userId,
        type: "daily_checkin",
        description: `Day ${newStreak} streak! Earned ${streakReward} XNRT and ${xpReward} XP`,
      });

      // Check and unlock achievements
      await storage.checkAndUnlockAchievements(userId);

      res.json({ 
        streak: newStreak, 
        xnrtReward: streakReward,
        xpReward,
        message: `Day ${newStreak} check-in complete!` 
      });
    } catch (error) {
      console.error("Error during check-in:", error);
      res.status(500).json({ message: "Failed to check in" });
    }
  });

  // Check-in history route
  app.get('/api/checkin/history', requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { year, month } = req.query;
      
      // Default to current month if not specified
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth();
      
      // Calculate start and end dates for the month
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
      
      // Query activities with type='daily_checkin' for the date range
      const checkinActivities = await prisma.activity.findMany({
        where: {
          userId,
          type: 'daily_checkin',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      
      // Extract dates from activities
      const checkinDates = checkinActivities.map((activity: { createdAt: Date | null }) => 
        new Date(activity.createdAt!).toISOString().split('T')[0]
      );
      
      res.json({ 
        dates: checkinDates,
        year: targetYear,
        month: targetMonth,
      });
    } catch (error) {
      console.error("Error fetching check-in history:", error);
      res.status(500).json({ message: "Failed to fetch check-in history" });
    }
  });

  // Admin routes
  app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allDeposits = await storage.getAllTransactions("deposit");
      const allWithdrawals = await storage.getAllTransactions("withdrawal");
      const activeStakes = await storage.getAllActiveStakes();
      
      const pendingDeposits = allDeposits.filter(d => d.status === "pending");
      const pendingWithdrawals = allWithdrawals.filter(w => w.status === "pending");

      const totalDeposits = allDeposits
        .filter(d => d.status === "approved")
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const totalWithdrawals = allWithdrawals
        .filter(w => w.status === "approved")
        .reduce((sum, w) => sum + parseFloat(w.amount), 0);

      // Today's stats (UTC)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      const todayDeposits = allDeposits
        .filter(d => d.status === "approved" && d.createdAt && new Date(d.createdAt) >= today)
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);
      
      const todayWithdrawals = allWithdrawals
        .filter(w => w.status === "approved" && w.createdAt && new Date(w.createdAt) >= today)
        .reduce((sum, w) => sum + parseFloat(w.amount), 0);
      
      const todayNewUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= today).length;
      
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

  app.get('/api/admin/deposits/pending', requireAuth, requireAdmin, async (req, res) => {
    try {
      const pendingDeposits = await storage.getPendingTransactions("deposit");
      res.json(pendingDeposits);
    } catch (error) {
      console.error("Error fetching pending deposits:", error);
      res.status(500).json({ message: "Failed to fetch pending deposits" });
    }
  });

  app.get('/api/admin/withdrawals/pending', requireAuth, requireAdmin, async (req, res) => {
    try {
      const pendingWithdrawals = await storage.getPendingTransactions("withdrawal");
      res.json(pendingWithdrawals);
    } catch (error) {
      console.error("Error fetching pending withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch pending withdrawals" });
    }
  });

  // Verify deposit on blockchain
  app.post('/api/admin/deposits/:id/verify', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
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
        minAmount: deposit.usdtAmount ? parseFloat(deposit.usdtAmount) : undefined,
        requiredConf: Number(process.env.BSC_CONFIRMATIONS ?? 12),
      });

      // Update transaction with verification results
      await storage.updateTransaction(id, {
        verified: result.verified,
        confirmations: result.confirmations,
        verificationData: result as any,
      });

      res.json(result);
    } catch (error) {
      console.error("Error verifying deposit:", error);
      res.status(500).json({ message: "Failed to verify deposit" });
    }
  });

  app.post('/api/admin/deposits/:id/approve', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const deposit = await storage.getTransactionById(id);

      if (!deposit || deposit.type !== "deposit") {
        return res.status(404).json({ message: "Deposit not found" });
      }

      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Deposit already processed" });
      }

      if (!deposit.verified) {
        return res.status(400).json({ message: "Deposit not verified on-chain yet" });
      }

      // Use atomic Prisma transaction for safe balance updates
      await prisma.$transaction(async (tx) => {
        // Credit safely using increment
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
            adminNotes: notes || deposit.adminNotes,
            approvedBy: req.authUser!.id,
            approvedAt: new Date(),
          },
        });
      });

      // Distribute referral commissions on deposit
      await storage.distributeReferralCommissions(deposit.userId, parseFloat(deposit.amount));

      // Log activity
      await storage.createActivity({
        userId: deposit.userId,
        type: "deposit_approved",
        description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT approved`,
      });

      void notifyUser(deposit.userId, {
        type: "deposit_approved",
        title: "💰 Deposit Approved!",
        message: `Your deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT has been approved and credited to your account`,
        url: "/wallet",
        metadata: {
          amount: deposit.amount,
          transactionId: id,
        },
      }).catch(err => {
        console.error('Error sending deposit notification (non-blocking):', err);
      });

      res.json({ message: "Deposit approved successfully" });
    } catch (error) {
      console.error("Error approving deposit:", error);
      res.status(500).json({ message: "Failed to approve deposit" });
    }
  });

  app.post('/api/admin/deposits/:id/reject', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const deposit = await storage.getTransactionById(id);

      if (!deposit || deposit.type !== "deposit") {
        return res.status(404).json({ message: "Deposit not found" });
      }

      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Deposit already processed" });
      }

      await storage.updateTransaction(id, { status: "rejected" });

      // Log activity
      await storage.createActivity({
        userId: deposit.userId,
        type: "deposit_rejected",
        description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT rejected`,
      });

      res.json({ message: "Deposit rejected" });
    } catch (error) {
      console.error("Error rejecting deposit:", error);
      res.status(500).json({ message: "Failed to reject deposit" });
    }
  });

  // Bulk approve deposits
  app.post('/api/admin/deposits/bulk-approve', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { depositIds, notes } = req.body;

      if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
        return res.status(400).json({ message: "Invalid deposit IDs" });
      }

      // Process all deposits sequentially to prevent race conditions
      const successful: string[] = [];
      const failed: Array<{ id: string; error: string }> = [];
      const errors: string[] = [];

      for (const id of depositIds) {
        try {
          const deposit = await storage.getTransactionById(id);

          if (!deposit || deposit.type !== "deposit") {
            throw new Error(`Deposit ${id} not found`);
          }

          if (deposit.status !== "pending") {
            throw new Error(`Deposit ${id} already processed`);
          }

          if (!deposit.verified) {
            throw new Error(`Deposit ${id} not verified on-chain yet`);
          }

          // Use atomic Prisma transaction for safe balance updates
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
                adminNotes: notes || deposit.adminNotes,
                approvedBy: req.authUser!.id,
                approvedAt: new Date(),
              },
            });
          });

          // Distribute referral commissions
          await storage.distributeReferralCommissions(deposit.userId, parseFloat(deposit.amount));

          // Log activity
          await storage.createActivity({
            userId: deposit.userId,
            type: "deposit_approved",
            description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT approved${notes ? ` - ${notes}` : ''}`,
          });

          void notifyUser(deposit.userId, {
            type: "deposit_approved",
            title: "💰 Deposit Approved!",
            message: `Your deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT has been approved and credited to your account`,
            url: "/wallet",
            metadata: {
              amount: deposit.amount,
              transactionId: id,
            },
          }).catch(err => {
            console.error('Error sending bulk deposit notification (non-blocking):', err);
          });

          successful.push(id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failed.push({ 
            id, 
            error: errorMessage
          });
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
  });

  // Bulk reject deposits
  app.post('/api/admin/deposits/bulk-reject', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { depositIds, notes } = req.body;

      if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
        return res.status(400).json({ message: "Invalid deposit IDs" });
      }

      // Process all deposits sequentially to prevent race conditions
      const successful: string[] = [];
      const failed: Array<{ id: string; error: string }> = [];
      const errors: string[] = [];

      for (const id of depositIds) {
        try {
          const deposit = await storage.getTransactionById(id);

          if (!deposit || deposit.type !== "deposit") {
            throw new Error(`Deposit ${id} not found`);
          }

          if (deposit.status !== "pending") {
            throw new Error(`Deposit ${id} already processed`);
          }

          // Update transaction status with optional admin notes
          await storage.updateTransaction(id, { 
            status: "rejected",
            adminNotes: notes || deposit.adminNotes,
            approvedBy: req.authUser!.id,
            approvedAt: new Date(),
          });

          // Log activity
          await storage.createActivity({
            userId: deposit.userId,
            type: "deposit_rejected",
            description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT rejected${notes ? ` - ${notes}` : ''}`,
          });

          successful.push(id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failed.push({ 
            id, 
            error: errorMessage
          });
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
  });

  // Unmatched Deposits Admin API
  app.get('/api/admin/unmatched-deposits', requireAuth, requireAdmin, async (req, res) => {
    try {
      const unmatched = await prisma.unmatchedDeposit.findMany({
        where: { matched: false },
        orderBy: { detectedAt: 'desc' },
        take: 100
      });
      res.json(unmatched);
    } catch (error) {
      console.error("Error fetching unmatched deposits:", error);
      res.status(500).json({ message: "Failed to fetch unmatched deposits" });
    }
  });

  app.post('/api/admin/unmatched-deposits/:id/match', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const unmatchedDeposit = await prisma.unmatchedDeposit.findUnique({
        where: { id }
      });

      if (!unmatchedDeposit) {
        return res.status(404).json({ message: "Unmatched deposit not found" });
      }

      if (unmatchedDeposit.matched) {
        return res.status(400).json({ message: "Deposit already matched" });
      }

      // Calculate XNRT amount
      const usdtAmount = parseFloat(unmatchedDeposit.amount.toString());
      const xnrtRate = Number(process.env.XNRT_RATE_USDT || 100);
      const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || 0);
      const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
      const xnrtAmount = netUsdt * xnrtRate;

      // Create approved transaction and credit balance atomically
      await prisma.$transaction(async (tx) => {
        // Create transaction
        await tx.transaction.create({
          data: {
            userId,
            type: "deposit",
            amount: new Prisma.Decimal(xnrtAmount),
            usdtAmount: new Prisma.Decimal(usdtAmount),
            transactionHash: unmatchedDeposit.transactionHash,
            walletAddress: unmatchedDeposit.fromAddress,
            status: "approved",
            verified: true,
            confirmations: unmatchedDeposit.confirmations,
            verificationData: {
              manualMatch: true,
              matchedBy: req.authUser!.id,
              matchedAt: new Date().toISOString(),
            } as any,
            approvedBy: req.authUser!.id,
            approvedAt: new Date(),
          }
        });

        // Credit balance
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

        // Mark as matched
        await tx.unmatchedDeposit.update({
          where: { id },
          data: {
            matched: true,
            matchedUserId: userId,
            matchedAt: new Date(),
          }
        });
      });

      res.json({ message: "Deposit matched and credited successfully" });
    } catch (error) {
      console.error("Error matching deposit:", error);
      res.status(500).json({ message: "Failed to match deposit" });
    }
  });

  // Deposit Reports Admin API
  app.get('/api/admin/deposit-reports', requireAuth, requireAdmin, async (req, res) => {
    try {
      const reports = await prisma.depositReport.findMany({
        where: { status: 'pending' },
        include: {
          user: {
            select: { email: true, username: true }
          }
        },
        orderBy: { reportedAt: 'desc' },
        take: 100
      });
      res.json(reports);
    } catch (error) {
      console.error("Error fetching deposit reports:", error);
      res.status(500).json({ message: "Failed to fetch deposit reports" });
    }
  });

  app.post('/api/admin/deposit-reports/:id/resolve', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution, adminNotes } = req.body;

      if (!resolution || !['approved', 'rejected'].includes(resolution)) {
        return res.status(400).json({ message: "Invalid resolution" });
      }

      const report = await prisma.depositReport.findUnique({
        where: { id }
      });

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (report.status !== 'pending') {
        return res.status(400).json({ message: "Report already resolved" });
      }

      if (resolution === 'approved') {
        // Credit user with reported amount
        const xnrtRate = Number(process.env.XNRT_RATE_USDT || 100);
        const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || 0);
        const usdtAmount = parseFloat(report.amount.toString());
        const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * xnrtRate;

        await prisma.$transaction(async (tx) => {
          // Create approved transaction
          await tx.transaction.create({
            data: {
              userId: report.userId,
              type: "deposit",
              amount: new Prisma.Decimal(xnrtAmount),
              usdtAmount: new Prisma.Decimal(usdtAmount),
              transactionHash: report.transactionHash,
              status: "approved",
              adminNotes: adminNotes || "Credited from deposit report",
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
            }
          });

          // Credit balance
          await tx.balance.upsert({
            where: { userId: report.userId },
            create: {
              userId: report.userId,
              xnrtBalance: new Prisma.Decimal(xnrtAmount),
              totalEarned: new Prisma.Decimal(xnrtAmount),
            },
            update: {
              xnrtBalance: { increment: new Prisma.Decimal(xnrtAmount) },
              totalEarned: { increment: new Prisma.Decimal(xnrtAmount) },
            },
          });

          // Update report status
          await tx.depositReport.update({
            where: { id },
            data: {
              status: 'approved',
              resolvedBy: req.authUser!.id,
              resolvedAt: new Date(),
              adminNotes: adminNotes || null,
            }
          });
        });
      } else {
        // Reject report
        await prisma.depositReport.update({
          where: { id },
          data: {
            status: 'rejected',
            resolvedBy: req.authUser!.id,
            resolvedAt: new Date(),
            adminNotes: adminNotes || null,
          }
        });
      }

      res.json({ message: `Report ${resolution} successfully` });
    } catch (error) {
      console.error("Error resolving deposit report:", error);
      res.status(500).json({ message: "Failed to resolve report" });
    }
  });

  app.post('/api/admin/reconcile-referrals', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      console.log('[RECONCILE] Starting referral commission reconciliation...');
      
      // Get all approved deposits
      const approvedDeposits = await storage.raw(`
        SELECT id, "userId", amount, "createdAt"
        FROM "Transaction"
        WHERE type = 'deposit' AND status = 'approved'
        ORDER BY "createdAt" ASC
      `);

      console.log(`[RECONCILE] Found ${approvedDeposits.length} approved deposits to process`);

      // Clear all existing referral data
      await storage.raw(`DELETE FROM "Referral"`);
      console.log('[RECONCILE] Cleared existing referral records');

      // Reset all referral balances to 0
      await storage.raw(`UPDATE "Balance" SET "referralBalance" = 0`);
      console.log('[RECONCILE] Reset all referral balances');

      // Redistribute commissions for each deposit
      let totalProcessed = 0;
      for (const deposit of approvedDeposits) {
        const amount = parseFloat(deposit.amount);
        console.log(`[RECONCILE] Processing deposit ${deposit.id}: ${amount} XNRT for user ${deposit.userId}`);
        
        await storage.distributeReferralCommissions(deposit.userId, amount);
        totalProcessed++;
      }

      console.log(`[RECONCILE] Reconciliation complete. Processed ${totalProcessed} deposits.`);

      res.json({ 
        message: "Referral commissions reconciled successfully",
        depositsProcessed: totalProcessed
      });
    } catch (error) {
      console.error("Error reconciling referrals:", error);
      res.status(500).json({ message: "Failed to reconcile referrals" });
    }
  });

  app.post('/api/admin/withdrawals/:id/approve', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const withdrawal = await storage.getTransactionById(id);

      if (!withdrawal || withdrawal.type !== "withdrawal") {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      if (withdrawal.status !== "pending") {
        return res.status(400).json({ message: "Withdrawal already processed" });
      }

      await storage.updateTransaction(id, { status: "approved" });

      // Deduct from balance
      const balance = await storage.getBalance(withdrawal.userId);
      if (balance) {
        let sourceBalance: "xnrtBalance" | "stakingBalance" | "miningBalance" | "referralBalance";
        
        switch (withdrawal.source) {
          case "main":
            sourceBalance = "xnrtBalance";
            break;
          case "staking":
            sourceBalance = "stakingBalance";
            break;
          case "mining":
            sourceBalance = "miningBalance";
            break;
          case "referral":
            sourceBalance = "referralBalance";
            break;
          default:
            sourceBalance = "xnrtBalance";
        }
        
        await storage.updateBalance(withdrawal.userId, {
          [sourceBalance]: (parseFloat(balance[sourceBalance]) - parseFloat(withdrawal.amount)).toString(),
        });
      }

      // Log activity
      await storage.createActivity({
        userId: withdrawal.userId,
        type: "withdrawal_approved",
        description: `Withdrawal of ${parseFloat(withdrawal.amount).toLocaleString()} XNRT approved`,
      });

      res.json({ message: "Withdrawal approved successfully" });
    } catch (error) {
      console.error("Error approving withdrawal:", error);
      res.status(500).json({ message: "Failed to approve withdrawal" });
    }
  });

  app.post('/api/admin/withdrawals/:id/reject', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const withdrawal = await storage.getTransactionById(id);

      if (!withdrawal || withdrawal.type !== "withdrawal") {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      if (withdrawal.status !== "pending") {
        return res.status(400).json({ message: "Withdrawal already processed" });
      }

      await storage.updateTransaction(id, { status: "rejected" });

      // Log activity
      await storage.createActivity({
        userId: withdrawal.userId,
        type: "withdrawal_rejected",
        description: `Withdrawal of ${parseFloat(withdrawal.amount).toLocaleString()} XNRT rejected`,
      });

      res.json({ message: "Withdrawal rejected" });
    } catch (error) {
      console.error("Error rejecting withdrawal:", error);
      res.status(500).json({ message: "Failed to reject withdrawal" });
    }
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Fetch balances and stakes for each user
      const usersWithData = await Promise.all(
        allUsers.map(async (user) => {
          const balance = await storage.getBalance(user.id);
          const stakes = await storage.getStakes(user.id);
          const referrals = await storage.getReferralsByReferrer(user.id);
          const transactions = await storage.getTransactionsByUser(user.id);
          
          const activeStakes = stakes.filter(s => s.status === "active").length;
          const totalStaked = stakes
            .filter(s => s.status === "active")
            .reduce((sum, s) => sum + parseFloat(s.amount), 0);
          
          const depositCount = transactions.filter(t => t.type === "deposit" && t.status === "approved").length;
          const withdrawalCount = transactions.filter(t => t.type === "withdrawal" && t.status === "approved").length;

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
            balance: balance ? {
              xnrtBalance: balance.xnrtBalance,
              stakingBalance: balance.stakingBalance,
              miningBalance: balance.miningBalance,
              referralBalance: balance.referralBalance,
              totalEarned: balance.totalEarned,
            } : null,
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
  });

  // Admin Analytics
  app.get('/api/admin/analytics', requireAuth, requireAdmin, async (req, res) => {
    try {
      const allTransactions = await storage.getAllTransactions();
      const allUsers = await storage.getAllUsers();
      const allStakes = await storage.getAllActiveStakes();
      
      // Calculate daily transaction volumes (last 30 days)
      const dailyData: Record<string, { deposits: number; withdrawals: number; revenue: number }> = {};
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      allTransactions.forEach(tx => {
        if (tx.createdAt) {
          const txDate = new Date(tx.createdAt);
          if (txDate >= thirtyDaysAgo) {
            const dateKey = txDate.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { deposits: 0, withdrawals: 0, revenue: 0 };
            }
            
            if (tx.type === 'deposit' && tx.status === 'approved') {
              dailyData[dateKey].deposits += parseFloat(tx.amount);
            } else if (tx.type === 'withdrawal' && tx.status === 'approved') {
              dailyData[dateKey].withdrawals += parseFloat(tx.amount);
              // 2% withdrawal fee
              dailyData[dateKey].revenue += parseFloat(tx.amount) * 0.02;
            }
          }
        }
      });
      
      // User growth (last 30 days)
      const dailyUsers: Record<string, number> = {};
      allUsers.forEach(user => {
        if (user.createdAt) {
          const userDate = new Date(user.createdAt);
          if (userDate >= thirtyDaysAgo) {
            const dateKey = userDate.toISOString().split('T')[0];
            dailyUsers[dateKey] = (dailyUsers[dateKey] || 0) + 1;
          }
        }
      });
      
      // Staking tier distribution
      const stakingTiers = {
        'Royal Sapphire': 0,
        'Legendary Emerald': 0,
        'Imperial Platinum': 0,
        'Mythic Diamond': 0
      };
      
      allStakes.forEach(stake => {
        const amount = parseFloat(stake.amount);
        if (amount >= 100000) stakingTiers['Mythic Diamond']++;
        else if (amount >= 50000) stakingTiers['Imperial Platinum']++;
        else if (amount >= 10000) stakingTiers['Legendary Emerald']++;
        else stakingTiers['Royal Sapphire']++;
      });
      
      // Referral statistics - Use Prisma aggregation for performance
      const [balancesAgg, referralsAgg] = await Promise.all([
        // Aggregate all user balances in one query
        prisma.balance.aggregate({
          _sum: {
            referralBalance: true
          }
        }),
        // Get referral counts
        prisma.referral.groupBy({
          by: ['referrerId'],
          _count: true
        })
      ]);
      
      const totalReferralBalance = balancesAgg._sum.referralBalance || 0;
      const activeReferrers = referralsAgg.length;
      const totalReferrals = referralsAgg.reduce((sum, r) => sum + r._count, 0);
      
      const referralStats = {
        totalCommissions: Number(totalReferralBalance),
        totalReferrals,
        activeReferrers
      };
      
      // Calculate total revenue
      const totalRevenue = Object.values(dailyData).reduce(
        (sum, day) => sum + day.revenue, 
        0
      );
      
      res.json({
        dailyTransactions: Object.entries(dailyData).map(([date, data]) => ({
          date,
          deposits: data.deposits,
          withdrawals: data.withdrawals,
          revenue: data.revenue
        })).sort((a, b) => a.date.localeCompare(b.date)),
        userGrowth: Object.entries(dailyUsers).map(([date, count]) => ({
          date,
          newUsers: count
        })).sort((a, b) => a.date.localeCompare(b.date)),
        stakingTiers,
        referralStats,
        totalRevenue,
        totalUsers: allUsers.length,
        totalStakes: allStakes.length
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Admin Activity Logs
  app.get('/api/admin/activities', requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Get all activities from admin users
      const adminUsers = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true }
      });
      
      const adminUserIds = adminUsers.map(u => u.id);
      
      const activities = await prisma.activity.findMany({
        where: {
          OR: [
            { userId: { in: adminUserIds } },
            { type: { in: ['deposit_approved', 'deposit_rejected', 'withdrawal_approved', 'withdrawal_rejected'] } }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              isAdmin: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching admin activities:", error);
      res.status(500).json({ message: "Failed to fetch admin activities" });
    }
  });

  // Platform Info
  app.get('/api/admin/info', requireAuth, requireAdmin, async (req, res) => {
    try {
      const [
        totalUsers,
        totalDeposits,
        totalWithdrawals,
        totalStakes,
        totalActivities
      ] = await Promise.all([
        prisma.user.count(),
        prisma.transaction.count({ where: { type: 'deposit' } }),
        prisma.transaction.count({ where: { type: 'withdrawal' } }),
        prisma.stake.count(),
        prisma.activity.count()
      ]);
      
      const stakingTiers = [
        { name: 'Royal Sapphire', min: 1000, max: 9999, apy: 5, duration: 30 },
        { name: 'Legendary Emerald', min: 10000, max: 49999, apy: 8, duration: 60 },
        { name: 'Imperial Platinum', min: 50000, max: 99999, apy: 12, duration: 90 },
        { name: 'Mythic Diamond', min: 100000, max: null, apy: 15, duration: 180 }
      ];
      
      res.json({
        platform: {
          name: 'XNRT',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        },
        statistics: {
          totalUsers,
          totalDeposits,
          totalWithdrawals,
          totalStakes,
          totalActivities
        },
        configuration: {
          stakingTiers,
          depositRate: 100,
          withdrawalFee: 2,
          companyWallet: '0x715C32deC9534d2fB34e0B567288AF8d895efB59'
        }
      });
    } catch (error) {
      console.error("Error fetching platform info:", error);
      res.status(500).json({ message: "Failed to fetch platform info" });
    }
  });

  // ===== ADMIN CRUD: STAKES =====
  app.get('/api/admin/stakes', requireAuth, requireAdmin, async (req, res) => {
    try {
      const stakes = await prisma.stake.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(stakes);
    } catch (error) {
      console.error("Error fetching stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });

  app.post('/api/admin/stakes', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { userId, tier, amount, duration } = req.body;

      if (!userId || !tier || !amount || !duration) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const dailyRates: Record<string, number> = {
        'royal_sapphire': 1.1,
        'legendary_emerald': 1.4,
        'imperial_platinum': 1.5,
        'mythic_diamond': 2.0
      };

      const dailyRate = dailyRates[tier] || 1.1;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(duration));

      const stake = await prisma.stake.create({
        data: {
          userId,
          tier,
          amount: new Prisma.Decimal(amount),
          dailyRate: new Prisma.Decimal(dailyRate),
          duration: parseInt(duration),
          startDate: new Date(),
          endDate,
          totalProfit: new Prisma.Decimal(0),
          status: 'active'
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_stake_created',
        description: `Admin created stake for ${stake.user.username}: ${amount} XNRT (${tier}, ${duration} days)`
      });

      res.json(stake);
    } catch (error) {
      console.error("Error creating stake:", error);
      res.status(500).json({ message: "Failed to create stake" });
    }
  });

  app.put('/api/admin/stakes/:id', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, totalProfit } = req.body;

      const data: any = {};
      if (status !== undefined) data.status = status;
      if (totalProfit !== undefined) {
        const parsed = typeof totalProfit === 'string' ? parseFloat(totalProfit) : totalProfit;
        data.totalProfit = new Prisma.Decimal(parsed);
      }

      const stake = await prisma.stake.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_stake_updated',
        description: `Admin updated stake for ${stake.user.username}`
      });

      res.json(stake);
    } catch (error) {
      console.error("Error updating stake:", error);
      res.status(500).json({ message: "Failed to update stake" });
    }
  });

  app.delete('/api/admin/stakes/:id', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;

      const stake = await prisma.stake.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              username: true
            }
          }
        }
      });

      if (!stake) {
        return res.status(404).json({ message: "Stake not found" });
      }

      await prisma.stake.delete({
        where: { id }
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_stake_deleted',
        description: `Admin deleted stake for ${stake.user.username}`
      });

      res.json({ message: "Stake deleted successfully" });
    } catch (error) {
      console.error("Error deleting stake:", error);
      res.status(500).json({ message: "Failed to delete stake" });
    }
  });

  // ===== ADMIN CRUD: TASKS =====
  app.get('/api/admin/tasks', requireAuth, requireAdmin, async (req, res) => {
    try {
      const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const tasksWithStats = await Promise.all(
        tasks.map(async (task) => {
          const completionCount = await prisma.userTask.count({
            where: {
              taskId: task.id,
              completed: true
            }
          });
          return {
            ...task,
            completionCount
          };
        })
      );

      res.json(tasksWithStats);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/admin/tasks', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { title, description, xpReward, xnrtReward, category, requirements, isActive } = req.body;

      if (!title || !description || xpReward === undefined || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const parsedXpReward = typeof xpReward === 'string' ? parseInt(xpReward, 10) : xpReward;
      const parsedXnrtReward = xnrtReward ? (typeof xnrtReward === 'string' ? parseFloat(xnrtReward) : xnrtReward) : 0;

      const task = await prisma.task.create({
        data: {
          title,
          description,
          xpReward: parsedXpReward,
          xnrtReward: new Prisma.Decimal(parsedXnrtReward),
          category,
          requirements: requirements || null,
          isActive: isActive !== undefined ? isActive : true
        }
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_task_created',
        description: `Admin created task: ${title}`
      });

      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/admin/tasks/:id', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, xpReward, xnrtReward, category, requirements, isActive } = req.body;

      const data: any = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (xpReward !== undefined) {
        data.xpReward = typeof xpReward === 'string' ? parseInt(xpReward, 10) : xpReward;
      }
      if (xnrtReward !== undefined) {
        const parsed = typeof xnrtReward === 'string' ? parseFloat(xnrtReward) : xnrtReward;
        data.xnrtReward = new Prisma.Decimal(parsed);
      }
      if (category !== undefined) data.category = category;
      if (requirements !== undefined) data.requirements = requirements;
      if (isActive !== undefined) data.isActive = isActive;

      const task = await prisma.task.update({
        where: { id },
        data
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_task_updated',
        description: `Admin updated task: ${task.title}`
      });

      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.patch('/api/admin/tasks/:id/toggle', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;

      const task = await prisma.task.findUnique({ where: { id } });
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const updatedTask = await prisma.task.update({
        where: { id },
        data: { isActive: !task.isActive }
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_task_toggled',
        description: `Admin ${updatedTask.isActive ? 'activated' : 'deactivated'} task: ${updatedTask.title}`
      });

      res.json(updatedTask);
    } catch (error) {
      console.error("Error toggling task:", error);
      res.status(500).json({ message: "Failed to toggle task" });
    }
  });

  app.delete('/api/admin/tasks/:id', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;

      const task = await prisma.task.findUnique({ where: { id } });
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      await prisma.userTask.deleteMany({ where: { taskId: id } });
      await prisma.task.delete({ where: { id } });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_task_deleted',
        description: `Admin deleted task: ${task.title}`
      });

      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // ===== ADMIN CRUD: ACHIEVEMENTS =====
  app.get('/api/admin/achievements', requireAuth, requireAdmin, async (req, res) => {
    try {
      const achievements = await prisma.achievement.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const achievementsWithStats = await Promise.all(
        achievements.map(async (achievement) => {
          const unlockCount = await prisma.userAchievement.count({
            where: { achievementId: achievement.id }
          });
          return {
            ...achievement,
            unlockCount
          };
        })
      );

      res.json(achievementsWithStats);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.post('/api/admin/achievements', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { title, description, icon, category, requirement, xpReward } = req.body;

      if (!title || !description || !icon || !category || requirement === undefined || xpReward === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const parsedRequirement = typeof requirement === 'string' ? parseInt(requirement, 10) : requirement;
      const parsedXpReward = typeof xpReward === 'string' ? parseInt(xpReward, 10) : xpReward;

      const achievement = await prisma.achievement.create({
        data: {
          title,
          description,
          icon,
          category,
          requirement: parsedRequirement,
          xpReward: parsedXpReward
        }
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_achievement_created',
        description: `Admin created achievement: ${title}`
      });

      res.json(achievement);
    } catch (error) {
      console.error("Error creating achievement:", error);
      res.status(500).json({ message: "Failed to create achievement" });
    }
  });

  app.put('/api/admin/achievements/:id', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, icon, category, requirement, xpReward } = req.body;

      const data: any = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (icon !== undefined) data.icon = icon;
      if (category !== undefined) data.category = category;
      if (requirement !== undefined) {
        data.requirement = typeof requirement === 'string' ? parseInt(requirement, 10) : requirement;
      }
      if (xpReward !== undefined) {
        data.xpReward = typeof xpReward === 'string' ? parseInt(xpReward, 10) : xpReward;
      }

      const achievement = await prisma.achievement.update({
        where: { id },
        data
      });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_achievement_updated',
        description: `Admin updated achievement: ${achievement.title}`
      });

      res.json(achievement);
    } catch (error) {
      console.error("Error updating achievement:", error);
      res.status(500).json({ message: "Failed to update achievement" });
    }
  });

  app.delete('/api/admin/achievements/:id', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;

      const achievement = await prisma.achievement.findUnique({ where: { id } });
      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }

      await prisma.userAchievement.deleteMany({ where: { achievementId: id } });
      await prisma.achievement.delete({ where: { id } });

      await storage.createActivity({
        userId: req.authUser!.id,
        type: 'admin_achievement_deleted',
        description: `Admin deleted achievement: ${achievement.title}`
      });

      res.json({ message: "Achievement deleted successfully" });
    } catch (error) {
      console.error("Error deleting achievement:", error);
      res.status(500).json({ message: "Failed to delete achievement" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
