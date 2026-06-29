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
import { mintXNRT, isTokenServiceReady, getTxExplorerUrl } from "./services/tokenService";
import { decimalValueToNumber } from "./lib/numbers";
import { isSameLocalDay } from "./lib/dates";
import {
  clampLeaderboardLimit,
  getLeaderboardDateFilter,
  normalizeLeaderboardPeriodParam,
  toLeaderboardNumber,
} from "./services/leaderboard.service";
import {
  getBalanceSourceKey,
  getOrCreateUserDepositAddress,
  getWalletRates,
  normalizeBscAddress,
} from "./services/wallet.service";
import { TRUST_LOAN_CONFIG, getDirectReferralStats } from "./services/trustLoan.service";



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
