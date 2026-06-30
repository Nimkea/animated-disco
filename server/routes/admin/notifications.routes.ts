import type { Express } from "express";
import type { RouteContext } from "../../routes";
import { recordAdminAuditLog } from "../../services/audit.service";
import { notifyUser } from "../../notifications";

const BROADCAST_LIMIT = 5000;

function normalizeBroadcastType(value: unknown) {
  const raw = String(value || "admin_broadcast").trim().toLowerCase();
  if (!raw) return "admin_broadcast";
  return raw.replace(/[^a-z0-9_:-]/g, "_").slice(0, 60);
}

function normalizeUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "/notifications";
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  return "/notifications";
}

export function registerAdminNotificationRoutes(app: Express, ctx: RouteContext) {
  const { prisma, requireAuth, requireAdmin, validateCSRF } = ctx;

  app.get("/api/admin/notifications/broadcast/summary", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [totalUsers, pushEnabledUsers, inAppEnabledUsers, adminBroadcastEnabledUsers] = await Promise.all([
        prisma.user.count(),
        (prisma as any).notificationPreference.count({ where: { pushEnabled: true } }),
        (prisma as any).notificationPreference.count({ where: { inAppEnabled: true } }),
        (prisma as any).notificationPreference.count({ where: { adminBroadcastAlerts: true } }),
      ]);

      res.json({
        totalUsers,
        pushEnabledUsers,
        inAppEnabledUsers,
        adminBroadcastEnabledUsers,
        maxBatchSize: BROADCAST_LIMIT,
      });
    } catch (error) {
      console.error("Error fetching broadcast summary:", error);
      res.status(500).json({ message: "Failed to fetch broadcast summary" });
    }
  });

  app.post("/api/admin/notifications/broadcast", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    const adminUserId = req.authUser!.id;
    try {
      const target = String(req.body.target || "all");
      const title = String(req.body.title || "").trim();
      const message = String(req.body.message || "").trim();
      const type = normalizeBroadcastType(req.body.type);
      const url = normalizeUrl(req.body.url);
      const targetUserId = typeof req.body.userId === "string" ? req.body.userId.trim() : "";

      if (!title || title.length < 3 || title.length > 120) {
        return res.status(400).json({ message: "Title must be between 3 and 120 characters" });
      }
      if (!message || message.length < 5 || message.length > 1000) {
        return res.status(400).json({ message: "Message must be between 5 and 1000 characters" });
      }
      if (!["all", "user"].includes(target)) {
        return res.status(400).json({ message: "Invalid broadcast target" });
      }
      if (target === "user" && !targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      const users = target === "user"
        ? await prisma.user.findMany({ where: { id: targetUserId }, select: { id: true, email: true, username: true } })
        : await prisma.user.findMany({
            select: { id: true, email: true, username: true },
            orderBy: { createdAt: "asc" },
            take: BROADCAST_LIMIT,
          });

      if (users.length === 0) {
        return res.status(404).json({ message: "No users found for broadcast" });
      }

      const broadcastId = `broadcast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const metadata = {
        url,
        broadcastId,
        sentBy: adminUserId,
        target,
      };

      let sent = 0;
      let failed = 0;
      const failures: Array<{ userId: string; reason: string }> = [];

      for (const user of users) {
        try {
          const created = await notifyUser(user.id, {
            type,
            title,
            message,
            metadata,
            url,
          });
          if (created) sent += 1;
        } catch (error: any) {
          failed += 1;
          failures.push({ userId: user.id, reason: error?.message || "Unknown error" });
        }
      }

      await recordAdminAuditLog({
        req,
        adminUserId,
        entityType: "notification_broadcast",
        entityId: broadcastId,
        action: target === "all" ? "notification_broadcast_all" : "notification_broadcast_user",
        status: failed > 0 ? "partial" : "success",
        summary: `Sent notification broadcast to ${sent}/${users.length} users`,
        metadata: {
          broadcastId,
          target,
          targetUserId: target === "user" ? targetUserId : null,
          title,
          type,
          url,
          attempted: users.length,
          sent,
          failed,
          failures: failures.slice(0, 20),
        },
      });

      res.json({
        message: "Broadcast processed",
        broadcastId,
        attempted: users.length,
        sent,
        skipped: users.length - sent - failed,
        failed,
        failures: failures.slice(0, 20),
      });
    } catch (error: any) {
      console.error("Error sending notification broadcast:", error);
      await recordAdminAuditLog({
        req,
        adminUserId,
        entityType: "notification_broadcast",
        action: "notification_broadcast_failed",
        status: "failed",
        summary: "Notification broadcast failed",
        metadata: { reason: error?.message || "Unknown error" },
      });
      res.status(500).json({ message: "Failed to send notification broadcast" });
    }
  });
}
