import type { Express } from "express";
import type { RouteContext } from "../../routes";
import { recordAdminAuditLog } from "../../services/audit.service";

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
    async (req, res) => {
      try {
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 200, 1), 500);
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

        const users = await prisma.user.findMany({
          where: q
            ? {
                OR: [
                  { email: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                  { referralCode: { contains: q, mode: "insensitive" } },
                  { id: { contains: q, mode: "insensitive" } },
                ],
              }
            : undefined,
          include: { balance: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        const userIds = users.map((user) => user.id);
        const [stakeGroups, referralGroups, depositGroups, withdrawalGroups, sessionGroups] = await Promise.all([
          prisma.stake.groupBy({
            by: ["userId", "status"],
            where: { userId: { in: userIds } },
            _count: { _all: true },
            _sum: { amount: true },
          }),
          prisma.referral.groupBy({
            by: ["referrerId"],
            where: { referrerId: { in: userIds } },
            _count: { _all: true },
          }),
          prisma.transaction.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds }, type: "deposit", status: "approved" },
            _count: { _all: true },
            _sum: { amount: true },
          }),
          prisma.transaction.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds }, type: "withdrawal", status: "approved" },
            _count: { _all: true },
            _sum: { amount: true },
          }),
          prisma.session.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds }, revokedAt: null },
            _count: { _all: true },
          }),
        ]);

        const activeStakeByUser = new Map<string, { count: number; total: string }>();
        for (const row of stakeGroups) {
          if (row.status !== "active") continue;
          activeStakeByUser.set(row.userId, {
            count: row._count?._all || 0,
            total: row._sum?.amount?.toString() || "0",
          });
        }

        const referralCountByUser = new Map(referralGroups.map((row) => [row.referrerId, row._count?._all || 0]));
        const depositByUser = new Map(depositGroups.map((row) => [row.userId, { count: row._count?._all || 0, total: row._sum?.amount?.toString() || "0" }]));
        const withdrawalByUser = new Map(withdrawalGroups.map((row) => [row.userId, { count: row._count?._all || 0, total: row._sum?.amount?.toString() || "0" }]));
        const sessionCountByUser = new Map(sessionGroups.map((row) => [row.userId, row._count?._all || 0]));

        res.json(
          users.map((user) => ({
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            referralCode: user.referralCode,
            referredBy: user.referredBy,
            emailVerified: user.emailVerified,
            isAdmin: user.isAdmin,
            xp: user.xp,
            level: user.level,
            streak: user.streak,
            lastCheckIn: user.lastCheckIn,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            balance: user.balance
              ? {
                  xnrtBalance: user.balance.xnrtBalance.toString(),
                  stakingBalance: user.balance.stakingBalance.toString(),
                  miningBalance: user.balance.miningBalance.toString(),
                  referralBalance: user.balance.referralBalance.toString(),
                  totalEarned: user.balance.totalEarned.toString(),
                }
              : null,
            stats: {
              activeStakes: activeStakeByUser.get(user.id)?.count || 0,
              totalStaked: activeStakeByUser.get(user.id)?.total || "0",
              referralsCount: referralCountByUser.get(user.id) || 0,
              depositCount: depositByUser.get(user.id)?.count || 0,
              depositTotal: depositByUser.get(user.id)?.total || "0",
              withdrawalCount: withdrawalByUser.get(user.id)?.count || 0,
              withdrawalTotal: withdrawalByUser.get(user.id)?.total || "0",
              activeSessions: sessionCountByUser.get(user.id) || 0,
            },
          }))
        );
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // Admin user detail with balances, transactions, staking, referrals, sessions, and activity.
  app.get(
    "/api/admin/users/:id",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            balance: true,
            sessions: { orderBy: { createdAt: "desc" }, take: 10 },
            stakes: { orderBy: { createdAt: "desc" }, take: 10 },
            transactions: { orderBy: { createdAt: "desc" }, take: 20 },
            activities: { orderBy: { createdAt: "desc" }, take: 25 },
            referralsGiven: {
              orderBy: { createdAt: "desc" },
              take: 25,
              include: {
                referredUser: {
                  select: { id: true, username: true, email: true, createdAt: true, xp: true, level: true },
                },
              },
            },
            referralsReceived: {
              orderBy: { createdAt: "desc" },
              take: 10,
              include: {
                referrer: {
                  select: { id: true, username: true, email: true, referralCode: true },
                },
              },
            },
            userTasks: {
              orderBy: { createdAt: "desc" },
              take: 10,
              include: { task: true },
            },
            userAchievements: {
              orderBy: { unlockedAt: "desc" },
              take: 10,
              include: { achievement: true },
            },
          },
        });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const [depositSummary, withdrawalSummary, referralCommissionSummary] = await Promise.all([
          prisma.transaction.aggregate({
            where: { userId, type: "deposit", status: "approved" },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.transaction.aggregate({
            where: { userId, type: "withdrawal", status: "approved" },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          (prisma as any).referralCommission?.aggregate
            ? (prisma as any).referralCommission.aggregate({
                where: { referrerId: userId },
                _sum: { commission: true },
                _count: { _all: true },
              })
            : Promise.resolve(null),
        ]);

        res.json({
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            referralCode: user.referralCode,
            referredBy: user.referredBy,
            emailVerified: user.emailVerified,
            isAdmin: user.isAdmin,
            xp: user.xp,
            level: user.level,
            streak: user.streak,
            lastCheckIn: user.lastCheckIn,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          balance: user.balance
            ? {
                xnrtBalance: user.balance.xnrtBalance.toString(),
                stakingBalance: user.balance.stakingBalance.toString(),
                miningBalance: user.balance.miningBalance.toString(),
                referralBalance: user.balance.referralBalance.toString(),
                totalEarned: user.balance.totalEarned.toString(),
              }
            : null,
          summaries: {
            deposits: {
              count: depositSummary._count?._all || 0,
              total: depositSummary._sum?.amount?.toString() || "0",
            },
            withdrawals: {
              count: withdrawalSummary._count?._all || 0,
              total: withdrawalSummary._sum?.amount?.toString() || "0",
            },
            referralCommissions: {
              count: referralCommissionSummary?._count?._all || 0,
              total: referralCommissionSummary?._sum?.commission?.toString?.() || "0",
            },
            activeSessions: user.sessions.filter((session) => !session.revokedAt).length,
            completedTasks: user.userTasks.filter((task) => task.completed).length,
            achievementsUnlocked: user.userAchievements.length,
          },
          sessions: user.sessions,
          stakes: user.stakes.map((stake) => ({ ...stake, amount: stake.amount.toString(), totalProfit: stake.totalProfit.toString(), dailyRate: stake.dailyRate.toString(), minInvestUsdtPerReferral: stake.minInvestUsdtPerReferral?.toString?.() ?? null })),
          transactions: user.transactions.map((transaction) => ({
            ...transaction,
            amount: transaction.amount.toString(),
            usdtAmount: transaction.usdtAmount?.toString() ?? null,
            fee: transaction.fee?.toString() ?? null,
            netAmount: transaction.netAmount?.toString() ?? null,
          })),
          activities: user.activities,
          referralsGiven: user.referralsGiven.map((referral) => ({
            id: referral.id,
            level: referral.level,
            totalCommission: referral.totalCommission.toString(),
            createdAt: referral.createdAt,
            referredUser: referral.referredUser,
          })),
          referralsReceived: user.referralsReceived.map((referral) => ({
            id: referral.id,
            level: referral.level,
            totalCommission: referral.totalCommission.toString(),
            createdAt: referral.createdAt,
            referrer: referral.referrer,
          })),
          tasks: user.userTasks,
          achievements: user.userAchievements,
        });
      } catch (error) {
        console.error("Error fetching admin user detail:", error);
        res.status(500).json({ message: "Failed to fetch user detail" });
      }
    }
  );

  const adminProfileUpdateSchema = z.object({
    username: z.string().trim().min(3).max(30).optional(),
    firstName: z.string().trim().max(80).optional().nullable(),
    lastName: z.string().trim().max(80).optional().nullable(),
    profileImageUrl: z.string().trim().max(500).optional().nullable(),
    emailVerified: z.boolean().optional(),
  });

  app.patch(
    "/api/admin/users/:id/profile",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const data = adminProfileUpdateSchema.parse(req.body);

        const existing = await prisma.user.findUnique({ where: { id: userId } });
        if (!existing) return res.status(404).json({ message: "User not found" });

        if (data.username && data.username !== existing.username) {
          const duplicate = await prisma.user.findUnique({ where: { username: data.username } });
          if (duplicate && duplicate.id !== userId) {
            return res.status(409).json({ message: "Username already exists" });
          }
        }

        const updated = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(data.username !== undefined ? { username: data.username } : {}),
            ...(data.firstName !== undefined ? { firstName: data.firstName || null } : {}),
            ...(data.lastName !== undefined ? { lastName: data.lastName || null } : {}),
            ...(data.profileImageUrl !== undefined ? { profileImageUrl: data.profileImageUrl || null } : {}),
            ...(data.emailVerified !== undefined ? { emailVerified: data.emailVerified } : {}),
          },
          select: { id: true, username: true, email: true, firstName: true, lastName: true, profileImageUrl: true, emailVerified: true },
        });

        await recordAdminAuditLog({
          req,
          targetUserId: userId,
          entityType: "user",
          entityId: userId,
          action: "user_profile_updated",
          summary: `Updated profile for ${existing.email}`,
          metadata: { before: { username: existing.username, firstName: existing.firstName, lastName: existing.lastName, emailVerified: existing.emailVerified }, after: updated },
        });

        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
        }
        console.error("Error updating admin user profile:", error);
        res.status(500).json({ message: "Failed to update user profile" });
      }
    }
  );

  app.patch(
    "/api/admin/users/:id/admin-status",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const schema = z.object({ isAdmin: z.boolean(), reason: z.string().trim().max(500).optional() });
        const data = schema.parse(req.body);

        if (req.authUser?.id === userId && !data.isAdmin) {
          return res.status(400).json({ message: "You cannot remove your own admin access" });
        }

        const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true, isAdmin: true } });
        if (!existing) return res.status(404).json({ message: "User not found" });

        const updated = await prisma.user.update({
          where: { id: userId },
          data: { isAdmin: data.isAdmin },
          select: { id: true, email: true, username: true, isAdmin: true },
        });

        await recordAdminAuditLog({
          req,
          targetUserId: userId,
          entityType: "user",
          entityId: userId,
          action: data.isAdmin ? "user_admin_granted" : "user_admin_removed",
          summary: `${data.isAdmin ? "Granted" : "Removed"} admin access for ${existing.email}`,
          metadata: { before: { isAdmin: existing.isAdmin }, after: { isAdmin: updated.isAdmin }, reason: data.reason || null },
        });

        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid admin status data", errors: error.errors });
        }
        console.error("Error updating admin user role:", error);
        res.status(500).json({ message: "Failed to update admin status" });
      }
    }
  );

  app.post(
    "/api/admin/users/:id/revoke-sessions",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const schema = z.object({ reason: z.string().trim().min(3).max(500).optional() });
        const data = schema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = await prisma.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await recordAdminAuditLog({
          req,
          targetUserId: userId,
          entityType: "user_session",
          entityId: userId,
          action: "user_sessions_revoked",
          summary: `Revoked ${result.count} active session(s) for ${user.email}`,
          metadata: { count: result.count, reason: data.reason || null },
        });

        res.json({ revoked: result.count });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid revoke session data", errors: error.errors });
        }
        console.error("Error revoking user sessions:", error);
        res.status(500).json({ message: "Failed to revoke user sessions" });
      }
    }
  );

  app.post(
    "/api/admin/users/:id/adjust-balance",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const schema = z.object({
          source: z.enum(["main", "staking", "mining", "referral"]),
          operation: z.enum(["increment", "decrement", "set"]),
          amount: z.coerce.number().positive(),
          reason: z.string().trim().min(5).max(500),
        });
        const data = schema.parse(req.body);

        const sourceKeyMap = {
          main: "xnrtBalance",
          staking: "stakingBalance",
          mining: "miningBalance",
          referral: "referralBalance",
        } as const;
        const sourceKey = sourceKeyMap[data.source];

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = await prisma.$transaction(async (tx) => {
          let current = await tx.balance.findUnique({ where: { userId } });
          if (!current) {
            current = await tx.balance.create({ data: { userId } });
          }
          const before = Number((current as any)[sourceKey] || 0);
          const after = data.operation === "set" ? data.amount : data.operation === "increment" ? before + data.amount : before - data.amount;
          if (after < 0) {
            throw new Error("Balance adjustment would make balance negative");
          }

          const updated = await tx.balance.update({
            where: { userId },
            data: { [sourceKey]: new Prisma.Decimal(after) },
          });

          await tx.activity.create({
            data: {
              userId,
              type: "admin_balance_adjustment",
              description: `Admin ${data.operation} ${data.amount.toLocaleString()} XNRT on ${data.source} balance. Reason: ${data.reason}`,
              metadata: JSON.stringify({ source: data.source, sourceKey, operation: data.operation, amount: data.amount, before, after, adminUserId: req.authUser?.id || null }),
            },
          });

          return { before, after, balance: updated };
        });

        await notifyUser(userId, {
          type: "wallet_admin_adjustment",
          title: "Wallet balance updated",
          message: `Your ${data.source} balance was updated by admin. New balance: ${result.after.toLocaleString()} XNRT.`,
          metadata: { source: data.source, operation: data.operation, amount: data.amount, reason: data.reason },
          url: "/wallet",
        }).catch((err) => console.error("[AdminUsers] Notification error:", err));

        await recordAdminAuditLog({
          req,
          targetUserId: userId,
          entityType: "user_balance",
          entityId: userId,
          action: "user_balance_adjusted",
          summary: `Adjusted ${data.source} balance for ${user.email}: ${result.before} → ${result.after} XNRT`,
          metadata: { source: data.source, sourceKey, operation: data.operation, amount: data.amount, before: result.before, after: result.after, reason: data.reason },
        });

        res.json({ source: data.source, sourceKey, before: result.before, after: result.after, balance: result.balance });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid balance adjustment data", errors: error.errors });
        }
        const message = error?.message || "Failed to adjust balance";
        console.error("Error adjusting user balance:", error);
        res.status(/negative|invalid/i.test(message) ? 400 : 500).json({ message });
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
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

        const logs = await (prisma as any).adminAuditLog.findMany({
          where: {
            ...(entityType ? { entityType } : {}),
            ...(action ? { action } : {}),
            ...(status ? { status } : {}),
            ...(q
              ? {
                  OR: [
                    { summary: { contains: q, mode: "insensitive" } },
                    { action: { contains: q, mode: "insensitive" } },
                    { entityType: { contains: q, mode: "insensitive" } },
                    { entityId: { contains: q, mode: "insensitive" } },
                    { adminUserId: { contains: q, mode: "insensitive" } },
                    { targetUserId: { contains: q, mode: "insensitive" } },
                    { ipAddress: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
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
