import type { Express } from "express";
import type { RouteContext } from "../../routes";
import { registerAdminDepositPendingRoutes } from "./deposits/pending.routes";
import { registerAdminDepositScannerRoutes } from "./deposits/scanner.routes";
import { registerAdminDepositUnmatchedRoutes } from "./deposits/unmatched.routes";
import { registerAdminDepositReportsRoutes } from "./deposits/reports.routes";
import { registerAdminDepositReconcileRoutes } from "./deposits/reconcile.routes";

export function registerAdminDepositRoutes(app: Express, ctx: RouteContext) {
  registerAdminDepositPendingRoutes(app, ctx);
  registerAdminDepositScannerRoutes(app, ctx);
  registerAdminDepositUnmatchedRoutes(app, ctx);
  registerAdminDepositReportsRoutes(app, ctx);
  registerAdminDepositReconcileRoutes(app, ctx);
}
