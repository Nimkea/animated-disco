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
import {
  awardUserXp,
  parseAchievementPayload,
  parseTaskPayload,
  serializeTask,
  serializeUserTaskWithTask,
  syncUserTasksForActiveTasks,
} from "./services/reward.service";
import { runStartupDatabaseSeeds } from "./services/health.service";



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
  // Seed / ensure default achievements/tasks exist only after a DB health check.
  await runStartupDatabaseSeeds();

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
