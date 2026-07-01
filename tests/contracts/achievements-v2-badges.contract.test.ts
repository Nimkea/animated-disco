import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const rewardService = readFileSync("server/services/reward.service.ts", "utf8");
const profileRoutes = readFileSync("server/routes/progress-profile.routes.ts", "utf8");
const achievementsPage = readFileSync("client/src/pages/achievements.tsx", "utf8");
const profilePage = readFileSync("client/src/pages/profile.tsx", "utf8");
const adminAchievements = readFileSync("client/src/pages/admin/tabs/achievements.tsx", "utf8");

describe("achievements v2 badge contracts", () => {
  it("adds tiered badge metadata and trophy case flags to the schema", () => {
    expect(schema).toContain("badgeTier   String");
    expect(schema).toContain("badgeColor  String?");
    expect(schema).toContain("isFeatured    Boolean");
    expect(schema).toContain("featuredSlot  Int?");
    expect(schema).toContain("@@unique([userId, achievementId])");
  });

  it("defines bronze, silver, gold, and diamond badge tiers", () => {
    expect(rewardService).toContain("bronze");
    expect(rewardService).toContain("silver");
    expect(rewardService).toContain("gold");
    expect(rewardService).toContain("diamond");
    expect(rewardService).toContain("Badge Unlocked");
  });

  it("exposes trophy case profile data and feature controls", () => {
    expect(profileRoutes).toContain("getUserTrophyCase");
    expect(profileRoutes).toContain('/api/achievements/:id/feature');
    expect(profileRoutes).toContain("trophyCase");
  });

  it("updates user and admin UI for badges", () => {
    expect(achievementsPage).toContain("Trophy Case");
    expect(achievementsPage).toContain("Add Trophy");
    expect(profilePage).toContain("Trophy Case");
    expect(adminAchievements).toContain("Badge Tier");
    expect(adminAchievements).toContain("diamond");
  });
});
