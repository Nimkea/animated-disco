import type { Express } from "express";
import type { RouteContext } from "../../../routes";
import { recordAdminAuditLog } from "../../../services/audit.service";
import { getDepositScannerStatus, scanForDeposits } from "../../../services/depositScanner";

export function registerAdminDepositScannerRoutes(app: Express, ctx: RouteContext) {
  const { requireAuth, requireAdmin, validateCSRF } = ctx;

  app.get(
    "/api/admin/scanner/status",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        res.json(await getDepositScannerStatus());
      } catch (error) {
        console.error("Error fetching scanner status:", error);
        res.status(500).json({ message: "Failed to fetch scanner status" });
      }
    }
  );

  app.post(
    "/api/admin/scanner/run",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        await scanForDeposits();
        await recordAdminAuditLog({
          req,
          entityType: "scanner",
          action: "scanner_manual_run",
          summary: "Admin manually triggered the deposit scanner",
        });
        res.json({ ok: true, status: await getDepositScannerStatus() });
      } catch (error: any) {
        await recordAdminAuditLog({
          req,
          entityType: "scanner",
          action: "scanner_manual_run",
          status: "failed",
          summary: "Manual scanner run failed",
          metadata: { error: error?.message || String(error) },
        });
        console.error("Error running scanner:", error);
        res.status(500).json({ message: error?.message || "Failed to run scanner" });
      }
    }
  );
}
