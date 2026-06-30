import type { Express } from "express";
import type { RouteContext } from "../routes";
import {
  claimTrustLoanForUser,
  getDefaultTrustLoanStatus,
  getTrustLoanStatusForUser,
  TrustLoanServiceError,
} from "../services/trustLoan.service";

export function registerTrustLoanRoutes(app: Express, ctx: RouteContext) {
  const { requireAuth, validateCSRF } = ctx;

  app.get("/api/trust-loan/status", requireAuth, async (req, res) => {
    try {
      const status = await getTrustLoanStatusForUser(req.authUser!.id);
      return res.json(status);
    } catch (error) {
      console.error("[trust-loan/status] error:", error);
      return res.json(getDefaultTrustLoanStatus());
    }
  });

  app.post("/api/trust-loan/claim", requireAuth, validateCSRF, async (req, res) => {
    try {
      const result = await claimTrustLoanForUser(req.authUser!.id);
      return res.json({ ok: true, stake: result.stake, status: result.status });
    } catch (error) {
      if (error instanceof TrustLoanServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("[trust-loan/claim] error:", error);
      return res.status(500).json({ message: "Failed to claim Trust Loan" });
    }
  });
}
