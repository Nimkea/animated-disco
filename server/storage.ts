// server/storage.ts
import { Prisma } from "@prisma/client";
import { prisma } from "./lib/db";
import { userRepository } from "./repositories/user.repository";
import { balanceRepository } from "./repositories/balance.repository";
import { transactionRepository } from "./repositories/transaction.repository";
import { activityRepository } from "./repositories/activity.repository";
import { notificationRepository } from "./repositories/notification.repository";
import { stakingRepository } from "./repositories/staking.repository";
import { miningRepository } from "./repositories/mining.repository";
import { referralRepository } from "./repositories/referral.repository";
import { taskRepository } from "./repositories/task.repository";
import { achievementRepository } from "./repositories/achievement.repository";
import { leaderboardRepository } from "./repositories/leaderboard.repository";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { calculateLevelFromXp, getEngagementConfig } from "./services/engagement.service";
import {
  type User,
  type UpsertUser,
  type Balance,
  type InsertBalance,
  type Stake,
  type InsertStake,
  type MiningSession,
  type InsertMiningSession,
  type Referral,
  type InsertReferral,
  type Transaction,
  type InsertTransaction,
  type Task,
  type InsertTask,
  type UserTask,
  type InsertUserTask,
  type Achievement,
  type InsertAchievement,
  type UserAchievement,
  type InsertUserAchievement,
  type Activity,
  type InsertActivity,
  type Notification,
  type InsertNotification,
  type PushSubscription,
  type InsertPushSubscription,
} from "@shared/schema";


export const MINING_SESSION_DURATION_HOURS = 24;
export const MINING_SESSION_DURATION_MS = MINING_SESSION_DURATION_HOURS * 60 * 60 * 1000;
export const MINING_SESSION_XP_REWARD = 10;
export const MINING_SESSION_XNRT_REWARD = 5;

const DEFAULT_MINING_BASE_REWARD = MINING_SESSION_XP_REWARD;
const XP_TO_XNRT_RATE = 0.5; // Generic activity parser fallback; mining uses fixed 5 XNRT.

function generateReferralCode(): string {
  return `XNRT${nanoid(8).toUpperCase()}`;
}

export function normalizeReferralCode(code?: string | null): string | null {
  const normalized = (code || "").trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function generateAnonymizedHandle(userId: string): string {
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  return `Player-${hash.substring(0, 4).toUpperCase()}`;
}

// Helper to convert Prisma Decimal to string
function decimalToString(value: any): string {
  if (value === null || value === undefined) return "0";
  return value.toString();
}

// Helper to convert Prisma result to match expected types
function convertPrismaUser(user: any): User {
  return {
    ...user,
    email: user.email || undefined,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    profileImageUrl: user.profileImageUrl || undefined,
    username: user.username || undefined,
    referredBy: user.referredBy || undefined,
    lastCheckIn: user.lastCheckIn || undefined,
  } as User;
}

function convertPrismaBalance(balance: any): Balance {
  return {
    ...balance,
    xnrtBalance: decimalToString(balance.xnrtBalance),
    stakingBalance: decimalToString(balance.stakingBalance),
    miningBalance: decimalToString(balance.miningBalance),
    referralBalance: decimalToString(balance.referralBalance),
    totalEarned: decimalToString(balance.totalEarned),
  } as Balance;
}

function convertPrismaStake(stake: any): Stake {
  return {
    ...stake,
    amount: decimalToString(stake.amount),
    dailyRate: decimalToString(stake.dailyRate),
    totalProfit: decimalToString(stake.totalProfit),
    lastProfitDate: stake.lastProfitDate || undefined,

    // Derived field for app type (Stake.has isLoan in shared/schema)
    isLoan: !!(stake.loanProgram && stake.loanProgram.startsWith("trust_")),

    // Trust Loan / loan-related fields
    loanProgram: stake.loanProgram || undefined,
    unlockMet: stake.unlockMet,
    requiredReferrals: stake.requiredReferrals,
    requiredInvestingReferrals: stake.requiredInvestingReferrals,
    minInvestUsdtPerReferral: decimalToString(stake.minInvestUsdtPerReferral),
  } as Stake;
}

function convertPrismaReferral(referral: any): Referral {
  return {
    ...referral,
    totalCommission: decimalToString(referral.totalCommission),
  } as Referral;
}

function convertPrismaTransaction(transaction: any): Transaction {
  return {
    ...transaction,
    amount: decimalToString(transaction.amount),
    usdtAmount: transaction.usdtAmount
      ? decimalToString(transaction.usdtAmount)
      : undefined,
    source: transaction.source || undefined,
    walletAddress: transaction.walletAddress || undefined,
    transactionHash: transaction.transactionHash || undefined,
    proofImageUrl: transaction.proofImageUrl || undefined,
    adminNotes: transaction.adminNotes || undefined,
    fee: transaction.fee ? decimalToString(transaction.fee) : undefined,
    netAmount: transaction.netAmount
      ? decimalToString(transaction.netAmount)
      : undefined,
    approvedBy: transaction.approvedBy || undefined,
    approvedAt: transaction.approvedAt || undefined,
    user: transaction.user
      ? {
          email: transaction.user.email,
          username: transaction.user.username,
        }
      : undefined,
  } as Transaction;
}

function convertPrismaTask(task: any): Task {
  return {
    ...task,
    xnrtReward: decimalToString(task.xnrtReward),
    requirements: task.requirements || undefined,
  } as Task;
}

function convertPrismaUserTask(userTask: any): UserTask {
  return {
    ...userTask,
    completedAt: userTask.completedAt || undefined,
  } as UserTask;
}

function convertPrismaActivity(activity: any): Activity {
  return {
    ...activity,
    metadata: activity.metadata || undefined,
  } as Activity;
}

function convertPrismaNotification(notification: any): Notification {
  let metadata = notification.metadata;

  // If stored as JSON string, try to parse back to object
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      // ignore parse errors, keep raw string
    }
  }

  return {
    ...notification,
    metadata: metadata ?? undefined,
  } as Notification;
}

function convertPrismaPushSubscription(subscription: any): PushSubscription {
  return {
    ...subscription,
    expirationTime: subscription.expirationTime || undefined,
  } as PushSubscription;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser, referralCode?: string): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Balance operations
  getBalance(userId: string): Promise<Balance | undefined>;
  createBalance(balance: InsertBalance): Promise<Balance>;
  updateBalance(userId: string, updates: Partial<Balance>): Promise<Balance>;
  adjustStakingBalance(data: {
    userId: string;
    amount: string;
    operation?: "add" | "subtract";
  }): Promise<Balance>;

  // Staking operations
  getStakes(userId: string): Promise<Stake[]>;
  getStakeById(id: string): Promise<Stake | undefined>;
  createStake(stake: InsertStake): Promise<Stake>;
  updateStake(id: string, updates: Partial<Stake>): Promise<Stake>;
  atomicWithdrawStake(id: string, totalProfit: string): Promise<Stake | null>;
  getAllActiveStakes(): Promise<Stake[]>;
  processStakingRewards(): Promise<void>;

  // Mining operations
  getCurrentMiningSession(userId: string): Promise<MiningSession | undefined>;
  getMiningHistory(userId: string): Promise<MiningSession[]>;
  createMiningSession(session: InsertMiningSession): Promise<MiningSession>;
  updateMiningSession(
    id: string,
    updates: Partial<MiningSession>
  ): Promise<MiningSession>;
  processMiningRewards(userId?: string): Promise<{ processedCount: number }>;

  // Referral operations
  getReferralsByReferrer(referrerId: string): Promise<Referral[]>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  updateReferral(id: string, updates: Partial<Referral>): Promise<Referral>;
  distributeReferralCommissions(
    userId: string,
    amount: number,
    sourceTransactionId?: string,
    options?: { creditTotalEarned?: boolean }
  ): Promise<void>;
  getReferrerChain(userId: string, maxLevels: number): Promise<User[]>;

  // Transaction operations
  getTransactionsByUser(
    userId: string,
    type?: string
  ): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  getAllTransactions(type?: string): Promise<Transaction[]>;
  getPendingTransactions(type: string): Promise<Transaction[]>;

  // Task operations
  getAllTasks(): Promise<Task[]>;
  getUserTasks(userId: string): Promise<UserTask[]>;
  createUserTask(userTask: InsertUserTask): Promise<UserTask>;
  updateUserTask(id: string, updates: Partial<UserTask>): Promise<UserTask>;

  // Achievement operations
  getAllAchievements(): Promise<Achievement[]>;
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  createUserAchievement(
    userAchievement: InsertUserAchievement
  ): Promise<UserAchievement>;
  checkAndUnlockAchievements(userId: string): Promise<void>;

  // Achievements with unlock count (for user-facing list)
  getAchievementsWithUnlockCount(): Promise<
    (Achievement & { unlockCount: number })[]
  >;

  // Activity operations
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivities(userId: string, limit?: number): Promise<Activity[]>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string): Promise<Notification>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getNotificationsPendingPush(limit: number): Promise<Notification[]>;
  updateNotificationDelivery(
    id: string,
    updates: {
      deliveredAt?: Date;
      deliveryAttempts?: number;
      lastAttemptAt?: Date;
      pendingPush?: boolean;
      pushError?: string;
    }
  ): Promise<Notification>;

  // Push Subscription operations
  getPushSubscription(
    userId: string,
    endpoint: string
  ): Promise<PushSubscription | null>;
  createPushSubscription(
    data: InsertPushSubscription
  ): Promise<PushSubscription>;
  deletePushSubscription(userId: string, endpoint: string): Promise<void>;
  getUserPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  disablePushSubscription(endpoint: string): Promise<void>;

  // XP Leaderboard operations
  getXPLeaderboard(
    currentUserId: string,
    period: string,
    category: string,
    isAdmin: boolean,
    limit?: number
  ): Promise<{ leaderboard: any[]; userPosition: any | null; meta: any }>;

  // Raw query support
  raw(query: string, params?: any[]): Promise<any[]>;
}


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
      return {
        OR: [{ type: "referral_commission" }, { type: "company_commission" }],
      };
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

  // Prefer explicit reward notation used by tasks/achievements: (+25 XP)
  const plusMatch = description.match(/\+\s*([\d.]+)\s*XP/i);
  if (plusMatch) return Number(plusMatch[1]) || 0;

  // Mining/check-in activities use "earned 20 XP" / "and 20 XP".
  const earnedMatch = description.match(/(?:earned|and)\s+([\d.]+)\s*XP/i);
  if (earnedMatch) return Number(earnedMatch[1]) || 0;

  // Safe fallback for known XP earning activity types.
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

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return userRepository.findById(id);
  }

  async upsertUser(userData: UpsertUser, refCode?: string): Promise<User> {
    const existingUser = await this.getUser(userData.id!);

    if (existingUser) {
      const updateData: any = {};
      if (userData.email !== undefined && userData.email !== null)
        updateData.email = userData.email;
      if (userData.username !== undefined && userData.username !== null)
        updateData.username = userData.username;
      if (userData.isAdmin !== undefined) updateData.isAdmin = userData.isAdmin;
      if (userData.firstName !== undefined) updateData.firstName = userData.firstName || null;
      if (userData.lastName !== undefined) updateData.lastName = userData.lastName || null;
      if (userData.profileImageUrl !== undefined) updateData.profileImageUrl = userData.profileImageUrl || null;
      if (userData.xp !== undefined) updateData.xp = userData.xp;
      if (userData.level !== undefined) updateData.level = userData.level;
      if (userData.streak !== undefined) updateData.streak = userData.streak;
      if (userData.lastCheckIn !== undefined)
        updateData.lastCheckIn = userData.lastCheckIn;
      updateData.updatedAt = new Date();

      const user = await prisma.user.update({
        where: { id: userData.id! },
        data: updateData,
      });
      return convertPrismaUser(user);
    }

    // New user - generate referral code and create balance
    const referralCode = generateReferralCode();
    const normalizedRefCode = normalizeReferralCode(refCode);
    const referredByUserId = normalizedRefCode
      ? await this.resolveReferralCodeToUserId(normalizedRefCode)
      : null;

    if (normalizedRefCode && !referredByUserId) {
      throw new Error("Invalid referral code");
    }

    const user = await prisma.user.create({
      data: {
        id: userData.id,
        email: userData.email || "",
        username:
          userData.username ||
          userData.email?.split("@")[0] ||
          `user${Date.now()}`,
        passwordHash: (userData as any).passwordHash || "",
        referralCode,
        referredBy: referredByUserId,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        isAdmin: userData.isAdmin || false,
        xp: userData.xp || 0,
        level: userData.level || 1,
        streak: userData.streak || 0,
        lastCheckIn: userData.lastCheckIn || null,
      },
    });

    // Create initial balance
    await this.createBalance({
      userId: user.id,
      xnrtBalance: "0",
      stakingBalance: "0",
      miningBalance: "0",
      referralBalance: "0",
      totalEarned: "0",
    });

    // If referred by someone, create the permanent 3-level referral network records.
    if (referredByUserId) {
      const referrer = await prisma.user.findUnique({
        where: { id: referredByUserId },
      });

      if (referrer) {
        const referrerChain = await this.getReferrerChain(user.id, 3);
        for (let i = 0; i < referrerChain.length; i++) {
          await this.ensureReferralRecord(referrerChain[i].id, user.id, i + 1);
        }

        // Create notification for direct referrer about new referral
        await this.createNotification({
          userId: referrer.id,
          type: "new_referral",
          title: "🎉 New Referral!",
          message: `${
            user.username || "A new user"
          } just joined using your referral code!`,
          // pass plain object; createNotification handles stringify
          metadata: {
            referredUserId: user.id,
            referredUsername: user.username,
          } as any,
        });

        // Check and unlock referral achievements for the direct referrer
        await this.checkAndUnlockAchievements(referrer.id);
      }
    }

    return convertPrismaUser(user);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    return userRepository.update(userId, updates);
  }

  async getAllUsers(): Promise<User[]> {
    return userRepository.findAll();
  }

  // Balance operations
  async getBalance(userId: string): Promise<Balance | undefined> {
    return balanceRepository.findByUserId(userId);
  }

  async createBalance(balance: InsertBalance): Promise<Balance> {
    return balanceRepository.create(balance);
  }

  async updateBalance(
    userId: string,
    updates: Partial<Balance>
  ): Promise<Balance> {
    return balanceRepository.update(userId, updates);
  }

  async adjustStakingBalance({
    userId,
    amount,
    operation = "add",
  }: {
    userId: string;
    amount: string;
    operation?: "add" | "subtract";
  }): Promise<Balance> {
    return balanceRepository.adjustStakingBalance({ userId, amount, operation });
  }

  // Staking operations
  async getStakes(userId: string): Promise<Stake[]> {
    return stakingRepository.findByUser(userId);
  }

  async getStakeById(id: string): Promise<Stake | undefined> {
    return stakingRepository.findById(id);
  }

  async createStake(stake: InsertStake): Promise<Stake> {
    return stakingRepository.create(stake);
  }

  async updateStake(id: string, updates: Partial<Stake>): Promise<Stake> {
    return stakingRepository.update(id, updates);
  }

  async atomicWithdrawStake(
    id: string,
    totalProfit: string
  ): Promise<Stake | null> {
    return stakingRepository.atomicWithdraw(id, totalProfit);
  }

  async getAllActiveStakes(): Promise<Stake[]> {
    return stakingRepository.findAllActive();
  }

  async processStakingRewards(): Promise<void> {
    const activeStakes = await this.getAllActiveStakes();
    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (const stake of activeStakes) {
      const lastProfitDate = new Date(stake.lastProfitDate || stake.startDate);
      const endDate = new Date(stake.endDate);

      const daysSinceLastProfit = Math.floor(
        (now.getTime() - lastProfitDate.getTime()) / DAY_MS
      );
      const daysUntilEnd = Math.floor(
        (endDate.getTime() - lastProfitDate.getTime()) / DAY_MS
      );

      const creditedDays = Math.max(
        0,
        Math.min(daysSinceLastProfit, daysUntilEnd)
      );

      if (creditedDays >= 1) {
        const dailyProfit =
          (parseFloat(stake.amount) * parseFloat(stake.dailyRate)) / 100;
        const profitToAdd = dailyProfit * creditedDays;
        const newTotalProfit = parseFloat(stake.totalProfit) + profitToAdd;

        const calculatedLastProfitDate = new Date(
          lastProfitDate.getTime() + creditedDays * DAY_MS
        );
        const newLastProfitDate =
          calculatedLastProfitDate > endDate
            ? endDate
            : calculatedLastProfitDate;

        await this.updateStake(stake.id, {
          totalProfit: newTotalProfit.toString(),
          lastProfitDate: newLastProfitDate,
        });

        const balance = await this.getBalance(stake.userId);
        if (balance) {
          await this.updateBalance(stake.userId, {
            stakingBalance: (
              parseFloat(balance.stakingBalance) + profitToAdd
            ).toString(),
            totalEarned: (
              parseFloat(balance.totalEarned) + profitToAdd
            ).toString(),
          });
        }

        await this.createActivity({
          userId: stake.userId,
          type: "staking_reward",
          description: `Earned ${profitToAdd.toFixed(
            2
          )} XNRT from staking (${creditedDays} day${
            creditedDays > 1 ? "s" : ""
          })`,
        });

        const { notifyUser } = await import("./notifications");
        void notifyUser(stake.userId, {
          type: "staking_reward",
          title: "💎 Staking Rewards!",
          message: `You earned ${profitToAdd.toFixed(
            2
          )} XNRT from ${creditedDays} day${
            creditedDays > 1 ? "s" : ""
          } of staking`,
          url: "/staking",
          metadata: {
            amount: profitToAdd.toString(),
            days: creditedDays,
            stakeId: stake.id,
          },
        }).catch((err) => {
          console.error(
            "Error sending staking reward notification (non-blocking):",
            err
          );
        });

        await this.checkAndUnlockAchievements(stake.userId);
      }

      if (now >= endDate) {
        await this.updateStake(stake.id, {
          status: "completed",
        });
      }
    }
  }

  // -------------------- Mining reward processor --------------------
  private async completeMiningSessionOnce(session: MiningSession): Promise<boolean> {
    if (!session.endTime) return false;

    const now = new Date();
    const scheduledEndTime = new Date(session.endTime);
    if (now < scheduledEndTime || session.status !== "active") return false;

    const xpReward = MINING_SESSION_XP_REWARD;
    const xnrtReward = MINING_SESSION_XNRT_REWARD;

    const completed = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.miningSession.updateMany({
        where: {
          id: session.id,
          status: "active",
          endTime: { lte: now },
        },
        data: {
          status: "completed",
          finalReward: xpReward,
        },
      });

      if (updateResult.count === 0) return false;

      await tx.user.update({
        where: { id: session.userId },
        data: { xp: { increment: xpReward } },
      });

      await tx.balance.upsert({
        where: { userId: session.userId },
        create: {
          userId: session.userId,
          xnrtBalance: new Prisma.Decimal(0),
          stakingBalance: new Prisma.Decimal(0),
          miningBalance: new Prisma.Decimal(xnrtReward),
          referralBalance: new Prisma.Decimal(0),
          totalEarned: new Prisma.Decimal(xnrtReward),
        },
        update: {
          miningBalance: { increment: new Prisma.Decimal(xnrtReward) },
          totalEarned: { increment: new Prisma.Decimal(xnrtReward) },
        },
      });

      await tx.activity.create({
        data: {
          userId: session.userId,
          type: "mining_completed",
          description: `Completed 24-hour mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(
            1
          )} XNRT`,
          metadata: JSON.stringify({
            source: "mining",
            sessionId: session.id,
            xpReward,
            xnrtReward,
            scheduledEndTime: scheduledEndTime.toISOString(),
          }),
        },
      });

      return true;
    });

    if (!completed) return false;

    const { notifyUser } = await import("./notifications");
    void notifyUser(session.userId, {
      type: "mining_completed",
      title: "⛏️ Mining Complete!",
      message: `Your 24-hour mining session earned ${xpReward} XP and ${xnrtReward.toFixed(
        1
      )} XNRT.`,
      url: "/mining",
      metadata: {
        xpReward,
        xnrtReward: xnrtReward.toString(),
        sessionId: session.id,
      },
    }).catch((err) => {
      console.error("Error sending mining notification (non-blocking):", err);
    });

    await this.checkAndUnlockAchievements(session.userId);
    return true;
  }

  async processMiningRewards(userId?: string): Promise<{ processedCount: number }> {
    const dueSessions = await miningRepository.findDueActive(userId);

    let processedCount = 0;
    for (const session of dueSessions) {
      if (await this.completeMiningSessionOnce(session)) processedCount += 1;
    }

    return { processedCount };
  }

  // ------------------------ Mining operations ------------------------
  async getCurrentMiningSession(
    userId: string
  ): Promise<MiningSession | undefined> {
    const session = await miningRepository.findCurrentActive(userId);

    if (session && session.endTime && new Date() >= new Date(session.endTime)) {
      await this.completeMiningSessionOnce(session);
      return undefined;
    }

    return session;
  }

  async getMiningHistory(userId: string): Promise<MiningSession[]> {
    return miningRepository.findHistory(userId);
  }

  async createMiningSession(
    session: InsertMiningSession
  ): Promise<MiningSession> {
    return miningRepository.create(session);
  }

  async updateMiningSession(
    id: string,
    updates: Partial<MiningSession>
  ): Promise<MiningSession> {
    return miningRepository.update(id, updates);
  }

  // Referral operations
  async getReferralsByReferrer(referrerId: string): Promise<Referral[]> {
    return referralRepository.findByReferrer(referrerId);
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    return referralRepository.create(referral);
  }

  async updateReferral(
    id: string,
    updates: Partial<Referral>
  ): Promise<Referral> {
    return referralRepository.update(id, updates);
  }

  private async resolveReferralCodeToUserId(refCode?: string | null): Promise<string | null> {
    return referralRepository.resolveCodeToUserId(refCode);
  }

  private async ensureReferralRecord(
    referrerId: string,
    referredUserId: string,
    level: number,
    totalCommission = "0"
  ): Promise<void> {
    return referralRepository.ensureRecord(referrerId, referredUserId, level, totalCommission);
  }

  async distributeReferralCommissions(
    userId: string,
    amount: number,
    sourceTransactionId?: string,
    options: { creditTotalEarned?: boolean } = {}
  ): Promise<void> {
    const creditTotalEarned = options.creditTotalEarned !== false;
    const baseAmount = Number(amount || 0);
    const sourceId = sourceTransactionId || `manual:${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    if (!userId || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      console.warn(`[REFERRAL] Skipping invalid distribution: userId=${userId}, amount=${amount}`);
      return;
    }

    console.log(
      `[REFERRAL] Starting distribution for userId: ${userId}, amount: ${baseAmount}, source=${sourceId}`
    );

    const COMMISSION_RATES: Record<1 | 2 | 3, number> = {
      1: 0.06,
      2: 0.03,
      3: 0.01,
    };

    const referrerChain = await this.getReferrerChain(userId, 3);
    console.log(
      `[REFERRAL] Referrer chain length: ${referrerChain.length}`,
      referrerChain.map((r) => ({ id: r?.id, email: r?.email }))
    );

    const creditCommission = async (params: {
      referrerId: string;
      referredUserId: string;
      level: 1 | 2 | 3;
      rate: number;
      commission: number;
      type: "referral_commission" | "company_commission";
      description: string;
      notify?: boolean;
    }) => {
      const { referrerId, referredUserId, level, rate, commission, type, description, notify } = params;

      const existingLedger = await prisma.referralCommission.findUnique({
        where: {
          transactionId_referrerId_level: {
            transactionId: sourceId,
            referrerId,
            level,
          },
        },
      });

      if (existingLedger) {
        console.log(
          `[REFERRAL] Commission already paid for source=${sourceId}, referrer=${referrerId}, level=${level}; skipping`
        );
        return;
      }

      await prisma.referralCommission.create({
        data: {
          transactionId: sourceId,
          referrerId,
          referredUserId,
          level,
          baseAmount: new Prisma.Decimal(baseAmount),
          rate: new Prisma.Decimal(rate),
          commission: new Prisma.Decimal(commission),
          status: "paid",
        },
      });

      if (type === "referral_commission") {
        const existingReferral = await prisma.referral.findFirst({
          where: { referrerId, referredUserId, level },
        });

        if (existingReferral) {
          await prisma.referral.update({
            where: { id: existingReferral.id },
            data: { totalCommission: { increment: new Prisma.Decimal(commission) } },
          });
        } else {
          await this.ensureReferralRecord(referrerId, referredUserId, level, commission.toString());
        }
      }

      await prisma.balance.upsert({
        where: { userId: referrerId },
        create: {
          userId: referrerId,
          referralBalance: new Prisma.Decimal(commission),
          totalEarned: creditTotalEarned ? new Prisma.Decimal(commission) : new Prisma.Decimal(0),
        },
        update: {
          referralBalance: { increment: new Prisma.Decimal(commission) },
          ...(creditTotalEarned
            ? { totalEarned: { increment: new Prisma.Decimal(commission) } }
            : {}),
        },
      });

      await this.createActivity({
        userId: referrerId,
        type,
        description,
        metadata: JSON.stringify({
          sourceTransactionId: sourceId,
          referredUserId,
          level,
          commission: commission.toString(),
          baseAmount: baseAmount.toString(),
          rate: rate.toString(),
        }),
      });

      if (notify) {
        const { notifyUser } = await import("./notifications");
        void notifyUser(referrerId, {
          type: "referral_commission",
          title: "💰 Referral Bonus!",
          message: `You earned ${commission.toFixed(2)} XNRT commission from a level ${level} referral`,
          url: "/referrals",
          metadata: {
            amount: commission.toString(),
            level,
            referredUserId,
            sourceTransactionId: sourceId,
          } as any,
        }).catch((err) => {
          console.error(
            "Error sending referral commission notification (non-blocking):",
            err
          );
        });
      }
    };

    for (let level = 1 as 1 | 2 | 3; level <= 3; level = (level + 1) as 1 | 2 | 3) {
      const referrer = referrerChain[level - 1];
      const rate = COMMISSION_RATES[level];
      const commission = baseAmount * rate;

      console.log(
        `[REFERRAL] Level ${level}: referrer=${
          referrer?.email || "null"
        }, commission=${commission}`
      );

      if (!referrer) {
        const fallbackEmail =
          process.env.REFERRAL_COMPANY_EMAIL ||
          process.env.COMPANY_ADMIN_EMAIL ||
          "noahkeaneowen@hotmail.com";

        const companyAccount = await prisma.user.findFirst({
          where: { email: fallbackEmail, isAdmin: true },
        });

        if (!companyAccount) {
          console.warn(
            `[REFERRAL] Company fallback admin not found (${fallbackEmail}); missing level ${level} commission was not credited, deposit remains approved.`
          );
          continue;
        }

        await creditCommission({
          referrerId: companyAccount.id,
          referredUserId: userId,
          level,
          rate,
          commission,
          type: "company_commission",
          description: `Received ${commission.toFixed(
            2
          )} XNRT company commission from missing level ${level} referrer`,
        });
        continue;
      }

      await this.ensureReferralRecord(referrer.id, userId, level);
      await creditCommission({
        referrerId: referrer.id,
        referredUserId: userId,
        level,
        rate,
        commission,
        type: "referral_commission",
        description: `Earned ${commission.toFixed(
          2
        )} XNRT commission from level ${level} referral`,
        notify: true,
      });

      console.log(
        `[REFERRAL] Level ${level} commission complete for ${referrer.email}`
      );
    }

    console.log(`[REFERRAL] Distribution complete for user ${userId}`);
  }

  async getReferrerChain(userId: string, maxLevels: number): Promise<User[]> {
    return referralRepository.getReferrerChain(userId, maxLevels);
  }

  // Transaction operations
  async getTransactionsByUser(
    userId: string,
    type?: string
  ): Promise<Transaction[]> {
    return transactionRepository.findByUser(userId, type);
  }

  async getTransactionById(id: string): Promise<Transaction | undefined> {
    return transactionRepository.findById(id);
  }

  async createTransaction(
    transaction: InsertTransaction
  ): Promise<Transaction> {
    return transactionRepository.create(transaction);
  }

  async updateTransaction(
    id: string,
    updates: Partial<Transaction>
  ): Promise<Transaction> {
    return transactionRepository.update(id, updates);
  }

  async getAllTransactions(type?: string): Promise<Transaction[]> {
    return transactionRepository.findAll(type);
  }

  async getPendingTransactions(type: string): Promise<Transaction[]> {
    return transactionRepository.findPending(type);
  }

  // Task operations
  async getAllTasks(): Promise<Task[]> {
    return taskRepository.findAllActive();
  }

  async getUserTasks(userId: string): Promise<UserTask[]> {
    return taskRepository.findUserTasks(userId);
  }

  async createUserTask(userTask: InsertUserTask): Promise<UserTask> {
    return taskRepository.createUserTask(userTask);
  }

  async updateUserTask(
    id: string,
    updates: Partial<UserTask>
  ): Promise<UserTask> {
    return taskRepository.updateUserTask(id, updates);
  }

  // Achievement operations
  async getAllAchievements(): Promise<Achievement[]> {
    return achievementRepository.findAll();
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return achievementRepository.findUserAchievements(userId);
  }

  async createUserAchievement(
    userAchievement: InsertUserAchievement
  ): Promise<UserAchievement> {
    return achievementRepository.createUserAchievement(userAchievement);
  }

  async checkAndUnlockAchievements(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const balance = await this.getBalance(userId);
    if (!balance) return;

    const allAchievements = await prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { requirement: "asc" }, { createdAt: "asc" }],
    });
    const userAchievementsList = await this.getUserAchievements(userId);
    const unlockedIds = new Set(userAchievementsList.map((ua) => ua.achievementId));

    const [
      userReferrals,
      miningSessions,
      completedTasks,
      createdStakes,
      linkedWallets,
      approvedDeposits,
    ] = await Promise.all([
      this.getReferralsByReferrer(userId),
      this.getMiningHistory(userId),
      prisma.userTask.count({ where: { userId, completed: true } }),
      prisma.stake.count({ where: { userId } }),
      prisma.linkedWallet.count({ where: { userId, active: true } }),
      prisma.transaction.count({ where: { userId, type: "deposit", status: "approved" } }),
    ]);

    const totalEarned = parseFloat(balance.totalEarned);
    const directReferrals = userReferrals.filter((r) => r.level === 1);
    const completedMining = miningSessions.filter((s) => s.status === "completed");
    const profileCompleted = Boolean(user.username && user.email);
    const walletReady = Boolean(user.depositAddress) || linkedWallets > 0 || approvedDeposits > 0;
    const trustLoanReady = directReferrals.length >= 3 && createdStakes >= 1 && (user.streak || 0) >= 7;

    let totalXpReward = 0;

    for (const achievement of allAchievements as any[]) {
      if (unlockedIds.has(achievement.id)) continue;

      let progress = 0;
      switch (achievement.category) {
        case "onboarding":
          progress = profileCompleted ? 1 : 0;
          break;
        case "wallet":
          progress = walletReady ? 1 : 0;
          break;
        case "earnings":
          progress = totalEarned;
          break;
        case "referrals":
          progress = directReferrals.length;
          break;
        case "streaks":
          progress = user.streak || 0;
          break;
        case "mining":
          progress = completedMining.length;
          break;
        case "tasks":
          progress = completedTasks;
          break;
        case "staking":
          progress = createdStakes;
          break;
        case "trust_loan":
          progress = trustLoanReady ? 1 : 0;
          break;
        default:
          progress = 0;
      }

      if (progress < achievement.requirement) continue;

      try {
        const existingFeatured = await prisma.userAchievement.count({ where: { userId, isFeatured: true } });
        const shouldAutoFeature = existingFeatured < 4;
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
            isFeatured: shouldAutoFeature,
            featuredSlot: shouldAutoFeature ? existingFeatured + 1 : null,
          },
        });
      } catch (error: any) {
        if (error?.code !== "P2002") throw error;
        continue;
      }

      totalXpReward += achievement.xpReward;

      const tierLabel = String(achievement.badgeTier || "bronze").replace(/_/g, " ");
      await this.createActivity({
        userId,
        type: "achievement_unlocked",
        description: `Unlocked ${tierLabel} badge: ${achievement.title} (+${achievement.xpReward} XP)`,
        metadata: JSON.stringify({
          achievementId: achievement.id,
          badgeTier: achievement.badgeTier || "bronze",
          category: achievement.category,
          xpReward: achievement.xpReward,
        }),
      });

      const { notifyUser } = await import("./notifications");
      void notifyUser(userId, {
        type: "achievement_unlocked",
        title: "🏆 Badge Unlocked!",
        message: `${achievement.icon || "🏆"} ${achievement.title} (${tierLabel}) — you earned ${achievement.xpReward} XP.`,
        url: "/achievements",
        metadata: {
          achievementId: achievement.id,
          achievementTitle: achievement.title,
          badgeTier: achievement.badgeTier || "bronze",
          category: achievement.category,
          xpReward: achievement.xpReward,
        },
      }).catch((err) => {
        console.error("Error sending achievement notification (non-blocking):", err);
      });
    }

    if (totalXpReward > 0) {
      const nextXp = (user.xp || 0) + totalXpReward;
      const engagementConfig = await getEngagementConfig();
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: nextXp,
          level: calculateLevelFromXp(nextXp, engagementConfig),
        },
      });
    }
  }

  async getAchievementsWithUnlockCount(): Promise<
    (Achievement & { unlockCount: number })[]
  > {
    return achievementRepository.findWithUnlockCount();
  }

  // Activity operations
  async createActivity(activity: InsertActivity): Promise<Activity> {
    return activityRepository.create(activity);
  }

  async getActivities(
    userId: string,
    limit: number = 10
  ): Promise<Activity[]> {
    return activityRepository.findByUser(userId, limit);
  }

  // Notification operations
  async createNotification(
    notification: InsertNotification
  ): Promise<Notification> {
    return notificationRepository.create(notification);
  }

  async getNotifications(
    userId: string,
    limit: number = 20
  ): Promise<Notification[]> {
    return notificationRepository.findByUser(userId, limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  }

  async markNotificationAsRead(id: string): Promise<Notification> {
    return notificationRepository.markAsRead(id);
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    return notificationRepository.markAllAsRead(userId);
  }

  async getNotificationsPendingPush(
    limit: number = 50
  ): Promise<Notification[]> {
    return notificationRepository.findPendingPush(limit);
  }

  async updateNotificationDelivery(
    id: string,
    updates: {
      deliveredAt?: Date;
      deliveryAttempts?: number;
      lastAttemptAt?: Date;
      pendingPush?: boolean;
      pushError?: string;
    }
  ): Promise<Notification> {
    return notificationRepository.updateDelivery(id, updates);
  }

  // Push Subscription operations
  async getPushSubscription(
    userId: string,
    endpoint: string
  ): Promise<PushSubscription | null> {
    try {
      return await notificationRepository.findPushSubscription(userId, endpoint);
    } catch (error) {
      console.error("Error getting push subscription:", error);
      return null;
    }
  }

  async createPushSubscription(
    data: InsertPushSubscription
  ): Promise<PushSubscription> {
    try {
      return await notificationRepository.upsertPushSubscription(data);
    } catch (error) {
      console.error("Error creating push subscription:", error);
      throw new Error("Failed to create push subscription");
    }
  }

  async deletePushSubscription(
    userId: string,
    endpoint: string
  ): Promise<void> {
    try {
      await notificationRepository.deletePushSubscription(userId, endpoint);
    } catch (error) {
      console.error("Error deleting push subscription:", error);
      throw new Error("Failed to delete push subscription");
    }
  }

  async getUserPushSubscriptions(
    userId: string
  ): Promise<PushSubscription[]> {
    try {
      return await notificationRepository.findUserPushSubscriptions(userId);
    } catch (error) {
      console.error("Error getting user push subscriptions:", error);
      return [];
    }
  }

  async disablePushSubscription(endpoint: string): Promise<void> {
    try {
      await notificationRepository.disablePushSubscription(endpoint);
    } catch (error) {
      console.error("Error disabling push subscription:", error);
    }
  }

  // XP Leaderboard operations
  async getXPLeaderboard(
    currentUserId: string,
    period: string,
    category: string,
    isAdmin: boolean = false,
    limit: number = 50
  ): Promise<{ leaderboard: any[]; userPosition: any | null; meta: any }> {
    return leaderboardRepository.getXPLeaderboard(
      currentUserId,
      period,
      category,
      isAdmin,
      limit
    );
  }

  // Raw query support
  async raw(query: string, params: any[] = []): Promise<any[]> {
    return await prisma.$queryRawUnsafe(query, ...params);
  }
}

export const storage = new DatabaseStorage();
