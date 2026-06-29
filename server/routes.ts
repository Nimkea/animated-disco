// file: server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  storage,
  generateAnonymizedHandle,
  MINING_SESSION_DURATION_MS,
  MINING_SESSION_XNRT_REWARD,
  MINING_SESSION_XP_REWARD,
} from "./storage";
import { requireAuth, requireAdmin, validateCSRF } from "./auth/middleware";
import authRoutes from "./auth/routes";

// Shared schema/types
import {
  STAKING_TIERS,
  type StakingTier,
  insertAnnouncementSchema,
} from "../shared/schema";
import { PrismaClient, Prisma } from "@prisma/client";
import { notifyUser, sendPushNotification } from "./notifications";
import webpush from "web-push";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { verifyBscUsdtDeposit } from "./services/verifyBscUsdt";
import { ethers } from "ethers";
import { deriveDepositAddress } from "./services/hdWallet";
import { mintXNRT, isTokenServiceReady, getTxExplorerUrl } from "./services/tokenService";

export const prisma = new PrismaClient();

/* ─────────────────────── Trust Loan configuration ──────────────────────── */
const TRUST_LOAN_CONFIG = {
  programKey: "trust_loan",
  durationDays: 30,
  amountXnrt: 10000,
  requiredReferrals: 3,
  requiredInvestingReferrals: 2,
  minInvestUsdtPerReferral: 100,
} as const;

/* ----------------------------- Trust Loan helper ---------------------------- */
async function getDirectReferralStats(userId: string) {
  // Count L1 referrals
  const directs = await prisma.referral.findMany({
    where: { referrerId: userId, level: 1 },
    select: { referredUserId: true },
  });
  const directCount = directs.length;
  if (!directCount) return { directCount: 0, investingCount: 0 };

  // Of those L1 referrals, count how many have >= min USDT approved deposits
  const ids = directs.map((d) => d.referredUserId);
  const investingRows = await prisma.transaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: ids },
      type: "deposit",
      status: "approved",
      usdtAmount: {
        gte: new Prisma.Decimal(TRUST_LOAN_CONFIG.minInvestUsdtPerReferral),
      },
    },
    _count: { _all: true },
  });
  const investingCount = investingRows.length;

  return { directCount, investingCount };
}
/* --------------------------- end Trust Loan helper -------------------------- */

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || "")
  .replace(/^"publicKey":"/, "")
  .replace(/"$/, "");
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || "")
  .replace(/^"privateKey":"/, "")
  .replace(/}$/, "")
  .replace(/"$/, "");
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@xnrt.org";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const pushSubscriptionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many subscription requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

function normalizeLeaderboardPeriodParam(period: unknown) {
  const value = typeof period === "string" ? period : "all-time";
  return ["daily", "weekly", "monthly", "all-time"].includes(value)
    ? value
    : "all-time";
}

function getLeaderboardDateFilter(period: string): Date | null {
  const now = new Date();

  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "weekly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return start;
  }

  if (period === "monthly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return start;
  }

  return null;
}

function clampLeaderboardLimit(value: unknown, fallback = 50) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}

function toLeaderboardNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

const profileUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be 20 characters or less")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only use letters, numbers, and underscores")
    .optional(),
  firstName: z.string().trim().max(50, "First name is too long").optional().nullable(),
  lastName: z.string().trim().max(50, "Last name is too long").optional().nullable(),
  profileImageUrl: z
    .string()
    .trim()
    .max(500, "Profile image URL is too long")
    .optional()
    .nullable()
    .refine(
      (value) =>
        !value ||
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("/"),
      "Profile image must be a valid URL or app-relative path"
    ),
});

function decimalValueToNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSameLocalDay(a: Date | string | null | undefined, b: Date = new Date()) {
  if (!a) return false;
  const date = new Date(a);
  return (
    date.getFullYear() === b.getFullYear() &&
    date.getMonth() === b.getMonth() &&
    date.getDate() === b.getDate()
  );
}

const BSC_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function normalizeBscAddress(address: unknown): string | null {
  const value = String(address || "").trim();
  return BSC_ADDRESS_RE.test(value) ? value.toLowerCase() : null;
}

function getWalletRates() {
  const xnrtPerUsdt = Number(process.env.XNRT_RATE_USDT || "100");
  const withdrawalFeePercent = Number(process.env.WITHDRAWAL_FEE_PERCENT || "2");
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || "0");
  const confirmations = Number(process.env.BSC_CONFIRMATIONS || "12");

  return {
    xnrtPerUsdt: Number.isFinite(xnrtPerUsdt) && xnrtPerUsdt > 0 ? xnrtPerUsdt : 100,
    usdtPerXnrt: Number.isFinite(xnrtPerUsdt) && xnrtPerUsdt > 0 ? 1 / xnrtPerUsdt : 0.01,
    withdrawalFeePercent:
      Number.isFinite(withdrawalFeePercent) && withdrawalFeePercent >= 0
        ? withdrawalFeePercent
        : 2,
    platformFeeBps: Number.isFinite(platformFeeBps) && platformFeeBps >= 0 ? platformFeeBps : 0,
    confirmations: Number.isFinite(confirmations) && confirmations > 0 ? confirmations : 12,
    network: "BSC (BEP-20)",
    depositToken: "USDT",
    withdrawalToken: "XNRT",
    withdrawalMode: "xnrt_token",
    minReferralWithdrawal: 5000,
    minMiningWithdrawal: 5000,
  };
}

function getBalanceSourceKey(source: string | null | undefined) {
  switch (source) {
    case "staking":
      return "stakingBalance" as const;
    case "mining":
      return "miningBalance" as const;
    case "referral":
      return "referralBalance" as const;
    case "main":
    default:
      return "xnrtBalance" as const;
  }
}

async function getOrCreateUserDepositAddress(userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { depositAddress: true, derivationIndex: true },
  });

  if (user?.depositAddress && user.derivationIndex !== null) {
    return user.depositAddress;
  }

  // Best-effort allocator within the current schema. The unique derivationIndex
  // constraint protects against duplicates if two requests race.
  for (let attempt = 0; attempt < 5; attempt++) {
    const maxIndexUser = await prisma.user.findFirst({
      where: { derivationIndex: { not: null } },
      orderBy: { derivationIndex: "desc" },
      select: { derivationIndex: true },
    });

    const nextIndex = (maxIndexUser?.derivationIndex ?? -1) + 1 + attempt;
    const address = deriveDepositAddress(nextIndex);

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { depositAddress: address, derivationIndex: nextIndex },
      });
      return address;
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
  }

  user = await prisma.user.findUnique({
    where: { id: userId },
    select: { depositAddress: true, derivationIndex: true },
  });
  if (user?.depositAddress) return user.depositAddress;
  throw new Error("Failed to allocate deposit address");
}

/* ------------------------ Default Achievements Seed ------------------------ */

const DEFAULT_ACHIEVEMENTS = [
  // 🟢 Earnings
  {
    title: "Sign-in Bonus",
    description: "Claim your first daily check-in reward",
    icon: "✅",
    category: "streaks",
    requirement: 1, // 1 din ka streak
    xpReward: 5,
  },
  {
    title: "First Earnings",
    description: "Earn a total of 1,000 XNRT from any source",
    icon: "💰",
    category: "earnings",
    requirement: 1000,
    xpReward: 25,
  },
  {
    title: "Rising Earner",
    description: "Earn a total of 5,000 XNRT",
    icon: "📈",
    category: "earnings",
    requirement: 5000,
    xpReward: 75,
  },
  {
    title: "Pro Earner",
    description: "Earn a total of 25,000 XNRT",
    icon: "🏅",
    category: "earnings",
    requirement: 25000,
    xpReward: 150,
  },

  // 🧑‍🤝‍🧑 Referrals
  {
    title: "First Referral",
    description: "Invite your first friend to XNRT",
    icon: "👥",
    category: "referrals",
    requirement: 1,
    xpReward: 25,
  },
  {
    title: "Team Builder",
    description: "Refer 5 direct users",
    icon: "🧱",
    category: "referrals",
    requirement: 5,
    xpReward: 75,
  },
  {
    title: "Community Leader",
    description: "Refer 25 direct users",
    icon: "👑",
    category: "referrals",
    requirement: 25,
    xpReward: 200,
  },

  // 🔥 Streaks
  {
    title: "3-Day Streak",
    description: "Check in 3 days in a row",
    icon: "🔥",
    category: "streaks",
    requirement: 3,
    xpReward: 30,
  },
  {
    title: "Weekly Grinder",
    description: "Maintain a 7-day login streak",
    icon: "📆",
    category: "streaks",
    requirement: 7,
    xpReward: 70,
  },
  {
    title: "Monthly Legend",
    description: "Maintain a 30-day login streak",
    icon: "🏆",
    category: "streaks",
    requirement: 30,
    xpReward: 200,
  },

  // ⛏ Mining
  {
    title: "First Mining Session",
    description: "Complete your first mining session",
    icon: "⛏️",
    category: "mining",
    requirement: 1,
    xpReward: 15,
  },
  {
    title: "Daily Miner",
    description: "Complete 10 mining sessions",
    icon: "🪙",
    category: "mining",
    requirement: 10,
    xpReward: 60,
  },
  {
    title: "Pro Miner",
    description: "Complete 50 mining sessions",
    icon: "⚙️",
    category: "mining",
    requirement: 50,
    xpReward: 200,
  },
];

const DEFAULT_TASKS = [
  {
    title: "Complete Your Profile",
    description: "Review your profile and complete your account setup",
    category: "onboarding",
    xpReward: 50,
    xnrtReward: "10",
    requirements: "Open your profile and make sure your account details are ready",
    isActive: true,
  },
  {
    title: "Daily Check-In",
    description: "Use the Rewards page daily and build your streak",
    category: "engagement",
    xpReward: 25,
    xnrtReward: "5",
    requirements: "Visit Rewards and complete your daily check-in",
    isActive: true,
  },
  {
    title: "Start Mining",
    description: "Visit the mining page and start your earning routine",
    category: "mining",
    xpReward: 75,
    xnrtReward: "15",
    requirements: "Start or complete your first mining session",
    isActive: true,
  },
  {
    title: "Create First Stake",
    description: "Create your first staking position",
    category: "staking",
    xpReward: 100,
    xnrtReward: "25",
    requirements: "Stake any eligible XNRT amount",
    isActive: true,
  },
  {
    title: "Invite A Friend",
    description: "Share your referral code with a new user",
    category: "referrals",
    xpReward: 120,
    xnrtReward: "30",
    requirements: "Get at least one direct referral",
    isActive: true,
  },
] as const;

async function ensureDefaultTasks() {
  for (const def of DEFAULT_TASKS) {
    try {
      await prisma.task.upsert({
        where: { title: def.title },
        create: {
          ...def,
          xnrtReward: new Prisma.Decimal(def.xnrtReward),
        },
        update: {
          description: def.description,
          category: def.category,
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

function serializeTask(task: any) {
  if (!task) return null;
  return {
    ...task,
    xnrtReward: task.xnrtReward?.toString?.() ?? String(task.xnrtReward ?? "0"),
  };
}

function serializeUserTaskWithTask(userTask: any) {
  return {
    ...userTask,
    task: serializeTask(userTask.task),
  };
}

async function syncUserTasksForActiveTasks(userId: string) {
  const activeTasks = await prisma.task.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (activeTasks.length === 0) return [];

  const taskIds = activeTasks.map((task) => task.id);
  const existingUserTasks = await prisma.userTask.findMany({
    where: { userId, taskId: { in: taskIds } },
    select: { taskId: true },
  });
  const existingTaskIds = new Set(existingUserTasks.map((task) => task.taskId));

  const missingTasks = activeTasks.filter((task) => !existingTaskIds.has(task.id));
  if (missingTasks.length > 0) {
    await prisma.userTask.createMany({
      data: missingTasks.map((task) => ({
        userId,
        taskId: task.id,
        progress: 0,
        maxProgress: 1,
        completed: false,
      })),
      skipDuplicates: true,
    });
  }

  return prisma.userTask.findMany({
    where: { userId, taskId: { in: taskIds } },
    include: { task: true },
    orderBy: { createdAt: "asc" },
  });
}

function parseTaskPayload(body: any) {
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category = String(body?.category ?? "special")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 40) || "special";

  if (!title || !description) {
    throw new Error("Title and description are required");
  }

  const xpReward = Number(body?.xpReward ?? 0);
  const xnrtReward = Number(body?.xnrtReward ?? 0);

  if (!Number.isFinite(xpReward) || xpReward < 0) {
    throw new Error("Invalid XP reward");
  }
  if (!Number.isFinite(xnrtReward) || xnrtReward < 0) {
    throw new Error("Invalid XNRT reward");
  }

  const requirements = String(body?.requirements ?? "").trim();

  return {
    title,
    description,
    xpReward: Math.floor(xpReward),
    xnrtReward: new Prisma.Decimal(xnrtReward.toString()),
    category,
    requirements: requirements || null,
    isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
  };
}

async function awardUserXp(userId: string, xpReward: number) {
  if (xpReward <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true },
  });

  if (!user) return null;

  const nextXp = (user.xp || 0) + xpReward;
  const nextLevel = Math.floor(nextXp / 1000) + 1;

  return prisma.user.update({
    where: { id: userId },
    data: { xp: nextXp, level: nextLevel },
  });
}

function parseAchievementPayload(body: any) {
  const {
    title,
    description,
    icon = "🏆",
    category = "earnings",
    requirement,
    xpReward,
  } = body || {};

  if (!title || !description) {
    throw new Error("Title and description are required");
  }

  const requirementNum = Number(requirement);
  const xpRewardNum = Number(xpReward);

  if (!Number.isFinite(requirementNum) || requirementNum < 0) {
    throw new Error("Invalid requirement");
  }
  if (!Number.isFinite(xpRewardNum) || xpRewardNum < 0) {
    throw new Error("Invalid XP reward");
  }

  const allowedCategories = new Set(["earnings", "referrals", "streaks", "mining"]);

  return {
    title: String(title),
    description: String(description),
    icon: String(icon || "🏆"),
    category: allowedCategories.has(category) ? category : "earnings",
    requirement: Math.floor(requirementNum),
    xpReward: Math.floor(xpRewardNum),
  };
}

async function ensureDefaultAchievements() {
  for (const def of DEFAULT_ACHIEVEMENTS) {
    try {
      await prisma.achievement.upsert({
        where: { title: def.title }, // title must be unique in schema
        create: def,
        update: {
          description: def.description,
          icon: def.icon,
          category: def.category,
          requirement: def.requirement,
          xpReward: def.xpReward,
        },
      });
    } catch (err) {
      console.error(
        "[Achievements] Failed to upsert default achievement",
        def.title,
        err
      );
    }
  }
}

/* -------------------------------------------------------------------------- */

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed / ensure default achievements/tasks exist once for everyone
  await ensureDefaultAchievements();
  await ensureDefaultTasks();

  // CSP violation report endpoint
  app.post("/csp-report", (req, res) => {
    console.log("[CSP Violation]", JSON.stringify(req.body, null, 2));
    res.status(204).end();
  });

  // Auth routes
  app.use("/auth", authRoutes);

  // Token info (XNRT contract address for UI)
  app.get("/api/token/info", (_req, res) => {
    const tokenAddress = process.env.XNRT_TOKEN_ADDRESS || "";
    res.json({
      address: tokenAddress,
      symbol: "XNRT",
      decimals: 18,
      network: "BSC Testnet",
      chainId: 97,
      explorerUrl: tokenAddress
        ? `https://testnet.bscscan.com/token/${tokenAddress}`
        : null,
    });
  });

  // Balance routes
  app.get("/api/balance", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const balance = await storage.getBalance(userId);
      res.json(
        balance || {
          xnrtBalance: "0",
          stakingBalance: "0",
          miningBalance: "0",
          referralBalance: "0",
          totalEarned: "0",
        }
      );
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  app.get("/api/wallet/rates", requireAuth, async (_req, res) => {
    res.json(getWalletRates());
  });

  app.get("/api/wallet/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const [balance, allRecentTransactions, pendingWithdrawalRows, depositAddress] = await Promise.all([
        storage.getBalance(userId),
        storage.getTransactionsByUser(userId),
        prisma.transaction.groupBy({
          by: ["source"],
          where: { userId, type: "withdrawal", status: { in: ["pending", "processing"] } },
          _sum: { amount: true, fee: true, netAmount: true },
          _count: { _all: true },
        }),
        getOrCreateUserDepositAddress(userId),
      ]);

      const available = decimalValueToNumber(balance?.xnrtBalance);
      const staking = decimalValueToNumber(balance?.stakingBalance);
      const mining = decimalValueToNumber(balance?.miningBalance);
      const referral = decimalValueToNumber(balance?.referralBalance);
      const totalWalletValue = available + staking + mining + referral;

      const reservedBySource = pendingWithdrawalRows.reduce(
        (acc, row) => {
          const source = row.source || "main";
          const amount = decimalValueToNumber(row._sum.amount);
          acc[source] = {
            amount,
            fee: decimalValueToNumber(row._sum.fee),
            netAmount: decimalValueToNumber(row._sum.netAmount),
            count: row._count._all,
          };
          acc.total.amount += amount;
          acc.total.fee += decimalValueToNumber(row._sum.fee);
          acc.total.netAmount += decimalValueToNumber(row._sum.netAmount);
          acc.total.count += row._count._all;
          return acc;
        },
        {
          total: { amount: 0, fee: 0, netAmount: 0, count: 0 },
        } as Record<string, { amount: number; fee: number; netAmount: number; count: number }>
      );

      const approvedDeposits = await prisma.transaction.aggregate({
        where: { userId, type: "deposit", status: "approved" },
        _sum: { amount: true, usdtAmount: true },
        _count: { _all: true },
      });

      const approvedWithdrawals = await prisma.transaction.aggregate({
        where: { userId, type: "withdrawal", status: "approved" },
        _sum: { amount: true, fee: true, netAmount: true },
        _count: { _all: true },
      });

      res.json({
        balance: {
          available,
          staking,
          mining,
          referral,
          totalWalletValue,
          totalEarned: decimalValueToNumber(balance?.totalEarned),
        },
        deposit: {
          address: depositAddress,
          network: "BSC (BEP-20)",
          token: "USDT",
          approvedCount: approvedDeposits._count._all,
          totalUsdtDeposited: decimalValueToNumber(approvedDeposits._sum.usdtAmount),
          totalXnrtCredited: decimalValueToNumber(approvedDeposits._sum.amount),
        },
        withdrawals: {
          reservedBySource,
          approvedCount: approvedWithdrawals._count._all,
          totalRequested: decimalValueToNumber(approvedWithdrawals._sum.amount),
          totalFees: decimalValueToNumber(approvedWithdrawals._sum.fee),
          totalPaid: decimalValueToNumber(approvedWithdrawals._sum.netAmount),
        },
        rates: getWalletRates(),
        recentTransactions: allRecentTransactions.slice(0, 12),
      });
    } catch (error) {
      console.error("Error fetching wallet summary:", error);
      res.status(500).json({ message: "Failed to fetch wallet summary" });
    }
  });

  // Stats route
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      const miningSessions = await storage.getMiningHistory(userId);
      const referrals = await storage.getReferralsByReferrer(userId);
      const recentActivity = await storage.getActivities(userId, 5);

      res.json({
        activeStakes: stakes.filter((s) => s.status === "active").length,
        miningSessions: miningSessions.filter((s) => s.status === "completed").length,
        totalReferrals: referrals.length,
        recentActivity,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Home v2 summary route
  app.get("/api/home/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      await storage.processMiningRewards(userId);

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const [
        balance,
        activeMiningSession,
        completedMiningStats,
        activeStakeStats,
        referralGroups,
        referralCommissionStats,
        activeTaskCount,
        completedTaskCount,
        totalAchievementCount,
        unlockedAchievementCount,
        xpRankRows,
        referralRankRows,
        recentActivities,
      ] = await Promise.all([
        storage.getBalance(userId),
        storage.getCurrentMiningSession(userId),
        prisma.miningSession.aggregate({
          where: { userId, status: "completed" },
          _count: { _all: true },
          _sum: { finalReward: true },
        }),
        prisma.stake.aggregate({
          where: { userId, status: "active" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.referral.groupBy({
          by: ["level"],
          where: { referrerId: userId },
          _count: { _all: true },
        }),
        prisma.referralCommission.aggregate({
          where: { referrerId: userId, status: "paid" },
          _sum: { commission: true },
        }),
        prisma.task.count({ where: { isActive: true } }),
        prisma.userTask.count({
          where: { userId, completed: true, task: { isActive: true } },
        }),
        prisma.achievement.count(),
        prisma.userAchievement.count({ where: { userId } }),
        storage.raw(
          `
            WITH ranked AS (
              SELECT
                id,
                ROW_NUMBER() OVER (ORDER BY xp DESC, "createdAt" ASC, id ASC)::int AS rank
              FROM "User"
              WHERE xp > 0
            )
            SELECT rank FROM ranked WHERE id = $1 LIMIT 1
          `,
          [userId]
        ),
        storage.raw(
          `
            WITH stats AS (
              SELECT
                u.id AS "userId",
                COUNT(r.id)::int AS "totalReferrals",
                COALESCE(SUM(r."totalCommission"), 0) AS "totalCommission"
              FROM "User" u
              JOIN "Referral" r ON r."referrerId" = u.id
              GROUP BY u.id
              HAVING COUNT(r.id) > 0
            ), ranked AS (
              SELECT
                *,
                ROW_NUMBER() OVER (
                  ORDER BY "totalReferrals" DESC, "totalCommission" DESC, "userId" ASC
                )::int AS rank
              FROM stats
            )
            SELECT rank FROM ranked WHERE "userId" = $1 LIMIT 1
          `,
          [userId]
        ),
        storage.getActivities(userId, 8),
      ]);

      const referralCounts = referralGroups.reduce(
        (acc, row) => {
          const count = row._count?._all || 0;
          if (row.level === 1) acc.level1 = count;
          if (row.level === 2) acc.level2 = count;
          if (row.level === 3) acc.level3 = count;
          return acc;
        },
        { level1: 0, level2: 0, level3: 0 }
      );

      const xp = user.xp || 0;
      const level = Math.floor(xp / 1000) + 1;
      const currentLevelXp = (level - 1) * 1000;
      const nextLevelXp = level * 1000;
      const xpIntoLevel = Math.max(0, xp - currentLevelXp);
      const xpRequiredForLevel = 1000;
      const xpProgressPercent = Math.min(
        100,
        Math.round((xpIntoLevel / xpRequiredForLevel) * 100)
      );

      const now = new Date();
      const miningEndTime = activeMiningSession?.endTime
        ? new Date(activeMiningSession.endTime)
        : null;
      const miningRemainingMs = miningEndTime
        ? Math.max(0, miningEndTime.getTime() - now.getTime())
        : 0;
      const miningProgressPercent = activeMiningSession?.startTime && miningEndTime
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((now.getTime() - new Date(activeMiningSession.startTime).getTime()) /
                  MINING_SESSION_DURATION_MS) *
                  100
              )
            )
          )
        : 0;

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          profileImageUrl: user.profileImageUrl || null,
          referralCode: user.referralCode,
          createdAt: user.createdAt,
        },
        xp: {
          total: xp,
          level,
          currentLevelXp,
          nextLevelXp,
          xpIntoLevel,
          xpRequiredForLevel,
          progressPercent: xpProgressPercent,
          toNextLevel: Math.max(0, nextLevelXp - xp),
        },
        balance: {
          available: decimalValueToNumber(balance?.xnrtBalance),
          staking: decimalValueToNumber(balance?.stakingBalance),
          mining: decimalValueToNumber(balance?.miningBalance),
          referral: decimalValueToNumber(balance?.referralBalance),
          totalEarned: decimalValueToNumber(balance?.totalEarned),
        },
        mining: {
          status: activeMiningSession ? "active" : "ready",
          activeSessionId: activeMiningSession?.id || null,
          startTime: activeMiningSession?.startTime || null,
          endTime: activeMiningSession?.endTime || null,
          remainingMs: miningRemainingMs,
          progressPercent: miningProgressPercent,
          completedSessions: completedMiningStats._count._all,
          totalXpMined: completedMiningStats._sum.finalReward || 0,
          totalXnrtMined: decimalValueToNumber(balance?.miningBalance),
          reward: {
            xp: MINING_SESSION_XP_REWARD,
            xnrt: MINING_SESSION_XNRT_REWARD,
            durationHours: 24,
          },
        },
        staking: {
          activeStakes: activeStakeStats._count._all,
          totalActiveStaked: decimalValueToNumber(activeStakeStats._sum.amount),
        },
        referrals: {
          direct: referralCounts.level1,
          level2: referralCounts.level2,
          level3: referralCounts.level3,
          totalNetwork: referralCounts.level1 + referralCounts.level2 + referralCounts.level3,
          paidCommission: decimalValueToNumber(referralCommissionStats._sum.commission),
          balance: decimalValueToNumber(balance?.referralBalance),
          rank: referralRankRows[0]?.rank ? toLeaderboardNumber(referralRankRows[0].rank) : null,
        },
        tasks: {
          completed: completedTaskCount,
          totalActive: activeTaskCount,
          remaining: Math.max(0, activeTaskCount - completedTaskCount),
          progressPercent: activeTaskCount > 0 ? Math.round((completedTaskCount / activeTaskCount) * 100) : 0,
        },
        achievements: {
          unlocked: unlockedAchievementCount,
          total: totalAchievementCount,
          remaining: Math.max(0, totalAchievementCount - unlockedAchievementCount),
          progressPercent: totalAchievementCount > 0 ? Math.round((unlockedAchievementCount / totalAchievementCount) * 100) : 0,
        },
        leaderboard: {
          xpRank: xpRankRows[0]?.rank ? toLeaderboardNumber(xpRankRows[0].rank) : null,
          referralRank: referralRankRows[0]?.rank ? toLeaderboardNumber(referralRankRows[0].rank) : null,
        },
        checkin: {
          currentStreak: user.streak || 0,
          lastCheckIn: user.lastCheckIn || null,
          checkedInToday: isSameLocalDay(user.lastCheckIn),
        },
        recentActivities,
      });
    } catch (error) {
      console.error("Error fetching home summary:", error);
      res.status(500).json({ message: "Failed to fetch home summary" });
    }
  });

  // Staking routes
  app.get("/api/stakes", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const stakes = await storage.getStakes(userId);
      res.json(stakes);
    } catch (error) {
      console.error("Error fetching stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });

  app.post("/api/stakes", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { tier, amount } = req.body;

      if (!STAKING_TIERS[tier as StakingTier]) {
        return res.status(400).json({ message: "Invalid staking tier" });
      }

      const tierConfig = STAKING_TIERS[tier as StakingTier];
      const stakeAmount = parseFloat(amount);

      if (stakeAmount < tierConfig.minAmount || stakeAmount > tierConfig.maxAmount) {
        return res.status(400).json({
          message: `Stake amount must be between ${tierConfig.minAmount} and ${tierConfig.maxAmount} XNRT`,
        });
      }

      const balance = await storage.getBalance(userId);
      if (!balance || parseFloat(balance.xnrtBalance) < stakeAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + tierConfig.duration * 24 * 60 * 60 * 1000
      );

      const stake = await storage.createStake({
        userId,
        tier,
        amount: amount.toString(),
        dailyRate: tierConfig.dailyRate.toString(),
        duration: tierConfig.duration,
        startDate,
        endDate,
        totalProfit: "0",
        lastProfitDate: null,
        status: "active",
      });

      // Deduct from balance
      await storage.updateBalance(userId, {
        xnrtBalance: (parseFloat(balance.xnrtBalance) - stakeAmount).toString(),
        stakingBalance: (parseFloat(balance.stakingBalance) + stakeAmount).toString(),
      });

      // Log activity
      await storage.createActivity({
        userId,
        type: "stake_created",
        description: `Staked ${stakeAmount.toLocaleString()} XNRT in ${tierConfig.name}`,
      });

      res.json(stake);
    } catch (error) {
      console.error("Error creating stake:", error);
      res.status(500).json({ message: "Failed to create stake" });
    }
  });

  app.post(
    "/api/stakes/process-rewards",
    requireAuth,
    validateCSRF,
    async (_req, res) => {
      try {
        await storage.processStakingRewards();
        res.json({ success: true, message: "Staking rewards processed successfully" });
      } catch (error) {
        console.error("Error processing staking rewards:", error);
        res.status(500).json({ message: "Failed to process staking rewards" });
      }
    }
  );

  app.post(
    "/api/stakes/:id/withdraw",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const stakeId = req.params.id;

        const stake = await storage.getStakeById(stakeId);

        if (!stake) return res.status(404).json({ message: "Stake not found" });
        if (stake.userId !== userId)
          return res.status(403).json({ message: "Unauthorized" });

        if (stake.status !== "completed" && stake.status !== "active") {
          return res.status(400).json({
            message: "Stake has already been withdrawn or is not ready for withdrawal",
          });
        }

        if (new Date(stake.endDate) > new Date()) {
          return res.status(400).json({ message: "Stake has not matured yet" });
        }

        const dailyRate = parseFloat(stake.dailyRate) / 100;
        const startDate = new Date(stake.startDate);
        const endDate = new Date(stake.endDate);
        const totalDurationDays = Math.floor(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const stakeAmount = parseFloat(stake.amount);
        const dailyProfit = stakeAmount * dailyRate;
        const totalProfit = dailyProfit * totalDurationDays;

        const withdrawnStake = await storage.atomicWithdrawStake(
          stakeId,
          totalProfit.toString()
        );
        if (!withdrawnStake)
          return res.status(409).json({ message: "Stake has already been withdrawn" });

        const balance = await storage.getBalance(userId);
        if (!balance) return res.status(404).json({ message: "Balance not found" });

        const totalWithdrawalAmount = stakeAmount + totalProfit;

        await storage.updateBalance(userId, {
          xnrtBalance: (parseFloat(balance.xnrtBalance) + totalWithdrawalAmount).toString(),
          stakingBalance: (parseFloat(balance.stakingBalance) - stakeAmount).toString(),
        });

        const tierConfig = STAKING_TIERS[stake.tier as StakingTier];
        await storage.createActivity({
          userId,
          type: "stake_withdrawn",
          description: `Withdrew ${stakeAmount.toLocaleString()} XNRT + ${totalProfit.toLocaleString()} profit from ${tierConfig.name}`,
        });

        res.json({ success: true, totalAmount: totalWithdrawalAmount, profit: totalProfit });
      } catch (error) {
        console.error("Error withdrawing stake:", error);
        res.status(500).json({ message: "Failed to withdraw stake" });
      }
    }
  );

  // Mining routes
  app.get("/api/mining/current", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      await storage.processMiningRewards(userId);
      const currentSession = await storage.getCurrentMiningSession(userId);
      res.json(currentSession ?? null);
    } catch (error) {
      console.error("Error loading current mining session:", error);
      res.status(500).json({ message: "Failed to load current mining session" });
    }
  });

  app.get("/api/mining/history", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const sessions = await storage.getMiningHistory(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error loading mining history:", error);
      res.status(500).json({ message: "Failed to load mining history" });
    }
  });

  app.post("/api/mining/process-rewards", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const result = await storage.processMiningRewards(userId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error processing mining rewards:", error);
      res.status(500).json({ message: "Failed to process mining rewards" });
    }
  });

  app.post("/api/mining/start", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      await storage.processMiningRewards(userId);

      const currentSession = await storage.getCurrentMiningSession(userId);
      if (currentSession && currentSession.status === "active") {
        return res.status(400).json({ message: "You already have an active mining session" });
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + MINING_SESSION_DURATION_MS);

      const session = await storage.createMiningSession({
        userId,
        baseReward: MINING_SESSION_XP_REWARD,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: MINING_SESSION_XP_REWARD,
        startTime,
        endTime,
        nextAvailable: endTime,
        status: "active",
      });

      res.json({
        ...session,
        reward: {
          xp: MINING_SESSION_XP_REWARD,
          xnrt: MINING_SESSION_XNRT_REWARD,
          durationHours: 24,
        },
      });
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });

  // Referral routes
  app.get("/api/referrals/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const balance = await storage.getBalance(userId);

      const referralGroups = await prisma.referral.groupBy({
        by: ["level"],
        where: { referrerId: userId },
        _count: { _all: true },
      });

      const commissionGroups = await prisma.referralCommission.groupBy({
        by: ["level"],
        where: { referrerId: userId, status: "paid" },
        _sum: { commission: true },
      });

      const getCount = (level: number) =>
        referralGroups.find((row) => row.level === level)?._count?._all || 0;
      const getCommission = (level: number) =>
        commissionGroups.find((row) => row.level === level)?._sum?.commission?.toString() || "0";

      const level1Total = parseFloat(getCommission(1));
      const level2Total = parseFloat(getCommission(2));
      const level3Total = parseFloat(getCommission(3));
      const paidNetworkCommission = level1Total + level2Total + level3Total;
      const actualBalance = parseFloat(balance?.referralBalance || "0");

      const stats = {
        level1Count: getCount(1),
        level2Count: getCount(2),
        level3Count: getCount(3),
        level1Commission: level1Total.toString(),
        level2Commission: level2Total.toString(),
        level3Commission: level3Total.toString(),
        totalCommission: paidNetworkCommission.toString(),
        paidNetworkCommission: paidNetworkCommission.toString(),
        actualBalance: actualBalance.toString(),
        companyCommissions: Math.max(0, actualBalance - paidNetworkCommission).toString(),
        ledgerBacked: true,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.get("/api/referrals/tree", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const currentUser = await storage.getUser(userId);
      const isAdmin = currentUser?.isAdmin || false;

      const referrals = await prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          referredUser: {
            select: { id: true, username: true, email: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const referredIds = referrals.map((referral) => referral.referredUserId);
      const depositGroups = referredIds.length
        ? await prisma.transaction.groupBy({
            by: ["userId"],
            where: {
              userId: { in: referredIds },
              type: "deposit",
              status: "approved",
            },
            _sum: { amount: true },
            _count: { _all: true },
          })
        : [];

      const depositsByUser = new Map<string, { count: number; total: string }>(
        depositGroups.map((row) => [
          row.userId,
          {
            count: row._count?._all || 0,
            total: row._sum?.amount?.toString() || "0",
          },
        ])
      );

      res.json(
        referrals.map((referral) => {
          const deposit = depositsByUser.get(referral.referredUserId);
          return {
            id: referral.id,
            referrerId: referral.referrerId,
            referredUserId: referral.referredUserId,
            level: referral.level,
            totalCommission: referral.totalCommission.toString(),
            createdAt: referral.createdAt,
            displayName: isAdmin
              ? referral.referredUser.username || referral.referredUser.email || "Unknown user"
              : generateAnonymizedHandle(referral.referredUserId),
            joinedAt: referral.referredUser.createdAt,
            hasDeposited: (deposit?.count || 0) > 0,
            depositCount: deposit?.count || 0,
            totalDeposited: deposit?.total || "0",
          };
        })
      );
    } catch (error) {
      console.error("Error fetching referral tree:", error);
      res.status(500).json({ message: "Failed to fetch referral tree" });
    }
  });

  app.get("/api/referrals/commissions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || "25"), 10) || 25, 1), 100);

      const commissions = await prisma.referralCommission.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const referredIds = Array.from(new Set(commissions.map((item) => item.referredUserId)));
      const referredUsers = referredIds.length
        ? await prisma.user.findMany({
            where: { id: { in: referredIds } },
            select: { id: true, username: true, email: true },
          })
        : [];
      const usersById = new Map<string, { id: string; username: string | null; email: string | null }>(
        referredUsers.map((user) => [user.id, user])
      );

      res.json(
        commissions.map((item) => {
          const referredUser = usersById.get(item.referredUserId);
          return {
            id: item.id,
            transactionId: item.transactionId,
            referrerId: item.referrerId,
            referredUserId: item.referredUserId,
            level: item.level,
            baseAmount: item.baseAmount.toString(),
            rate: item.rate.toString(),
            commission: item.commission.toString(),
            status: item.status,
            createdAt: item.createdAt,
            referredDisplayName: referredUser
              ? generateAnonymizedHandle(referredUser.id)
              : generateAnonymizedHandle(item.referredUserId),
          };
        })
      );
    } catch (error) {
      console.error("Error fetching referral commissions:", error);
      res.status(500).json({ message: "Failed to fetch referral commissions" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.authUser!.id;

      // Ownership check without loading all notifications
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Mark as read using existing storage API
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post(
    "/api/notifications/mark-all-read",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        await storage.markAllNotificationsAsRead(userId);
        res.json({ message: "All notifications marked as read" });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ message: "Failed to mark all notifications as read" });
      }
    }
  );

  // Push Notification routes
  app.get("/api/push/vapid-public-key", async (_req, res) => {
    try {
      res.json({ publicKey: VAPID_PUBLIC_KEY });
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      res.status(500).json({ message: "Failed to get VAPID public key" });
    }
  });

  app.post(
    "/api/push/subscribe",
    requireAuth,
    pushSubscriptionLimiter,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { endpoint, keys, expirationTime } = req.body;

        if (!endpoint || typeof endpoint !== "string") {
          return res.status(400).json({ message: "Invalid endpoint" });
        }
        if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
          return res.status(400).json({ message: "Invalid subscription keys" });
        }
        if (!endpoint.startsWith("https://")) {
          return res.status(400).json({ message: "Endpoint must be HTTPS URL" });
        }

        const base64Regex = /^[A-Za-z0-9+/=_-]+$/;
        if (!base64Regex.test(keys.p256dh) || !base64Regex.test(keys.auth)) {
          return res.status(400).json({ message: "Keys must be valid base64 strings" });
        }

        const subscription = await storage.createPushSubscription({
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          expirationTime: expirationTime || null,
        });

        res.json(subscription);
      } catch (error) {
        console.error("Error creating push subscription:", error);
        res.status(500).json({ message: "Failed to create push subscription" });
      }
    }
  );

  app.delete(
    "/api/push/unsubscribe",
    requireAuth,
    pushSubscriptionLimiter,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { endpoint } = req.body;

        if (!endpoint || typeof endpoint !== "string") {
          return res.status(400).json({ message: "Invalid endpoint" });
        }

        await storage.deletePushSubscription(userId, endpoint);
        res.json({ message: "Successfully unsubscribed from push notifications" });
      } catch (error) {
        console.error("Error deleting push subscription:", error);
        res.status(500).json({ message: "Failed to delete push subscription" });
      }
    }
  );

  app.get("/api/push/subscriptions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const subscriptions = await storage.getUserPushSubscriptions(userId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error getting push subscriptions:", error);
      res.status(500).json({ message: "Failed to get push subscriptions" });
    }
  });

  app.post("/api/admin/push/test", requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { userId, title, body } = req.body;

      if (!userId || !title || !body) {
        return res.status(400).json({ message: "userId, title, and body are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      await sendPushNotification(userId, { title, body });
      res.json({ message: "Test push notification sent successfully" });
    } catch (error) {
      console.error("Error sending test push notification:", error);
      res.status(500).json({ message: "Failed to send test push notification" });
    }
  });

  // Leaderboard routes
  app.get("/api/leaderboard/referrals", requireAuth, async (req, res) => {
    try {
      const period = normalizeLeaderboardPeriodParam(req.query.period);
      const limit = clampLeaderboardLimit(req.query.limit, 50);
      const currentUserId = req.authUser!.id;
      const dateFilter = getLeaderboardDateFilter(period);

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;

      const rankedReferralSql = `
        WITH stats AS (
          SELECT
            u.id AS "userId",
            u.username,
            u.email,
            COUNT(r.id)::int AS "totalReferrals",
            COALESCE(SUM(r."totalCommission"), 0) AS "totalCommission",
            COUNT(CASE WHEN r.level = 1 THEN 1 END)::int AS "level1Count",
            COUNT(CASE WHEN r.level = 2 THEN 1 END)::int AS "level2Count",
            COUNT(CASE WHEN r.level = 3 THEN 1 END)::int AS "level3Count"
          FROM "User" u
          JOIN "Referral" r ON r."referrerId" = u.id
            ${dateFilter ? `AND r."createdAt" >= $1` : ""}
          GROUP BY u.id, u.username, u.email
          HAVING COUNT(r.id) > 0
        ), ranked AS (
          SELECT
            *,
            ROW_NUMBER() OVER (
              ORDER BY "totalReferrals" DESC, "totalCommission" DESC, "userId" ASC
            )::int AS rank
          FROM stats
        )
        SELECT * FROM ranked
      `;

      const leaderboardQuery = `${rankedReferralSql} ORDER BY rank ASC LIMIT $${dateFilter ? "2" : "1"}`;
      const leaderboard: any[] = dateFilter
        ? await storage.raw(leaderboardQuery, [dateFilter, limit])
        : await storage.raw(leaderboardQuery, [limit]);

      const userPositionQuery = `${rankedReferralSql} WHERE "userId" = $${dateFilter ? "2" : "1"} LIMIT 1`;
      const userRows: any[] = dateFilter
        ? await storage.raw(userPositionQuery, [dateFilter, currentUserId])
        : await storage.raw(userPositionQuery, [currentUserId]);

      const formatLeaderboardEntry = (item: any, forceYou = false) => {
        const baseData = {
          totalReferrals: toLeaderboardNumber(item.totalReferrals),
          totalCommission: item.totalCommission?.toString?.() ?? "0",
          level1Count: toLeaderboardNumber(item.level1Count),
          level2Count: toLeaderboardNumber(item.level2Count),
          level3Count: toLeaderboardNumber(item.level3Count),
          rank: toLeaderboardNumber(item.rank),
          currentUser: item.userId === currentUserId || forceYou,
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

        return {
          ...baseData,
          displayName: forceYou ? "You" : generateAnonymizedHandle(item.userId),
        };
      };

      const formattedLeaderboard = leaderboard.map((item) =>
        formatLeaderboardEntry(item)
      );

      const userPosition = userRows.length
        ? formatLeaderboardEntry(userRows[0], true)
        : null;

      res.json({
        leaderboard: formattedLeaderboard,
        userPosition,
        meta: {
          period,
          unit: "referrals",
          window:
            period === "daily"
              ? "today"
              : period === "weekly"
              ? "last 7 days"
              : period === "monthly"
              ? "last 30 days"
              : "all time",
        },
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/xp", requireAuth, async (req, res) => {
    try {
      const period = normalizeLeaderboardPeriodParam(req.query.period);
      const category = typeof req.query.category === "string" ? req.query.category : "overall";
      const limit = clampLeaderboardLimit(req.query.limit, 50);
      const currentUserId = req.authUser!.id;

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;

      const result = await storage.getXPLeaderboard(
        currentUserId,
        period,
        category,
        isAdmin,
        limit
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching XP leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch XP leaderboard" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const transactions = await storage.getTransactionsByUser(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/deposits", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const deposits = await storage.getTransactionsByUser(userId, "deposit");
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  app.get("/api/transactions/withdrawals", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const withdrawals = await storage.getTransactionsByUser(
        userId,
        "withdrawal"
      );
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Wallet Linking API
  app.get("/api/wallet/me", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const wallets = await prisma.linkedWallet.findMany({
        where: { userId, active: true },
        select: { address: true, linkedAt: true },
        orderBy: { linkedAt: "desc" },
      });
      res.json(wallets.map((w) => w.address));
    } catch (error) {
      console.error("Error fetching linked wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.get("/api/wallet/link/challenge", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const address = String(req.query.address || "").toLowerCase();

      if (!/^0x[a-f0-9]{40}$/.test(address)) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      // 6-digit numeric nonce; avoids NaN issues and is easy for users to verify
      const nonce = Math.floor(100000 + Math.random() * 900000);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const issuedAt = new Date();

      await prisma.walletNonce.upsert({
        where: { userId_address: { userId, address } },
        update: { nonce: String(nonce), expiresAt },
        create: { userId, address, nonce: String(nonce), expiresAt },
      });

      const message = `XNRT Wallet Link

Address: ${address}
Nonce: ${nonce}
Issued: ${issuedAt.toISOString()}`;

      res.json({
        message,
        nonce: String(nonce),
        issuedAt: issuedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).json({ message: "Failed to generate challenge" });
    }
  });

  app.post(
    "/api/wallet/link/confirm",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { address, signature, nonce, issuedAt } = req.body;
        const normalized = String(address || "").toLowerCase();

        if (!address || !signature || !nonce || !issuedAt) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const rec = await prisma.walletNonce.findUnique({
          where: {
            userId_address: { userId, address: normalized },
          },
        });

        if (
          !rec ||
          String(rec.nonce) !== String(nonce) ||
          !rec.expiresAt ||
          rec.expiresAt < new Date()
        ) {
          return res.status(400).json({ message: "Invalid or expired challenge" });
        }

        const message = `XNRT Wallet Link

Address: ${normalized}
Nonce: ${nonce}
Issued: ${issuedAt}`;

        let recoveredAddress: string;
        try {
          recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
        } catch {
          return res.status(400).json({ message: "Invalid signature" });
        }

        if (recoveredAddress !== normalized) {
          return res
            .status(400)
            .json({ message: "Signature does not match address" });
        }

        const existing = await prisma.linkedWallet.findFirst({
          where: { address: normalized, active: true },
        });

        if (existing && existing.userId !== userId) {
          return res
            .status(409)
            .json({ message: "This wallet is already linked to another account" });
        }

        if (existing && existing.userId === userId) {
          return res.json({ address: existing.address, alreadyLinked: true });
        }

        await prisma.$transaction([
          prisma.walletNonce.delete({ where: { id: rec.id } }),
          prisma.linkedWallet.create({
            data: {
              userId,
              address: normalized,
              signature,
              nonce: rec.nonce,
            },
          }),
        ]);

        res.json({ address: normalized });
      } catch (error) {
        console.error("Error linking wallet:", error);
        res.status(500).json({ message: "Failed to link wallet" });
      }
    }
  );

  // User Deposit Address API
  app.get("/api/wallet/deposit-address", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const address = await getOrCreateUserDepositAddress(userId);
      const rates = getWalletRates();

      res.json({
        address,
        network: rates.network,
        token: rates.depositToken,
        instructions: [
          "Send USDT (BEP-20) from your exchange to this personal deposit address",
          "Auto-detection credits deposits after the required confirmations",
          "Report the transaction hash only if auto-credit does not appear",
          `Required confirmations: ${rates.confirmations}`,
        ],
      });
    } catch (error) {
      console.error("Error getting deposit address:", error);
      res.status(500).json({ message: "Failed to get deposit address" });
    }
  });

  app.post(
    "/api/wallet/report-deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        let { transactionHash, amount, description } = req.body;

        if (!transactionHash || amount === undefined || amount === null) {
          return res
            .status(400)
            .json({ message: "Transaction hash and amount required" });
        }

        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return res.status(400).json({ message: "Invalid amount" });
        }

        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res
            .status(400)
            .json({ message: "Invalid transaction hash format" });
        }

        const existingTx = await prisma.transaction.findFirst({
          where: { transactionHash },
        });
        if (existingTx) {
          return res.status(409).json({
            message: "This deposit has already been credited",
            alreadyProcessed: true,
          });
        }

        const existingReport = await prisma.depositReport.findFirst({
          where: { txHash: transactionHash },
        });
        if (existingReport) {
          return res
            .status(409)
            .json({ message: "This deposit has already been reported" });
        }

        const userDepositAddress = (await getOrCreateUserDepositAddress(userId)).toLowerCase();
        const treasuryAddress = (process.env.XNRT_WALLET || "").toLowerCase();
        const rates = getWalletRates();

        let verification = await verifyBscUsdtDeposit({
          txHash: transactionHash,
          expectedTo: userDepositAddress,
          minAmount: amountNum,
          requiredConf: rates.confirmations,
        });
        let expectedTo = userDepositAddress;
        let verifiedToPersonalAddress = !!verification.verified;

        if (!verification.verified && treasuryAddress) {
          const treasuryVerification = await verifyBscUsdtDeposit({
            txHash: transactionHash,
            expectedTo: treasuryAddress,
            minAmount: amountNum,
            requiredConf: rates.confirmations,
          });
          if (treasuryVerification.verified) {
            verification = treasuryVerification;
            expectedTo = treasuryAddress;
            verifiedToPersonalAddress = false;
          }
        }

        if (!verification.verified) {
          const report = await prisma.depositReport.create({
            data: {
              userId,
              txHash: transactionHash,
              amount: new Prisma.Decimal(amountNum),
              notes:
                description ||
                `Verification failed. Checked personal address ${userDepositAddress}${treasuryAddress ? ` and treasury ${treasuryAddress}` : ""}. Reason: ${verification.reason}`,
              status: "pending",
            },
          });

          return res.json({
            message: "Report submitted for admin review",
            reportId: report.id,
            reason: verification.reason,
          });
        }

        const provider = new ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
        const receipt = await provider.getTransactionReceipt(transactionHash);
        const transaction = await provider.getTransaction(transactionHash);
        const fromAddress = transaction?.from?.toLowerCase() || "";

        const usdtAmount = verification.amountOnChain ?? amountNum;
        const netUsdt = usdtAmount * (1 - rates.platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * rates.xnrtPerUsdt;

        // Personal deposit addresses are unique per user, so linked-wallet proof is not required.
        const shouldAutoCredit = verifiedToPersonalAddress;
        const linkedWallet = !shouldAutoCredit
          ? await prisma.linkedWallet.findFirst({
              where: { userId, address: fromAddress, active: true },
            })
          : null;

        if (shouldAutoCredit || linkedWallet) {
          const createdDeposit = await prisma.$transaction(async (tx) => {
            const txRecord = await tx.transaction.create({
              data: {
                userId,
                type: "deposit",
                amount: new Prisma.Decimal(xnrtAmount),
                usdtAmount: new Prisma.Decimal(usdtAmount),
                transactionHash,
                walletAddress: expectedTo,
                status: "approved",
                verified: true,
                confirmations: verification.confirmations,
                verificationData: {
                  autoVerified: true,
                  reportSubmitted: true,
                  verifiedTo: expectedTo,
                  verifiedAt: new Date().toISOString(),
                  blockNumber: receipt?.blockNumber,
                  fromAddress,
                } as any,
              },
            });

            await tx.balance.upsert({
              where: { userId },
              create: {
                userId,
                xnrtBalance: new Prisma.Decimal(xnrtAmount),
                totalEarned: new Prisma.Decimal(xnrtAmount),
              },
              update: {
                xnrtBalance: { increment: new Prisma.Decimal(xnrtAmount) },
                totalEarned: { increment: new Prisma.Decimal(xnrtAmount) },
              },
            });
            return txRecord;
          });

          const { sendDepositNotification } = await import(
            "./services/depositScanner"
          );
          void sendDepositNotification(userId, xnrtAmount, transactionHash).catch((err) => {
            console.error("[ReportDeposit] Notification error:", err);
          });

          await storage.distributeReferralCommissions(
            userId,
            xnrtAmount,
            `tx:${createdDeposit.id}`
          );
          await storage.createActivity({
            userId,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via verified deposit report`,
          });

          return res.json({
            message: "Deposit verified and credited automatically!",
            credited: true,
            amount: xnrtAmount,
          });
        }

        await prisma.unmatchedDeposit.create({
          data: {
            fromAddress,
            toAddress: expectedTo,
            amount: new Prisma.Decimal(usdtAmount),
            transactionHash,
            blockNumber: receipt?.blockNumber ?? 0,
            confirmations: verification.confirmations ?? 0,
            matched: false,
          },
        });

        return res.json({
          message:
            "Deposit verified on blockchain. Admin will credit your account shortly.",
          verified: true,
          pendingAdminReview: true,
        });
      } catch (error: any) {
        console.error("Error reporting deposit:", error);
        if (String(error?.message || "").includes("unique")) {
          return res.status(409).json({ message: "This deposit has already been processed" });
        }
        res.status(500).json({ message: "Failed to process deposit report" });
      }
    }
  );

  app.post(
    "/api/transactions/deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        let { usdtAmount, transactionHash, proofImageUrl } = req.body;

        if (!usdtAmount || !transactionHash) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const usdt = Number(usdtAmount);
        if (!Number.isFinite(usdt) || usdt <= 0) {
          return res.status(400).json({ message: "Invalid USDT amount" });
        }

        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res
            .status(400)
            .json({ message: "Invalid transaction hash format" });
        }

        const existing = await prisma.transaction.findFirst({
          where: { transactionHash },
        });
        if (existing) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit.",
          });
        }

        if (proofImageUrl) {
          const isBase64DataUrl = proofImageUrl.startsWith("data:image/");
          const isValidUrl = /^https?:\/\//.test(proofImageUrl);
          if (!isBase64DataUrl && !isValidUrl) {
            return res
              .status(400)
              .json({ message: "Invalid proof image URL format" });
          }
        }

        const rates = getWalletRates();
        const netUsdt = usdt * (1 - rates.platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * rates.xnrtPerUsdt;
        const depositAddress = await getOrCreateUserDepositAddress(userId);

        const transaction = await storage.createTransaction({
          userId,
          type: "deposit",
          amount: xnrtAmount.toString(),
          usdtAmount: usdt.toString(),
          transactionHash,
          walletAddress: depositAddress,
          ...(proofImageUrl && { proofImageUrl }),
          status: "pending",
          verified: false,
          confirmations: 0,
        });

        res.json(transaction);
      } catch (error: any) {
        if (error.code === "P2002" && error.meta?.target?.includes("transactionHash")) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit.",
          });
        }
        console.error("Error creating deposit:", error);
        res.status(500).json({ message: "Failed to create deposit" });
      }
    }
  );

  app.post(
    "/api/transactions/withdrawal",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { source, amount, walletAddress } = req.body;

        if (!source || amount === undefined || amount === null || !walletAddress) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const normalizedWallet = normalizeBscAddress(walletAddress);
        if (!normalizedWallet) {
          return res.status(400).json({
            message: "Enter a valid BEP-20 wallet address starting with 0x",
          });
        }

        if (!["main", "staking", "mining", "referral"].includes(String(source))) {
          return res.status(400).json({ message: "Invalid withdrawal source" });
        }

        const withdrawAmount = Number(amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res
            .status(400)
            .json({ message: "Withdrawal amount must be a positive number" });
        }

        const rates = getWalletRates();
        const fee = (withdrawAmount * rates.withdrawalFeePercent) / 100;
        const netAmount = withdrawAmount - fee;
        const usdtAmount = netAmount * rates.usdtPerXnrt;

        if (source === "referral" && withdrawAmount < rates.minReferralWithdrawal) {
          return res.status(400).json({
            message: `Minimum withdrawal from referral balance is ${rates.minReferralWithdrawal.toLocaleString()} XNRT`,
          });
        }

        if (source === "mining" && withdrawAmount < rates.minMiningWithdrawal) {
          return res.status(400).json({
            message: `Minimum withdrawal from mining balance is ${rates.minMiningWithdrawal.toLocaleString()} XNRT`,
          });
        }

        const sourceBalanceKey = getBalanceSourceKey(source);

        const transaction = await prisma.$transaction(async (tx) => {
          const balance = await tx.balance.findUnique({ where: { userId } });
          if (!balance) throw new Error("Balance not found");

          const availableBalance = decimalValueToNumber((balance as any)[sourceBalanceKey]);
          if (withdrawAmount > availableBalance) {
            throw new Error("Insufficient balance for this withdrawal");
          }

          await tx.balance.update({
            where: { userId },
            data: {
              [sourceBalanceKey]: new Prisma.Decimal(availableBalance - withdrawAmount),
            },
          });

          return await tx.transaction.create({
            data: {
              userId,
              type: "withdrawal",
              amount: new Prisma.Decimal(withdrawAmount),
              usdtAmount: new Prisma.Decimal(usdtAmount),
              source,
              walletAddress: normalizedWallet,
              status: "pending",
              fee: new Prisma.Decimal(fee),
              netAmount: new Prisma.Decimal(netAmount),
              verificationData: {
                withdrawalMode: rates.withdrawalMode,
                withdrawalToken: rates.withdrawalToken,
                reservedBalance: true,
                reservedAt: new Date().toISOString(),
                sourceBalanceKey,
                feePercent: rates.withdrawalFeePercent,
              } as any,
            },
          });
        });

        await storage.createActivity({
          userId,
          type: "withdrawal_requested",
          description: `Withdrawal request reserved ${withdrawAmount.toLocaleString()} XNRT from ${source} balance`,
        });

        res.json(transaction);
      } catch (error: any) {
        console.error("Error creating withdrawal:", error);
        const message = error?.message || "Failed to create withdrawal";
        const status = /insufficient|balance not found|invalid/i.test(message) ? 400 : 500;
        res.status(status).json({ message });
      }
    }
  );

  // Task routes
  app.get("/api/tasks/user", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const userTasks = await syncUserTasksForActiveTasks(userId);
      res.json(userTasks.map(serializeUserTaskWithTask));
    } catch (error) {
      console.error("Error fetching user tasks:", error);
      res.status(500).json({ message: "Failed to fetch user tasks" });
    }
  });

  app.post(
    "/api/tasks/:taskId/complete",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { taskId } = req.params;

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task || !task.isActive) {
          return res.status(404).json({ message: "Task not found" });
        }

        const userTask = await prisma.userTask.upsert({
          where: { userId_taskId: { userId, taskId } },
          create: {
            userId,
            taskId,
            progress: 0,
            maxProgress: 1,
            completed: false,
          },
          update: {},
        });

        if (userTask.completed) {
          return res.status(400).json({ message: "Task already completed" });
        }

        const maxProgress = Math.max(userTask.maxProgress || 1, 1);
        if (maxProgress > 1 && userTask.progress < maxProgress) {
          return res.status(400).json({
            message: `Task progress is incomplete (${userTask.progress}/${maxProgress})`,
          });
        }

        const completedUserTask = await prisma.userTask.update({
          where: { id: userTask.id },
          data: {
            completed: true,
            completedAt: new Date(),
            progress: maxProgress,
          },
        });

        await awardUserXp(userId, task.xpReward);

        const xnrtAmount = Number(task.xnrtReward);
        if (Number.isFinite(xnrtAmount) && xnrtAmount > 0) {
          const balance = await storage.getBalance(userId);
          if (balance) {
            await storage.updateBalance(userId, {
              xnrtBalance: (parseFloat(balance.xnrtBalance) + xnrtAmount).toString(),
              totalEarned: (parseFloat(balance.totalEarned) + xnrtAmount).toString(),
            });
          }

          await storage.createTransaction({
            userId,
            type: "reward",
            amount: xnrtAmount.toString(),
            source: "task",
            status: "approved",
            approvedAt: new Date(),
            verified: true,
          });
        }

        await storage.createActivity({
          userId,
          type: "task_completed",
          description: `Completed task: ${task.title} (+${task.xpReward} XP, +${task.xnrtReward.toString()} XNRT)`,
        });

        void notifyUser(userId, {
          type: "task_completed",
          title: "✅ Task Completed",
          message: `You earned ${task.xpReward} XP and ${task.xnrtReward.toString()} XNRT from ${task.title}.`,
          url: "/tasks",
          metadata: {
            taskId: task.id,
            taskTitle: task.title,
            xpReward: task.xpReward,
            xnrtReward: task.xnrtReward.toString(),
          },
        }).catch((err) => {
          console.error("Error sending task completion notification:", err);
        });

        await storage.checkAndUnlockAchievements(userId);

        res.json({
          userTask: completedUserTask,
          xpReward: task.xpReward,
          xnrtReward: task.xnrtReward.toString(),
        });
      } catch (error) {
        console.error("Error completing task:", error);
        res.status(500).json({ message: "Failed to complete task" });
      }
    }
  );

  // Achievement routes
  app.get("/api/achievements", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const allAchievements = await storage.getAllAchievements();
      const userAchievements = await storage.getUserAchievements(userId);

      const populated = allAchievements.map((achievement: any) => {
        const ua = (userAchievements as any[]).find(
          (x) => x.achievementId === achievement.id
        );

        const unlocked = !!ua;
        const claimed = !!ua?.claimed;
        const claimedAt = ua?.claimedAt ?? null;

        return {
          ...achievement,
          unlocked,
          unlockedAt: ua?.unlockedAt ?? ua?.createdAt ?? null,
          claimed,
          claimedAt,
          // handy flag for UI
          claimable: unlocked && !claimed,
        };
      });

      res.json(populated);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Claim an unlocked achievement (marks claimed/claimedAt only; XP is already granted on unlock)
  app.post(
    "/api/achievements/:id/claim",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const achievementId = req.params.id;

        const achievement = await prisma.achievement.findUnique({
          where: { id: achievementId },
        });
        if (!achievement) {
          return res.status(404).json({ message: "Achievement not found" });
        }

        const userAchievement = await prisma.userAchievement.findFirst({
          where: { userId, achievementId },
        });

        if (!userAchievement) {
          return res
            .status(400)
            .json({ message: "Achievement not unlocked yet" });
        }

        if (userAchievement.claimed) {
          return res
            .status(400)
            .json({ message: "Achievement already claimed" });
        }

        const updated = await prisma.userAchievement.update({
          where: { id: userAchievement.id },
          data: {
            claimed: true,
            claimedAt: new Date(),
          },
        });

        await storage.createActivity({
          userId,
          type: "achievement_claimed",
          description: `Claimed achievement: ${achievement.title}`,
        });

        res.json({
          achievementId,
          claimed: updated.claimed,
          claimedAt: updated.claimedAt,
        });
      } catch (error) {
        console.error("Error claiming achievement:", error);
        res.status(500).json({ message: "Failed to claim achievement" });
      }
    }
  );

  // Admin Task Management
  app.get("/api/admin/tasks", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [tasks, completionGroups] = await Promise.all([
        prisma.task.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.userTask.groupBy({
          by: ["taskId"],
          where: { completed: true },
          _count: { taskId: true },
        }),
      ]);

      const completionMap = new Map<string, number>();
      (completionGroups as any[]).forEach((row) => {
        const count = row?._count?.taskId ?? row?._count?._all ?? row?._count ?? 0;
        completionMap.set(row.taskId, Number(count) || 0);
      });

      res.json(
        tasks.map((task) => ({
          ...serializeTask(task),
          completionCount: completionMap.get(task.id) ?? 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching admin tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post(
    "/api/admin/tasks",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        let payload;
        try {
          payload = parseTaskPayload(req.body);
        } catch (e: any) {
          return res.status(400).json({ message: e?.message ?? "Invalid task payload" });
        }

        const task = await prisma.task.create({ data: payload });
        res.status(201).json({ ...serializeTask(task), completionCount: 0 });
      } catch (error: any) {
        console.error("Error creating task:", error);
        if (error.code === "P2002") {
          return res.status(409).json({ message: "A task with this title already exists" });
        }
        res.status(500).json({ message: "Failed to create task" });
      }
    }
  );

  app.put(
    "/api/admin/tasks/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        let payload;
        try {
          payload = parseTaskPayload(req.body);
        } catch (e: any) {
          return res.status(400).json({ message: e?.message ?? "Invalid task payload" });
        }

        const task = await prisma.task.update({ where: { id }, data: payload });
        const completionCount = await prisma.userTask.count({
          where: { taskId: id, completed: true },
        });

        res.json({ ...serializeTask(task), completionCount });
      } catch (error: any) {
        console.error("Error updating task:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Task not found" });
        }
        if (error.code === "P2002") {
          return res.status(409).json({ message: "A task with this title already exists" });
        }
        res.status(500).json({ message: "Failed to update task" });
      }
    }
  );

  app.patch(
    "/api/admin/tasks/:id/toggle",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const existing = await prisma.task.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Task not found" });

        const task = await prisma.task.update({
          where: { id },
          data: { isActive: !existing.isActive },
        });

        const completionCount = await prisma.userTask.count({
          where: { taskId: id, completed: true },
        });

        res.json({ ...serializeTask(task), completionCount });
      } catch (error) {
        console.error("Error toggling task:", error);
        res.status(500).json({ message: "Failed to toggle task" });
      }
    }
  );

  app.delete(
    "/api/admin/tasks/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.task.delete({ where: { id } });
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting task:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Task not found" });
        }
        res.status(500).json({ message: "Failed to delete task" });
      }
    }
  );

  // Admin Achievement Management
  app.get(
    "/api/admin/achievements",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const [achievements, unlockGroups] = await Promise.all([
          prisma.achievement.findMany({
            orderBy: { createdAt: "asc" },
          }),
          prisma.userAchievement.groupBy({
            by: ["achievementId"],
            _count: { achievementId: true },
          }),
        ]);

        const unlockMap = new Map<string, number>();
        (unlockGroups as any[]).forEach((row) => {
          const count =
            row?._count?.achievementId ??
            row?._count?._all ??
            row?._count ??
            0;
          unlockMap.set(row.achievementId, Number(count) || 0);
        });

        const result = achievements.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          icon: a.icon,
          category: a.category,
          requirement: a.requirement,
          xpReward: a.xpReward,
          unlockCount: unlockMap.get(a.id) ?? 0,
        }));

        res.json(result);
      } catch (error) {
        console.error("Error fetching admin achievements:", error);
        res.status(500).json({ message: "Failed to fetch achievements" });
      }
    }
  );

  app.post(
    "/api/admin/achievements",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        let payload;
        try {
          payload = parseAchievementPayload(req.body);
        } catch (e: any) {
          return res
            .status(400)
            .json({ message: e?.message ?? "Invalid achievement payload" });
        }

        const achievement = await prisma.achievement.create({
          data: payload,
        });

        res.status(201).json({
          ...achievement,
          unlockCount: 0,
        });
      } catch (error: any) {
        console.error("Error creating achievement:", error);
        if (error.code === "P2002") {
          return res.status(409).json({
            message: "An achievement with this title already exists",
          });
        }
        res.status(500).json({ message: "Failed to create achievement" });
      }
    }
  );

  app.put(
    "/api/admin/achievements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;

        let payload;
        try {
          payload = parseAchievementPayload(req.body);
        } catch (e: any) {
          return res
            .status(400)
            .json({ message: e?.message ?? "Invalid achievement payload" });
        }

        const achievement = await prisma.achievement.update({
          where: { id },
          data: payload,
        });

        const unlockCount = await prisma.userAchievement.count({
          where: { achievementId: id },
        });

        res.json({
          ...achievement,
          unlockCount,
        });
      } catch (error: any) {
        console.error("Error updating achievement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Achievement not found" });
        }
        if (error.code === "P2002") {
          return res.status(409).json({
            message: "An achievement with this title already exists",
          });
        }
        res.status(500).json({ message: "Failed to update achievement" });
      }
    }
  );

  app.delete(
    "/api/admin/achievements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.achievement.delete({ where: { id } });
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting achievement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Achievement not found" });
        }
        res.status(500).json({ message: "Failed to delete achievement" });
      }
    }
  );

  // Profile v2 routes
  app.get("/api/profile/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const [
        balance,
        activeStakeStats,
        completedMiningStats,
        referralGroups,
        referralCommission,
        activeTaskCount,
        assignedTaskCount,
        completedTaskCount,
        totalAchievementCount,
        unlockedAchievementCount,
        leaderboardRows,
        referralRankRows,
        recentActivities,
      ] = await Promise.all([
        storage.getBalance(userId),
        prisma.stake.aggregate({
          where: { userId, status: "active" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.miningSession.aggregate({
          where: { userId, status: "completed" },
          _count: { _all: true },
          _sum: { finalReward: true },
        }),
        prisma.referral.groupBy({
          by: ["level"],
          where: { referrerId: userId },
          _count: { _all: true },
        }),
        prisma.referral.aggregate({
          where: { referrerId: userId },
          _sum: { totalCommission: true },
        }),
        prisma.task.count({ where: { isActive: true } }),
        prisma.userTask.count({ where: { userId } }),
        prisma.userTask.count({ where: { userId, completed: true } }),
        prisma.achievement.count(),
        prisma.userAchievement.count({ where: { userId } }),
        storage.raw(
          `
            WITH ranked AS (
              SELECT
                id,
                ROW_NUMBER() OVER (ORDER BY xp DESC, "createdAt" ASC, id ASC)::int AS rank
              FROM "User"
              WHERE xp > 0
            )
            SELECT rank FROM ranked WHERE id = $1 LIMIT 1
          `,
          [userId]
        ),
        storage.raw(
          `
            WITH stats AS (
              SELECT
                u.id AS "userId",
                COUNT(r.id)::int AS "totalReferrals",
                COALESCE(SUM(r."totalCommission"), 0) AS "totalCommission"
              FROM "User" u
              JOIN "Referral" r ON r."referrerId" = u.id
              GROUP BY u.id
              HAVING COUNT(r.id) > 0
            ), ranked AS (
              SELECT
                *,
                ROW_NUMBER() OVER (
                  ORDER BY "totalReferrals" DESC, "totalCommission" DESC, "userId" ASC
                )::int AS rank
              FROM stats
            )
            SELECT rank FROM ranked WHERE "userId" = $1 LIMIT 1
          `,
          [userId]
        ),
        storage.getActivities(userId, 5),
      ]);

      const referralCounts = referralGroups.reduce(
        (acc, row) => {
          const count = row._count?._all || 0;
          if (row.level === 1) acc.level1 = count;
          if (row.level === 2) acc.level2 = count;
          if (row.level === 3) acc.level3 = count;
          return acc;
        },
        { level1: 0, level2: 0, level3: 0 }
      );

      let referredByUser: { username: string | null; referralCode: string | null } | null = null;
      if (user.referredBy) {
        referredByUser = await prisma.user.findFirst({
          where: {
            OR: [{ id: user.referredBy }, { referralCode: user.referredBy }],
          },
          select: { username: true, referralCode: true },
        });
      }

      const xp = user.xp || 0;
      const level = Math.floor(xp / 1000) + 1;
      const currentLevelXp = (level - 1) * 1000;
      const nextLevelXp = level * 1000;
      const xpIntoLevel = Math.max(0, xp - currentLevelXp);
      const xpRequiredForLevel = 1000;
      const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpRequiredForLevel) * 100));

      res.json({
        profile: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          profileImageUrl: user.profileImageUrl || null,
          referralCode: user.referralCode,
          referredBy: user.referredBy || null,
          referredByUsername: referredByUser?.username || null,
          referredByCode: referredByUser?.referralCode || null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        xp: {
          total: xp,
          level,
          currentLevelXp,
          nextLevelXp,
          xpIntoLevel,
          xpRequiredForLevel,
          progressPercent,
        },
        balance: {
          xnrtBalance: decimalValueToNumber(balance?.xnrtBalance),
          stakingBalance: decimalValueToNumber(balance?.stakingBalance),
          miningBalance: decimalValueToNumber(balance?.miningBalance),
          referralBalance: decimalValueToNumber(balance?.referralBalance),
          totalEarned: decimalValueToNumber(balance?.totalEarned),
        },
        referrals: {
          direct: referralCounts.level1,
          level2: referralCounts.level2,
          level3: referralCounts.level3,
          totalNetwork: referralCounts.level1 + referralCounts.level2 + referralCounts.level3,
          totalCommission: decimalValueToNumber(referralCommission._sum.totalCommission),
          rank: referralRankRows[0]?.rank ? toLeaderboardNumber(referralRankRows[0].rank) : null,
        },
        mining: {
          completedSessions: completedMiningStats._count._all,
          totalXpMined: completedMiningStats._sum.finalReward || 0,
          totalXnrtMined: decimalValueToNumber(balance?.miningBalance),
        },
        staking: {
          activeStakes: activeStakeStats._count._all,
          totalActiveStaked: decimalValueToNumber(activeStakeStats._sum.amount),
        },
        tasks: {
          assigned: assignedTaskCount,
          completed: completedTaskCount,
          totalActive: activeTaskCount,
          progressPercent: activeTaskCount > 0 ? Math.round((completedTaskCount / activeTaskCount) * 100) : 0,
        },
        achievements: {
          unlocked: unlockedAchievementCount,
          total: totalAchievementCount,
          progressPercent: totalAchievementCount > 0 ? Math.round((unlockedAchievementCount / totalAchievementCount) * 100) : 0,
        },
        leaderboard: {
          xpRank: leaderboardRows[0]?.rank ? toLeaderboardNumber(leaderboardRows[0].rank) : null,
          referralRank: referralRankRows[0]?.rank ? toLeaderboardNumber(referralRankRows[0].rank) : null,
        },
        checkin: {
          currentStreak: user.streak || 0,
          lastCheckIn: user.lastCheckIn || null,
          checkedInToday: isSameLocalDay(user.lastCheckIn),
        },
        recentActivities,
      });
    } catch (error) {
      console.error("Error fetching profile summary:", error);
      res.status(500).json({ message: "Failed to fetch profile summary" });
    }
  });

  app.patch("/api/profile", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const data = profileUpdateSchema.parse(req.body);
      const updateData: any = {};

      if (data.username !== undefined) {
        const existing = await prisma.user.findFirst({
          where: { username: data.username, NOT: { id: userId } },
          select: { id: true },
        });
        if (existing) {
          return res.status(409).json({ message: "Username is already taken" });
        }
        updateData.username = data.username;
      }

      if (data.firstName !== undefined) updateData.firstName = data.firstName || null;
      if (data.lastName !== undefined) updateData.lastName = data.lastName || null;
      if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl || null;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No profile fields provided" });
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      await storage.createActivity({
        userId,
        type: "profile_updated",
        description: "Updated profile information",
      });

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.firstName || null,
        lastName: updatedUser.lastName || null,
        profileImageUrl: updatedUser.profileImageUrl || null,
        referralCode: updatedUser.referralCode,
        referredBy: updatedUser.referredBy || null,
        emailVerified: updatedUser.emailVerified,
        isAdmin: updatedUser.isAdmin,
        xp: updatedUser.xp,
        level: updatedUser.level,
        streak: updatedUser.streak,
        lastCheckIn: updatedUser.lastCheckIn || null,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Profile stats route kept for backward compatibility with existing widgets
  app.get("/api/profile/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const [
        activeStakeStats,
        completedMiningStats,
        referralGroups,
        referralCommission,
        completedTaskCount,
        unlockedAchievementCount,
      ] = await Promise.all([
        prisma.stake.aggregate({
          where: { userId, status: "active" },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.miningSession.aggregate({
          where: { userId, status: "completed" },
          _count: { _all: true },
          _sum: { finalReward: true },
        }),
        prisma.referral.groupBy({
          by: ["level"],
          where: { referrerId: userId },
          _count: { _all: true },
        }),
        prisma.referral.aggregate({
          where: { referrerId: userId },
          _sum: { totalCommission: true },
        }),
        prisma.userTask.count({ where: { userId, completed: true } }),
        prisma.userAchievement.count({ where: { userId } }),
      ]);

      const totalReferrals = referralGroups.reduce((sum, row) => sum + (row._count?._all || 0), 0);

      res.json({
        totalReferrals,
        activeStakes: activeStakeStats._count._all,
        totalStaked: decimalValueToNumber(activeStakeStats._sum.amount),
        miningSessions: completedMiningStats._count._all,
        totalMined: completedMiningStats._sum.finalReward || 0,
        referralEarnings: decimalValueToNumber(referralCommission._sum.totalCommission),
        tasksCompleted: completedTaskCount,
        achievementsUnlocked: unlockedAchievementCount,
      });
    } catch (error) {
      console.error("Error fetching profile stats:", error);
      res.status(500).json({ message: "Failed to fetch profile stats" });
    }
  });

  // Daily check-in route
  app.post("/api/checkin", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      const now = new Date();
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
      const lastCheckInDay = lastCheckIn
        ? new Date(
            lastCheckIn.getFullYear(),
            lastCheckIn.getMonth(),
            lastCheckIn.getDate()
          )
        : null;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = 1;
      if (
        lastCheckInDay &&
        lastCheckInDay.getTime() === yesterday.getTime()
      ) {
        newStreak = (user.streak || 0) + 1;
      }

      const streakReward = Math.min(newStreak * 10, 100);
      const xpReward = Math.min(newStreak * 5, 50);

      if (
        lastCheckIn &&
        lastCheckInDay &&
        lastCheckInDay.getTime() === today.getTime()
      ) {
        return res.status(400).json({ message: "Already checked in today" });
      }

      const nextXp = (user.xp || 0) + xpReward;
      await storage.updateUser(userId, {
        lastCheckIn: now,
        streak: newStreak,
        xp: nextXp,
        level: Math.floor(nextXp / 1000) + 1,
      });

      const balance = await storage.getBalance(userId);
      if (balance) {
        await storage.updateBalance(userId, {
          xnrtBalance: (
            parseFloat(balance.xnrtBalance) + streakReward
          ).toString(),
          totalEarned: (
            parseFloat(balance.totalEarned) + streakReward
          ).toString(),
        });
      }

      await storage.createActivity({
        userId,
        type: "daily_checkin",
        description: `Day ${newStreak} streak! Earned ${streakReward} XNRT and ${xpReward} XP`,
      });

      await storage.checkAndUnlockAchievements(userId);

      res.json({
        streak: newStreak,
        xnrtReward: streakReward,
        xpReward,
        message: `Day ${newStreak} check-in complete!`,
      });
    } catch (error) {
      console.error("Error during check-in:", error);
      res.status(500).json({ message: "Failed to check in" });
    }
  });

  // Check-in history route
  app.get("/api/checkin/history", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const { year, month } = req.query;

      const now = new Date();
      const targetYear = year
        ? parseInt(year as string, 10)
        : now.getFullYear();

      let targetMonth: number;
      if (typeof month !== "undefined") {
        const monthNum = parseInt(month as string, 10); // expect 1-12 from client
        const clamped = Math.min(Math.max(monthNum, 1), 12);
        targetMonth = clamped - 1; // JS Date months are 0-based
      } else {
        targetMonth = now.getMonth();
      }

      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(
        targetYear,
        targetMonth + 1,
        0,
        23,
        59,
        59,
        999
      );

      const checkinActivities = await prisma.activity.findMany({
        where: {
          userId,
          type: "daily_checkin",
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: "asc" },
      });

      const checkinDates = checkinActivities.map(
        (activity: { createdAt: Date | null }) =>
          new Date(activity.createdAt!).toISOString().split("T")[0]
      );

      res.json({ dates: checkinDates, year: targetYear, month: targetMonth });
    } catch (error) {
      console.error("Error fetching check-in history:", error);
      res.status(500).json({ message: "Failed to fetch check-in history" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allDeposits = await storage.getAllTransactions("deposit");
      const allWithdrawals = await storage.getAllTransactions("withdrawal");
      const activeStakes = await storage.getAllActiveStakes();

      const pendingDeposits = allDeposits.filter(
        (d) => d.status === "pending"
      );
      const pendingWithdrawals = allWithdrawals.filter(
        (w) => w.status === "pending"
      );

      const totalDeposits = allDeposits
        .filter((d) => d.status === "approved")
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const totalWithdrawals = allWithdrawals
        .filter((w) => w.status === "approved")
        .reduce((sum, w) => sum + parseFloat(w.amount), 0);

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const todayDeposits = allDeposits
        .filter(
          (d) =>
            d.status === "approved" &&
            d.createdAt &&
            new Date(d.createdAt) >= today
        )
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);

      const todayWithdrawals = allWithdrawals
        .filter(
          (w) =>
            w.status === "approved" &&
            w.createdAt &&
            new Date(w.createdAt) >= today
        )
        .reduce((sum, w) => sum + parseFloat(w.amount), 0);

      const todayNewUsers = allUsers.filter(
        (u) => u.createdAt && new Date(u.createdAt) >= today
      ).length;

      const activeStakesCount = activeStakes.length;

      res.json({
        totalUsers: allUsers.length,
        totalDeposits: totalDeposits.toString(),
        totalWithdrawals: totalWithdrawals.toString(),
        pendingDepositsCount: pendingDeposits.length,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        todayDeposits: todayDeposits.toString(),
        todayWithdrawals: todayWithdrawals.toString(),
        todayNewUsers,
        activeStakesCount,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get(
    "/api/admin/deposits/pending",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const pendingDeposits = await storage.getPendingTransactions("deposit");
        res.json(pendingDeposits);
      } catch (error) {
        console.error("Error fetching pending deposits:", error);
        res.status(500).json({ message: "Failed to fetch pending deposits" });
      }
    }
  );

  app.get(
    "/api/admin/withdrawals/pending",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const pendingWithdrawals = await storage.getPendingTransactions(
          "withdrawal"
        );
        res.json(pendingWithdrawals);
      } catch (error) {
        console.error("Error fetching pending withdrawals:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch pending withdrawals" });
      }
    }
  );

  // Verify deposit on-chain (admin)
  app.post(
    "/api/admin/deposits/:id/verify",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const deposit = await storage.getTransactionById(id);

        if (!deposit || deposit.type !== "deposit") {
          return res.status(404).json({ message: "Deposit not found" });
        }
        if (!deposit.transactionHash) {
          return res.status(400).json({ message: "No transaction hash provided" });
        }

        const result = await verifyBscUsdtDeposit({
          txHash: deposit.transactionHash,
          expectedTo: deposit.walletAddress || process.env.XNRT_WALLET!,
          minAmount: deposit.usdtAmount
            ? parseFloat(deposit.usdtAmount)
            : undefined,
          requiredConf: parseInt(
            process.env.BSC_CONFIRMATIONS ?? "12",
            10
          ),
        });

        // persist verification state; admin UI can decide next step
        await prisma.transaction.update({
          where: { id },
          data: {
            verified: !!result.verified,
            confirmations: result.confirmations ?? 0,
            verificationData: {
              verifiedAt: new Date().toISOString(),
              reason: result.reason || null,
              amountOnChain: result.amountOnChain ?? null,
            } as any,
          },
        });

        res.json(result);
      } catch (error) {
        console.error("Error verifying deposit:", error);
        res.status(500).json({ message: "Failed to verify deposit" });
      }
    }
  );

  // Approve deposit (admin) – allows overriding failed/unverified as long as not already approved/rejected
  app.post(
    "/api/admin/deposits/:id/approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes, force } = req.body;
        const deposit = await storage.getTransactionById(id);

        if (!deposit || deposit.type !== "deposit") {
          return res.status(404).json({ message: "Deposit not found" });
        }

        // Only block if already approved or rejected
        if (
          deposit.status === "approved" ||
          deposit.status === "rejected"
        ) {
          return res.status(400).json({ message: "Deposit already processed" });
        }

        // Scanner bypass – if not verified OR admin explicitly forces
        const override = !deposit.verified || !!force;

        await prisma.$transaction(async (tx) => {
          // Credit user balance
          await tx.balance.upsert({
            where: { userId: deposit.userId },
            create: {
              userId: deposit.userId,
              xnrtBalance: new Prisma.Decimal(deposit.amount),
              totalEarned: new Prisma.Decimal(deposit.amount),
            },
            update: {
              xnrtBalance: { increment: new Prisma.Decimal(deposit.amount) },
              totalEarned: { increment: new Prisma.Decimal(deposit.amount) },
            },
          });

          // Mark transaction approved
          await tx.transaction.update({
            where: { id },
            data: {
              status: "approved",
              adminNotes: notes ?? deposit.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
              verificationData: deposit.verificationData as any,
            },
          });

          if (override) {
            await tx.activity.create({
              data: {
                userId: req.authUser!.id,
                type: "ADMIN_DEPOSIT_OVERRIDE",
                description: `Force-approved deposit ${id} for user ${deposit.userId} (scanner: ${
                  deposit.verified ? "verified" : "failed/unverified"
                })`,
              },
            });
          }
        });

        // Referral commissions + activity + notification
        await storage.distributeReferralCommissions(
          deposit.userId,
          parseFloat(deposit.amount),
          `tx:${id}`
        );

        await storage.createActivity({
          userId: deposit.userId,
          type: "deposit_approved",
          description: `Deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT approved`,
        });

        void notifyUser(deposit.userId, {
          type: "deposit_approved",
          title: "💰 Deposit Approved!",
          message: `Your deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT has been approved and credited to your account`,
          url: "/wallet",
          metadata: { amount: deposit.amount, transactionId: id },
        }).catch((err) => {
          console.error(
            "Error sending deposit notification (non-blocking):",
            err
          );
        });

        res.json({ ok: true, override });
      } catch (error) {
        console.error("Error approving deposit:", error);
        return res.status(500).json({ message: "Failed to approve deposit" });
      }
    }
  );

  // Reject deposit (admin) – also works for failed/unverified, blocks only approved/rejected
  app.post(
    "/api/admin/deposits/:id/reject",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes } = req.body;
        const deposit = await storage.getTransactionById(id);

        if (!deposit || deposit.type !== "deposit") {
          return res.status(404).json({ message: "Deposit not found" });
        }

        if (
          deposit.status === "approved" ||
          deposit.status === "rejected"
        ) {
          return res.status(400).json({ message: "Deposit already processed" });
        }

        await storage.updateTransaction(id, {
          status: "rejected",
          adminNotes: notes ?? deposit.adminNotes,
        });

        await storage.createActivity({
          userId: deposit.userId,
          type: "deposit_rejected",
          description: `Deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT rejected${
            notes ? ` - ${notes}` : ""
          }`,
        });

        res.json({ message: "Deposit rejected" });
      } catch (error) {
        console.error("Error rejecting deposit:", error);
        res.status(500).json({ message: "Failed to reject deposit" });
      }
    }
  );

  // Bulk approve deposits – same override logic, skip already approved/rejected
  app.post(
    "/api/admin/deposits/bulk-approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { depositIds, notes } = req.body;

        if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
          return res.status(400).json({ message: "Invalid deposit IDs" });
        }

        const successful: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        const errors: string[] = [];

        for (const id of depositIds) {
          try {
            const deposit = await storage.getTransactionById(id);

            if (!deposit || deposit.type !== "deposit") {
              throw new Error(`Deposit ${id} not found`);
            }
            if (
              deposit.status === "approved" ||
              deposit.status === "rejected"
            ) {
              throw new Error(`Deposit ${id} already processed`);
            }

            const override = !deposit.verified;

            await prisma.$transaction(async (tx) => {
              await tx.balance.upsert({
                where: { userId: deposit.userId },
                create: {
                  userId: deposit.userId,
                  xnrtBalance: new Prisma.Decimal(deposit.amount),
                  totalEarned: new Prisma.Decimal(deposit.amount),
                },
                update: {
                  xnrtBalance: {
                    increment: new Prisma.Decimal(deposit.amount),
                  },
                  totalEarned: {
                    increment: new Prisma.Decimal(deposit.amount),
                  },
                },
              });

              await tx.transaction.update({
                where: { id },
                data: {
                  status: "approved",
                  adminNotes: notes ?? deposit.adminNotes,
                  approvedBy: req.authUser!.id,
                  approvedAt: new Date(),
                },
              });

              if (override) {
                await tx.activity.create({
                  data: {
                    userId: req.authUser!.id,
                    type: "ADMIN_DEPOSIT_OVERRIDE",
                    description: `Force-approved deposit ${id} for user ${deposit.userId} via bulk`,
                  },
                });
              }
            });

            await storage.distributeReferralCommissions(
              deposit.userId,
              parseFloat(deposit.amount),
              `tx:${id}`
            );

            await storage.createActivity({
              userId: deposit.userId,
              type: "deposit_approved",
              description: `Deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT approved${
                notes ? ` - ${notes}` : ""
              }`,
            });

            void notifyUser(deposit.userId, {
              type: "deposit_approved",
              title: "💰 Deposit Approved!",
              message: `Your deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT has been approved and credited to your account`,
              url: "/wallet",
              metadata: { amount: deposit.amount, transactionId: id },
            }).catch((err) => {
              console.error(
                "Error sending bulk deposit notification (non-blocking):",
                err
              );
            });

            successful.push(id);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            failed.push({ id, error: errorMessage });
            errors.push(`${id}: ${errorMessage}`);
          }
        }

        res.json({
          approved: successful.length,
          failed: failed.length,
          total: depositIds.length,
          successful,
          failures: failed,
          errors,
        });
      } catch (error) {
        console.error("Error bulk approving deposits:", error);
        res.status(500).json({ message: "Failed to process bulk approval" });
      }
    }
  );

  // Bulk reject deposits – allow rejecting pending/failed/unverified, block only approved/rejected
  app.post(
    "/api/admin/deposits/bulk-reject",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { depositIds, notes } = req.body;

        if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
          return res.status(400).json({ message: "Invalid deposit IDs" });
        }

        const successful: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        const errors: string[] = [];

        for (const id of depositIds) {
          try {
            const deposit = await storage.getTransactionById(id);

            if (!deposit || deposit.type !== "deposit") {
              throw new Error(`Deposit ${id} not found`);
            }
            if (
              deposit.status === "approved" ||
              deposit.status === "rejected"
            ) {
              throw new Error(`Deposit ${id} already processed`);
            }

            await storage.updateTransaction(id, {
              status: "rejected",
              adminNotes: notes || deposit.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
            });

            await storage.createActivity({
              userId: deposit.userId,
              type: "deposit_rejected",
              description: `Deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT rejected${
                notes ? ` - ${notes}` : ""
              }`,
            });

            successful.push(id);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            failed.push({ id, error: errorMessage });
            errors.push(`${id}: ${errorMessage}`);
          }
        }

        res.json({
          rejected: successful.length,
          failed: failed.length,
          total: depositIds.length,
          successful,
          failures: failed,
          errors,
        });
      } catch (error) {
        console.error("Error bulk rejecting deposits:", error);
        res.status(500).json({ message: "Failed to process bulk rejection" });
      }
    }
  );

  // Unmatched Deposits Admin API
  app.get(
    "/api/admin/unmatched-deposits",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const unmatched = await prisma.unmatchedDeposit.findMany({
          where: { matched: false },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        res.json(unmatched);
      } catch (error) {
        console.error("Error fetching unmatched deposits:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch unmatched deposits" });
      }
    }
  );

  app.post(
    "/api/admin/unmatched-deposits/:id/match",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).json({ message: "User ID required" });
        }

        const unmatchedDeposit = await prisma.unmatchedDeposit.findUnique({
          where: { id },
        });
        if (!unmatchedDeposit) {
          return res
            .status(404)
            .json({ message: "Unmatched deposit not found" });
        }
        if ((unmatchedDeposit as any).resolved) {
          return res
            .status(400)
            .json({ message: "Deposit already matched" });
        }

        const usdtAmount = parseFloat(unmatchedDeposit.amount.toString());
        const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
        const platformFeeBps = parseFloat(process.env.PLATFORM_FEE_BPS || "0");
        const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * xnrtRate;

        const txHash =
          (unmatchedDeposit as any).txHash ??
          (unmatchedDeposit as any).transactionHash;

        await prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              userId,
              type: "deposit",
              amount: new Prisma.Decimal(xnrtAmount),
              usdtAmount: new Prisma.Decimal(usdtAmount),
              transactionHash: txHash,
              walletAddress: unmatchedDeposit.fromAddress,
              status: "approved",
              verified: true,
              confirmations: unmatchedDeposit.confirmations ?? 0,
              verificationData: {
                manualMatch: true,
                matchedBy: req.authUser!.id,
                matchedAt: new Date().toISOString(),
              } as any,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
            },
          });

          await tx.balance.upsert({
            where: { userId },
            create: {
              userId,
              xnrtBalance: new Prisma.Decimal(xnrtAmount),
              totalEarned: new Prisma.Decimal(xnrtAmount),
            },
            update: {
              xnrtBalance: { increment: new Prisma.Decimal(xnrtAmount) },
              totalEarned: { increment: new Prisma.Decimal(xnrtAmount) },
            },
          });

          await tx.unmatchedDeposit.update({
            where: { id },
            data: { resolved: true } as any,
          });
        });

        // Referral commissions + activity for matched deposit
        await storage.distributeReferralCommissions(
          userId,
          xnrtAmount,
          `unmatched:${id}`
        );
        await storage.createActivity({
          userId,
          type: "deposit_approved",
          description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via manual match`,
        });

        res.json({
          message: "Deposit matched and credited successfully",
        });
      } catch (error) {
        console.error("Error matching deposit:", error);
        res.status(500).json({ message: "Failed to match deposit" });
      }
    }
  );

  // Deposit Reports Admin API
  app.get(
    "/api/admin/deposit-reports",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const reports = await prisma.depositReport.findMany({
          where: { status: "pending" },
          include: { user: { select: { email: true, username: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        res.json(reports);
      } catch (error) {
        console.error("Error fetching deposit reports:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch deposit reports" });
      }
    }
  );

  app.post(
    "/api/admin/deposit-reports/:id/resolve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { resolution, adminNotes } = req.body;

        if (!resolution || !["approved", "rejected"].includes(resolution)) {
          return res.status(400).json({ message: "Invalid resolution" });
        }

        const report = await prisma.depositReport.findUnique({
          where: { id },
        });
        if (!report) {
          return res.status(404).json({ message: "Report not found" });
        }
        if (report.status !== "pending") {
          return res
            .status(400)
            .json({ message: "Report already resolved" });
        }

        if (resolution === "approved") {
          const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
          const platformFeeBps = parseFloat(
            process.env.PLATFORM_FEE_BPS || "0"
          );
          const usdtAmount = report.amount
            ? parseFloat(report.amount.toString())
            : 0;
          const netUsdt = usdtAmount * (1 - platformFeeBps / 10_000);
          const xnrtAmount = netUsdt * xnrtRate;

          await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
              data: {
                userId: report.userId!,
                type: "deposit",
                amount: new Prisma.Decimal(xnrtAmount),
                usdtAmount: new Prisma.Decimal(usdtAmount),
                transactionHash: report.txHash,
                status: "approved",
                adminNotes: adminNotes || "Credited from deposit report",
                approvedBy: req.authUser!.id,
                approvedAt: new Date(),
              },
            });

            await tx.balance.upsert({
              where: { userId: report.userId! },
              create: {
                userId: report.userId!,
                xnrtBalance: new Prisma.Decimal(xnrtAmount),
                totalEarned: new Prisma.Decimal(xnrtAmount),
              },
              update: {
                xnrtBalance: {
                  increment: new Prisma.Decimal(xnrtAmount),
                },
                totalEarned: {
                  increment: new Prisma.Decimal(xnrtAmount),
                },
              },
            });

            await tx.depositReport.update({
              where: { id },
              data: {
                status: "approved",
                resolvedAt: new Date(),
                notes: adminNotes || null,
              },
            });
          });

          // Referral commissions + activity for approved report
          await storage.distributeReferralCommissions(
            report.userId!,
            xnrtAmount,
            `deposit-report:${id}`
          );
          await storage.createActivity({
            userId: report.userId!,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved from deposit report`,
          });
        } else {
          await prisma.depositReport.update({
            where: { id },
            data: {
              status: "rejected",
              resolvedAt: new Date(),
              notes: adminNotes || null,
            },
          });
        }

        res.json({ message: `Report ${resolution} successfully` });
      } catch (error) {
        console.error("Error resolving deposit report:", error);
        res.status(500).json({ message: "Failed to resolve report" });
      }
    }
  );

  // Recalculate all referral commissions from approved deposits
  app.post(
    "/api/admin/reconcile-referrals",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (_req, res) => {
      try {
        console.log(
          "[RECONCILE] Starting referral commission reconciliation..."
        );

        const approvedDeposits = await storage.raw(`
        SELECT id, "userId", amount, "createdAt"
        FROM "Transaction"
        WHERE type = 'deposit' AND status = 'approved'
        ORDER BY "createdAt" ASC
      `);

        console.log(
          `[RECONCILE] Found ${approvedDeposits.length} approved deposits to process`
        );

        await storage.raw(`DELETE FROM "ReferralCommission"`);
        console.log("[RECONCILE] Cleared referral commission ledger only");

        await storage.raw(`UPDATE "Referral" SET "totalCommission" = 0`);
        console.log("[RECONCILE] Preserved referral tree and reset referral totals");

        await storage.raw(`UPDATE "Balance" SET "referralBalance" = 0`);
        console.log("[RECONCILE] Reset referral balances");

        let totalProcessed = 0;
        for (const deposit of approvedDeposits) {
          const amount = parseFloat(deposit.amount);
          console.log(
            `[RECONCILE] Processing deposit ${deposit.id}: ${amount} XNRT for user ${deposit.userId}`
          );
          await storage.distributeReferralCommissions(
            deposit.userId,
            amount,
            `tx:${deposit.id}`,
            { creditTotalEarned: false }
          );
          totalProcessed++;
        }

        console.log(
          `[RECONCILE] Reconciliation complete. Processed ${totalProcessed} deposits.`
        );

        res.json({
          message: "Referral commissions reconciled successfully",
          depositsProcessed: totalProcessed,
        });
      } catch (error) {
        console.error("Error reconciling referrals:", error);
        res.status(500).json({ message: "Failed to reconcile referrals" });
      }
    }
  );

  // Admin approve/reject withdrawals
  app.post(
    "/api/admin/withdrawals/:id/approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes } = req.body || {};
        const withdrawal = await storage.getTransactionById(id);

        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }

        if (withdrawal.status === "approved") {
          return res.json({
            message: "Withdrawal already approved",
            onChainTxHash: withdrawal.transactionHash ?? null,
            explorerUrl: withdrawal.transactionHash
              ? getTxExplorerUrl(withdrawal.transactionHash)
              : null,
          });
        }

        if (withdrawal.status !== "pending" && withdrawal.status !== "processing") {
          return res.status(400).json({ message: "Withdrawal already processed" });
        }

        const withdrawAmount = Number(withdrawal.amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res.status(400).json({ message: "Invalid withdrawal amount" });
        }

        const normalizedWallet = normalizeBscAddress(withdrawal.walletAddress);
        if (!normalizedWallet) {
          return res.status(400).json({ message: "Withdrawal has an invalid destination wallet" });
        }

        const sourceBalanceKey = getBalanceSourceKey(withdrawal.source);
        const meta = (withdrawal.verificationData || {}) as Record<string, any>;
        const alreadyReserved = meta.reservedBalance === true;
        let onChainTxHash: string | undefined = withdrawal.transactionHash || undefined;

        // Older pending withdrawals may not have been reserved at request time.
        // Reserve them once before approval so admin approval cannot overdraw balances.
        if (withdrawal.status === "pending" && !alreadyReserved) {
          await prisma.$transaction(async (tx) => {
            const liveBalance = await tx.balance.findUnique({
              where: { userId: withdrawal.userId },
            });
            const liveAmount = decimalValueToNumber((liveBalance as any)?.[sourceBalanceKey]);
            if (withdrawAmount > liveAmount) {
              throw new Error(`Insufficient balance: need ${withdrawAmount}, have ${liveAmount}`);
            }
            const locked = await tx.transaction.updateMany({
              where: { id, status: "pending" },
              data: {
                status: "processing",
                verificationData: {
                  ...(meta as any),
                  reservedBalance: true,
                  reservedAt: new Date().toISOString(),
                  reservedBy: req.authUser!.id,
                  sourceBalanceKey,
                } as any,
              },
            });
            if (locked.count === 0) throw new Error("Withdrawal is already being processed");
            await tx.balance.update({
              where: { userId: withdrawal.userId },
              data: { [sourceBalanceKey]: new Prisma.Decimal(liveAmount - withdrawAmount) },
            });
          });
        } else if (withdrawal.status === "pending") {
          const locked = await prisma.transaction.updateMany({
            where: { id, status: "pending" },
            data: { status: "processing" },
          });
          if (locked.count === 0) {
            return res.status(409).json({
              message: "Withdrawal is currently being processed. Retry after a moment.",
            });
          }
        }

        if (isTokenServiceReady() && !onChainTxHash) {
          try {
            onChainTxHash = await mintXNRT(normalizedWallet, withdrawal.netAmount?.toString() || withdrawal.amount.toString());
            await prisma.transaction.update({
              where: { id },
              data: { transactionHash: onChainTxHash },
            });
          } catch (mintErr: unknown) {
            await prisma.transaction.update({ where: { id }, data: { status: "pending" } });
            const msg = mintErr instanceof Error ? mintErr.message : String(mintErr);
            console.error(`[Withdrawal] On-chain mint failed; reserved balance kept pending: ${msg}`);
            throw mintErr;
          }
        }

        await prisma.transaction.update({
          where: { id },
          data: {
            status: "approved",
            ...(onChainTxHash ? { transactionHash: onChainTxHash } : {}),
            approvedBy: req.authUser!.id,
            approvedAt: new Date(),
            adminNotes: notes ?? withdrawal.adminNotes,
            verificationData: {
              ...((withdrawal.verificationData || {}) as any),
              reservedBalance: true,
              approvedAt: new Date().toISOString(),
              approvedBy: req.authUser!.id,
              withdrawalMode: getWalletRates().withdrawalMode,
              withdrawalToken: getWalletRates().withdrawalToken,
            } as any,
          },
        });

        await storage.createActivity({
          userId: withdrawal.userId,
          type: "withdrawal_approved",
          description: `Withdrawal of ${withdrawAmount.toLocaleString()} XNRT approved${
            onChainTxHash ? ` – tx: ${onChainTxHash}` : ""
          }`,
        });

        res.json({
          message: "Withdrawal approved successfully",
          onChainTxHash: onChainTxHash ?? null,
          explorerUrl: onChainTxHash ? getTxExplorerUrl(onChainTxHash) : null,
        });
      } catch (error: any) {
        console.error("Error approving withdrawal:", error);
        res.status(500).json({ message: error?.message || "Failed to approve withdrawal" });
      }
    }
  );

  app.post(
    "/api/admin/withdrawals/:id/reject",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { notes } = req.body || {};
        const withdrawal = await storage.getTransactionById(id);

        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }
        if (!["pending", "processing"].includes(withdrawal.status)) {
          return res.status(400).json({ message: "Withdrawal already processed" });
        }
        if (withdrawal.status === "processing" && withdrawal.transactionHash) {
          return res.status(400).json({
            message: "Withdrawal already has an on-chain transaction. Approve/finalize it instead of rejecting.",
          });
        }

        const withdrawAmount = Number(withdrawal.amount);
        const sourceBalanceKey = getBalanceSourceKey(withdrawal.source);
        const meta = (withdrawal.verificationData || {}) as Record<string, any>;
        const shouldRefund = meta.reservedBalance === true;

        await prisma.$transaction(async (tx) => {
          if (shouldRefund) {
            await tx.balance.upsert({
              where: { userId: withdrawal.userId },
              create: {
                userId: withdrawal.userId,
                [sourceBalanceKey]: new Prisma.Decimal(withdrawAmount),
              } as any,
              update: {
                [sourceBalanceKey]: { increment: new Prisma.Decimal(withdrawAmount) },
              } as any,
            });
          }

          await tx.transaction.update({
            where: { id },
            data: {
              status: "rejected",
              adminNotes: notes ?? withdrawal.adminNotes,
              approvedBy: req.authUser!.id,
              approvedAt: new Date(),
              verificationData: {
                ...(meta as any),
                refundedReservedBalance: shouldRefund,
                rejectedAt: new Date().toISOString(),
                rejectedBy: req.authUser!.id,
              } as any,
            },
          });
        });

        await storage.createActivity({
          userId: withdrawal.userId,
          type: "withdrawal_rejected",
          description: `Withdrawal of ${withdrawAmount.toLocaleString()} XNRT rejected${
            shouldRefund ? " and reserved balance refunded" : ""
          }${notes ? ` - ${notes}` : ""}`,
        });

        res.json({ message: "Withdrawal rejected", refunded: shouldRefund });
      } catch (error: any) {
        console.error("Error rejecting withdrawal:", error);
        res.status(500).json({ message: error?.message || "Failed to reject withdrawal" });
      }
    }
  );

  // Admin users list with balances & stats
  app.get(
    "/api/admin/users",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const allUsers = await storage.getAllUsers();

        const usersWithData = await Promise.all(
          allUsers.map(async (user) => {
            const balance = await storage.getBalance(user.id);
            const stakes = await storage.getStakes(user.id);
            const referrals = await storage.getReferralsByReferrer(user.id);
            const transactions = await storage.getTransactionsByUser(
              user.id
            );

            const activeStakes = stakes.filter(
              (s) => s.status === "active"
            ).length;
            const totalStaked = stakes
              .filter((s) => s.status === "active")
              .reduce((sum, s) => sum + parseFloat(s.amount), 0);

            const depositCount = transactions.filter(
              (t) => t.type === "deposit" && t.status === "approved"
            ).length;
            const withdrawalCount = transactions.filter(
              (t) => t.type === "withdrawal" && t.status === "approved"
            ).length;

            return {
              id: user.id,
              email: user.email,
              username: user.username,
              referralCode: user.referralCode,
              isAdmin: user.isAdmin,
              xp: user.xp,
              level: user.level,
              streak: user.streak,
              createdAt: user.createdAt,
              balance: balance
                ? {
                    xnrtBalance: balance.xnrtBalance,
                    stakingBalance: balance.stakingBalance,
                    miningBalance: balance.miningBalance,
                    referralBalance: balance.referralBalance,
                    totalEarned: balance.totalEarned,
                  }
                : null,
              stats: {
                activeStakes,
                totalStaked: totalStaked.toString(),
                referralsCount: referrals.length,
                depositCount,
                withdrawalCount,
              },
            };
          })
        );

        res.json(usersWithData);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // Admin Analytics
  app.get(
    "/api/admin/analytics",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const allTransactions = await storage.getAllTransactions();
        const allUsers = await storage.getAllUsers();
        const allStakes = await storage.getAllActiveStakes();

        const dailyData: Record<
          string,
          { deposits: number; withdrawals: number; revenue: number }
        > = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        allTransactions.forEach((tx) => {
          if (tx.createdAt) {
            const txDate = new Date(tx.createdAt);
            if (txDate >= thirtyDaysAgo) {
              const dateKey = txDate.toISOString().split("T")[0];
              if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                  deposits: 0,
                  withdrawals: 0,
                  revenue: 0,
                };
              }

              if (tx.type === "deposit" && tx.status === "approved") {
                dailyData[dateKey].deposits += parseFloat(tx.amount);
              } else if (
                tx.type === "withdrawal" &&
                tx.status === "approved"
              ) {
                dailyData[dateKey].withdrawals += parseFloat(tx.amount);
                dailyData[dateKey].revenue +=
                  parseFloat(tx.amount) * 0.02; // 2% fee
              }
            }
          }
        });

        const dailyUsers: Record<string, number> = {};
        allUsers.forEach((user) => {
          if (user.createdAt) {
            const userDate = new Date(user.createdAt);
            if (userDate >= thirtyDaysAgo) {
              const dateKey = userDate.toISOString().split("T")[0];
              dailyUsers[dateKey] = (dailyUsers[dateKey] || 0) + 1;
            }
          }
        });

        const stakingTiers = {
          "Royal Sapphire": 0,
          "Legendary Emerald": 0,
          "Imperial Platinum": 0,
          "Mythic Diamond": 0,
        };

        allStakes.forEach((stake) => {
          const amount = parseFloat(stake.amount);
          if (amount >= 100000) stakingTiers["Mythic Diamond"]++;
          else if (amount >= 50000) stakingTiers["Imperial Platinum"]++;
          else if (amount >= 10000) stakingTiers["Legendary Emerald"]++;
          else stakingTiers["Royal Sapphire"]++;
        });

        const [balancesAgg, referralsAgg] = await Promise.all([
          prisma.balance.aggregate({
            _sum: { referralBalance: true },
          }),
          prisma.referral.groupBy({
            by: ["referrerId"],
            _count: { referrerId: true },
          }),
        ]);

        const totalReferralBalance = balancesAgg._sum.referralBalance || 0;
        const activeReferrers = referralsAgg.length;
        const totalReferrals = referralsAgg.reduce(
          (sum, r) => sum + (r._count.referrerId || 0),
          0
        );

        const referralStats = {
          totalCommissions: Number(totalReferralBalance),
          totalReferrals,
          activeReferrers,
        };

        const totalRevenue = Object.values(dailyData).reduce(
          (sum, day) => sum + day.revenue,
          0
        );

        res.json({
          dailyTransactions: Object.entries(dailyData)
            .map(([date, data]) => ({
              date,
              deposits: data.deposits,
              withdrawals: data.withdrawals,
              revenue: data.revenue,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          userGrowth: Object.entries(dailyUsers)
            .map(([date, count]) => ({ date, newUsers: count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          stakingTiers,
          referralStats,
          totalRevenue,
          totalUsers: allUsers.length,
          totalStakes: allStakes.length,
        });
      } catch (error) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );

  // Admin Real-time Analytics
  app.get(
    "/api/admin/analytics/realtime",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const activeUsers = await prisma.activity.groupBy({
          by: ["userId"],
          where: { createdAt: { gte: fifteenMinutesAgo } },
        });

        const todayDeposits = await prisma.transaction.aggregate({
          where: {
            type: "deposit",
            status: "approved",
            createdAt: { gte: startOfToday },
          },
          _count: true,
          _sum: { amount: true },
        });

        const todayWithdrawals = await prisma.transaction.aggregate({
          where: {
            type: "withdrawal",
            status: "approved",
            createdAt: { gte: startOfToday },
          },
          _count: true,
          _sum: { amount: true },
        });

        const [pendingDeposits, pendingWithdrawals] = await Promise.all([
          prisma.transaction.count({
            where: { type: "deposit", status: "pending" },
          }),
          prisma.transaction.count({
            where: { type: "withdrawal", status: "pending" },
          }),
        ]);

        res.json({
          activeUsers: activeUsers.length,
          todayDeposits: {
            count: todayDeposits._count,
            total: Number(todayDeposits._sum.amount || 0),
          },
          todayWithdrawals: {
            count: todayWithdrawals._count,
            total: Number(todayWithdrawals._sum.amount || 0),
          },
          pendingTransactions: {
            deposits: pendingDeposits,
            withdrawals: pendingWithdrawals,
            total: pendingDeposits + pendingWithdrawals,
          },
        });
      } catch (error) {
        console.error("Error fetching real-time analytics:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch real-time analytics" });
      }
    }
  );

  // Admin Analytics Export
  app.get(
    "/api/admin/analytics/export",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const format = (req.query.format as string) || "csv";

        const allTransactions = await storage.getAllTransactions();
        const allUsers = await storage.getAllUsers();
        const allStakes = await storage.getAllActiveStakes();

        const dailyData: Record<
          string,
          { deposits: number; withdrawals: number; revenue: number }
        > = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        allTransactions.forEach((tx) => {
          if (tx.createdAt) {
            const txDate = new Date(tx.createdAt);
            if (txDate >= thirtyDaysAgo) {
              const dateKey = txDate.toISOString().split("T")[0];
              if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                  deposits: 0,
                  withdrawals: 0,
                  revenue: 0,
                };
              }

              if (tx.type === "deposit" && tx.status === "approved") {
                dailyData[dateKey].deposits += parseFloat(tx.amount);
              } else if (
                tx.type === "withdrawal" &&
                tx.status === "approved"
              ) {
                dailyData[dateKey].withdrawals += parseFloat(tx.amount);
                dailyData[dateKey].revenue +=
                  parseFloat(tx.amount) * 0.02;
              }
            }
          }
        });

        const totalRevenue = Object.values(dailyData).reduce(
          (sum, day) => sum + day.revenue,
          0
        );

        if (format === "csv") {
          let csv = "Date,Deposits (XNRT),Withdrawals (XNRT),Revenue (XNRT)\n";
          Object.entries(dailyData)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([date, data]) => {
              csv += `${date},${data.deposits},${data.withdrawals},${data.revenue}\n`;
            });

          csv += `\nSummary\n`;
          csv += `Total Users,${allUsers.length}\n`;
          csv += `Total Active Stakes,${allStakes.length}\n`;
          csv += `Total Revenue (30 days),${totalRevenue}\n`;

          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=xnrt-analytics-${
              new Date().toISOString().split("T")[0]
            }.csv`
          );
          res.send(csv);
        } else {
          const jsonData = {
            exportDate: new Date().toISOString(),
            summary: {
              totalUsers: allUsers.length,
              totalActiveStakes: allStakes.length,
              totalRevenue30Days: totalRevenue,
            },
            dailyTransactions: Object.entries(dailyData)
              .map(([date, data]) => ({
                date,
                deposits: data.deposits,
                withdrawals: data.withdrawals,
                revenue: data.revenue,
              }))
              .sort((a, b) => a.date.localeCompare(b.date)),
          };

          res.setHeader("Content-Type", "application/json");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=xnrt-analytics-${
              new Date().toISOString().split("T")[0]
            }.json`
          );
          res.json(jsonData);
        }
      } catch (error) {
        console.error("Error exporting analytics:", error);
        res.status(500).json({ message: "Failed to export analytics" });
      }
    }
  );

  // Admin Activity Logs
  app.get(
    "/api/admin/activities",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;

        const adminUsers = await prisma.user.findMany({
          where: { isAdmin: true },
          select: { id: true },
        });
        const adminUserIds = adminUsers.map((u) => u.id);

        const activities = await prisma.activity.findMany({
          where: {
            OR: [
              { userId: { in: adminUserIds } },
              {
                type: {
                  in: [
                    "deposit_approved",
                    "deposit_rejected",
                    "withdrawal_approved",
                    "withdrawal_rejected",
                  ],
                },
              },
            ],
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                isAdmin: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        res.json(activities);
      } catch (error) {
        console.error("Error fetching admin activities:", error);
        res.status(500).json({ message: "Failed to fetch admin activities" });
      }
    }
  );

  // Platform Info
  app.get(
    "/api/admin/info",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const [
          totalUsers,
          totalDeposits,
          totalWithdrawals,
          totalStakes,
          totalActivities,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.transaction.count({ where: { type: "deposit" } }),
          prisma.transaction.count({ where: { type: "withdrawal" } }),
          prisma.stake.count(),
          prisma.activity.count(),
        ]);

        const stakingTiers = [
          {
            name: "Royal Sapphire",
            min: 50000,
            max: 1000000,
            apy: 402,
            duration: 15,
          },
          {
            name: "Legendary Emerald",
            min: 10000,
            max: 10000000,
            apy: 511,
            duration: 30,
          },
          {
            name: "Imperial Platinum",
            min: 5000,
            max: 10000000,
            apy: 547,
            duration: 47,
          },
          {
            name: "Mythic Diamond",
            min: 100,
            max: 10000000,
            apy: 730,
            duration: 90,
          },
        ];

        res.json({
          platform: {
            name: "XNRT",
            version: "1.0.0",
            environment: process.env.NODE_ENV || "development",
          },
          statistics: {
            totalUsers,
            totalDeposits,
            totalWithdrawals,
            totalStakes,
            totalActivities,
          },
          configuration: {
            stakingTiers,
            depositRate: 100,
            withdrawalFee: 2,
            // 🔐 now reading from env, with your old address as fallback
            companyWallet:
              process.env.XNRT_WALLET ??
              "0x715C32deC9534d2fB34e0B567288AF8d895efB59",
          },
        });
      } catch (error) {
        console.error("Error fetching platform info:", error);
        res.status(500).json({ message: "Failed to fetch platform info" });
      }
    }
  );

  // ===== ANNOUNCEMENTS =====
  app.get("/api/announcements", async (_req, res) => {
    try {
      const now = new Date();
      const announcements = await prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.get(
    "/api/admin/announcements",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const announcements = await prisma.announcement.findMany({
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        res.json(announcements);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch announcements" });
      }
    }
  );

  app.post(
    "/api/admin/announcements",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const validationResult = insertAnnouncementSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationResult.error.issues,
          });
        }

        const { title, content, type, isActive, expiresAt } =
          validationResult.data;

        const announcement = await prisma.announcement.create({
          data: {
            title,
            content,
            type: type || "info",
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.authUser!.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
        });

        res.status(201).json(announcement);
      } catch (error) {
        console.error("Error creating announcement:", error);
        res
          .status(500)
          .json({ message: "Failed to create announcement" });
      }
    }
  );

  app.put(
    "/api/admin/announcements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;

        const partialSchema = insertAnnouncementSchema.partial();
        const validationResult = partialSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationResult.error.issues,
          });
        }

        const { title, content, type, isActive, expiresAt } =
          validationResult.data;

        const announcement = await prisma.announcement.update({
          where: { id },
          data: {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            ...(type !== undefined && { type }),
            ...(isActive !== undefined && { isActive }),
            ...(expiresAt !== undefined && {
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            }),
          },
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
        });

        res.json(announcement);
      } catch (error: any) {
        console.error("Error updating announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res
          .status(500)
          .json({ message: "Failed to update announcement" });
      }
    }
  );

  app.delete(
    "/api/admin/announcements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.announcement.delete({ where: { id } });
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res
          .status(500)
          .json({ message: "Failed to delete announcement" });
      }
    }
  );

  /* ------------------------------- TRUST LOAN ------------------------------- */
  // Claim Trust Loan stake
  app.post(
    "/api/trust-loan/claim",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;

        // Prevent duplicate claim: rely on existing stake "tier"
        const existing = await storage.getStakes(userId);
        const already = existing.find(
          (s: any) =>
            s.tier === TRUST_LOAN_CONFIG.programKey &&
            (s.status === "active" || s.status === "completed" || s.status === "withdrawn")
        );
        if (already) {
          return res
            .status(409)
            .json({ message: "Trust Loan already claimed." });
        }

        // Ensure tier exists
        const tierKey = TRUST_LOAN_CONFIG.programKey as unknown as StakingTier;
        const tier = STAKING_TIERS[tierKey];
        if (!tier) {
          return res
            .status(400)
            .json({ message: "Trust Loan tier not configured." });
        }

        const now = new Date();
        const endDate = new Date(
          now.getTime() +
            TRUST_LOAN_CONFIG.durationDays * 24 * 60 * 60 * 1000
        );

        // Create "virtual principal" stake – principal is NOT credited anywhere
        const stake = await storage.createStake({
          userId,
          tier: tierKey,
          amount: String(TRUST_LOAN_CONFIG.amountXnrt),
          duration: TRUST_LOAN_CONFIG.durationDays,
          // You can also move this daily rate into TRUST_LOAN_CONFIG if you prefer
          dailyRate: "1.3",
          startDate: now,
          endDate,
          totalProfit: "0",
          lastProfitDate: null,
          status: "active",
          // Trust Loan specific fields
          isLoan: true,
          loanProgram: tierKey,
          unlockMet: false,
          requiredReferrals: TRUST_LOAN_CONFIG.requiredReferrals,
          requiredInvestingReferrals:
            TRUST_LOAN_CONFIG.requiredInvestingReferrals,
          minInvestUsdtPerReferral: String(
            TRUST_LOAN_CONFIG.minInvestUsdtPerReferral
          ),
        });

        // Profits will be credited over time (e.g. by processStakingRewards)
        // into stakingBalance when unlock conditions are met.

        await storage.createActivity({
          userId,
          type: "trust_loan_claimed",
          description: `Trust Loan claimed: virtual ${TRUST_LOAN_CONFIG.amountXnrt} XNRT principal for ${TRUST_LOAN_CONFIG.durationDays} days (profits only).`,
        });

        return res.json({ ok: true, stake });
      } catch (e) {
        console.error("[trust-loan/claim] error:", e);
        return res
          .status(500)
          .json({ message: "Failed to claim Trust Loan" });
      }
    }
  );

  // Read Trust Loan status
  app.get("/api/trust-loan/status", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;

      const stakes = await storage.getStakes(userId);
      const loan = stakes.find(
        (s: any) => s.tier === TRUST_LOAN_CONFIG.programKey
      );

      const { directCount, investingCount } =
        await getDirectReferralStats(userId);

      // Use config for required thresholds
      const requiredReferrals = TRUST_LOAN_CONFIG.requiredReferrals;
      const requiredInvestingReferrals =
        TRUST_LOAN_CONFIG.requiredInvestingReferrals;
      const minInvestUsdtPerReferral =
        TRUST_LOAN_CONFIG.minInvestUsdtPerReferral;

      return res.json({
        hasLoanStake: Boolean(loan),
        stake: loan ?? null,
        directCount,
        investingCount,
        requiredReferrals,
        requiredInvestingReferrals,
        minInvestUsdtPerReferral: String(minInvestUsdtPerReferral),
        program: TRUST_LOAN_CONFIG.programKey,
        amountXnrt: TRUST_LOAN_CONFIG.amountXnrt,
        durationDays: TRUST_LOAN_CONFIG.durationDays,
      });
    } catch (e) {
      console.error("[trust-loan/status] error:", e);
      return res
        .status(500)
        .json({ message: "Failed to get Trust Loan status" });
    }
  });
  /* ----------------------------- end TRUST LOAN ----------------------------- */

  const httpServer = createServer(app);
  return httpServer;
}
