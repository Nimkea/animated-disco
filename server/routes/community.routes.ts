import type { Express } from "express";
import type { RouteContext } from "../routes";

export function registerCommunityRoutes(app: Express, ctx: RouteContext) {
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
  app.get("/api/referrals/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const balance = await storage.getBalance(userId);

      const referralGroups = await prisma.referral.groupBy({
        by: ["level"],
        where: { referrerId: userId },
        _count: { _all: true },
      });

      const commissionGroups = await prisma.referralCommission.groupBy({
        by: ["level"],
        where: { referrerId: userId, status: "paid" },
        _sum: { commission: true },
      });

      const getCount = (level: number) =>
        referralGroups.find((row) => row.level === level)?._count?._all || 0;
      const getCommission = (level: number) =>
        commissionGroups.find((row) => row.level === level)?._sum?.commission?.toString() || "0";

      const level1Total = parseFloat(getCommission(1));
      const level2Total = parseFloat(getCommission(2));
      const level3Total = parseFloat(getCommission(3));
      const paidNetworkCommission = level1Total + level2Total + level3Total;
      const actualBalance = parseFloat(balance?.referralBalance || "0");

      const stats = {
        level1Count: getCount(1),
        level2Count: getCount(2),
        level3Count: getCount(3),
        level1Commission: level1Total.toString(),
        level2Commission: level2Total.toString(),
        level3Commission: level3Total.toString(),
        totalCommission: paidNetworkCommission.toString(),
        paidNetworkCommission: paidNetworkCommission.toString(),
        actualBalance: actualBalance.toString(),
        companyCommissions: Math.max(0, actualBalance - paidNetworkCommission).toString(),
        ledgerBacked: true,
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
      const currentUser = await storage.getUser(userId);
      const isAdmin = currentUser?.isAdmin || false;

      const referrals = await prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          referredUser: {
            select: { id: true, username: true, email: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const referredIds = referrals.map((referral) => referral.referredUserId);
      const depositGroups = referredIds.length
        ? await prisma.transaction.groupBy({
            by: ["userId"],
            where: {
              userId: { in: referredIds },
              type: "deposit",
              status: "approved",
            },
            _sum: { amount: true },
            _count: { _all: true },
          })
        : [];

      const depositsByUser = new Map<string, { count: number; total: string }>(
        depositGroups.map((row) => [
          row.userId,
          {
            count: row._count?._all || 0,
            total: row._sum?.amount?.toString() || "0",
          },
        ])
      );

      res.json(
        referrals.map((referral) => {
          const deposit = depositsByUser.get(referral.referredUserId);
          return {
            id: referral.id,
            referrerId: referral.referrerId,
            referredUserId: referral.referredUserId,
            level: referral.level,
            totalCommission: referral.totalCommission.toString(),
            createdAt: referral.createdAt,
            displayName: isAdmin
              ? referral.referredUser.username || referral.referredUser.email || "Unknown user"
              : generateAnonymizedHandle(referral.referredUserId),
            joinedAt: referral.referredUser.createdAt,
            hasDeposited: (deposit?.count || 0) > 0,
            depositCount: deposit?.count || 0,
            totalDeposited: deposit?.total || "0",
          };
        })
      );
    } catch (error) {
      console.error("Error fetching referral tree:", error);
      res.status(500).json({ message: "Failed to fetch referral tree" });
    }
  });

  app.get("/api/referrals/commissions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || "25"), 10) || 25, 1), 100);

      const commissions = await prisma.referralCommission.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const referredIds = Array.from(new Set(commissions.map((item) => item.referredUserId)));
      const referredUsers = referredIds.length
        ? await prisma.user.findMany({
            where: { id: { in: referredIds } },
            select: { id: true, username: true, email: true },
          })
        : [];
      const usersById = new Map<string, { id: string; username: string | null; email: string | null }>(
        referredUsers.map((user) => [user.id, user])
      );

      res.json(
        commissions.map((item) => {
          const referredUser = usersById.get(item.referredUserId);
          return {
            id: item.id,
            transactionId: item.transactionId,
            referrerId: item.referrerId,
            referredUserId: item.referredUserId,
            level: item.level,
            baseAmount: item.baseAmount.toString(),
            rate: item.rate.toString(),
            commission: item.commission.toString(),
            status: item.status,
            createdAt: item.createdAt,
            referredDisplayName: referredUser
              ? generateAnonymizedHandle(referredUser.id)
              : generateAnonymizedHandle(item.referredUserId),
          };
        })
      );
    } catch (error) {
      console.error("Error fetching referral commissions:", error);
      res.status(500).json({ message: "Failed to fetch referral commissions" });
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
      const period = normalizeLeaderboardPeriodParam(req.query.period);
      const limit = clampLeaderboardLimit(req.query.limit, 50);
      const currentUserId = req.authUser!.id;
      const dateFilter = getLeaderboardDateFilter(period);

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;

      const rankedReferralSql = `
        WITH stats AS (
          SELECT
            u.id AS "userId",
            u.username,
            u.email,
            COUNT(r.id)::int AS "totalReferrals",
            COALESCE(SUM(r."totalCommission"), 0) AS "totalCommission",
            COUNT(CASE WHEN r.level = 1 THEN 1 END)::int AS "level1Count",
            COUNT(CASE WHEN r.level = 2 THEN 1 END)::int AS "level2Count",
            COUNT(CASE WHEN r.level = 3 THEN 1 END)::int AS "level3Count"
          FROM "User" u
          JOIN "Referral" r ON r."referrerId" = u.id
            ${dateFilter ? `AND r."createdAt" >= $1` : ""}
          GROUP BY u.id, u.username, u.email
          HAVING COUNT(r.id) > 0
        ), ranked AS (
          SELECT
            *,
            ROW_NUMBER() OVER (
              ORDER BY "totalReferrals" DESC, "totalCommission" DESC, "userId" ASC
            )::int AS rank
          FROM stats
        )
        SELECT * FROM ranked
      `;

      const leaderboardQuery = `${rankedReferralSql} ORDER BY rank ASC LIMIT $${dateFilter ? "2" : "1"}`;
      const leaderboard: any[] = dateFilter
        ? await storage.raw(leaderboardQuery, [dateFilter, limit])
        : await storage.raw(leaderboardQuery, [limit]);

      const userPositionQuery = `${rankedReferralSql} WHERE "userId" = $${dateFilter ? "2" : "1"} LIMIT 1`;
      const userRows: any[] = dateFilter
        ? await storage.raw(userPositionQuery, [dateFilter, currentUserId])
        : await storage.raw(userPositionQuery, [currentUserId]);

      const formatLeaderboardEntry = (item: any, forceYou = false) => {
        const baseData = {
          totalReferrals: toLeaderboardNumber(item.totalReferrals),
          totalCommission: item.totalCommission?.toString?.() ?? "0",
          level1Count: toLeaderboardNumber(item.level1Count),
          level2Count: toLeaderboardNumber(item.level2Count),
          level3Count: toLeaderboardNumber(item.level3Count),
          rank: toLeaderboardNumber(item.rank),
          currentUser: item.userId === currentUserId || forceYou,
        };

        if (isAdmin) {
          return {
            ...baseData,
            userId: item.userId,
            username: item.username,
            email: item.email,
            displayName: item.username || item.email || "Unknown user",
          };
        }

        return {
          ...baseData,
          displayName: forceYou ? "You" : generateAnonymizedHandle(item.userId),
        };
      };

      const formattedLeaderboard = leaderboard.map((item) =>
        formatLeaderboardEntry(item)
      );

      const userPosition = userRows.length
        ? formatLeaderboardEntry(userRows[0], true)
        : null;

      res.json({
        leaderboard: formattedLeaderboard,
        userPosition,
        meta: {
          period,
          unit: "referrals",
          window:
            period === "daily"
              ? "today"
              : period === "weekly"
              ? "last 7 days"
              : period === "monthly"
              ? "last 30 days"
              : "all time",
        },
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/xp", requireAuth, async (req, res) => {
    try {
      const period = normalizeLeaderboardPeriodParam(req.query.period);
      const category = typeof req.query.category === "string" ? req.query.category : "overall";
      const limit = clampLeaderboardLimit(req.query.limit, 50);
      const currentUserId = req.authUser!.id;

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;

      const result = await storage.getXPLeaderboard(
        currentUserId,
        period,
        category,
        isAdmin,
        limit
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching XP leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch XP leaderboard" });
    }
  });

}
