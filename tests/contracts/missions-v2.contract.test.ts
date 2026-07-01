import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const rewardService = readFileSync("server/services/reward.service.ts", "utf8");
const profileRoutes = readFileSync("server/routes/progress-profile.routes.ts", "utf8");
const tasksPage = readFileSync("client/src/pages/tasks.tsx", "utf8");
const adminTasks = readFileSync("client/src/pages/admin/tabs/tasks.tsx", "utf8");

describe("missions v2 contracts", () => {
  it("adds reusable daily/weekly mission fields to tasks and period-scoped user progress", () => {
    expect(schema).toContain("missionType String");
    expect(schema).toContain("triggerKey  String");
    expect(schema).toContain("targetCount Int");
    expect(schema).toContain("periodKey   String");
    expect(schema).toContain("@@unique([userId, taskId, periodKey])");
  });

  it("tracks progress separately from claiming rewards", () => {
    expect(rewardService).toContain("recordMissionEvent");
    expect(rewardService).toContain("recordManualTaskProgress");
    expect(rewardService).toContain("claimUserTaskReward");
    expect(rewardService).toContain("daily_checkin_claimed");
    expect(rewardService).toContain("mining_completed");
  });

  it("exposes progress and claim APIs for missions", () => {
    expect(profileRoutes).toContain('/api/tasks/track');
    expect(profileRoutes).toContain('/api/tasks/:taskId/progress');
    expect(profileRoutes).toContain('/api/tasks/:taskId/claim');
  });

  it("updates user and admin UI for missions v2", () => {
    expect(tasksPage).toContain("Claim Reward");
    expect(tasksPage).toContain("Record Progress");
    expect(adminTasks).toContain("Mission Type");
    expect(adminTasks).toContain("Progress Trigger");
    expect(adminTasks).toContain("Weekly quest");
  });
});
