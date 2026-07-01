import type { Express } from "express";
import type { RouteContext } from "../routes";
import { getEngagementSummary } from "../services/engagement.service";

export function registerEngagementRoutes(app: Express, ctx: RouteContext) {
  const { requireAuth } = ctx;

  app.get("/api/engagement/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const summary = await getEngagementSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching engagement summary:", error);
      res.status(500).json({ message: "Failed to fetch engagement summary" });
    }
  });
}
