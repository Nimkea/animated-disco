import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readExistingFiles(paths: string[]) {
  return paths
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

const walletRoutes = readExistingFiles(["server/routes/wallet-operations.routes.ts"]);
const depositAdminRoutes = readExistingFiles([
  "server/routes/admin/deposits.routes.ts",
  "server/routes/admin/deposits/pending.routes.ts",
]);
const withdrawalAdminRoutes = readExistingFiles(["server/routes/admin/withdrawals.routes.ts"]);

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
