import type { Express } from "express";
import type { RouteContext } from "../routes";

export function registerHomeWalletRoutes(app: Express, ctx: RouteContext) {
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

  app.get("/api/wallet/rates", requireAuth, async (_req, res) => {
    res.json(getWalletRates());
  });

  app.get("/api/wallet/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const [balance, allRecentTransactions, pendingWithdrawalRows, depositAddress] = await Promise.all([
        storage.getBalance(userId),
        storage.getTransactionsByUser(userId),
        prisma.transaction.groupBy({
          by: ["source"],
          where: { userId, type: "withdrawal", status: { in: ["pending", "processing"] } },
          _sum: { amount: true, fee: true, netAmount: true },
          _count: { _all: true },
        }),
        getOrCreateUserDepositAddress(userId),
      ]);

      const available = decimalValueToNumber(balance?.xnrtBalance);
      const staking = decimalValueToNumber(balance?.stakingBalance);
      const mining = decimalValueToNumber(balance?.miningBalance);
      const referral = decimalValueToNumber(balance?.referralBalance);
      const totalWalletValue = available + staking + mining + referral;

      const reservedBySource = pendingWithdrawalRows.reduce(
        (acc, row) => {
          const source = row.source || "main";
          const amount = decimalValueToNumber(row._sum.amount);
          acc[source] = {
            amount,
            fee: decimalValueToNumber(row._sum.fee),
            netAmount: decimalValueToNumber(row._sum.netAmount),
            count: row._count._all,
          };
          acc.total.amount += amount;
          acc.total.fee += decimalValueToNumber(row._sum.fee);
          acc.total.netAmount += decimalValueToNumber(row._sum.netAmount);
          acc.total.count += row._count._all;
          return acc;
        },
        {
          total: { amount: 0, fee: 0, netAmount: 0, count: 0 },
        } as Record<string, { amount: number; fee: number; netAmount: number; count: number }>
      );

      const approvedDeposits = await prisma.transaction.aggregate({
        where: { userId, type: "deposit", status: "approved" },
        _sum: { amount: true, usdtAmount: true },
        _count: { _all: true },
      });

      const approvedWithdrawals = await prisma.transaction.aggregate({
        where: { userId, type: "withdrawal", status: "approved" },
        _sum: { amount: true, fee: true, netAmount: true },
        _count: { _all: true },
      });

      res.json({
        balance: {
          available,
          staking,
          mining,
          referral,
          totalWalletValue,
          totalEarned: decimalValueToNumber(balance?.totalEarned),
        },
        deposit: {
          address: depositAddress,
          network: "BSC (BEP-20)",
          token: "USDT",
          approvedCount: approvedDeposits._count._all,
          totalUsdtDeposited: decimalValueToNumber(approvedDeposits._sum.usdtAmount),
          totalXnrtCredited: decimalValueToNumber(approvedDeposits._sum.amount),
        },
        withdrawals: {
          reservedBySource,
          approvedCount: approvedWithdrawals._count._all,
          totalRequested: decimalValueToNumber(approvedWithdrawals._sum.amount),
          totalFees: decimalValueToNumber(approvedWithdrawals._sum.fee),
          totalPaid: decimalValueToNumber(approvedWithdrawals._sum.netAmount),
        },
        rates: getWalletRates(),
        recentTransactions: allRecentTransactions.slice(0, 12),
      });
    } catch (error) {
      console.error("Error fetching wallet summary:", error);
      res.status(500).json({ message: "Failed to fetch wallet summary" });
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

  // Home v2 summary route
  app.get("/api/home/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      await storage.processMiningRewards(userId);

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const [
        balance,
        activeMiningSession,
        completedMiningStats,
        activeStakeStats,
        referralGroups,
        referralCommissionStats,
        activeTaskCount,
        completedTaskCount,
        totalAchievementCount,
        unlockedAchievementCount,
        xpRankRows,
        referralRankRows,
        recentActivities,
      ] = await Promise.all([
        storage.getBalance(userId),
        storage.getCurrentMiningSession(userId),
        prisma.miningSession.aggregate({
          where: { userId, status: "completed" },
          _count: { _all: true },
          _sum: { finalReward: true },
        }),
        prisma.stake.aggregate({
          where: { userId, status: "active" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.referral.groupBy({
          by: ["level"],
          where: { referrerId: userId },
          _count: { _all: true },
        }),
        prisma.referralCommission.aggregate({
          where: { referrerId: userId, status: "paid" },
          _sum: { commission: true },
        }),
        prisma.task.count({ where: { isActive: true } }),
        prisma.userTask.count({
          where: { userId, completed: true, task: { isActive: true } },
        }),
        prisma.achievement.count(),
        prisma.userAchievement.count({ where: { userId } }),
        storage.raw(
          `
            WITH ranked AS (
              SELECT
                id,
                ROW_NUMBER() OVER (ORDER BY xp DESC, "createdAt" ASC, id ASC)::int AS rank
              FROM "User"
              WHERE xp > 0
            )
            SELECT rank FROM ranked WHERE id = $1 LIMIT 1
          `,
          [userId]
        ),
        storage.raw(
          `
            WITH stats AS (
              SELECT
                u.id AS "userId",
                COUNT(r.id)::int AS "totalReferrals",
                COALESCE(SUM(r."totalCommission"), 0) AS "totalCommission"
              FROM "User" u
              JOIN "Referral" r ON r."referrerId" = u.id
              GROUP BY u.id
              HAVING COUNT(r.id) > 0
            ), ranked AS (
              SELECT
                *,
                ROW_NUMBER() OVER (
                  ORDER BY "totalReferrals" DESC, "totalCommission" DESC, "userId" ASC
                )::int AS rank
              FROM stats
            )
            SELECT rank FROM ranked WHERE "userId" = $1 LIMIT 1
          `,
          [userId]
        ),
        storage.getActivities(userId, 8),
      ]);

      const referralCounts = referralGroups.reduce(
        (acc, row) => {
          const count = row._count?._all || 0;
          if (row.level === 1) acc.level1 = count;
          if (row.level === 2) acc.level2 = count;
          if (row.level === 3) acc.level3 = count;
          return acc;
        },
        { level1: 0, level2: 0, level3: 0 }
      );

      const xp = user.xp || 0;
      const level = Math.floor(xp / 1000) + 1;
      const currentLevelXp = (level - 1) * 1000;
      const nextLevelXp = level * 1000;
      const xpIntoLevel = Math.max(0, xp - currentLevelXp);
      const xpRequiredForLevel = 1000;
      const xpProgressPercent = Math.min(
        100,
        Math.round((xpIntoLevel / xpRequiredForLevel) * 100)
      );

      const now = new Date();
      const miningEndTime = activeMiningSession?.endTime
        ? new Date(activeMiningSession.endTime)
        : null;
      const miningRemainingMs = miningEndTime
        ? Math.max(0, miningEndTime.getTime() - now.getTime())
        : 0;
      const miningProgressPercent = activeMiningSession?.startTime && miningEndTime
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((now.getTime() - new Date(activeMiningSession.startTime).getTime()) /
                  MINING_SESSION_DURATION_MS) *
                  100
              )
            )
          )
        : 0;

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          profileImageUrl: user.profileImageUrl || null,
          referralCode: user.referralCode,
          createdAt: user.createdAt,
        },
        xp: {
          total: xp,
          level,
          currentLevelXp,
          nextLevelXp,
          xpIntoLevel,
          xpRequiredForLevel,
          progressPercent: xpProgressPercent,
          toNextLevel: Math.max(0, nextLevelXp - xp),
        },
        balance: {
          available: decimalValueToNumber(balance?.xnrtBalance),
          staking: decimalValueToNumber(balance?.stakingBalance),
          mining: decimalValueToNumber(balance?.miningBalance),
          referral: decimalValueToNumber(balance?.referralBalance),
          totalEarned: decimalValueToNumber(balance?.totalEarned),
        },
        mining: {
          status: activeMiningSession ? "active" : "ready",
          activeSessionId: activeMiningSession?.id || null,
          startTime: activeMiningSession?.startTime || null,
          endTime: activeMiningSession?.endTime || null,
          remainingMs: miningRemainingMs,
          progressPercent: miningProgressPercent,
          completedSessions: completedMiningStats._count._all,
          totalXpMined: completedMiningStats._sum.finalReward || 0,
          totalXnrtMined: decimalValueToNumber(balance?.miningBalance),
          reward: {
            xp: MINING_SESSION_XP_REWARD,
            xnrt: MINING_SESSION_XNRT_REWARD,
            durationHours: 24,
          },
        },
        staking: {
          activeStakes: activeStakeStats._count._all,
          totalActiveStaked: decimalValueToNumber(activeStakeStats._sum.amount),
        },
        referrals: {
          direct: referralCounts.level1,
          level2: referralCounts.level2,
          level3: referralCounts.level3,
          totalNetwork: referralCounts.level1 + referralCounts.level2 + referralCounts.level3,
          paidCommission: decimalValueToNumber(referralCommissionStats._sum.commission),
          balance: decimalValueToNumber(balance?.referralBalance),
          rank: referralRankRows[0]?.rank ? toLeaderboardNumber(referralRankRows[0].rank) : null,
        },
        tasks: {
          completed: completedTaskCount,
          totalActive: activeTaskCount,
          remaining: Math.max(0, activeTaskCount - completedTaskCount),
          progressPercent: activeTaskCount > 0 ? Math.round((completedTaskCount / activeTaskCount) * 100) : 0,
        },
        achievements: {
          unlocked: unlockedAchievementCount,
          total: totalAchievementCount,
          remaining: Math.max(0, totalAchievementCount - unlockedAchievementCount),
          progressPercent: totalAchievementCount > 0 ? Math.round((unlockedAchievementCount / totalAchievementCount) * 100) : 0,
        },
        leaderboard: {
          xpRank: xpRankRows[0]?.rank ? toLeaderboardNumber(xpRankRows[0].rank) : null,
          referralRank: referralRankRows[0]?.rank ? toLeaderboardNumber(referralRankRows[0].rank) : null,
        },
        checkin: {
          currentStreak: user.streak || 0,
          lastCheckIn: user.lastCheckIn || null,
          checkedInToday: isSameLocalDay(user.lastCheckIn),
        },
        recentActivities,
      });
    } catch (error) {
      console.error("Error fetching home summary:", error);
      res.status(500).json({ message: "Failed to fetch home summary" });
    }
  });

}
