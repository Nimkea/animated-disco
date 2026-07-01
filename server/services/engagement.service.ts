import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";

const db = prisma as any;

export const DEFAULT_LEVEL_LABELS = [
  { minLevel: 1, label: "New Member" },
  { minLevel: 5, label: "Active Miner" },
  { minLevel: 10, label: "Bronze Builder" },
  { minLevel: 20, label: "Silver Contributor" },
  { minLevel: 30, label: "Gold Leader" },
  { minLevel: 50, label: "Diamond Member" },
];

const DEFAULT_ENGAGEMENT_CONFIG = {
  id: "default",
  enabled: true,
  levelXpStep: 1000,
  dailyTotalXnrtCap: new Prisma.Decimal("200"),
  weeklyTotalXnrtCap: new Prisma.Decimal("1000"),
  dailyTaskXnrtCap: new Prisma.Decimal("100"),
  weeklyTaskXnrtCap: new Prisma.Decimal("500"),
  dailyCheckinBaseXnrt: new Prisma.Decimal("5"),
  dailyCheckinStreakBonusXnrt: new Prisma.Decimal("2"),
  dailyCheckinMaxXnrt: new Prisma.Decimal("25"),
  dailyCheckinBaseXp: 10,
  dailyCheckinStreakBonusXp: 5,
  dailyCheckinMaxXp: 50,
  taskCompletionXpDailyCap: 500,
  publicLevelLabels: DEFAULT_LEVEL_LABELS,
};

export type EngagementConfigInput = Partial<{
  enabled: boolean;
  levelXpStep: number;
  dailyTotalXnrtCap: number;
  weeklyTotalXnrtCap: number;
  dailyTaskXnrtCap: number;
  weeklyTaskXnrtCap: number;
  dailyCheckinBaseXnrt: number;
  dailyCheckinStreakBonusXnrt: number;
  dailyCheckinMaxXnrt: number;
  dailyCheckinBaseXp: number;
  dailyCheckinStreakBonusXp: number;
  dailyCheckinMaxXp: number;
  taskCompletionXpDailyCap: number;
}>;

type WindowRange = { start: Date; end: Date };

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number((value as any)?.toString?.() ?? value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = toNumber(value, fallback);
  return Math.min(Math.max(parsed, min), max);
}

function toDecimal(value: unknown, fallback: string) {
  const num = clampNumber(value, 0, 1_000_000_000, Number(fallback));
  return new Prisma.Decimal(num.toString());
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date = new Date()) {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - weekday + 1);
  return day;
}

function dailyWindow(now = new Date()): WindowRange {
  const start = startOfUtcDay(now);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function weeklyWindow(now = new Date()): WindowRange {
  const start = startOfUtcWeek(now);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function normalizeConfig(config: any) {
  return {
    ...DEFAULT_ENGAGEMENT_CONFIG,
    ...(config || {}),
    dailyTotalXnrtCap: config?.dailyTotalXnrtCap ?? DEFAULT_ENGAGEMENT_CONFIG.dailyTotalXnrtCap,
    weeklyTotalXnrtCap: config?.weeklyTotalXnrtCap ?? DEFAULT_ENGAGEMENT_CONFIG.weeklyTotalXnrtCap,
    dailyTaskXnrtCap: config?.dailyTaskXnrtCap ?? DEFAULT_ENGAGEMENT_CONFIG.dailyTaskXnrtCap,
    weeklyTaskXnrtCap: config?.weeklyTaskXnrtCap ?? DEFAULT_ENGAGEMENT_CONFIG.weeklyTaskXnrtCap,
    dailyCheckinBaseXnrt: config?.dailyCheckinBaseXnrt ?? DEFAULT_ENGAGEMENT_CONFIG.dailyCheckinBaseXnrt,
    dailyCheckinStreakBonusXnrt:
      config?.dailyCheckinStreakBonusXnrt ?? DEFAULT_ENGAGEMENT_CONFIG.dailyCheckinStreakBonusXnrt,
    dailyCheckinMaxXnrt: config?.dailyCheckinMaxXnrt ?? DEFAULT_ENGAGEMENT_CONFIG.dailyCheckinMaxXnrt,
    publicLevelLabels: config?.publicLevelLabels ?? DEFAULT_LEVEL_LABELS,
  };
}

export function serializeEngagementConfig(config: any) {
  const normalized = normalizeConfig(config);
  return {
    id: normalized.id,
    enabled: Boolean(normalized.enabled),
    levelXpStep: Number(normalized.levelXpStep || 1000),
    dailyTotalXnrtCap: toNumber(normalized.dailyTotalXnrtCap),
    weeklyTotalXnrtCap: toNumber(normalized.weeklyTotalXnrtCap),
    dailyTaskXnrtCap: toNumber(normalized.dailyTaskXnrtCap),
    weeklyTaskXnrtCap: toNumber(normalized.weeklyTaskXnrtCap),
    dailyCheckinBaseXnrt: toNumber(normalized.dailyCheckinBaseXnrt),
    dailyCheckinStreakBonusXnrt: toNumber(normalized.dailyCheckinStreakBonusXnrt),
    dailyCheckinMaxXnrt: toNumber(normalized.dailyCheckinMaxXnrt),
    dailyCheckinBaseXp: Number(normalized.dailyCheckinBaseXp || 10),
    dailyCheckinStreakBonusXp: Number(normalized.dailyCheckinStreakBonusXp || 5),
    dailyCheckinMaxXp: Number(normalized.dailyCheckinMaxXp || 50),
    taskCompletionXpDailyCap: Number(normalized.taskCompletionXpDailyCap || 500),
    publicLevelLabels: normalized.publicLevelLabels || DEFAULT_LEVEL_LABELS,
    updatedBy: normalized.updatedBy || null,
    createdAt: normalized.createdAt || null,
    updatedAt: normalized.updatedAt || null,
  };
}

export async function ensureEngagementConfig() {
  try {
    return await db.engagementConfig.upsert({
      where: { id: "default" },
      create: DEFAULT_ENGAGEMENT_CONFIG,
      update: {},
    });
  } catch (error) {
    console.error("[Engagement] Failed to ensure default config", error);
    throw error;
  }
}

export async function getEngagementConfig() {
  const existing = await db.engagementConfig.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return ensureEngagementConfig();
}

export function parseEngagementConfigPayload(body: EngagementConfigInput) {
  const data: Record<string, unknown> = {};
  if (typeof body.enabled !== "undefined") data.enabled = Boolean(body.enabled);
  if (typeof body.levelXpStep !== "undefined") data.levelXpStep = Math.floor(clampNumber(body.levelXpStep, 100, 100_000, 1000));
  if (typeof body.dailyTotalXnrtCap !== "undefined") data.dailyTotalXnrtCap = toDecimal(body.dailyTotalXnrtCap, "200");
  if (typeof body.weeklyTotalXnrtCap !== "undefined") data.weeklyTotalXnrtCap = toDecimal(body.weeklyTotalXnrtCap, "1000");
  if (typeof body.dailyTaskXnrtCap !== "undefined") data.dailyTaskXnrtCap = toDecimal(body.dailyTaskXnrtCap, "100");
  if (typeof body.weeklyTaskXnrtCap !== "undefined") data.weeklyTaskXnrtCap = toDecimal(body.weeklyTaskXnrtCap, "500");
  if (typeof body.dailyCheckinBaseXnrt !== "undefined") data.dailyCheckinBaseXnrt = toDecimal(body.dailyCheckinBaseXnrt, "5");
  if (typeof body.dailyCheckinStreakBonusXnrt !== "undefined") data.dailyCheckinStreakBonusXnrt = toDecimal(body.dailyCheckinStreakBonusXnrt, "2");
  if (typeof body.dailyCheckinMaxXnrt !== "undefined") data.dailyCheckinMaxXnrt = toDecimal(body.dailyCheckinMaxXnrt, "25");
  if (typeof body.dailyCheckinBaseXp !== "undefined") data.dailyCheckinBaseXp = Math.floor(clampNumber(body.dailyCheckinBaseXp, 0, 10_000, 10));
  if (typeof body.dailyCheckinStreakBonusXp !== "undefined") data.dailyCheckinStreakBonusXp = Math.floor(clampNumber(body.dailyCheckinStreakBonusXp, 0, 10_000, 5));
  if (typeof body.dailyCheckinMaxXp !== "undefined") data.dailyCheckinMaxXp = Math.floor(clampNumber(body.dailyCheckinMaxXp, 0, 100_000, 50));
  if (typeof body.taskCompletionXpDailyCap !== "undefined") data.taskCompletionXpDailyCap = Math.floor(clampNumber(body.taskCompletionXpDailyCap, 0, 100_000, 500));
  return data;
}

export async function updateEngagementConfig(input: EngagementConfigInput, adminUserId?: string | null) {
  const data = parseEngagementConfigPayload(input);
  return db.engagementConfig.upsert({
    where: { id: "default" },
    create: { ...DEFAULT_ENGAGEMENT_CONFIG, ...data, updatedBy: adminUserId || null },
    update: { ...data, updatedBy: adminUserId || null },
  });
}

export function calculateLevelFromXp(totalXp: number, config?: any) {
  const step = Math.max(100, Number(config?.levelXpStep || 1000));
  return Math.floor(Math.max(0, totalXp) / step) + 1;
}

export function getLevelProgress(totalXp: number, config?: any) {
  const step = Math.max(100, Number(config?.levelXpStep || 1000));
  const safeXp = Math.max(0, Number(totalXp || 0));
  const level = calculateLevelFromXp(safeXp, config);
  const currentLevelXp = (level - 1) * step;
  const nextLevelXp = level * step;
  const xpIntoLevel = Math.max(0, safeXp - currentLevelXp);
  const xpRequiredForLevel = step;
  const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpRequiredForLevel) * 100));
  const labels = Array.isArray(config?.publicLevelLabels) ? config.publicLevelLabels : DEFAULT_LEVEL_LABELS;
  const currentLabel = [...labels]
    .sort((a: any, b: any) => Number(b.minLevel || 0) - Number(a.minLevel || 0))
    .find((entry: any) => level >= Number(entry.minLevel || 1))?.label || "Member";

  return {
    total: safeXp,
    level,
    label: currentLabel,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpRequiredForLevel,
    progressPercent,
  };
}

export async function awardUserXpWithLedger({
  userId,
  amount,
  reason,
  source,
  sourceId,
  metadata,
}: {
  userId: string;
  amount: number;
  reason: string;
  source: string;
  sourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const xpAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (xpAmount <= 0) return null;

  const [user, config] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } }),
    getEngagementConfig(),
  ]);
  if (!user) return null;

  const totalXpBefore = user.xp || 0;
  const levelBefore = user.level || calculateLevelFromXp(totalXpBefore, config);
  const totalXpAfter = totalXpBefore + xpAmount;
  const levelAfter = calculateLevelFromXp(totalXpAfter, config);

  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { xp: totalXpAfter, level: levelAfter } }),
    db.xpLedger.create({
      data: {
        userId,
        amount: xpAmount,
        reason,
        source,
        sourceId: sourceId || null,
        totalXpBefore,
        totalXpAfter,
        levelBefore,
        levelAfter,
        metadata: metadata || undefined,
      },
    }),
  ]);

  return { user: updated, amount: xpAmount, totalXpBefore, totalXpAfter, levelBefore, levelAfter };
}

async function sumRewardAmount(userId: string, source: string | null, window: WindowRange) {
  const result = await db.rewardCapLedger.aggregate({
    where: {
      userId,
      ...(source ? { source } : {}),
      createdAt: { gte: window.start, lt: window.end },
    },
    _sum: { amount: true },
  });
  return toNumber(result?._sum?.amount);
}

export async function getRewardCapUsage(userId: string) {
  const config = serializeEngagementConfig(await getEngagementConfig());
  const day = dailyWindow();
  const week = weeklyWindow();

  const [dailyTotal, weeklyTotal, dailyTask, weeklyTask] = await Promise.all([
    sumRewardAmount(userId, null, day),
    sumRewardAmount(userId, null, week),
    sumRewardAmount(userId, "task", day),
    sumRewardAmount(userId, "task", week),
  ]);

  return {
    daily: {
      total: dailyTotal,
      task: dailyTask,
      totalCap: config.dailyTotalXnrtCap,
      taskCap: config.dailyTaskXnrtCap,
      remainingTotal: Math.max(0, config.dailyTotalXnrtCap - dailyTotal),
      remainingTask: Math.max(0, config.dailyTaskXnrtCap - dailyTask),
      windowStart: day.start,
      windowEnd: day.end,
    },
    weekly: {
      total: weeklyTotal,
      task: weeklyTask,
      totalCap: config.weeklyTotalXnrtCap,
      taskCap: config.weeklyTaskXnrtCap,
      remainingTotal: Math.max(0, config.weeklyTotalXnrtCap - weeklyTotal),
      remainingTask: Math.max(0, config.weeklyTaskXnrtCap - weeklyTask),
      windowStart: week.start,
      windowEnd: week.end,
    },
  };
}

export async function calculateAllowedXnrtReward({
  userId,
  requestedAmount,
  source,
  sourceId,
  reason,
}: {
  userId: string;
  requestedAmount: number;
  source: string;
  sourceId?: string | null;
  reason?: string;
}) {
  const requested = Math.max(0, Number(requestedAmount || 0));
  if (requested <= 0) {
    return { requestedAmount: requested, awardedAmount: 0, capped: false, usage: await getRewardCapUsage(userId) };
  }

  const usage = await getRewardCapUsage(userId);
  const remaining = [usage.daily.remainingTotal, usage.weekly.remainingTotal];
  if (source === "task") {
    remaining.push(usage.daily.remainingTask, usage.weekly.remainingTask);
  }
  const maxAllowed = Math.max(0, Math.min(...remaining));
  const awardedAmount = Math.min(requested, maxAllowed);
  const capped = awardedAmount < requested;

  if (awardedAmount > 0) {
    await db.rewardCapLedger.create({
      data: {
        userId,
        source,
        sourceId: sourceId || null,
        amount: new Prisma.Decimal(awardedAmount.toString()),
        reason: reason || null,
      },
    });
  }

  return { requestedAmount: requested, awardedAmount, capped, usage };
}

export function calculateDailyCheckinReward(streak: number, config: any) {
  const normalized = serializeEngagementConfig(config);
  const safeStreak = Math.max(1, Math.floor(Number(streak || 1)));
  const xnrtReward = Math.min(
    normalized.dailyCheckinMaxXnrt,
    normalized.dailyCheckinBaseXnrt + (safeStreak - 1) * normalized.dailyCheckinStreakBonusXnrt
  );
  const xpReward = Math.min(
    normalized.dailyCheckinMaxXp,
    normalized.dailyCheckinBaseXp + (safeStreak - 1) * normalized.dailyCheckinStreakBonusXp
  );

  return { xnrtReward, xpReward };
}

export async function getEngagementSummary(userId: string) {
  const [config, user, usage, recentXp] = await Promise.all([
    getEngagementConfig(),
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true, streak: true, lastCheckIn: true } }),
    getRewardCapUsage(userId),
    db.xpLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const serializedConfig = serializeEngagementConfig(config);
  const xp = getLevelProgress(user?.xp || 0, serializedConfig);
  return {
    config: serializedConfig,
    xp,
    streak: user?.streak || 0,
    lastCheckIn: user?.lastCheckIn || null,
    caps: usage,
    recentXp: recentXp.map((entry: any) => ({
      ...entry,
      createdAt: entry.createdAt,
    })),
  };
}

export async function getAdminEngagementSummary() {
  const now = new Date();
  const day = dailyWindow(now);
  const week = weeklyWindow(now);
  const todayKey = day.start.toISOString().slice(0, 10);
  const [config, activeTasks, completedTasksToday, dailyCheckinsToday, xpToday, xnrtToday, totalXpRows, recentXp] = await Promise.all([
    getEngagementConfig(),
    prisma.task.count({ where: { isActive: true } }),
    prisma.userTask.count({ where: { completed: true, completedAt: { gte: day.start, lt: day.end } } }),
    db.dailyCheckin.count({ where: { checkinDate: todayKey } }),
    db.xpLedger.aggregate({ where: { createdAt: { gte: day.start, lt: day.end } }, _sum: { amount: true }, _count: { _all: true } }),
    db.rewardCapLedger.aggregate({ where: { createdAt: { gte: day.start, lt: day.end } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["level"], _count: { _all: true }, orderBy: { level: "asc" } }),
    db.xpLedger.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { username: true, email: true } } } }),
  ]);

  return {
    config: serializeEngagementConfig(config),
    windows: { day, week },
    metrics: {
      activeTasks,
      completedTasksToday,
      dailyCheckinsToday,
      xpAwardedToday: Number(xpToday?._sum?.amount || 0),
      xpEventsToday: Number(xpToday?._count?._all || 0),
      xnrtRewardsToday: toNumber(xnrtToday?._sum?.amount),
      xnrtRewardEventsToday: Number(xnrtToday?._count?._all || 0),
    },
    levelDistribution: (totalXpRows as any[]).map((row) => ({ level: row.level, users: row._count?._all || 0 })),
    recentXp: (recentXp as any[]).map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      username: entry.user?.username || entry.user?.email || "User",
      amount: entry.amount,
      source: entry.source,
      reason: entry.reason,
      levelBefore: entry.levelBefore,
      levelAfter: entry.levelAfter,
      createdAt: entry.createdAt,
    })),
  };
}
