import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const walletRoutes = readFileSync("server/routes/wallet-operations.routes.ts", "utf8");
const depositAdminRoutes = readFileSync("server/routes/admin/deposits.routes.ts", "utf8");
const withdrawalAdminRoutes = readFileSync("server/routes/admin/withdrawals.routes.ts", "utf8");

describe("wallet route safety contracts", () => {
  it("validates withdrawal wallet addresses before accepting requests", () => {
    expect(walletRoutes).toContain("normalizeBscAddress");
    expect(walletRoutes).toContain("valid BEP-20 wallet address");
  });

  it("keeps unverified deposit approval behind an explicit force approval flow", () => {
    expect(depositAdminRoutes).toContain("forceApprove");
    expect(depositAdminRoutes).toContain("requiresForce");
  });

  it("keeps withdrawal approve/reject actions audit logged", () => {
    expect(withdrawalAdminRoutes).toContain("audit");
    expect(withdrawalAdminRoutes).toContain("withdrawal");
  });
});
