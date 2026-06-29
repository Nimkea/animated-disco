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
import { registerHomeWalletRoutes } from "./routes/home-wallet.routes";
import { registerEarningRoutes } from "./routes/earning.routes";
import { registerCommunityRoutes } from "./routes/community.routes";
import { registerWalletOperationRoutes } from "./routes/wallet-operations.routes";
import { registerProgressProfileRoutes } from "./routes/progress-profile.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerTrustLoanRoutes } from "./routes/trust-loan.routes";

// Shared schema/types
import {
  STAKING_TIERS,
  type StakingTier,
  insertAnnouncementSchema,
} from "../shared/schema";
import { Prisma } from "@prisma/client";
import { prisma } from "./lib/db";
import { notifyUser, sendPushNotification } from "./notifications";
import webpush from "web-push";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { verifyBscUsdtDeposit } from "./services/verifyBscUsdt";
import { ethers } from "ethers";
import { deriveDepositAddress } from "./services/hdWallet";
import { mintXNRT, isTokenServiceReady, getTxExplorerUrl } from "./services/tokenService";


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



export function createRouteContext() {
  return {
    storage,
    prisma,
    requireAuth,
    requireAdmin,
    validateCSRF,
    STAKING_TIERS,
    Prisma,
    notifyUser,
    sendPushNotification,
    verifyBscUsdtDeposit,
    ethers,
    deriveDepositAddress,
    mintXNRT,
    isTokenServiceReady,
    getTxExplorerUrl,
    generateAnonymizedHandle,
    MINING_SESSION_DURATION_MS,
    MINING_SESSION_XNRT_REWARD,
    MINING_SESSION_XP_REWARD,
    getWalletRates,
    decimalValueToNumber,
    isSameLocalDay,
    normalizeBscAddress,
    getBalanceSourceKey,
    getOrCreateUserDepositAddress,
    normalizeLeaderboardPeriodParam,
    getLeaderboardDateFilter,
    clampLeaderboardLimit,
    toLeaderboardNumber,
    syncUserTasksForActiveTasks,
    serializeTask,
    serializeUserTaskWithTask,
    parseTaskPayload,
    awardUserXp,
    parseAchievementPayload,
    profileUpdateSchema,
    pushSubscriptionLimiter,
    VAPID_PUBLIC_KEY,
    TRUST_LOAN_CONFIG,
    getDirectReferralStats,
    insertAnnouncementSchema,
    z,
  };
}

export type RouteContext = ReturnType<typeof createRouteContext>;

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

  const routeContext = createRouteContext();

  registerHomeWalletRoutes(app, routeContext);
  registerEarningRoutes(app, routeContext);
  registerCommunityRoutes(app, routeContext);
  registerWalletOperationRoutes(app, routeContext);
  registerProgressProfileRoutes(app, routeContext);
  registerAdminRoutes(app, routeContext);
  registerTrustLoanRoutes(app, routeContext);

  const httpServer = createServer(app);
  return httpServer;
}
