// server/storage.ts
import { PrismaClient, Prisma } from "@prisma/client";
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

const prisma = new PrismaClient();

const DEFAULT_MINING_BASE_REWARD = 20; // default XP per session
const XP_TO_XNRT_RATE = 0.5; // 1 XP → 0.5 XNRT

function generateReferralCode(): string {
  return `XNRT${nanoid(8).toUpperCase()}`;
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
  // User operations (IMPORTANT: mandatory for Replit Auth)
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
  processMiningRewards(): Promise<void>;

  // Referral operations
  getReferralsByReferrer(referrerId: string): Promise<Referral[]>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  updateReferral(id: string, updates: Partial<Referral>): Promise<Referral>;
  distributeReferralCommissions(userId: string, amount: number): Promise<void>;
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
    isAdmin: boolean
  ): Promise<{ leaderboard: any[]; userPosition: any | null }>;

  // Raw query support
  raw(query: string, params?: any[]): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user ? convertPrismaUser(user) : undefined;
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
        referredBy: refCode || null,
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

    // If referred by someone, create referral record
    if (refCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: refCode },
      });
      if (referrer) {
        await this.createReferral({
          referrerId: referrer.id,
          referredUserId: user.id,
          level: 1,
          totalCommission: "0",
        });

        // Create notification for referrer about new referral
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

        // Check and unlock referral achievements for the referrer
        await this.checkAndUnlockAchievements(referrer.id);
      }
    }

    return convertPrismaUser(user);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const updateData: any = {};

    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.isAdmin !== undefined) updateData.isAdmin = updates.isAdmin;
    if (updates.xp !== undefined) updateData.xp = updates.xp;
    if (updates.level !== undefined) updateData.level = updates.level;
    if (updates.streak !== undefined) updateData.streak = updates.streak;
    if (updates.lastCheckIn !== undefined)
      updateData.lastCheckIn = updates.lastCheckIn;
    updateData.updatedAt = new Date();

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    return convertPrismaUser(user);
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prisma.user.findMany();
    return users.map(convertPrismaUser);
  }

  // Balance operations
  async getBalance(userId: string): Promise<Balance | undefined> {
    const balance = await prisma.balance.findUnique({
      where: { userId },
    });
    return balance ? convertPrismaBalance(balance) : undefined;
  }

  async createBalance(balance: InsertBalance): Promise<Balance> {
    const newBalance = await prisma.balance.create({
      data: {
        userId: balance.userId,
        xnrtBalance: new Prisma.Decimal(balance.xnrtBalance || "0"),
        stakingBalance: new Prisma.Decimal(balance.stakingBalance || "0"),
        miningBalance: new Prisma.Decimal(balance.miningBalance || "0"),
        referralBalance: new Prisma.Decimal(balance.referralBalance || "0"),
        totalEarned: new Prisma.Decimal(balance.totalEarned || "0"),
      },
    });
    return convertPrismaBalance(newBalance);
  }

  async updateBalance(
    userId: string,
    updates: Partial<Balance>
  ): Promise<Balance> {
    const data: any = { updatedAt: new Date() };

    if (updates.xnrtBalance !== undefined)
      data.xnrtBalance = new Prisma.Decimal(updates.xnrtBalance);
    if (updates.stakingBalance !== undefined)
      data.stakingBalance = new Prisma.Decimal(updates.stakingBalance);
    if (updates.miningBalance !== undefined)
      data.miningBalance = new Prisma.Decimal(updates.miningBalance);
    if (updates.referralBalance !== undefined)
      data.referralBalance = new Prisma.Decimal(updates.referralBalance);
    if (updates.totalEarned !== undefined)
      data.totalEarned = new Prisma.Decimal(updates.totalEarned);

    const balance = await prisma.balance.update({
      where: { userId },
      data,
    });
    return convertPrismaBalance(balance);
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
    const balance = await prisma.balance.update({
      where: { userId },
      data: {
        stakingBalance: {
          [operation === "add" ? "increment" : "decrement"]:
            new Prisma.Decimal(amount),
        },
      },
    });
    return convertPrismaBalance(balance);
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
  async processMiningRewards(): Promise<void> {
    const activeSessions = await prisma.miningSession.findMany({
      where: { status: "active" },
    });

    const now = new Date();

    for (const session of activeSessions) {
      if (!session.endTime) continue;

      const endTime = new Date(session.endTime);
      if (now < endTime) continue; // still running

      const baseReward = session.baseReward ?? DEFAULT_MINING_BASE_REWARD;
      const boostPercentage = session.boostPercentage ?? 0;

      const finalReward =
        session.finalReward ??
        (baseReward + Math.floor((baseReward * boostPercentage) / 100));

      const xpReward = finalReward;
      const xnrtReward = finalReward * XP_TO_XNRT_RATE;

      await this.updateMiningSession(session.id, {
        status: "completed",
        finalReward,
        endTime: now, // completion time = when processor runs
      });

      const user = await this.getUser(session.userId);
      if (user) {
        await this.updateUser(session.userId, {
          xp: (user.xp || 0) + xpReward,
        });
      }

      const balance = await this.getBalance(session.userId);
      if (balance) {
        await this.updateBalance(session.userId, {
          miningBalance: (
            parseFloat(balance.miningBalance) + xnrtReward
          ).toString(),
          totalEarned: (
            parseFloat(balance.totalEarned) + xnrtReward
          ).toString(),
        });
      }

      await this.createActivity({
        userId: session.userId,
        type: "mining_completed",
        description: `Auto-completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(
          1
        )} XNRT`,
      });

      const { notifyUser } = await import("./notifications");
      void notifyUser(session.userId, {
        type: "mining_completed",
        title: "⛏️ Mining Complete!",
        message: `You earned ${xpReward} XP and ${xnrtReward.toFixed(
          1
        )} XNRT from your 24-hour mining session`,
        url: "/mining",
        metadata: {
          xpReward,
          xnrtReward: xnrtReward.toString(),
          sessionId: session.id,
        },
      }).catch((err) => {
        console.error(
          "Error sending mining notification (non-blocking):",
          err
        );
      });

      await this.checkAndUnlockAchievements(session.userId);
    }
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
      const baseReward = session.baseReward ?? DEFAULT_MINING_BASE_REWARD;
      const boostPercentage = session.boostPercentage ?? 0;

      const finalReward =
        session.finalReward ??
        (baseReward + Math.floor((baseReward * boostPercentage) / 100));

      const xpReward = finalReward;
      const xnrtReward = finalReward * XP_TO_XNRT_RATE;

      await this.updateMiningSession(session.id, {
        status: "completed",
        finalReward,
        endTime: new Date(),
      });

      const user = await this.getUser(userId);
      if (user) {
        await this.updateUser(userId, {
          xp: (user.xp || 0) + xpReward,
        });
      }

      const balance = await this.getBalance(userId);
      if (balance) {
        await this.updateBalance(userId, {
          miningBalance: (
            parseFloat(balance.miningBalance) + xnrtReward
          ).toString(),
          totalEarned: (
            parseFloat(balance.totalEarned) + xnrtReward
          ).toString(),
        });
      }

      await this.createActivity({
        userId,
        type: "mining_completed",
        description: `Completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(
          1
        )} XNRT`,
      });

      await this.checkAndUnlockAchievements(userId);
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
    const defaultNextAvailable = new Date(
      defaultEndTime.getTime() + 60 * 60 * 1000
    );

    const base = session.baseReward ?? DEFAULT_MINING_BASE_REWARD;
    const boost = session.boostPercentage ?? 0;
    const computedFinal = base + Math.floor((base * boost) / 100);

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

  async distributeReferralCommissions(
    userId: string,
    amount: number
  ): Promise<void> {
    console.log(
      `[REFERRAL] Starting distribution for userId: ${userId}, amount: ${amount}`
    );

    const COMMISSION_RATES = {
      1: 0.06,
      2: 0.03,
      3: 0.01,
    };

    const referrerChain = await this.getReferrerChain(userId, 3);
    console.log(
      `[REFERRAL] Referrer chain length: ${referrerChain.length}`,
      referrerChain.map((r) => ({ id: r?.id, email: r?.email }))
    );

    for (let level = 1; level <= 3; level++) {
      const referrer = referrerChain[level - 1];
      const commission = amount * COMMISSION_RATES[level as 1 | 2 | 3];
      console.log(
        `[REFERRAL] Level ${level}: referrer=${
          referrer?.email || "null"
        }, commission=${commission}`
      );

      if (!referrer) {
        const COMPANY_ADMIN_EMAIL = "noahkeaneowen@hotmail.com";
        console.log(
          `[REFERRAL] No referrer at level ${level}, using company fallback: ${COMPANY_ADMIN_EMAIL}`
        );

        const companyAccount = await prisma.user.findFirst({
          where: {
            email: COMPANY_ADMIN_EMAIL,
            isAdmin: true,
          },
        });

        if (!companyAccount) {
          console.error(
            `[REFERRAL] Company admin account not found: ${COMPANY_ADMIN_EMAIL}`
          );
          throw new Error(
            `Company admin account (${COMPANY_ADMIN_EMAIL}) not found - cannot process commission fallback`
          );
        }

        console.log(
          `[REFERRAL] Company account found: ${companyAccount.id}, crediting ${commission} XNRT`
        );

        const companyBalance = await this.getBalance(companyAccount.id);
        if (companyBalance) {
          const newReferralBalance = (
            parseFloat(companyBalance.referralBalance) + commission
          ).toString();
          const newTotalEarned = (
            parseFloat(companyBalance.totalEarned) + commission
          ).toString();
          console.log(
            `[REFERRAL] Updating company balance: referral ${companyBalance.referralBalance} → ${newReferralBalance}`
          );

          await this.updateBalance(companyAccount.id, {
            referralBalance: newReferralBalance,
            totalEarned: newTotalEarned,
          });

          await this.createActivity({
            userId: companyAccount.id,
            type: "company_commission",
            description: `Received ${commission.toFixed(
              2
            )} XNRT company commission from missing level ${level} referrer`,
          });
        }
        continue;
      }

      const existingReferral = await prisma.referral.findFirst({
        where: {
          referrerId: referrer.id,
          referredUserId: userId,
        },
      });

      if (existingReferral) {
        const newCommission =
          parseFloat(decimalToString(existingReferral.totalCommission)) +
          commission;
        await this.updateReferral(existingReferral.id, {
          totalCommission: newCommission.toString(),
        });
      } else {
        await this.createReferral({
          referrerId: referrer.id,
          referredUserId: userId,
          level,
          totalCommission: commission.toString(),
        });
      }

      const referrerBalance = await this.getBalance(referrer.id);
      if (referrerBalance) {
        const newReferralBalance = (
          parseFloat(referrerBalance.referralBalance) + commission
        ).toString();
        const newTotalEarned = (
          parseFloat(referrerBalance.totalEarned) + commission
        ).toString();
        console.log(
          `[REFERRAL] Updating referrer ${referrer.email} balance: referral ${referrerBalance.referralBalance} → ${newReferralBalance}`
        );

        await this.updateBalance(referrer.id, {
          referralBalance: newReferralBalance,
          totalEarned: newTotalEarned,
        });
      } else {
        console.warn(
          `[REFERRAL] No balance found for referrer ${referrer.email} (${referrer.id})`
        );
      }

      await this.createActivity({
        userId: referrer.id,
        type: "referral_commission",
        description: `Earned ${commission.toFixed(
          2
        )} XNRT commission from level ${level} referral`,
      });

      const { notifyUser } = await import("./notifications");
      void notifyUser(referrer.id, {
        type: "referral_commission",
        title: "💰 Referral Bonus!",
        message: `You earned ${commission.toFixed(
          2
        )} XNRT commission from a level ${level} referral`,
        url: "/referrals",
        // pass plain object; notifications module / createNotification will stringify
        metadata: {
          amount: commission.toString(),
          level,
          referredUserId: userId,
        } as any,
      }).catch((err) => {
        console.error(
          "Error sending referral commission notification (non-blocking):",
          err
        );
      });

      console.log(
        `[REFERRAL] Level ${level} commission complete for ${referrer.email}`
      );
    }

    console.log(`[REFERRAL] Distribution complete for user ${userId}`);
  }

  async getReferrerChain(userId: string, maxLevels: number): Promise<User[]> {
    const chain: User[] = [];
    let currentUserId = userId;

    for (let i = 0; i < maxLevels; i++) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
      });

      if (!currentUser || !currentUser.referredBy) break;

      const referrer = await prisma.user.findUnique({
        where: { id: currentUser.referredBy },
      });

      if (!referrer) break;

      chain.push(convertPrismaUser(referrer));
      currentUserId = referrer.id;
    }

    return chain;
  }

  // Transaction operations
  async getTransactionsByUser(
    userId: string,
    type?: string
  ): Promise<Transaction[]> {
    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return transactions.map(convertPrismaTransaction);
  }

  async getTransactionById(id: string): Promise<Transaction | undefined> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });
    return transaction ? convertPrismaTransaction(transaction) : undefined;
  }

  async createTransaction(
    transaction: InsertTransaction
  ): Promise<Transaction> {
    const data: any = {
      userId: transaction.userId,
      type: transaction.type,
      amount: new Prisma.Decimal(transaction.amount),
      status: transaction.status || "pending",
    };

    if (transaction.usdtAmount !== undefined && transaction.usdtAmount !== null)
      data.usdtAmount = new Prisma.Decimal(transaction.usdtAmount);
    if (transaction.source !== undefined && transaction.source !== null)
      data.source = transaction.source;
    if (
      transaction.walletAddress !== undefined &&
      transaction.walletAddress !== null
    ) {
      data.walletAddress = transaction.walletAddress;
    }
    if (
      transaction.transactionHash !== undefined &&
      transaction.transactionHash !== null
    ) {
      data.transactionHash = transaction.transactionHash;
    }
    if (
      transaction.proofImageUrl !== undefined &&
      transaction.proofImageUrl !== null
    ) {
      data.proofImageUrl = transaction.proofImageUrl;
    }
    if (
      transaction.adminNotes !== undefined &&
      transaction.adminNotes !== null
    ) {
      data.adminNotes = transaction.adminNotes;
    }
    if (transaction.fee !== undefined && transaction.fee !== null) {
      data.fee = new Prisma.Decimal(transaction.fee);
    }
    if (transaction.netAmount !== undefined && transaction.netAmount !== null) {
      data.netAmount = new Prisma.Decimal(transaction.netAmount);
    }
    if (
      transaction.approvedBy !== undefined &&
      transaction.approvedBy !== null
    ) {
      data.approvedBy = transaction.approvedBy;
    }
    if (
      transaction.approvedAt !== undefined &&
      transaction.approvedAt !== null
    ) {
      data.approvedAt = transaction.approvedAt;
    }
    if (transaction.verified !== undefined) {
      data.verified = transaction.verified;
    }
    if (transaction.confirmations !== undefined) {
      data.confirmations = transaction.confirmations;
    }
    if (
      transaction.verificationData !== undefined &&
      transaction.verificationData !== null
    ) {
      data.verificationData = transaction.verificationData;
    }

    const newTransaction = await prisma.transaction.create({ data });
    return convertPrismaTransaction(newTransaction);
  }

  async updateTransaction(
    id: string,
    updates: Partial<Transaction>
  ): Promise<Transaction> {
    const data: any = {};

    if (updates.amount !== undefined && updates.amount !== null) {
      data.amount = new Prisma.Decimal(updates.amount);
    }
    if (updates.usdtAmount !== undefined && updates.usdtAmount !== null) {
      data.usdtAmount = new Prisma.Decimal(updates.usdtAmount);
    }
    if (updates.status !== undefined) data.status = updates.status;
    if (
      updates.adminNotes !== undefined &&
      updates.adminNotes !== null
    ) {
      data.adminNotes = updates.adminNotes;
    }
    if (updates.fee !== undefined && updates.fee !== null) {
      data.fee = new Prisma.Decimal(updates.fee);
    }
    if (updates.netAmount !== undefined && updates.netAmount !== null) {
      data.netAmount = new Prisma.Decimal(updates.netAmount);
    }
    if (
      updates.approvedBy !== undefined &&
      updates.approvedBy !== null
    ) {
      data.approvedBy = updates.approvedBy;
    }
    if (
      updates.approvedAt !== undefined &&
      updates.approvedAt !== null
    ) {
      data.approvedAt = updates.approvedAt;
    }
    if (updates.verified !== undefined) {
      data.verified = updates.verified;
    }
    if (updates.confirmations !== undefined) {
      data.confirmations = updates.confirmations;
    }
    if (
      updates.verificationData !== undefined &&
      updates.verificationData !== null
    ) {
      data.verificationData = updates.verificationData;
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data,
    });
    return convertPrismaTransaction(transaction);
  }

  async getAllTransactions(type?: string): Promise<Transaction[]> {
    const where: any = {};
    if (type) {
      where.type = type;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return transactions.map(convertPrismaTransaction);
  }

  async getPendingTransactions(type: string): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: {
        type,
        status: "pending",
      },
      include: {
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return transactions.map(convertPrismaTransaction);
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
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: (user.xp || 0) + totalXpReward,
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
    const data: any = {
      userId: activity.userId,
      type: activity.type,
      description: activity.description,
    };

    if (activity.metadata !== undefined && activity.metadata !== null) {
      data.metadata = activity.metadata;
    }

    const newActivity = await prisma.activity.create({ data });
    return convertPrismaActivity(newActivity);
  }

  async getActivities(
    userId: string,
    limit: number = 10
  ): Promise<Activity[]> {
    const activities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return activities.map(convertPrismaActivity);
  }

  // Notification operations
  async createNotification(
    notification: InsertNotification
  ): Promise<Notification> {
    const data: any = {
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read || false,
    };

    // Expect metadata as a plain object or value; stringify only if not already a JSON string
    if (notification.metadata !== undefined && notification.metadata !== null) {
      data.metadata =
        typeof notification.metadata === "string"
          ? notification.metadata
          : JSON.stringify(notification.metadata);
    }

    const newNotification = await prisma.notification.create({ data });
    return convertPrismaNotification(newNotification);
  }

  async getNotifications(
    userId: string,
    limit: number = 20
  ): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return notifications.map(convertPrismaNotification);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  async markNotificationAsRead(id: string): Promise<Notification> {
    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return convertPrismaNotification(notification);
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });
  }

  async getNotificationsPendingPush(
    limit: number = 50
  ): Promise<Notification[]> {
    // @ts-ignore pendingPush field exists in runtime but may not be in local type cache
    const notifications = await prisma.notification.findMany({
      where: {
        pendingPush: true,
        deliveryAttempts: {
          lt: 5,
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return notifications.map(convertPrismaNotification);
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
    const data: any = {};
    if (updates.deliveredAt !== undefined)
      data.deliveredAt = updates.deliveredAt;
    if (updates.deliveryAttempts !== undefined)
      data.deliveryAttempts = updates.deliveryAttempts;
    if (updates.lastAttemptAt !== undefined)
      data.lastAttemptAt = updates.lastAttemptAt;
    if (updates.pendingPush !== undefined)
      data.pendingPush = updates.pendingPush;
    if (updates.pushError !== undefined) data.pushError = updates.pushError;

    const notification = await prisma.notification.update({
      where: { id },
      data,
    });
    return convertPrismaNotification(notification);
  }

  // Push Subscription operations
  async getPushSubscription(
    userId: string,
    endpoint: string
  ): Promise<PushSubscription | null> {
    try {
      const subscription = await prisma.pushSubscription.findFirst({
        where: { userId, endpoint },
      });
      return subscription ? convertPrismaPushSubscription(subscription) : null;
    } catch (error) {
      console.error("Error getting push subscription:", error);
      return null;
    }
  }

  async createPushSubscription(
    data: InsertPushSubscription
  ): Promise<PushSubscription> {
    try {
      const subscription = await prisma.pushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId: data.userId,
            endpoint: data.endpoint,
          },
        },
        update: {
          p256dh: data.p256dh,
          auth: data.auth,
          expirationTime: data.expirationTime || null,
          enabled: true,
          updatedAt: new Date(),
        },
        create: {
          userId: data.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          expirationTime: data.expirationTime || null,
          enabled: true,
        },
      });
      return convertPrismaPushSubscription(subscription);
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
      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
    } catch (error) {
      console.error("Error deleting push subscription:", error);
      throw new Error("Failed to delete push subscription");
    }
  }

  async getUserPushSubscriptions(
    userId: string
  ): Promise<PushSubscription[]> {
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId, enabled: true },
        orderBy: { createdAt: "desc" },
      });
      return subscriptions.map(convertPrismaPushSubscription);
    } catch (error) {
      console.error("Error getting user push subscriptions:", error);
      return [];
    }
  }

  async disablePushSubscription(endpoint: string): Promise<void> {
    try {
      await prisma.pushSubscription.updateMany({
        where: { endpoint },
        data: { enabled: false, updatedAt: new Date() },
      });
    } catch (error) {
      console.error("Error disabling push subscription:", error);
    }
  }

  // XP Leaderboard operations
  async getXPLeaderboard(
    currentUserId: string,
    period: string,
    category: string,
    isAdmin: boolean = false
  ): Promise<{ leaderboard: any[]; userPosition: any | null }> {
    const now = new Date();
    let startDate: Date | null = null;

    // Determine time window
    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly": {
        const dayOfWeek = now.getDay();
        startDate = new Date(
          now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
        );
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case "monthly":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "all-time":
      default:
        startDate = null;
        break;
    }

    // ---------------- Overall leaderboard (pure XP) ----------------
    if (category === "overall") {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          xp: true,
        },
        orderBy: { xp: "desc" },
        take: 100,
      });

      const leaderboard = users.slice(0, 10).map((user, index) => {
        const baseData = {
          xp: user.xp,
          categoryXp: user.xp,
          rank: index + 1,
        };

        if (isAdmin) {
          return {
            ...baseData,
            userId: user.id,
            username: user.username,
            email: user.email,
            displayName: user.username || user.email,
          };
        }

        return {
          ...baseData,
          displayName: generateAnonymizedHandle(user.id),
        };
      });

      const currentUserRank = users.findIndex((u) => u.id === currentUserId);
      let userPosition: any = null;

      if (currentUserRank !== -1 && currentUserRank > 9) {
        const currentUser = users[currentUserRank];
        const baseData = {
          xp: currentUser.xp,
          categoryXp: currentUser.xp,
          rank: currentUserRank + 1,
        };

        if (isAdmin) {
          userPosition = {
            ...baseData,
            userId: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            displayName: currentUser.username || currentUser.email,
          };
        } else {
          userPosition = {
            ...baseData,
            displayName: "You",
          };
        }
      }

      return { leaderboard, userPosition };
    }

    // ---------------- Category leaderboards ----------------
    const typeFilter =
      category === "mining"
        ? "mining"
        : category === "staking"
        ? "stak"
        : "referral";

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        xp: true,
      },
      orderBy: { xp: "desc" },
      take: 100,
    });

    const userXPData = await Promise.all(
      users.map(async (user) => {
        const whereClause: any = {
          userId: user.id,
          type: { contains: typeFilter },
        };

        if (startDate) {
          whereClause.createdAt = { gte: startDate };
        }

        const activities = await prisma.activity.findMany({
          where: whereClause,
        });

        let categoryXp = 0;

        for (const activity of activities) {
          const desc = activity.description || "";

          if (category === "mining") {
            // For mining: rank by XP mentioned in description
            // e.g. "earned 20 XP and 10 XNRT"
            const xpMatch = desc.match(/(\d+)\s*XP/i);
            if (xpMatch) {
              categoryXp += parseInt(xpMatch[1], 10);
            }
          } else {
            // For staking & referral: rank by XNRT earned from description
            // e.g. "Earned 12.34 XNRT from staking", "Earned 5.00 XNRT commission..."
            const xnrtMatch = desc.match(/([\d.]+)\s*XNRT/i);
            if (xnrtMatch) {
              categoryXp += parseFloat(xnrtMatch[1]);
            }
          }
        }

        return {
          userId: user.id,
          username: user.username,
          email: user.email,
          xp: user.xp,
          categoryXp,
        };
      })
    );

    // Sort by category "score" (XP or XNRT depending on category)
    userXPData.sort((a, b) => b.categoryXp - a.categoryXp);

    const leaderboard = userXPData.slice(0, 10).map((user, index) => {
      const baseData = {
        xp: user.xp,
        categoryXp: user.categoryXp,
        rank: index + 1,
      };

      if (isAdmin) {
        return {
          ...baseData,
          userId: user.userId,
          username: user.username,
          email: user.email,
          displayName: user.username || user.email,
        };
      }

      return {
        ...baseData,
        displayName: generateAnonymizedHandle(user.userId),
      };
    });

    const currentUserRank = userXPData.findIndex(
      (u) => u.userId === currentUserId
    );
    let userPosition: any = null;

    if (currentUserRank !== -1 && currentUserRank > 9) {
      const currentUser = userXPData[currentUserRank];
      const baseData = {
        xp: currentUser.xp,
        categoryXp: currentUser.categoryXp,
        rank: currentUserRank + 1,
      };

      if (isAdmin) {
        userPosition = {
          ...baseData,
          userId: currentUser.userId,
          username: currentUser.username,
          email: currentUser.email,
          displayName: currentUser.username || currentUser.email,
        };
      } else {
        userPosition = {
          ...baseData,
          displayName: "You",
        };
      }
    }

    return { leaderboard, userPosition };
  }

  // Raw query support
  async raw(query: string, params: any[] = []): Promise<any[]> {
    return await prisma.$queryRawUnsafe(query, ...params);
  }
}

export const storage = new DatabaseStorage();
