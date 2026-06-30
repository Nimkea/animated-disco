import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "../lib/db";

type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";
type LeaderboardCategory =
  | "overall"
  | "mining"
  | "tasks"
  | "achievements"
  | "checkins"
  | "staking"
  | "referral_earnings";
type LeaderboardMetric = "xp" | "xnrt";

function generateAnonymizedHandle(userId: string): string {
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  return `Player-${hash.substring(0, 4).toUpperCase()}`;
}

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLeaderboardPeriod(period: string): LeaderboardPeriod {
  const allowed = new Set(["daily", "weekly", "monthly", "all-time"]);
  return allowed.has(period) ? (period as LeaderboardPeriod) : "all-time";
}

function normalizeLeaderboardCategory(category: string): LeaderboardCategory {
  const aliases: Record<string, LeaderboardCategory> = {
    overall: "overall",
    mining: "mining",
    task: "tasks",
    tasks: "tasks",
    achievement: "achievements",
    achievements: "achievements",
    checkin: "checkins",
    checkins: "checkins",
    "daily-checkin": "checkins",
    streaks: "checkins",
    staking: "staking",
    referrals: "referral_earnings",
    referral: "referral_earnings",
    referral_earnings: "referral_earnings",
  };
  return aliases[category] || "overall";
}

function getLeaderboardStartDate(period: LeaderboardPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "daily": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "weekly": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start;
    }
    case "monthly": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return start;
    }
    case "all-time":
    default:
      return null;
  }
}

function getLeaderboardCategoryMetric(category: LeaderboardCategory): LeaderboardMetric {
  if (category === "staking" || category === "referral_earnings") return "xnrt";
  return "xp";
}

function getLeaderboardCategoryMeta(category: LeaderboardCategory, period: LeaderboardPeriod) {
  const labels: Record<LeaderboardCategory, string> = {
    overall: period === "all-time" ? "Overall XP" : "Earned XP",
    mining: "Mining XP",
    tasks: "Task XP",
    achievements: "Achievement XP",
    checkins: "Check-in XP",
    staking: "Staking Rewards",
    referral_earnings: "Referral Earnings",
  };
  const unit = getLeaderboardCategoryMetric(category) === "xnrt" ? "XNRT" : "XP";
  return {
    period,
    category,
    label: labels[category],
    unit,
    window: period === "daily" ? "today" : period === "weekly" ? "last 7 days" : period === "monthly" ? "last 30 days" : "all time",
  };
}

function getActivityWhereForLeaderboardCategory(category: LeaderboardCategory): Prisma.ActivityWhereInput {
  switch (category) {
    case "mining":
      return { type: { contains: "mining" } };
    case "tasks":
      return { type: "task_completed" };
    case "achievements":
      return { type: "achievement_unlocked" };
    case "checkins":
      return { type: "daily_checkin" };
    case "staking":
      return { type: "staking_reward" };
    case "referral_earnings":
      return { OR: [{ type: "referral_commission" }, { type: "company_commission" }] };
    case "overall":
    default:
      return {
        OR: [
          { type: { contains: "mining" } },
          { type: "task_completed" },
          { type: "achievement_unlocked" },
          { type: "daily_checkin" },
        ],
      };
  }
}

function extractXpFromActivity(description: string, type: string, category: LeaderboardCategory): number {
  if (category === "staking" || category === "referral_earnings") return 0;

  const plusMatch = description.match(/\+\s*([\d.]+)\s*XP/i);
  if (plusMatch) return Number(plusMatch[1]) || 0;

  const earnedMatch = description.match(/(?:earned|and)\s+([\d.]+)\s*XP/i);
  if (earnedMatch) return Number(earnedMatch[1]) || 0;

  if (
    type.includes("mining") ||
    type === "task_completed" ||
    type === "achievement_unlocked" ||
    type === "daily_checkin"
  ) {
    const anyMatch = description.match(/([\d.]+)\s*XP/i);
    return anyMatch ? Number(anyMatch[1]) || 0 : 0;
  }

  return 0;
}

function extractXnrtFromActivity(description: string, type: string, category: LeaderboardCategory): number {
  if (category === "staking" && type !== "staking_reward") return 0;
  if (category === "referral_earnings" && type !== "referral_commission" && type !== "company_commission") return 0;

  const plusMatch = description.match(/\+\s*([\d,.]+)\s*XNRT/i);
  if (plusMatch) return Number(plusMatch[1].replace(/,/g, "")) || 0;

  const earnedMatch = description.match(/(?:earned|received)\s+([\d,.]+)\s*XNRT/i);
  if (earnedMatch) return Number(earnedMatch[1].replace(/,/g, "")) || 0;

  const anyMatch = description.match(/([\d,.]+)\s*XNRT/i);
  return anyMatch ? Number(anyMatch[1].replace(/,/g, "")) || 0 : 0;
}

export class LeaderboardRepository {
  async getXPLeaderboard(
    currentUserId: string,
    period: string,
    category: string,
    isAdmin = false,
    limit = 50
  ): Promise<{ leaderboard: any[]; userPosition: any | null; meta: any }> {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const normalizedPeriod = normalizeLeaderboardPeriod(period);
    const normalizedCategory = normalizeLeaderboardCategory(category);
    const startDate = getLeaderboardStartDate(normalizedPeriod);
    const metric = getLeaderboardCategoryMetric(normalizedCategory);
    const meta = getLeaderboardCategoryMeta(normalizedCategory, normalizedPeriod);

    const formatEntry = (item: any) => {
      const baseData = {
        xp: toNumber(item.xp),
        categoryXp: toNumber(item.categoryXp ?? item.categoryScore ?? item.xp),
        categoryScore: toNumber(item.categoryScore ?? item.categoryXp ?? item.xp),
        rank: toNumber(item.rank),
        unit: meta.unit,
        category: normalizedCategory,
        currentUser: item.userId === currentUserId,
      };

      if (isAdmin) {
        return {
          ...baseData,
          userId: item.userId,
          username: item.username,
          email: item.email,
          displayName: item.username || item.email || "Unknown user",
        };
      }

      return { ...baseData, displayName: generateAnonymizedHandle(item.userId) };
    };

    const formatUserPosition = (item: any) => {
      const baseData = {
        xp: toNumber(item.xp),
        categoryXp: toNumber(item.categoryXp ?? item.categoryScore ?? item.xp),
        categoryScore: toNumber(item.categoryScore ?? item.categoryXp ?? item.xp),
        rank: toNumber(item.rank),
        unit: meta.unit,
        category: normalizedCategory,
        currentUser: true,
      };

      if (isAdmin) {
        return {
          ...baseData,
          userId: item.userId,
          username: item.username,
          email: item.email,
          displayName: item.username || item.email || "You",
        };
      }

      return { ...baseData, displayName: "You" };
    };

    if (normalizedCategory === "overall" && normalizedPeriod === "all-time") {
      const leaderboardRows: any[] = await prisma.$queryRawUnsafe(
        `
          WITH ranked AS (
            SELECT
              id AS "userId",
              username,
              email,
              xp,
              xp AS "categoryScore",
              xp AS "categoryXp",
              ROW_NUMBER() OVER (ORDER BY xp DESC, "createdAt" ASC, id ASC)::int AS rank
            FROM "User"
            WHERE xp > 0
          )
          SELECT * FROM ranked
          ORDER BY rank ASC
          LIMIT $1
        `,
        safeLimit
      );

      const currentUserRows: any[] = await prisma.$queryRawUnsafe(
        `
          WITH ranked AS (
            SELECT
              id AS "userId",
              username,
              email,
              xp,
              xp AS "categoryScore",
              xp AS "categoryXp",
              ROW_NUMBER() OVER (ORDER BY xp DESC, "createdAt" ASC, id ASC)::int AS rank
            FROM "User"
            WHERE xp > 0
          )
          SELECT * FROM ranked
          WHERE "userId" = $1
          LIMIT 1
        `,
        currentUserId
      );

      const leaderboard = leaderboardRows.map(formatEntry);
      const currentRankInVisibleRows = leaderboard.some((entry) => entry.currentUser);
      const userPosition =
        !currentRankInVisibleRows && currentUserRows.length > 0
          ? formatUserPosition(currentUserRows[0])
          : currentUserRows.length > 0
          ? formatUserPosition(currentUserRows[0])
          : null;

      return { leaderboard, userPosition, meta };
    }

    const activityWhere: Prisma.ActivityWhereInput = {
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
      ...getActivityWhereForLeaderboardCategory(normalizedCategory),
    };

    const activities = await prisma.activity.findMany({
      where: activityWhere,
      select: {
        userId: true,
        type: true,
        description: true,
        user: { select: { id: true, username: true, email: true, xp: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const statsByUser = new Map<
      string,
      { userId: string; username: string | null; email: string | null; xp: number; categoryScore: number; categoryXp: number }
    >();

    for (const activity of activities) {
      const score =
        metric === "xnrt"
          ? extractXnrtFromActivity(activity.description, activity.type, normalizedCategory)
          : extractXpFromActivity(activity.description, activity.type, normalizedCategory);

      if (!Number.isFinite(score) || score <= 0) continue;

      const existing = statsByUser.get(activity.userId) ?? {
        userId: activity.userId,
        username: activity.user.username,
        email: activity.user.email,
        xp: activity.user.xp || 0,
        categoryScore: 0,
        categoryXp: 0,
      };

      existing.categoryScore += score;
      if (metric === "xp") existing.categoryXp += score;
      statsByUser.set(activity.userId, existing);
    }

    const ranked = Array.from(statsByUser.values())
      .filter((entry) => entry.categoryScore > 0)
      .sort((a, b) => {
        if (b.categoryScore !== a.categoryScore) return b.categoryScore - a.categoryScore;
        if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
        return a.userId.localeCompare(b.userId);
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    const leaderboard = ranked.slice(0, safeLimit).map(formatEntry);
    const currentUserRank = ranked.find((entry) => entry.userId === currentUserId);
    const userPosition = currentUserRank ? formatUserPosition(currentUserRank) : null;

    return { leaderboard, userPosition, meta };
  }
}

export const leaderboardRepository = new LeaderboardRepository();
