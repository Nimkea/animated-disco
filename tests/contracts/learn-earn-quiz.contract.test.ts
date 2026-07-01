import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const learnService = readFileSync("server/services/learn-earn.service.ts", "utf8");
const learnRoutes = readFileSync("server/routes/learn-earn.routes.ts", "utf8");
const adminLearnRoutes = readFileSync("server/routes/admin/learn-earn.routes.ts", "utf8");
const learnPage = readFileSync("client/src/pages/learn.tsx", "utf8");
const adminLearnPage = readFileSync("client/src/pages/admin/tabs/learn-earn.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");

describe("learn and earn quiz contracts", () => {
  it("adds lesson, question, and user lesson progress models", () => {
    expect(schema).toContain("model Lesson");
    expect(schema).toContain("model LessonQuestion");
    expect(schema).toContain("model UserLessonProgress");
    expect(schema).toContain("@@unique([userId, lessonId])");
    expect(schema).toContain("isResponsibleUsage Boolean");
  });

  it("seeds responsible usage lessons and awards capped quiz rewards once", () => {
    expect(learnService).toContain("Responsible Usage & Safety");
    expect(learnService).toContain("ensureDefaultLessons");
    expect(learnService).toContain("submitLessonQuiz");
    expect(learnService).toContain("calculateAllowedXnrtReward");
    expect(learnService).toContain("alreadyRewarded");
    expect(learnService).toContain("Quiz Reward Claimed");
    expect(learnService).toContain("lesson_completed");
  });

  it("exposes user and admin Learn & Earn APIs", () => {
    expect(routes).toContain("registerLearnEarnRoutes");
    expect(learnRoutes).toContain('/api/learn/lessons');
    expect(learnRoutes).toContain('/api/learn/lessons/:slug/submit');
    expect(adminLearnRoutes).toContain('/api/admin/learn/lessons');
    expect(adminLearnRoutes).toContain('/api/admin/learn/lessons/:id/questions');
  });

  it("adds Learn & Earn and Admin Quiz Manager UI", () => {
    expect(learnPage).toContain("Learn & Earn Quiz System");
    expect(learnPage).toContain("Submit & Claim Reward");
    expect(learnPage).toContain("Responsible Usage");
    expect(adminLearnPage).toContain("Admin Quiz Manager");
    expect(adminLearnPage).toContain("Quiz Questions");
  });
});
