import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

describe("API smoke test harness", () => {
  it("runs Supertest against an isolated Express app", async () => {
    const app = express();
    app.get("/health", (_req, res) => res.json({ ok: true }));

    await request(app).get("/health").expect(200).expect({ ok: true });
  });

  it("documents high-value production routes that need integration coverage", () => {
    const routesToCover = [
      "POST /api/mining/start",
      "POST /api/mining/process-rewards",
      "POST /api/transactions/deposit",
      "POST /api/transactions/withdrawal",
      "POST /api/admin/deposits/:id/approve",
      "POST /api/admin/withdrawals/:id/reject",
      "POST /api/checkin",
      "POST /api/tasks/:id/complete",
    ];

    expect(new Set(routesToCover).size).toBe(routesToCover.length);
  });
});
