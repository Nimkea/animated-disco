import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { addUtcDays, getNextUtcDayStart, getUtcDateKey, getUtcMonthDateKeyRange, isSameUtcDay, startOfUtcDay } from "../lib/dates";
import { notifyUser } from "../notifications";
import { storage } from "../storage";
import {
  awardUserXpWithLedger,
  calculateAllowedXnrtReward,
  calculateDailyCheckinReward,
  calculateLevelFromXp,
  getEngagementConfig,
} from "./engagement.service";

const db = prisma as any;

const BADGE_TIERS = ["bronze", "silver", "gold", "diamond"] as const;
export const BADGE_UNLOCKED_NOTIFICATION_TITLE = "🏆 Badge Unlocked";

const BADGE_TIER_RANK: Record<string, number> = { bronze: 1, silver: 2, gold: 3, diamond: 4 };
const DEFAULT_BADGE_COLORS: Record<string, string> = {
  bronze: "amber",
  silver: "slate",
  gold: "yellow",
  diamond: "cyan",
};

function normalizeBadgeTier(value: unknown) {
  const tier = String(value || "bronze").trim().toLowerCase();
  return BADGE_TIERS.includes(tier as any) ? tier : "bronze";
}

function getBadgeTierRank(value: unknown) {
  return BADGE_TIER_RANK[normalizeBadgeTier(value)] || 1;
}

const DEFAULT_ACHIEVEMENTS = [
  { title: "First Steps", description: "Create your account and enter the XNRT platform", icon: "✅", category: "onboarding", requirement: 1, xpReward: 10, badgeTier: "bronze", sortOrder: 10 },
  { title: "Wallet Ready", description: "Add or receive a wallet address for deposits", icon: "👛", category: "wallet", requirement: 1, xpReward: 20, badgeTier: "bronze", sortOrder: 20 },
  { title: "Sign-in Bonus", description: "Claim your first daily check-in reward", icon: "🔥", category: "streaks", requirement: 1, xpReward: 15, badgeTier: "bronze", sortOrder: 30 },
  { title: "3-Day Streak", description: "Check in 3 days in a row", icon: "🔥", category: "streaks", requirement: 3, xpReward: 30, badgeTier: "bronze", sortOrder: 40 },
  { title: "Weekly Grinder", description: "Maintain a 7-day login streak", icon: "📆", category: "streaks", requirement: 7, xpReward: 70, badgeTier: "silver", sortOrder: 50 },
  { title: "Monthly Legend", description: "Maintain a 30-day login streak", icon: "🏆", category: "streaks", requirement: 30, xpReward: 200, badgeTier: "diamond", sortOrder: 60 },
  { title: "First Mining Session", description: "Complete your first mining session", icon: "⛏️", category: "mining", requirement: 1, xpReward: 15, badgeTier: "bronze", sortOrder: 70 },
  { title: "Daily Miner", description: "Complete 10 mining sessions", icon: "🪙", category: "mining", requirement: 10, xpReward: 60, badgeTier: "silver", sortOrder: 80 },
  { title: "Pro Miner", description: "Complete 50 mining sessions", icon: "⚙️", category: "mining", requirement: 50, xpReward: 200, badgeTier: "gold", sortOrder: 90 },
  { title: "Diamond Miner", description: "Complete 200 mining sessions", icon: "💎", category: "mining", requirement: 200, xpReward: 500, badgeTier: "diamond", sortOrder: 100 },
  { title: "First Earnings", description: "Earn a total of 1,000 XNRT from any source", icon: "💰", category: "earnings", requirement: 1000, xpReward: 25, badgeTier: "bronze", sortOrder: 110 },
  { title: "Rising Earner", description: "Earn a total of 5,000 XNRT", icon: "📈", category: "earnings", requirement: 5000, xpReward: 75, badgeTier: "silver", sortOrder: 120 },
  { title: "Pro Earner", description: "Earn a total of 25,000 XNRT", icon: "🏅", category: "earnings", requirement: 25000, xpReward: 150, badgeTier: "gold", sortOrder: 130 },
  { title: "Diamond Earner", description: "Earn a total of 100,000 XNRT", icon: "💎", category: "earnings", requirement: 100000, xpReward: 450, badgeTier: "diamond", sortOrder: 140 },
  { title: "First Referral", description: "Invite your first friend to XNRT", icon: "👥", category: "referrals", requirement: 1, xpReward: 25, badgeTier: "bronze", sortOrder: 150 },
  { title: "Team Builder", description: "Refer 5 direct users", icon: "🧱", category: "referrals", requirement: 5, xpReward: 75, badgeTier: "silver", sortOrder: 160 },
  { title: "Community Leader", description: "Refer 25 direct users", icon: "👑", category: "referrals", requirement: 25, xpReward: 200, badgeTier: "gold", sortOrder: 170 },
  { title: "Network Diamond", description: "Refer 100 direct users", icon: "💎", category: "referrals", requirement: 100, xpReward: 600, badgeTier: "diamond", sortOrder: 180 },
  { title: "Mission Starter", description: "Claim your first mission reward", icon: "🎯", category: "tasks", requirement: 1, xpReward: 25, badgeTier: "bronze", sortOrder: 190 },
  { title: "Mission Finisher", description: "Claim 10 mission rewards", icon: "✅", category: "tasks", requirement: 10, xpReward: 100, badgeTier: "silver", sortOrder: 200 },
  { title: "Quest Champion", description: "Claim 50 mission rewards", icon: "🏆", category: "tasks", requirement: 50, xpReward: 300, badgeTier: "gold", sortOrder: 210 },
  { title: "Stake Starter", description: "Create your first stake", icon: "💠", category: "staking", requirement: 1, xpReward: 40, badgeTier: "bronze", sortOrder: 220 },
  { title: "Stake Builder", description: "Create 5 staking positions", icon: "🔷", category: "staking", requirement: 5, xpReward: 150, badgeTier: "silver", sortOrder: 230 },
  { title: "Learn Starter", description: "Pass your first Learn & Earn quiz", icon: "🎓", category: "education", requirement: 1, xpReward: 50, badgeTier: "bronze", sortOrder: 235 },
  { title: "Responsible Learner", description: "Complete the responsible usage safety lesson", icon: "🛡️", category: "responsible_usage", requirement: 1, xpReward: 80, badgeTier: "silver", sortOrder: 236 },
  { title: "Trust Loan Eligible", description: "Build enough engagement for Trust Loan readiness", icon: "🤝", category: "trust_loan", requirement: 1, xpReward: 100, badgeTier: "gold", sortOrder: 240 },
] as const;

const DEFAULT_TASKS = [
  {
    title: "Complete Your Profile",
    description: "Review your profile and complete your account setup",
    category: "onboarding",
    missionType: "one_time",
    triggerKey: "manual",
    targetCount: 1,
    sortOrder: 10,
    xpReward: 50,
    xnrtReward: "10",
    requirements: "Open your profile and confirm your account details",
    isActive: true,
  },
  {
    title: "Daily Check-In",
    description: "Claim your daily reward and keep your streak alive",
    category: "daily",
    missionType: "daily",
    triggerKey: "daily_checkin_claimed",
    targetCount: 1,
    sortOrder: 20,
    xpReward: 25,
    xnrtReward: "5",
    requirements: "Claim the daily check-in reward on the Rewards page",
    isActive: true,
  },
  {
    title: "Start Mining",
    description: "Start one mining session today",
    category: "daily",
    missionType: "daily",
    triggerKey: "mining_started",
    targetCount: 1,
    sortOrder: 30,
    xpReward: 35,
    xnrtReward: "8",
    requirements: "Open Mining and start a session",
    isActive: true,
  },
  {
    title: "Open Wallet Page",
    description: "Review your wallet balances and recent transactions",
    category: "daily",
    missionType: "daily",
    triggerKey: "wallet_opened",
    targetCount: 1,
    sortOrder: 40,
    xpReward: 15,
    xnrtReward: "3",
    requirements: "Open the Wallet page once today",
    isActive: true,
  },
  {
    title: "Check Staking Rewards",
    description: "Visit staking and review reward status",
    category: "daily",
    missionType: "daily",
    triggerKey: "staking_rewards_viewed",
    targetCount: 1,
    sortOrder: 50,
    xpReward: 15,
    xnrtReward: "3",
    requirements: "Open the Staking page once today",
    isActive: true,
  },
  {
    title: "Read Safety Tip",
    description: "Read one responsible usage and security tip",
    category: "daily",
    missionType: "daily",
    triggerKey: "safety_tip_read",
    targetCount: 1,
    sortOrder: 60,
    xpReward: 20,
    xnrtReward: "4",
    requirements: "Use the Record Progress button after reading the safety note",
    isActive: true,
  },
  {
    title: "Daily Learn & Earn",
    description: "Pass one Learn & Earn quiz today",
    category: "daily",
    missionType: "daily",
    triggerKey: "lesson_completed",
    targetCount: 1,
    sortOrder: 70,
    xpReward: 30,
    xnrtReward: "6",
    requirements: "Open Learn and pass any available quiz",
    isActive: true,
  },
  {
    title: "Weekly Mining Quest",
    description: "Complete 5 mining sessions this week",
    category: "weekly",
    missionType: "weekly",
    triggerKey: "mining_completed",
    targetCount: 5,
    sortOrder: 110,
    xpReward: 150,
    xnrtReward: "100",
    requirements: "Complete 5 mining cycles before the weekly reset",
    isActive: true,
  },
  {
    title: "Weekly Check-in Quest",
    description: "Check in on 5 different days this week",
    category: "weekly",
    missionType: "weekly",
    triggerKey: "daily_checkin_claimed",
    targetCount: 5,
    sortOrder: 120,
    xpReward: 125,
    xnrtReward: "80",
    requirements: "Claim daily check-in rewards on 5 days this week",
    isActive: true,
  },
  {
    title: "Weekly Staking Quest",
    description: "Create one stake this week",
    category: "weekly",
    missionType: "weekly",
    triggerKey: "stake_created",
    targetCount: 1,
    sortOrder: 130,
    xpReward: 100,
    xnrtReward: "50",
    requirements: "Create any eligible staking position",
    isActive: true,
  },
  {
    title: "Weekly Learning Quest",
    description: "Pass 3 Learn & Earn quizzes this week",
    category: "weekly",
    missionType: "weekly",
    triggerKey: "lesson_completed",
    targetCount: 3,
    sortOrder: 135,
    xpReward: 140,
    xnrtReward: "90",
    requirements: "Complete 3 quiz lessons before weekly reset",
    isActive: true,
  },
  {
    title: "Weekly Referral Quest",
    description: "Invite 2 new users this week",
    category: "weekly",
    missionType: "weekly",
    triggerKey: "referral_created",
    targetCount: 2,
    sortOrder: 140,
    xpReward: 160,
    xnrtReward: "120",
    requirements: "Get 2 direct referrals before weekly reset",
    isActive: true,
  },
] as const;

const VALID_MISSION_TYPES = new Set(["one_time", "daily", "weekly"]);
const AUTOMATED_TRIGGER_KEYS = new Set([
  "daily_checkin_claimed",
  "mining_started",
  "mining_completed",
  "stake_created",
  "referral_created",
  "lesson_completed",
]);

type MissionPeriod = { key: string; start?: Date; end?: Date; expiresAt?: Date | null };

function normalizeMissionType(value: unknown) {
  const missionType = String(value || "one_time").trim().toLowerCase();
  return VALID_MISSION_TYPES.has(missionType) ? missionType : "one_time";
}

function normalizeTriggerKey(value: unknown) {
  return (
    String(value || "manual")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 60) || "manual"
  );
}

function startOfUtcWeek(date = new Date()) {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - weekday + 1);
  return day;
}

function getMissionPeriod(task: any, now = new Date()): MissionPeriod {
  const missionType = normalizeMissionType(task?.missionType);
  if (missionType === "daily") {
    const start = startOfUtcDay(now);
    const end = addUtcDays(start, 1);
    return { key: `day:${getUtcDateKey(start)}`, start, end, expiresAt: end };
  }
  if (missionType === "weekly") {
    const start = startOfUtcWeek(now);
    const end = addUtcDays(start, 7);
    return { key: `week:${getUtcDateKey(start)}`, start, end, expiresAt: end };
  }
  return { key: "all-time", expiresAt: null };
}

function getTaskTargetCount(task: any) {
  const parsed = Number(task?.targetCount || task?.maxProgress || 1);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

async function getAutomatedMissionProgress(userId: string, triggerKey: string, period: MissionPeriod) {
  if (!period.start || !period.end) return null;
  const start = period.start;
  const end = period.end;
  const startKey = getUtcDateKey(start);
  const endKey = getUtcDateKey(end);

  switch (triggerKey) {
    case "daily_checkin_claimed":
      return db.dailyCheckin.count({ where: { userId, checkinDate: { gte: startKey, lt: endKey } } });
    case "mining_started":
      return prisma.miningSession.count({ where: { userId, createdAt: { gte: start, lt: end } } });
    case "mining_completed":
      return prisma.miningSession.count({ where: { userId, status: "completed", createdAt: { gte: start, lt: end } } });
    case "stake_created":
      return prisma.stake.count({ where: { userId, createdAt: { gte: start, lt: end } } });
    case "referral_created":
      return prisma.referral.count({ where: { referrerId: userId, level: 1, createdAt: { gte: start, lt: end } } });
    case "lesson_completed":
      return db.userLessonProgress.count({ where: { userId, rewarded: true, completedAt: { gte: start, lt: end } } });
    default:
      return null;
  }
}

async function refreshAutomatedMissionProgress(userId: string, userTasks: any[]) {
  const updatedRows: any[] = [];

  for (const userTask of userTasks) {
    const task = userTask.task;
    if (!task) {
      updatedRows.push(userTask);
      continue;
    }

    const triggerKey = normalizeTriggerKey(task.triggerKey);
    if (!AUTOMATED_TRIGGER_KEYS.has(triggerKey)) {
      updatedRows.push(userTask);
      continue;
    }

    const period = getMissionPeriod(task);
    if (period.key !== userTask.periodKey) {
      updatedRows.push(userTask);
      continue;
    }

    const computed = await getAutomatedMissionProgress(userId, triggerKey, period);
    if (computed === null) {
      updatedRows.push(userTask);
      continue;
    }

    const maxProgress = getTaskTargetCount(task);
    const nextProgress = Math.min(maxProgress, Math.max(Number(userTask.progress || 0), Number(computed || 0)));

    if (nextProgress !== userTask.progress || userTask.maxProgress !== maxProgress) {
      const updated = await prisma.userTask.update({
        where: { id: userTask.id },
        data: {
          progress: nextProgress,
          maxProgress,
          progressSource: triggerKey,
          lastProgressAt: new Date(),
        },
        include: { task: true },
      });
      updatedRows.push(updated);
    } else {
      updatedRows.push(userTask);
    }
  }

  return updatedRows;
}

function sortUserTasks(a: any, b: any) {
  const ao = Number(a.task?.sortOrder || 0);
  const bo = Number(b.task?.sortOrder || 0);
  return ao - bo || String(a.task?.title || "").localeCompare(String(b.task?.title || ""));
}

export async function ensureDefaultTasks() {
  for (const def of DEFAULT_TASKS) {
    try {
      await prisma.task.upsert({
        where: { title: def.title },
        create: { ...def, xnrtReward: new Prisma.Decimal(def.xnrtReward) },
        update: {
          description: def.description,
          category: def.category,
          missionType: def.missionType,
          triggerKey: def.triggerKey,
          targetCount: def.targetCount,
          sortOrder: def.sortOrder,
          xpReward: def.xpReward,
          xnrtReward: new Prisma.Decimal(def.xnrtReward),
          requirements: def.requirements,
          isActive: def.isActive,
        },
      });
    } catch (err) {
      console.error("[Tasks] Failed to upsert default task", def.title, err);
    }
  }
}

export async function ensureDefaultAchievements() {
  for (const def of DEFAULT_ACHIEVEMENTS) {
    try {
      const badgeTier = normalizeBadgeTier(def.badgeTier);
      await prisma.achievement.upsert({
        where: { title: def.title },
        create: {
          ...def,
          badgeTier,
          badgeColor: DEFAULT_BADGE_COLORS[badgeTier],
          isActive: true,
        },
        update: {
          description: def.description,
          icon: def.icon,
          category: def.category,
          requirement: def.requirement,
          xpReward: def.xpReward,
          badgeTier,
          badgeColor: DEFAULT_BADGE_COLORS[badgeTier],
          sortOrder: def.sortOrder,
          isActive: true,
        },
      });
    } catch (err) {
      console.error("[Achievements] Failed to upsert default achievement", def.title, err);
    }
  }
}

export function serializeTask(task: any) {
  if (!task) return null;
  return {
    ...task,
    missionType: normalizeMissionType(task.missionType),
    triggerKey: normalizeTriggerKey(task.triggerKey),
    targetCount: getTaskTargetCount(task),
    sortOrder: Number(task.sortOrder || 0),
    xnrtReward: task.xnrtReward?.toString?.() ?? String(task.xnrtReward ?? "0"),
  };
}

export function serializeAchievement(achievement: any) {
  if (!achievement) return null;
  const badgeTier = normalizeBadgeTier(achievement.badgeTier);
  return {
    ...achievement,
    badgeTier,
    badgeColor: achievement.badgeColor || DEFAULT_BADGE_COLORS[badgeTier],
    badgeTierRank: getBadgeTierRank(badgeTier),
    sortOrder: Number(achievement.sortOrder || 0),
    isActive: achievement.isActive !== false,
  };
}

function sortAchievementsForTrophyCase(a: any, b: any) {
  const aFeatured = Number(Boolean(a.isFeatured));
  const bFeatured = Number(Boolean(b.isFeatured));
  const aSlot = Number.isFinite(Number(a.featuredSlot)) ? Number(a.featuredSlot) : 999;
  const bSlot = Number.isFinite(Number(b.featuredSlot)) ? Number(b.featuredSlot) : 999;
  const aTier = getBadgeTierRank(a.badgeTier);
  const bTier = getBadgeTierRank(b.badgeTier);
  return bFeatured - aFeatured || aSlot - bSlot || bTier - aTier || Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
}

export function serializeUserTaskWithTask(userTask: any) {
  const maxProgress = Math.max(Number(userTask.maxProgress || 1), 1);
  const progress = Math.max(0, Math.min(Number(userTask.progress || 0), maxProgress));
  const claimed = Boolean(userTask.claimed ?? userTask.completed);
  const completed = Boolean(userTask.completed || claimed);
  return {
    ...userTask,
    progress,
    maxProgress,
    completed,
    claimed,
    claimable: !completed && progress >= maxProgress,
    progressPercent: Math.round((progress / maxProgress) * 100),
    task: serializeTask(userTask.task),
  };
}

export async function syncUserTasksForActiveTasks(userId: string) {
  const activeTasks = await prisma.task.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (activeTasks.length === 0) return [];

  for (const task of activeTasks as any[]) {
    const period = getMissionPeriod(task);
    const maxProgress = getTaskTargetCount(task);
    await db.userTask.upsert({
      where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey: period.key } },
      create: {
        userId,
        taskId: task.id,
        periodKey: period.key,
        progress: 0,
        maxProgress,
        completed: false,
        claimed: false,
        expiresAt: period.expiresAt || null,
      },
      update: {
        maxProgress,
        expiresAt: period.expiresAt || null,
      },
    });
  }

  const currentTaskPeriods = activeTasks.map((task) => ({ taskId: task.id, periodKey: getMissionPeriod(task).key }));
  const userTasks = await prisma.userTask.findMany({
    where: { userId, OR: currentTaskPeriods },
    include: { task: true },
    orderBy: { createdAt: "asc" },
  });

  const refreshed = await refreshAutomatedMissionProgress(userId, userTasks);
  return refreshed.sort(sortUserTasks);
}

export function parseTaskPayload(body: any) {
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category =
    String(body?.category ?? "special")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 40) || "special";

  if (!title || !description) {
    throw new Error("Title and description are required");
  }

  const xpReward = Number(body?.xpReward ?? 0);
  const xnrtReward = Number(body?.xnrtReward ?? 0);
  const targetCount = Number(body?.targetCount ?? 1);
  const sortOrder = Number(body?.sortOrder ?? 0);
  const missionType = normalizeMissionType(body?.missionType ?? (category === "daily" || category === "weekly" ? category : "one_time"));
  const triggerKey = normalizeTriggerKey(body?.triggerKey ?? "manual");

  if (!Number.isFinite(xpReward) || xpReward < 0) throw new Error("Invalid XP reward");
  if (!Number.isFinite(xnrtReward) || xnrtReward < 0) throw new Error("Invalid XNRT reward");
  if (!Number.isFinite(targetCount) || targetCount < 1 || targetCount > 1000) throw new Error("Invalid target count");
  if (!Number.isFinite(sortOrder)) throw new Error("Invalid sort order");

  const requirements = String(body?.requirements ?? "").trim();

  return {
    title,
    description,
    xpReward: Math.floor(xpReward),
    xnrtReward: new Prisma.Decimal(xnrtReward.toString()),
    category,
    missionType,
    triggerKey,
    targetCount: Math.floor(targetCount),
    sortOrder: Math.floor(sortOrder),
    requirements: requirements || null,
    isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
  };
}

export async function awardUserXp(userId: string, xpReward: number, source = "system", sourceId?: string | null) {
  return awardUserXpWithLedger({
    userId,
    amount: xpReward,
    reason: source,
    source,
    sourceId: sourceId || null,
  });
}

export function parseAchievementPayload(body: any) {
  const {
    title,
    description,
    icon = "🏆",
    category = "earnings",
    requirement,
    xpReward,
    badgeTier = "bronze",
    badgeColor,
    sortOrder = 0,
    isActive = true,
  } = body || {};

  if (!title || !description) throw new Error("Title and description are required");

  const requirementNum = Number(requirement);
  const xpRewardNum = Number(xpReward);
  const sortOrderNum = Number(sortOrder);

  if (!Number.isFinite(requirementNum) || requirementNum < 0) throw new Error("Invalid requirement");
  if (!Number.isFinite(xpRewardNum) || xpRewardNum < 0) throw new Error("Invalid XP reward");
  if (!Number.isFinite(sortOrderNum)) throw new Error("Invalid sort order");

  const normalizedCategory =
    String(category || "earnings")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_") || "earnings";
  const normalizedTier = normalizeBadgeTier(badgeTier);
  const normalizedColor = String(badgeColor || DEFAULT_BADGE_COLORS[normalizedTier] || "primary").trim().slice(0, 32);
  const normalizedActive = typeof isActive === "string" ? isActive !== "false" : Boolean(isActive);

  return {
    title: String(title).trim(),
    description: String(description).trim(),
    icon: String(icon || "🏆").slice(0, 8),
    category: normalizedCategory,
    requirement: Math.floor(requirementNum),
    xpReward: Math.floor(xpRewardNum),
    badgeTier: normalizedTier,
    badgeColor: normalizedColor,
    sortOrder: Math.floor(sortOrderNum),
    isActive: normalizedActive,
  };
}

async function getCurrentUserTaskForTask(userId: string, task: any) {
  const period = getMissionPeriod(task);
  const maxProgress = getTaskTargetCount(task);
  const userTask = await db.userTask.upsert({
    where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey: period.key } },
    create: {
      userId,
      taskId: task.id,
      periodKey: period.key,
      progress: 0,
      maxProgress,
      completed: false,
      claimed: false,
      expiresAt: period.expiresAt || null,
    },
    update: {
      maxProgress,
      expiresAt: period.expiresAt || null,
    },
    include: { task: true },
  });

  const refreshed = await refreshAutomatedMissionProgress(userId, [userTask]);
  return refreshed[0] || userTask;
}

export async function recordMissionEvent(userId: string, eventKey: string, amount = 1) {
  const triggerKey = normalizeTriggerKey(eventKey);
  const increment = Math.max(1, Math.floor(Number(amount || 1)));
  const tasks = await prisma.task.findMany({ where: { isActive: true, triggerKey } });
  if (tasks.length === 0) return [];

  const changed: any[] = [];
  for (const task of tasks as any[]) {
    const period = getMissionPeriod(task);
    const maxProgress = getTaskTargetCount(task);
    const existing = await db.userTask.upsert({
      where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey: period.key } },
      create: {
        userId,
        taskId: task.id,
        periodKey: period.key,
        progress: 0,
        maxProgress,
        completed: false,
        claimed: false,
        expiresAt: period.expiresAt || null,
      },
      update: { maxProgress, expiresAt: period.expiresAt || null },
    });

    if (existing.completed || existing.claimed) continue;

    const nextProgress = Math.min(maxProgress, Math.max(Number(existing.progress || 0), Number(existing.progress || 0) + increment));
    if (nextProgress !== existing.progress || existing.maxProgress !== maxProgress) {
      const updated = await prisma.userTask.update({
        where: { id: existing.id },
        data: {
          progress: nextProgress,
          maxProgress,
          progressSource: triggerKey,
          lastProgressAt: new Date(),
        },
        include: { task: true },
      });
      changed.push(updated);
    }
  }

  return changed.map(serializeUserTaskWithTask);
}

export async function recordManualTaskProgress(userId: string, taskId: string, amount = 1) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.isActive) {
    return { ok: false as const, status: 404, message: "Task not found" };
  }

  const userTask = await getCurrentUserTaskForTask(userId, task);
  if (userTask.completed || userTask.claimed) {
    return { ok: false as const, status: 400, message: "Task reward already claimed" };
  }

  const maxProgress = getTaskTargetCount(task);
  const increment = Math.max(1, Math.floor(Number(amount || 1)));
  const nextProgress = Math.min(maxProgress, Number(userTask.progress || 0) + increment);
  const updated = await prisma.userTask.update({
    where: { id: userTask.id },
    data: {
      progress: nextProgress,
      maxProgress,
      progressSource: normalizeTriggerKey(task.triggerKey),
      lastProgressAt: new Date(),
    },
    include: { task: true },
  });

  return { ok: true as const, userTask: serializeUserTaskWithTask(updated) };
}

export async function claimUserTaskReward(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.isActive) {
    return { ok: false as const, status: 404, message: "Task not found" };
  }

  const userTask = await getCurrentUserTaskForTask(userId, task);
  const maxProgress = Math.max(userTask.maxProgress || getTaskTargetCount(task), 1);
  const progress = Math.max(0, Number(userTask.progress || 0));

  if (userTask.completed || userTask.claimed) {
    return { ok: false as const, status: 400, message: "Task reward already claimed" };
  }

  if (progress < maxProgress) {
    return {
      ok: false as const,
      status: 400,
      message: `Task progress is incomplete (${progress}/${maxProgress})`,
    };
  }

  const now = new Date();
  const completedUserTask = await prisma.userTask.update({
    where: { id: userTask.id },
    data: {
      completed: true,
      completedAt: now,
      claimed: true,
      claimedAt: now,
      progress: maxProgress,
    },
    include: { task: true },
  });

  await awardUserXp(userId, task.xpReward, "task", `${task.id}:${userTask.periodKey}`);

  const requestedXnrtAmount = Number(task.xnrtReward);
  let awardedXnrtAmount = 0;
  let rewardCapped = false;
  if (Number.isFinite(requestedXnrtAmount) && requestedXnrtAmount > 0) {
    const capResult = await calculateAllowedXnrtReward({
      userId,
      requestedAmount: requestedXnrtAmount,
      source: "task",
      sourceId: `${task.id}:${userTask.periodKey}`,
      reason: `Mission claimed: ${task.title}`,
    });
    awardedXnrtAmount = capResult.awardedAmount;
    rewardCapped = capResult.capped;

    if (awardedXnrtAmount > 0) {
      const balance = await storage.getBalance(userId);
      if (balance) {
        await storage.updateBalance(userId, {
          xnrtBalance: (parseFloat(balance.xnrtBalance) + awardedXnrtAmount).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + awardedXnrtAmount).toString(),
        });
      }

      await storage.createTransaction({
        userId,
        type: "reward",
        amount: awardedXnrtAmount.toString(),
        source: "task",
        status: "approved",
        approvedAt: now,
        verified: true,
      });
    }
  }

  await storage.createActivity({
    userId,
    type: "mission_claimed",
    description: `Claimed mission: ${task.title} (+${task.xpReward} XP, +${awardedXnrtAmount} XNRT${rewardCapped ? " capped" : ""})`,
    metadata: JSON.stringify({ taskId: task.id, periodKey: userTask.periodKey, missionType: task.missionType }),
  });

  void notifyUser(userId, {
    type: "task_completed",
    title: "🎯 Mission Reward Claimed",
    message: `You earned ${task.xpReward} XP and ${awardedXnrtAmount} XNRT from ${task.title}${rewardCapped ? " (reward cap applied)" : ""}.`,
    url: "/tasks",
    metadata: {
      taskId: task.id,
      taskTitle: task.title,
      periodKey: userTask.periodKey,
      missionType: task.missionType,
      xpReward: task.xpReward,
      xnrtReward: awardedXnrtAmount.toString(),
      requestedXnrtReward: task.xnrtReward.toString(),
      rewardCapped,
    },
  }).catch((err: unknown) => {
    console.error("Error sending mission claim notification:", err);
  });

  await storage.checkAndUnlockAchievements(userId);

  return {
    ok: true as const,
    userTask: serializeUserTaskWithTask(completedUserTask),
    xpReward: task.xpReward,
    xnrtReward: awardedXnrtAmount.toString(),
    requestedXnrtReward: task.xnrtReward.toString(),
    rewardCapped,
  };
}

export async function completeUserTask(userId: string, taskId: string) {
  return claimUserTaskReward(userId, taskId);
}

export async function getUserAchievementsWithStatus(userId: string) {
  const allAchievements = await storage.getAllAchievements();
  const userAchievements = await storage.getUserAchievements(userId);

  return allAchievements.map((achievement: any) => {
    const ua = (userAchievements as any[]).find((x) => x.achievementId === achievement.id);
    const unlocked = !!ua;
    const claimed = !!ua?.claimed;
    const claimedAt = ua?.claimedAt ?? null;

    return {
      ...serializeAchievement(achievement),
      unlocked,
      unlockedAt: ua?.unlockedAt ?? ua?.createdAt ?? null,
      claimed,
      claimedAt,
      claimable: unlocked && !claimed,
      isFeatured: Boolean(ua?.isFeatured),
      featuredSlot: ua?.featuredSlot ?? null,
    };
  });
}

export async function getUserTrophyCase(userId: string, limit = 4) {
  const achievements = await getUserAchievementsWithStatus(userId);
  const unlocked = achievements.filter((achievement: any) => achievement.unlocked);
  const featured = unlocked.filter((achievement: any) => achievement.isFeatured).sort(sortAchievementsForTrophyCase);
  const fallback = unlocked.filter((achievement: any) => !achievement.isFeatured).sort(sortAchievementsForTrophyCase);
  return [...featured, ...fallback].slice(0, Math.max(1, Math.min(Number(limit || 4), 12)));
}

export async function setUserAchievementFeatured(userId: string, achievementId: string, input: { featured?: boolean; slot?: number | null }) {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement || achievement.isActive === false) return { ok: false as const, status: 404, message: "Achievement not found" };

  const userAchievement = await prisma.userAchievement.findFirst({ where: { userId, achievementId } });
  if (!userAchievement) return { ok: false as const, status: 400, message: "Achievement not unlocked yet" };

  const featured = input.featured === undefined ? !userAchievement.isFeatured : Boolean(input.featured);
  const rawSlot = input.slot === null || input.slot === undefined ? null : Number(input.slot);
  const featuredSlot = featured && Number.isFinite(rawSlot) ? Math.max(1, Math.min(Math.floor(rawSlot as number), 4)) : null;

  if (featured) {
    const featuredCount = await prisma.userAchievement.count({
      where: { userId, isFeatured: true, NOT: { id: userAchievement.id } },
    });
    if (featuredCount >= 4 && !userAchievement.isFeatured) {
      return { ok: false as const, status: 400, message: "Trophy case can show up to 4 featured badges" };
    }
    if (featuredSlot !== null) {
      await prisma.userAchievement.updateMany({
        where: { userId, featuredSlot, NOT: { id: userAchievement.id } },
        data: { featuredSlot: null },
      });
    }
  }

  const updated = await prisma.userAchievement.update({
    where: { id: userAchievement.id },
    data: { isFeatured: featured, featuredSlot },
    include: { achievement: true },
  });

  await storage.createActivity({
    userId,
    type: featured ? "badge_featured" : "badge_unfeatured",
    description: `${featured ? "Added" : "Removed"} badge ${achievement.title} ${featured ? "to" : "from"} trophy case`,
    metadata: JSON.stringify({ achievementId, featured, featuredSlot }),
  });

  return {
    ok: true as const,
    achievement: {
      ...serializeAchievement((updated as any).achievement),
      unlocked: true,
      unlockedAt: updated.unlockedAt,
      claimed: updated.claimed,
      claimedAt: updated.claimedAt,
      isFeatured: updated.isFeatured,
      featuredSlot: updated.featuredSlot,
    },
  };
}

export async function claimUserAchievement(userId: string, achievementId: string) {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return { ok: false as const, status: 404, message: "Achievement not found" };

  const userAchievement = await prisma.userAchievement.findFirst({ where: { userId, achievementId } });
  if (!userAchievement) {
    return { ok: false as const, status: 400, message: "Achievement not unlocked yet" };
  }
  if (userAchievement.claimed) {
    return { ok: false as const, status: 400, message: "Achievement already claimed" };
  }

  const updated = await prisma.userAchievement.update({
    where: { id: userAchievement.id },
    data: { claimed: true, claimedAt: new Date() },
  });

  await storage.createActivity({
    userId,
    type: "achievement_claimed",
    description: `Claimed achievement: ${achievement.title}`,
  });

  return {
    ok: true as const,
    achievementId,
    claimed: updated.claimed,
    claimedAt: updated.claimedAt,
  };
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number((value as any)?.toString?.() ?? value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function serializeDailyCheckin(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    checkinDate: row.checkinDate,
    streakDay: row.streakDay,
    xpReward: row.xpReward,
    xnrtReward: toNumber(row.xnrtReward),
    requestedXnrtReward: toNumber(row.requestedXnrtReward),
    rewardCapped: Boolean(row.rewardCapped),
    createdAt: row.createdAt,
  };
}

async function getLatestDailyCheckin(userId: string) {
  return db.dailyCheckin?.findFirst({
    where: { userId },
    orderBy: [{ checkinDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getDailyCheckinStatus(userId: string) {
  const now = new Date();
  const todayKey = getUtcDateKey(now);
  const yesterdayKey = getUtcDateKey(addUtcDays(startOfUtcDay(now), -1));
  const nextClaimAt = getNextUtcDayStart(now);

  const [user, config, todayCheckin, latestCheckin] = await Promise.all([
    storage.getUser(userId),
    getEngagementConfig(),
    db.dailyCheckin?.findUnique({ where: { userId_checkinDate: { userId, checkinDate: todayKey } } }),
    getLatestDailyCheckin(userId),
  ]);

  const lastCheckInKey = latestCheckin?.checkinDate || (user?.lastCheckIn ? getUtcDateKey(user.lastCheckIn) : null);
  const latestStreak = latestCheckin?.streakDay ?? user?.streak ?? 0;
  const checkedInToday = Boolean(todayCheckin) || isSameUtcDay(user?.lastCheckIn, now);
  const currentStreak = checkedInToday ? Math.max(latestStreak, user?.streak || 0) : user?.streak || latestStreak || 0;
  const nextStreak = checkedInToday
    ? currentStreak + 1
    : lastCheckInKey === yesterdayKey
      ? Math.max(currentStreak, latestStreak) + 1
      : 1;
  const nextReward = calculateDailyCheckinReward(nextStreak, config);
  const missedStreak = Boolean(lastCheckInKey && lastCheckInKey !== todayKey && lastCheckInKey !== yesterdayKey && currentStreak > 0);

  return {
    currentStreak,
    lastCheckIn: user?.lastCheckIn || latestCheckin?.createdAt || null,
    checkedInToday,
    todayKey,
    yesterdayKey,
    nextClaimAt,
    nextStreak,
    nextReward,
    missedStreak,
    todayCheckin: serializeDailyCheckin(todayCheckin),
  };
}

export async function performDailyCheckIn(userId: string) {
  const now = new Date();
  const todayKey = getUtcDateKey(now);
  const yesterdayKey = getUtcDateKey(addUtcDays(startOfUtcDay(now), -1));
  const user = await storage.getUser(userId);
  if (!user) return { ok: false as const, status: 404, message: "User not found" };

  const [config, existingToday, latestCheckin] = await Promise.all([
    getEngagementConfig(),
    db.dailyCheckin?.findUnique({ where: { userId_checkinDate: { userId, checkinDate: todayKey } } }),
    getLatestDailyCheckin(userId),
  ]);

  if (existingToday || isSameUtcDay(user.lastCheckIn, now)) {
    return {
      ok: false as const,
      status: 400,
      message: "Already checked in today",
      nextClaimAt: getNextUtcDayStart(now),
      todayCheckin: serializeDailyCheckin(existingToday),
    };
  }

  const previousKey = latestCheckin?.checkinDate || (user.lastCheckIn ? getUtcDateKey(user.lastCheckIn) : null);
  const previousStreak = latestCheckin?.streakDay ?? user.streak ?? 0;
  const newStreak = previousKey === yesterdayKey ? previousStreak + 1 : 1;
  const { xnrtReward: requestedStreakReward, xpReward } = calculateDailyCheckinReward(newStreak, config);

  let dailyCheckin;
  try {
    dailyCheckin = await db.dailyCheckin.create({
      data: {
        userId,
        checkinDate: todayKey,
        streakDay: newStreak,
        xpReward,
        xnrtReward: new Prisma.Decimal("0"),
        requestedXnrtReward: new Prisma.Decimal(requestedStreakReward.toString()),
        rewardCapped: false,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return {
        ok: false as const,
        status: 400,
        message: "Already checked in today",
        nextClaimAt: getNextUtcDayStart(now),
      };
    }
    throw error;
  }

  const capResult = await calculateAllowedXnrtReward({
    userId,
    requestedAmount: requestedStreakReward,
    source: "daily_checkin",
    sourceId: todayKey,
    reason: `Daily check-in day ${newStreak}`,
  });
  const streakReward = capResult.awardedAmount;

  const xpResult = await awardUserXpWithLedger({
    userId,
    amount: xpReward,
    reason: `Daily check-in day ${newStreak}`,
    source: "daily_checkin",
    sourceId: todayKey,
    metadata: { streak: newStreak, checkinDate: todayKey },
  });

  dailyCheckin = await db.dailyCheckin.update({
    where: { id: dailyCheckin.id },
    data: {
      xnrtReward: new Prisma.Decimal(streakReward.toString()),
      rewardCapped: capResult.capped,
    },
  });

  await storage.updateUser(userId, {
    lastCheckIn: now,
    streak: newStreak,
    level: xpResult?.levelAfter ?? calculateLevelFromXp((user.xp || 0) + xpReward, config),
  });

  const balance = await storage.getBalance(userId);
  if (balance && streakReward > 0) {
    await storage.updateBalance(userId, {
      xnrtBalance: (parseFloat(balance.xnrtBalance) + streakReward).toString(),
      totalEarned: (parseFloat(balance.totalEarned) + streakReward).toString(),
    });

    await storage.createTransaction({
      userId,
      type: "reward",
      amount: streakReward.toString(),
      source: "daily_checkin",
      status: "approved",
      approvedAt: now,
      verified: true,
    });
  }

  await storage.createActivity({
    userId,
    type: "daily_checkin",
    description: `Day ${newStreak} streak! Earned ${streakReward} XNRT and ${xpReward} XP${capResult.capped ? " (reward cap applied)" : ""}`,
    metadata: JSON.stringify({ checkinDate: todayKey, rewardCapped: capResult.capped }),
  });

  void notifyUser(userId, {
    type: "daily_checkin",
    title: "🔥 Daily Check-in Claimed",
    message: `Day ${newStreak} streak complete. You earned ${xpReward} XP and ${streakReward} XNRT${capResult.capped ? " after cap" : ""}.`,
    url: "/rewards",
    metadata: {
      checkinDate: todayKey,
      streak: newStreak,
      xpReward,
      xnrtReward: streakReward,
      requestedXnrtReward: requestedStreakReward,
      rewardCapped: capResult.capped,
    },
  }).catch((err: unknown) => {
    console.error("Error sending daily check-in notification:", err);
  });

  await storage.checkAndUnlockAchievements(userId);
  await recordMissionEvent(userId, "daily_checkin_claimed", 1);

  return {
    ok: true as const,
    streak: newStreak,
    xnrtReward: streakReward,
    requestedXnrtReward: requestedStreakReward,
    xpReward,
    rewardCapped: capResult.capped,
    checkinDate: todayKey,
    nextClaimAt: getNextUtcDayStart(now),
    todayCheckin: serializeDailyCheckin(dailyCheckin),
    message: `Day ${newStreak} check-in complete!`,
  };
}

export async function getCheckinHistory(userId: string, yearQuery: unknown, monthQuery: unknown) {
  const now = new Date();
  const requestedYear = yearQuery ? parseInt(String(yearQuery), 10) : now.getUTCFullYear();
  const targetYear = Number.isFinite(requestedYear) ? requestedYear : now.getUTCFullYear();

  let targetMonth: number;
  if (typeof monthQuery !== "undefined") {
    const monthNum = parseInt(String(monthQuery), 10);
    const clamped = Number.isFinite(monthNum) ? Math.min(Math.max(monthNum, 1), 12) : now.getUTCMonth() + 1;
    targetMonth = clamped - 1;
  } else {
    targetMonth = now.getUTCMonth();
  }

  const { startKey, endKey } = getUtcMonthDateKeyRange(targetYear, targetMonth);
  const checkins = await db.dailyCheckin.findMany({
    where: { userId, checkinDate: { gte: startKey, lt: endKey } },
    orderBy: { checkinDate: "asc" },
  });

  let entries = checkins.map(serializeDailyCheckin).filter(Boolean);

  if (entries.length === 0) {
    const startDate = new Date(Date.UTC(targetYear, targetMonth, 1));
    const endDate = new Date(Date.UTC(targetYear, targetMonth + 1, 1));
    const checkinActivities = await prisma.activity.findMany({
      where: { userId, type: "daily_checkin", createdAt: { gte: startDate, lt: endDate } },
      orderBy: { createdAt: "asc" },
    });

    entries = checkinActivities.map((activity: { id: string; createdAt: Date | null }) => ({
      id: activity.id,
      userId,
      checkinDate: getUtcDateKey(activity.createdAt),
      streakDay: 0,
      xpReward: 0,
      xnrtReward: 0,
      requestedXnrtReward: 0,
      rewardCapped: false,
      createdAt: activity.createdAt,
    }));
  }

  const dates = Array.from(new Set(entries.map((entry: any) => entry.checkinDate)));
  const monthTotalXp = entries.reduce((sum: number, entry: any) => sum + Number(entry.xpReward || 0), 0);
  const monthTotalXnrt = entries.reduce((sum: number, entry: any) => sum + Number(entry.xnrtReward || 0), 0);
  const status = await getDailyCheckinStatus(userId);

  return {
    dates,
    entries,
    year: targetYear,
    month: targetMonth,
    monthTotalXp,
    monthTotalXnrt,
    currentStreak: status.currentStreak,
    checkedInToday: status.checkedInToday,
    nextClaimAt: status.nextClaimAt,
    nextReward: status.nextReward,
  };
}

export function hasCheckedInToday(lastCheckIn?: Date | string | null) {
  return isSameUtcDay(lastCheckIn);
}
