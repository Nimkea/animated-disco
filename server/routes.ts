import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireAdmin, validateCSRF } from "./auth/middleware";
import authRoutes from "./auth/routes";
import { STAKING_TIERS, type StakingTier } from "@shared/schema";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      
      // Check if can start mining
      const history = await storage.getMiningHistory(userId);
      const lastSession = history[0];
      
      if (lastSession && new Date(lastSession.nextAvailable) > new Date()) {
        return res.status(400).json({ message: "Please wait 24 hours between mining sessions" });
      }

      const startTime = new Date();
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const nextAvailable = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const session = await storage.createMiningSession({
        userId,
        baseReward: 10,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: 10,
        startTime,
        endTime,
        nextAvailable,
        status: "active",
      });

      res.json(session);
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });

  app.post('/api/mining/watch-ad', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const session = await storage.getCurrentMiningSession(userId);

      if (!session || session.status !== "active") {
        return res.status(400).json({ message: "No active mining session" });
      }

      if (session.adBoostCount >= 5) {
        return res.status(400).json({ message: "Maximum ad boosts reached" });
      }

      const newAdBoostCount = session.adBoostCount + 1;
      const newBoostPercentage = newAdBoostCount * 10;
      const newFinalReward = session.baseReward + Math.floor((session.baseReward * newBoostPercentage) / 100);

      await storage.updateMiningSession(session.id, {
        adBoostCount: newAdBoostCount,
        boostPercentage: newBoostPercentage,
        finalReward: newFinalReward,
      });

      res.json({ success: true, boost: newBoostPercentage });
    } catch (error) {
      console.error("Error watching ad:", error);
      res.status(500).json({ message: "Failed to watch ad" });
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

  // Leaderboard routes
  app.get('/api/leaderboard/referrals', requireAuth, async (req, res) => {
    try {
      const period = (req.query.period as string) || 'all-time';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const currentUserId = req.authUser!.id;
      
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
        leaderboard: leaderboard.map((item, index) => ({
          ...item,
          totalReferrals: parseInt(item.totalReferrals),
          totalCommission: item.totalCommission.toString(),
          level1Count: parseInt(item.level1Count),
          level2Count: parseInt(item.level2Count),
          level3Count: parseInt(item.level3Count),
          rank: index + 1,
        })),
        userPosition: userPosition === -1 && userStats.length > 0 ? {
          ...userStats[0],
          totalReferrals: parseInt(userStats[0].totalReferrals),
          totalCommission: userStats[0].totalCommission.toString(),
          level1Count: parseInt(userStats[0].level1Count),
          level2Count: parseInt(userStats[0].level2Count),
          level3Count: parseInt(userStats[0].level3Count),
          rank: userPosition + 1,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
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

  app.post('/api/transactions/deposit', requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { usdtAmount, transactionHash } = req.body;

      if (!usdtAmount || !transactionHash) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const xnrtAmount = parseFloat(usdtAmount) * 100; // 1 USDT = 100 XNRT

      const transaction = await storage.createTransaction({
        userId,
        type: "deposit",
        amount: xnrtAmount.toString(),
        usdtAmount: usdtAmount.toString(),
        transactionHash,
        status: "pending",
      });

      res.json(transaction);
    } catch (error) {
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
      const availableBalance = source === "main" ? parseFloat(balance?.xnrtBalance || "0") : parseFloat(balance?.referralBalance || "0");

      if (withdrawAmount > availableBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      if (source === "referral" && withdrawAmount < 5000) {
        return res.status(400).json({ message: "Minimum withdrawal from referral balance is 5000 XNRT" });
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

  app.post('/api/admin/deposits/:id/approve', requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const deposit = await storage.getTransactionById(id);

      if (!deposit || deposit.type !== "deposit") {
        return res.status(404).json({ message: "Deposit not found" });
      }

      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Deposit already processed" });
      }

      // Update transaction status
      await storage.updateTransaction(id, { status: "approved" });

      // Add to user balance
      const balance = await storage.getBalance(deposit.userId);
      if (balance) {
        await storage.updateBalance(deposit.userId, {
          xnrtBalance: (parseFloat(balance.xnrtBalance) + parseFloat(deposit.amount)).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + parseFloat(deposit.amount)).toString(),
        });
      }

      // Distribute referral commissions on deposit
      await storage.distributeReferralCommissions(deposit.userId, parseFloat(deposit.amount));

      // Log activity
      await storage.createActivity({
        userId: deposit.userId,
        type: "deposit_approved",
        description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT approved`,
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
        const sourceBalance = withdrawal.source === "main" ? "xnrtBalance" : "referralBalance";
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

  const httpServer = createServer(app);
  return httpServer;
}
