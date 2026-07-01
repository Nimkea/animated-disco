import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const engagementService = readFileSync("server/services/engagement.service.ts", "utf8");
const routes = readFileSync("server/routes/engagement.routes.ts", "utf8");
const adminRoutes = readFileSync("server/routes/admin/engagement.routes.ts", "utf8");

describe("engagement system contracts", () => {
  it("stores configurable engagement caps and XP ledger models", () => {
    expect(schema).toContain("model EngagementConfig");
    expect(schema).toContain("model XpLedger");
    expect(schema).toContain("model RewardCapLedger");
    expect(schema).toContain("dailyTotalXnrtCap");
    expect(schema).toContain("levelXpStep");
  });

  it("keeps XNRT engagement rewards behind daily and weekly caps", () => {
    expect(engagementService).toContain("calculateAllowedXnrtReward");
    expect(engagementService).toContain("dailyTotalXnrtCap");
    expect(engagementService).toContain("weeklyTotalXnrtCap");
    expect(engagementService).toContain("dailyTaskXnrtCap");
    expect(engagementService).toContain("weeklyTaskXnrtCap");
  });

  it("exposes user and admin engagement summary APIs", () => {
    expect(routes).toContain("/api/engagement/summary");
    expect(adminRoutes).toContain("/api/admin/engagement/config");
    expect(adminRoutes).toContain("/api/admin/engagement/summary");
    expect(adminRoutes).toContain("engagement_config_updated");
  });
});
