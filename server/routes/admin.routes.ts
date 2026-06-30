import type { Express } from "express";
import type { RouteContext } from "../routes";
import { registerAdminOverviewRoutes } from "./admin/overview.routes";
import { registerAdminDepositRoutes } from "./admin/deposits.routes";
import { registerAdminWithdrawalRoutes } from "./admin/withdrawals.routes";
import { registerAdminStakeRoutes } from "./admin/stakes.routes";
import { registerAdminAnalyticsRoutes } from "./admin/analytics.routes";
import { registerAdminAnnouncementRoutes } from "./admin/announcements.routes";

export function registerAdminRoutes(app: Express, ctx: RouteContext) {
  registerAdminOverviewRoutes(app, ctx);
  registerAdminDepositRoutes(app, ctx);
  registerAdminWithdrawalRoutes(app, ctx);
  registerAdminStakeRoutes(app, ctx);
  registerAdminAnalyticsRoutes(app, ctx);
  registerAdminAnnouncementRoutes(app, ctx);
}
