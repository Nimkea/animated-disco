import type { Express } from "express";
import type { RouteContext } from "../routes";
import {
  getReferralCommissionHistoryForUser,
  getReferralStatsForUser,
  getReferralTreeForUser,
} from "../services/referral.service";
import {
  getNotificationPreferenceSummary,
  updateNotificationPreference,
} from "../services/notificationPreference.service";

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
      const stats = await getReferralStatsForUser(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.get("/api/referrals/tree", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const tree = await getReferralTreeForUser(userId);
      res.json(tree);
    } catch (error) {
      console.error("Error fetching referral tree:", error);
      res.status(500).json({ message: "Failed to fetch referral tree" });
    }
  });

  app.get("/api/referrals/commissions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const commissions = await getReferralCommissionHistoryForUser(userId, req.query.limit);
      res.json(commissions);
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

  app.get("/api/notifications/status", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      const subscriptions = await storage.getUserPushSubscriptions(userId);
      const pendingPush = await prisma.notification.count({
        where: { userId, pendingPush: true },
      });
      const vapidConfigured = Boolean(VAPID_PUBLIC_KEY);
      const pushEnabled = process.env.ENABLE_PUSH_NOTIFICATIONS !== "false" && vapidConfigured;

      const preferences = await getNotificationPreferenceSummary(userId);

      res.json({
        unreadCount,
        subscriptions: subscriptions.length,
        pendingPush,
        pushEnabled: pushEnabled && preferences.pushEnabled,
        serverPushEnabled: pushEnabled,
        vapidConfigured,
        foregroundSoundSupported: true,
        preferences,
      });
    } catch (error) {
      console.error("Error fetching notification status:", error);
      res.status(500).json({ message: "Failed to fetch notification status" });
    }
  });


  app.get("/api/notifications/preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const preferences = await getNotificationPreferenceSummary(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.patch(
    "/api/notifications/preferences",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const payload = {
          pushEnabled: typeof req.body.pushEnabled === "boolean" ? req.body.pushEnabled : undefined,
          inAppEnabled: typeof req.body.inAppEnabled === "boolean" ? req.body.inAppEnabled : undefined,
          inAppSoundEnabled: typeof req.body.inAppSoundEnabled === "boolean" ? req.body.inAppSoundEnabled : undefined,
          soundVolume: req.body.soundVolume,
          soundType: req.body.soundType,
          walletAlerts: typeof req.body.walletAlerts === "boolean" ? req.body.walletAlerts : undefined,
          miningAlerts: typeof req.body.miningAlerts === "boolean" ? req.body.miningAlerts : undefined,
          stakingAlerts: typeof req.body.stakingAlerts === "boolean" ? req.body.stakingAlerts : undefined,
          referralAlerts: typeof req.body.referralAlerts === "boolean" ? req.body.referralAlerts : undefined,
          achievementAlerts: typeof req.body.achievementAlerts === "boolean" ? req.body.achievementAlerts : undefined,
          taskAlerts: typeof req.body.taskAlerts === "boolean" ? req.body.taskAlerts : undefined,
          systemAlerts: typeof req.body.systemAlerts === "boolean" ? req.body.systemAlerts : undefined,
          adminBroadcastAlerts: typeof req.body.adminBroadcastAlerts === "boolean" ? req.body.adminBroadcastAlerts : undefined,
        };
        const preferences = await updateNotificationPreference(userId, payload);
        res.json(preferences);
      } catch (error) {
        console.error("Error updating notification preferences:", error);
        res.status(500).json({ message: "Failed to update notification preferences" });
      }
    }
  );

  app.patch("/api/notifications/:id/read", requireAuth, validateCSRF, async (req, res) => {
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
    validateCSRF,
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
      const configured = Boolean(VAPID_PUBLIC_KEY);
      const enabled = process.env.ENABLE_PUSH_NOTIFICATIONS !== "false" && configured;
      res.json({ publicKey: VAPID_PUBLIC_KEY, configured, enabled });
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
