// server/storage.ts
import { Prisma } from "@prisma/client";
import { prisma } from "./lib/db";
import { userRepository } from "./repositories/user.repository";
import { balanceRepository } from "./repositories/balance.repository";
import { transactionRepository } from "./repositories/transaction.repository";
import { activityRepository } from "./repositories/activity.repository";
import { notificationRepository } from "./repositories/notification.repository";
import crypto from "crypto";
import { nanoid } from "nanoid";
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
    const stakes = await prisma.stake.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return stakes.map(convertPrismaStake);
  }

  async getStakeById(id: string): Promise<Stake | undefined> {
    const stake = await prisma.stake.findUnique({
      where: { id },
    });
    return stake ? convertPrismaStake(stake) : undefined;
  }

  async createStake(stake: InsertStake): Promise<Stake> {
    const newStake = await prisma.stake.create({
      data: {
        userId: stake.userId,
        tier: stake.tier,
        amount: new Prisma.Decimal(stake.amount),
        dailyRate: new Prisma.Decimal(stake.dailyRate),
        duration: stake.duration,
        startDate: stake.startDate || new Date(),
        endDate: stake.endDate,
        totalProfit: new Prisma.Decimal(stake.totalProfit || "0"),
        lastProfitDate: stake.lastProfitDate,
        status: stake.status || "active",
        loanProgram: stake.loanProgram,
        unlockMet: stake.unlockMet || false,
        requiredReferrals: stake.requiredReferrals,
        requiredInvestingReferrals: stake.requiredInvestingReferrals,
        minInvestUsdtPerReferral: stake.minInvestUsdtPerReferral
          ? new Prisma.Decimal(stake.minInvestUsdtPerReferral)
          : undefined,
      },
    });
    return convertPrismaStake(newStake);
  }

  async updateStake(id: string, updates: Partial<Stake>): Promise<Stake> {
    const data: any = {};

    if (updates.totalProfit !== undefined)
      data.totalProfit = new Prisma.Decimal(updates.totalProfit);
    if (updates.lastProfitDate !== undefined)
      data.lastProfitDate = updates.lastProfitDate;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.unlockMet !== undefined) data.unlockMet = updates.unlockMet;

    const stake = await prisma.stake.update({
      where: { id },
      data,
    });
    return convertPrismaStake(stake);
  }

  async atomicWithdrawStake(
    id: string,
    totalProfit: string
  ): Promise<Stake | null> {
    try {
      const stake = await prisma.stake.updateMany({
        where: {
          id,
          OR: [{ status: "completed" }, { status: "active" }],
        },
        data: {
          status: "withdrawn",
          totalProfit: new Prisma.Decimal(totalProfit),
        },
      });

      if (stake.count === 0) return null;

      const updatedStake = await prisma.stake.findUnique({
        where: { id },
      });

      return updatedStake ? convertPrismaStake(updatedStake) : null;
    } catch {
      return null;
    }
  }

  async getAllActiveStakes(): Promise<Stake[]> {
    const stakes = await prisma.stake.findMany({
      where: { status: "active" },
    });
    return stakes.map(convertPrismaStake);
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
    const now = new Date();
    const dueSessions = await prisma.miningSession.findMany({
      where: {
        status: "active",
        ...(userId ? { userId } : {}),
        endTime: { lte: now },
      },
      orderBy: { endTime: "asc" },
      take: 100,
    });

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
    const session = await prisma.miningSession.findFirst({
      where: {
        userId,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
    });

    if (session && session.endTime && new Date() >= new Date(session.endTime)) {
      await this.completeMiningSessionOnce(session);
      return undefined;
    }

    return session || undefined;
  }

  async getMiningHistory(userId: string): Promise<MiningSession[]> {
    const sessions = await prisma.miningSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return sessions;
  }

  async createMiningSession(
    session: InsertMiningSession
  ): Promise<MiningSession> {
    const now = new Date();
    const startTime = session.startTime ?? now;

    const defaultEndTime = new Date(
      startTime.getTime() + 24 * 60 * 60 * 1000
    );
    const defaultNextAvailable = defaultEndTime;

    const base = session.baseReward ?? DEFAULT_MINING_BASE_REWARD;
    const boost = session.boostPercentage ?? 0;
    const computedFinal = MINING_SESSION_XP_REWARD;

    const newSession = await prisma.miningSession.create({
      data: {
        userId: session.userId,
        baseReward: base,
        adBoostCount: session.adBoostCount ?? 0,
        boostPercentage: boost,
        finalReward: session.finalReward ?? computedFinal,
        startTime,
        endTime: session.endTime ?? defaultEndTime,
        nextAvailable: session.nextAvailable ?? defaultNextAvailable,
        status: session.status ?? "active",
      },
    });

    return newSession;
  }

  async updateMiningSession(
    id: string,
    updates: Partial<MiningSession>
  ): Promise<MiningSession> {
    const data: any = {};
    if (updates.baseReward !== undefined) data.baseReward = updates.baseReward;
    if (updates.adBoostCount !== undefined)
      data.adBoostCount = updates.adBoostCount;
    if (updates.boostPercentage !== undefined)
      data.boostPercentage = updates.boostPercentage;
    if (updates.finalReward !== undefined) data.finalReward = updates.finalReward;
    if (updates.endTime !== undefined) data.endTime = updates.endTime;
    if (updates.nextAvailable !== undefined)
      data.nextAvailable = updates.nextAvailable;
    if (updates.status !== undefined) data.status = updates.status;

    const session = await prisma.miningSession.update({
      where: { id },
      data,
    });
    return session;
  }

  // Referral operations
  async getReferralsByReferrer(referrerId: string): Promise<Referral[]> {
    const referrals = await prisma.referral.findMany({
      where: { referrerId },
    });
    return referrals.map(convertPrismaReferral);
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const existing = await prisma.referral.findFirst({
      where: {
        referrerId: referral.referrerId,
        referredUserId: referral.referredUserId,
        level: referral.level,
      },
    });

    if (existing) return convertPrismaReferral(existing);

    const newReferral = await prisma.referral.create({
      data: {
        referrerId: referral.referrerId,
        referredUserId: referral.referredUserId,
        level: referral.level,
        totalCommission: new Prisma.Decimal(
          referral.totalCommission || "0"
        ),
      },
    });
    return convertPrismaReferral(newReferral);
  }

  async updateReferral(
    id: string,
    updates: Partial<Referral>
  ): Promise<Referral> {
    const data: any = {};

    if (updates.totalCommission !== undefined) {
      data.totalCommission = new Prisma.Decimal(updates.totalCommission);
    }

    const referral = await prisma.referral.update({
      where: { id },
      data,
    });
    return convertPrismaReferral(referral);
  }

  private async resolveReferralCodeToUserId(refCode?: string | null): Promise<string | null> {
    const normalized = normalizeReferralCode(refCode);
    if (!normalized) return null;

    const referrer = await prisma.user.findUnique({
      where: { referralCode: normalized },
      select: { id: true },
    });

    return referrer?.id || null;
  }

  private async ensureReferralRecord(
    referrerId: string,
    referredUserId: string,
    level: number,
    totalCommission = "0"
  ): Promise<void> {
    if (!referrerId || !referredUserId || referrerId === referredUserId) return;

    const existing = await prisma.referral.findFirst({
      where: { referrerId, referredUserId, level },
      select: { id: true },
    });

    if (existing) return;

    await prisma.referral.create({
      data: {
        referrerId,
        referredUserId,
        level,
        totalCommission: new Prisma.Decimal(totalCommission),
      },
    });
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
    const chain: User[] = [];
    const seen = new Set<string>([userId]);
    let currentUserId = userId;

    for (let i = 0; i < maxLevels; i++) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
      });

      if (!currentUser || !currentUser.referredBy) break;

      let referrer = await prisma.user.findUnique({
        where: { id: currentUser.referredBy },
      });

      // Backfill old records where referredBy stored a referral code instead of a user id.
      if (!referrer) {
        const normalizedCode = normalizeReferralCode(currentUser.referredBy);
        referrer = normalizedCode
          ? await prisma.user.findUnique({ where: { referralCode: normalizedCode } })
          : null;

        if (referrer) {
          await prisma.user.update({
            where: { id: currentUser.id },
            data: { referredBy: referrer.id },
          });
        }
      }

      if (!referrer) break;
      if (seen.has(referrer.id)) {
        console.warn(`[REFERRAL] Referral cycle detected at user ${referrer.id}; stopping chain lookup.`);
        break;
      }

      chain.push(convertPrismaUser(referrer));
      seen.add(referrer.id);
      currentUserId = referrer.id;
    }

    return chain;
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
    const tasks = await prisma.task.findMany({
      where: { isActive: true },
    });
    return tasks.map(convertPrismaTask);
  }

  async getUserTasks(userId: string): Promise<UserTask[]> {
    const userTasks = await prisma.userTask.findMany({
      where: { userId },
    });
    return userTasks.map(convertPrismaUserTask);
  }

  async createUserTask(userTask: InsertUserTask): Promise<UserTask> {
    const newUserTask = await prisma.userTask.create({
      data: {
        userId: userTask.userId,
        taskId: userTask.taskId,
        progress: userTask.progress || 0,
        maxProgress: userTask.maxProgress || 1,
        completed: userTask.completed || false,
        completedAt: userTask.completedAt,
      },
    });
    return convertPrismaUserTask(newUserTask);
  }

  async updateUserTask(
    id: string,
    updates: Partial<UserTask>
  ): Promise<UserTask> {
    const data: any = {};
    if (updates.progress !== undefined) data.progress = updates.progress;
    if (updates.maxProgress !== undefined)
      data.maxProgress = updates.maxProgress;
    if (updates.completed !== undefined) data.completed = updates.completed;
    if (updates.completedAt !== undefined)
      data.completedAt = updates.completedAt;

    const userTask = await prisma.userTask.update({
      where: { id },
      data,
    });
    return convertPrismaUserTask(userTask);
  }

  // Achievement operations
  async getAllAchievements(): Promise<Achievement[]> {
    return await prisma.achievement.findMany();
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return await prisma.userAchievement.findMany({
      where: { userId },
    });
  }

  async createUserAchievement(
    userAchievement: InsertUserAchievement
  ): Promise<UserAchievement> {
    const newUserAchievement = await prisma.userAchievement.create({
      data: {
        userId: userAchievement.userId,
        achievementId: userAchievement.achievementId,
      },
    });
    return newUserAchievement;
  }

  async checkAndUnlockAchievements(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const balance = await this.getBalance(userId);
    if (!balance) return;

    const allAchievements = await this.getAllAchievements();
    const userAchievementsList = await this.getUserAchievements(userId);
    const unlockedIds = new Set(
      userAchievementsList.map((ua) => ua.achievementId)
    );

    const totalEarned = parseFloat(balance.totalEarned);
    const userReferrals = await this.getReferralsByReferrer(userId);
    const directReferrals = userReferrals.filter((r) => r.level === 1);
    const miningSessions = await this.getMiningHistory(userId);
    const completedMining = miningSessions.filter(
      (s) => s.status === "completed"
    );

    let totalXpReward = 0;

    for (const achievement of allAchievements) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.category) {
        case "earnings":
          shouldUnlock = totalEarned >= achievement.requirement;
          break;
        case "referrals":
          shouldUnlock = directReferrals.length >= achievement.requirement;
          break;
        case "streaks":
          shouldUnlock = (user.streak || 0) >= achievement.requirement;
          break;
        case "mining":
          shouldUnlock = completedMining.length >= achievement.requirement;
          break;
      }

      if (shouldUnlock) {
        await this.createUserAchievement({
          userId,
          achievementId: achievement.id,
        });

        totalXpReward += achievement.xpReward;

        await this.createActivity({
          userId,
          type: "achievement_unlocked",
          description: `Unlocked achievement: ${achievement.title} (+${achievement.xpReward} XP)`,
        });

        const { notifyUser } = await import("./notifications");
        void notifyUser(userId, {
          type: "achievement_unlocked",
          title: "🏆 Achievement Unlocked!",
          message: `${achievement.title} - You earned ${achievement.xpReward} XP!`,
          url: "/achievements",
          metadata: {
            achievementId: achievement.id,
            achievementTitle: achievement.title,
            xpReward: achievement.xpReward,
          },
        }).catch((err) => {
          console.error(
            "Error sending achievement notification (non-blocking):",
            err
          );
        });
      }
    }

    if (totalXpReward > 0) {
      const nextXp = (user.xp || 0) + totalXpReward;
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: nextXp,
          level: Math.floor(nextXp / 1000) + 1,
        },
      });
    }
  }

  async getAchievementsWithUnlockCount(): Promise<
    (Achievement & { unlockCount: number })[]
  > {
    const achievements = await prisma.achievement.findMany({
      orderBy: { requirement: "asc" },
    });

    const counts = await Promise.all(
      achievements.map((achievement) =>
        prisma.userAchievement.count({
          where: { achievementId: achievement.id },
        })
      )
    );

    return achievements.map((achievement, index) => ({
      ...(achievement as any),
      unlockCount: counts[index] ?? 0,
    })) as (Achievement & { unlockCount: number })[];
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

      return {
        ...baseData,
        displayName: generateAnonymizedHandle(item.userId),
      };
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

      return {
        ...baseData,
        displayName: "You",
      };
    };

    // All-time overall should use the stored User.xp total so it remains fast and accurate.
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
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            xp: true,
          },
        },
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
    const userPosition = currentUserRank
      ? formatUserPosition(currentUserRank)
      : null;

    return {
      leaderboard,
      userPosition,
      meta,
    };
  }

  // Raw query support
  async raw(query: string, params: any[] = []): Promise<any[]> {
    return await prisma.$queryRawUnsafe(query, ...params);
  }
}

export const storage = new DatabaseStorage();
