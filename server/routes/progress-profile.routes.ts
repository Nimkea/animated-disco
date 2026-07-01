import type { Express } from "express";
import type { RouteContext } from "../routes";
import {
  claimUserAchievement,
  completeUserTask,
  getCheckinHistory,
  getUserAchievementsWithStatus,
  performDailyCheckIn,
} from "../services/reward.service";
import { getEngagementConfig, getLevelProgress } from "../services/engagement.service";

export function registerProgressProfileRoutes(app: Express, ctx: RouteContext) {
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
  app.get("/api/tasks/user", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const userTasks = await syncUserTasksForActiveTasks(userId);
      res.json(userTasks.map(serializeUserTaskWithTask));
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
        const result = await completeUserTask(userId, taskId);

        if (!result.ok) {
          return res.status(result.status).json({ message: result.message });
        }

        res.json({
          userTask: result.userTask,
          xpReward: result.xpReward,
          xnrtReward: result.xnrtReward,
          requestedXnrtReward: result.requestedXnrtReward,
          rewardCapped: result.rewardCapped,
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
      const achievements = await getUserAchievementsWithStatus(userId);
      res.json(achievements);
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
        const result = await claimUserAchievement(userId, achievementId);

        if (!result.ok) {
          return res.status(result.status).json({ message: result.message });
        }

        res.json({
          achievementId: result.achievementId,
          claimed: result.claimed,
          claimedAt: result.claimedAt,
        });
      } catch (error) {
        console.error("Error claiming achievement:", error);
        res.status(500).json({ message: "Failed to claim achievement" });
      }
    }
  );

  // Admin Task Management
  app.get("/api/admin/tasks", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [tasks, completionGroups] = await Promise.all([
        prisma.task.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.userTask.groupBy({
          by: ["taskId"],
          where: { completed: true },
          _count: { taskId: true },
        }),
      ]);

      const completionMap = new Map<string, number>();
      (completionGroups as any[]).forEach((row) => {
        const count = row?._count?.taskId ?? row?._count?._all ?? row?._count ?? 0;
        completionMap.set(row.taskId, Number(count) || 0);
      });

      res.json(
        tasks.map((task) => ({
          ...serializeTask(task),
          completionCount: completionMap.get(task.id) ?? 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching admin tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post(
    "/api/admin/tasks",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        let payload;
        try {
          payload = parseTaskPayload(req.body);
        } catch (e: any) {
          return res.status(400).json({ message: e?.message ?? "Invalid task payload" });
        }

        const task = await prisma.task.create({ data: payload });
        res.status(201).json({ ...serializeTask(task), completionCount: 0 });
      } catch (error: any) {
        console.error("Error creating task:", error);
        if (error.code === "P2002") {
          return res.status(409).json({ message: "A task with this title already exists" });
        }
        res.status(500).json({ message: "Failed to create task" });
      }
    }
  );

  app.put(
    "/api/admin/tasks/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        let payload;
        try {
          payload = parseTaskPayload(req.body);
        } catch (e: any) {
          return res.status(400).json({ message: e?.message ?? "Invalid task payload" });
        }

        const task = await prisma.task.update({ where: { id }, data: payload });
        const completionCount = await prisma.userTask.count({
          where: { taskId: id, completed: true },
        });

        res.json({ ...serializeTask(task), completionCount });
      } catch (error: any) {
        console.error("Error updating task:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Task not found" });
        }
        if (error.code === "P2002") {
          return res.status(409).json({ message: "A task with this title already exists" });
        }
        res.status(500).json({ message: "Failed to update task" });
      }
    }
  );

  app.patch(
    "/api/admin/tasks/:id/toggle",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const existing = await prisma.task.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Task not found" });

        const task = await prisma.task.update({
          where: { id },
          data: { isActive: !existing.isActive },
        });

        const completionCount = await prisma.userTask.count({
          where: { taskId: id, completed: true },
        });

        res.json({ ...serializeTask(task), completionCount });
      } catch (error) {
        console.error("Error toggling task:", error);
        res.status(500).json({ message: "Failed to toggle task" });
      }
    }
  );

  app.delete(
    "/api/admin/tasks/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.task.delete({ where: { id } });
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting task:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Task not found" });
        }
        res.status(500).json({ message: "Failed to delete task" });
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

  // Profile v2 routes
  app.get("/api/profile/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const [
        balance,
        activeStakeStats,
        completedMiningStats,
        referralGroups,
        referralCommission,
        activeTaskCount,
        assignedTaskCount,
        completedTaskCount,
        totalAchievementCount,
        unlockedAchievementCount,
        leaderboardRows,
        referralRankRows,
        recentActivities,
      ] = await Promise.all([
        storage.getBalance(userId),
        prisma.stake.aggregate({
          where: { userId, status: "active" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.miningSession.aggregate({
          where: { userId, status: "completed" },
          _count: { _all: true },
          _sum: { finalReward: true },
        }),
        prisma.referral.groupBy({
          by: ["level"],
          where: { referrerId: userId },
          _count: { _all: true },
        }),
        prisma.referral.aggregate({
          where: { referrerId: userId },
          _sum: { totalCommission: true },
        }),
        prisma.task.count({ where: { isActive: true } }),
        prisma.userTask.count({ where: { userId } }),
        prisma.userTask.count({ where: { userId, completed: true } }),
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
        storage.getActivities(userId, 5),
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

      let referredByUser: { username: string | null; referralCode: string | null } | null = null;
      if (user.referredBy) {
        referredByUser = await prisma.user.findFirst({
          where: {
            OR: [{ id: user.referredBy }, { referralCode: user.referredBy }],
          },
          select: { username: true, referralCode: true },
        });
      }

      const engagementConfig = await getEngagementConfig();
      const xp = user.xp || 0;
      const xpProgress = getLevelProgress(xp, engagementConfig);

      res.json({
        profile: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          profileImageUrl: user.profileImageUrl || null,
          referralCode: user.referralCode,
          referredBy: user.referredBy || null,
          referredByUsername: referredByUser?.username || null,
          referredByCode: referredByUser?.referralCode || null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        xp: xpProgress,
        balance: {
          xnrtBalance: decimalValueToNumber(balance?.xnrtBalance),
          stakingBalance: decimalValueToNumber(balance?.stakingBalance),
          miningBalance: decimalValueToNumber(balance?.miningBalance),
          referralBalance: decimalValueToNumber(balance?.referralBalance),
          totalEarned: decimalValueToNumber(balance?.totalEarned),
        },
        referrals: {
          direct: referralCounts.level1,
          level2: referralCounts.level2,
          level3: referralCounts.level3,
          totalNetwork: referralCounts.level1 + referralCounts.level2 + referralCounts.level3,
          totalCommission: decimalValueToNumber(referralCommission._sum.totalCommission),
          rank: referralRankRows[0]?.rank ? toLeaderboardNumber(referralRankRows[0].rank) : null,
        },
        mining: {
          completedSessions: completedMiningStats._count._all,
          totalXpMined: completedMiningStats._sum.finalReward || 0,
          totalXnrtMined: decimalValueToNumber(balance?.miningBalance),
        },
        staking: {
          activeStakes: activeStakeStats._count._all,
          totalActiveStaked: decimalValueToNumber(activeStakeStats._sum.amount),
        },
        tasks: {
          assigned: assignedTaskCount,
          completed: completedTaskCount,
          totalActive: activeTaskCount,
          progressPercent: activeTaskCount > 0 ? Math.round((completedTaskCount / activeTaskCount) * 100) : 0,
        },
        achievements: {
          unlocked: unlockedAchievementCount,
          total: totalAchievementCount,
          progressPercent: totalAchievementCount > 0 ? Math.round((unlockedAchievementCount / totalAchievementCount) * 100) : 0,
        },
        leaderboard: {
          xpRank: leaderboardRows[0]?.rank ? toLeaderboardNumber(leaderboardRows[0].rank) : null,
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
      console.error("Error fetching profile summary:", error);
      res.status(500).json({ message: "Failed to fetch profile summary" });
    }
  });

  app.patch("/api/profile", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const data = profileUpdateSchema.parse(req.body);
      const updateData: any = {};

      if (data.username !== undefined) {
        const existing = await prisma.user.findFirst({
          where: { username: data.username, NOT: { id: userId } },
          select: { id: true },
        });
        if (existing) {
          return res.status(409).json({ message: "Username is already taken" });
        }
        updateData.username = data.username;
      }

      if (data.firstName !== undefined) updateData.firstName = data.firstName || null;
      if (data.lastName !== undefined) updateData.lastName = data.lastName || null;
      if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl || null;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No profile fields provided" });
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      await storage.createActivity({
        userId,
        type: "profile_updated",
        description: "Updated profile information",
      });

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.firstName || null,
        lastName: updatedUser.lastName || null,
        profileImageUrl: updatedUser.profileImageUrl || null,
        referralCode: updatedUser.referralCode,
        referredBy: updatedUser.referredBy || null,
        emailVerified: updatedUser.emailVerified,
        isAdmin: updatedUser.isAdmin,
        xp: updatedUser.xp,
        level: updatedUser.level,
        streak: updatedUser.streak,
        lastCheckIn: updatedUser.lastCheckIn || null,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Profile stats route kept for backward compatibility with existing widgets
  app.get("/api/profile/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const [
        activeStakeStats,
        completedMiningStats,
        referralGroups,
        referralCommission,
        completedTaskCount,
        unlockedAchievementCount,
      ] = await Promise.all([
        prisma.stake.aggregate({
          where: { userId, status: "active" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.miningSession.aggregate({
          where: { userId, status: "completed" },
          _count: { _all: true },
          _sum: { finalReward: true },
        }),
        prisma.referral.groupBy({
          by: ["level"],
          where: { referrerId: userId },
          _count: { _all: true },
        }),
        prisma.referral.aggregate({
          where: { referrerId: userId },
          _sum: { totalCommission: true },
        }),
        prisma.userTask.count({ where: { userId, completed: true } }),
        prisma.userAchievement.count({ where: { userId } }),
      ]);

      const totalReferrals = referralGroups.reduce((sum, row) => sum + (row._count?._all || 0), 0);

      res.json({
        totalReferrals,
        activeStakes: activeStakeStats._count._all,
        totalStaked: decimalValueToNumber(activeStakeStats._sum.amount),
        miningSessions: completedMiningStats._count._all,
        totalMined: completedMiningStats._sum.finalReward || 0,
        referralEarnings: decimalValueToNumber(referralCommission._sum.totalCommission),
        tasksCompleted: completedTaskCount,
        achievementsUnlocked: unlockedAchievementCount,
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
      const result = await performDailyCheckIn(userId);

      if (!result.ok) {
        return res.status(result.status).json({ message: result.message });
      }

      res.json({
        streak: result.streak,
        xnrtReward: result.xnrtReward,
        xpReward: result.xpReward,
        requestedXnrtReward: result.requestedXnrtReward,
        rewardCapped: result.rewardCapped,
        message: result.message,
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
      const history = await getCheckinHistory(userId, req.query.year, req.query.month);
      res.json(history);
    } catch (error) {
      console.error("Error fetching check-in history:", error);
      res.status(500).json({ message: "Failed to fetch check-in history" });
    }
  });


}
