import type { Express } from "express";
import type { RouteContext } from "../../routes";
import { recordAdminAuditLog } from "../../services/audit.service";
import {
  getAdminEngagementSummary,
  getEngagementConfig,
  serializeEngagementConfig,
  updateEngagementConfig,
} from "../../services/engagement.service";

export function registerAdminEngagementRoutes(app: Express, ctx: RouteContext) {
  const { requireAuth, requireAdmin, validateCSRF } = ctx;

  app.get("/api/admin/engagement/config", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const config = await getEngagementConfig();
      res.json(serializeEngagementConfig(config));
    } catch (error) {
      console.error("Error fetching engagement config:", error);
      res.status(500).json({ message: "Failed to fetch engagement config" });
    }
  });

  app.patch("/api/admin/engagement/config", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const adminUserId = req.authUser!.id;
      const config = await updateEngagementConfig(req.body || {}, adminUserId);

      await recordAdminAuditLog({
        adminUserId,
        entityType: "engagement_config",
        entityId: "default",
        action: "engagement_config_updated",
        summary: "Updated engagement XP and reward cap settings",
        metadata: { fields: Object.keys(req.body || {}) },
        req,
      });

      res.json(serializeEngagementConfig(config));
    } catch (error) {
      console.error("Error updating engagement config:", error);
      res.status(500).json({ message: "Failed to update engagement config" });
    }
  });

  app.get("/api/admin/engagement/summary", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const summary = await getAdminEngagementSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching engagement admin summary:", error);
      res.status(500).json({ message: "Failed to fetch engagement summary" });
    }
  });
}
