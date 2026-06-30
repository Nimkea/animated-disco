import type { Express } from "express";
import type { RouteContext } from "../../routes";

export function registerAdminOverviewRoutes(app: Express, ctx: RouteContext) {
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


  app.get(
    "/api/admin/audit-logs",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
        const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
        const action = typeof req.query.action === "string" ? req.query.action : undefined;

        const logs = await (prisma as any).adminAuditLog.findMany({
          where: {
            ...(entityType ? { entityType } : {}),
            ...(action ? { action } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        res.json(logs);
      } catch (error) {
        console.error("Error fetching admin audit logs:", error);
        res.status(500).json({ message: "Failed to fetch admin audit logs" });
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
}
