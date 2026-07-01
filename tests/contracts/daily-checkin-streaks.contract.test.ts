import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const rewardService = readFileSync("server/services/reward.service.ts", "utf8");
const profileRoutes = readFileSync("server/routes/progress-profile.routes.ts", "utf8");
const calendar = readFileSync("client/src/components/checkin-calendar.tsx", "utf8");
const rewardsPage = readFileSync("client/src/pages/rewards.tsx", "utf8");

describe("daily check-in streak contracts", () => {
  it("stores one check-in per user per UTC date", () => {
    expect(schema).toContain("model DailyCheckin");
    expect(schema).toContain("@@unique([userId, checkinDate])");
    expect(schema).toContain("rewardCapped");
  });

  it("exposes status, claim, and history endpoints", () => {
    expect(profileRoutes).toContain('/api/checkin/status');
    expect(profileRoutes).toContain('/api/checkin');
    expect(profileRoutes).toContain('/api/checkin/history');
  });

  it("uses the daily ledger for claim and calendar history", () => {
    expect(rewardService).toContain("getUtcDateKey");
    expect(rewardService).toContain("userId_checkinDate");
    expect(rewardService).toContain("dailyCheckin.create");
    expect(rewardService).toContain("dailyCheckin.findMany");
  });

  it("keeps the rewards UI aligned with real backend reward values", () => {
    expect(rewardsPage).toContain('/api/checkin/status');
    expect(rewardsPage).toContain('Claim Daily Reward');
    expect(calendar).toContain('monthTotalXnrt');
    expect(calendar).toContain('Reward cap applied');
  });
});
