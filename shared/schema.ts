import { z } from "zod";

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  referralCode: string;
  referredBy?: string | null;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  isAdmin: boolean;
  xp: number;
  level: number;
  streak: number;
  lastCheckIn?: Date | null;
  depositAddress?: string | null;
  derivationIndex?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UpsertUser = Partial<User> & { id?: string };

// ─── Balance ─────────────────────────────────────────────────────────────────

export interface Balance {
  id: string;
  userId: string;
  xnrtBalance: string;
  stakingBalance: string;
  miningBalance: string;
  referralBalance: string;
  totalEarned: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertBalance = {
  userId: string;
  xnrtBalance?: string;
  stakingBalance?: string;
  miningBalance?: string;
  referralBalance?: string;
  totalEarned?: string;
};

// ─── Stake ───────────────────────────────────────────────────────────────────

export interface Stake {
  id: string;
  userId: string;
  tier: string;
  amount: string;
  dailyRate: string;
  duration: number;
  startDate: Date;
  endDate: Date;
  totalProfit: string;
  lastProfitDate?: Date | null;
  status: string;
  isLoan?: boolean;
  loanProgram?: string | null;
  unlockMet?: boolean;
  requiredReferrals?: number;
  requiredInvestingReferrals?: number;
  minInvestUsdtPerReferral?: string;
  createdAt: Date;
}

export const insertStakeSchema = z.object({
  userId: z.string(),
  tier: z.string(),
  amount: z.string(),
  dailyRate: z.string(),
  duration: z.number().int(),
  startDate: z.date().optional(),
  endDate: z.date(),
  totalProfit: z.string().optional().default("0"),
  lastProfitDate: z.date().nullable().optional(),
  status: z.string().optional().default("active"),
  isLoan: z.boolean().optional(),
  loanProgram: z.string().nullable().optional(),
  unlockMet: z.boolean().optional(),
  requiredReferrals: z.number().int().optional(),
  requiredInvestingReferrals: z.number().int().optional(),
  minInvestUsdtPerReferral: z.string().nullable().optional(),
});

export type InsertStake = z.infer<typeof insertStakeSchema>;

// ─── MiningSession ───────────────────────────────────────────────────────────

export interface MiningSession {
  id: string;
  userId: string;
  baseReward: number;
  adBoostCount: number;
  boostPercentage: number;
  finalReward: number;
  startTime: Date;
  endTime?: Date | null;
  nextAvailable: Date;
  status: string;
  createdAt: Date;
}

export const insertMiningSessionSchema = z.object({
  userId: z.string(),
  baseReward: z.number().int().optional().default(10),
  adBoostCount: z.number().int().optional().default(0),
  boostPercentage: z.number().int().optional().default(0),
  finalReward: z.number().int().optional().default(10),
  startTime: z.date().optional(),
  endTime: z.date().nullable().optional(),
  nextAvailable: z.date(),
  status: z.string().optional().default("active"),
});

export type InsertMiningSession = z.infer<typeof insertMiningSessionSchema>;

// ─── Referral ────────────────────────────────────────────────────────────────

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  level: number;
  totalCommission: string;
  createdAt: Date;
  displayName?: string;
  joinedAt?: Date | string | null;
  hasDeposited?: boolean;
  depositCount?: number;
  totalDeposited?: string;
}

export type InsertReferral = {
  referrerId: string;
  referredUserId: string;
  level: number;
  totalCommission?: string;
};

export interface ReferralCommission {
  id: string;
  transactionId: string;
  referrerId: string;
  referredUserId: string;
  level: number;
  baseAmount: string;
  rate: string;
  commission: string;
  status: string;
  createdAt: Date;
  referredDisplayName?: string;
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: string;
  usdtAmount?: string | null;
  source?: string | null;
  walletAddress?: string | null;
  transactionHash?: string | null;
  proofImageUrl?: string | null;
  status: string;
  adminNotes?: string | null;
  fee?: string | null;
  netAmount?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  verified: boolean;
  confirmations: number;
  verificationData?: any;
  createdAt: Date;
  user?: { email: string; username: string };
}

export const insertTransactionSchema = z.object({
  userId: z.string(),
  type: z.string(),
  amount: z.string(),
  usdtAmount: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  walletAddress: z.string().nullable().optional(),
  transactionHash: z.string().nullable().optional(),
  proofImageUrl: z.string().nullable().optional(),
  status: z.string().optional().default("pending"),
  adminNotes: z.string().nullable().optional(),
  fee: z.string().nullable().optional(),
  netAmount: z.string().nullable().optional(),
  approvedBy: z.string().nullable().optional(),
  approvedAt: z.date().nullable().optional(),
  verified: z.boolean().optional(),
  confirmations: z.number().int().optional(),
  verificationData: z.any().optional(),
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// ─── Task ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  xnrtReward: string;
  category: string;
  requirements?: string | null;
  missionType: "one_time" | "daily" | "weekly" | string;
  triggerKey: string;
  targetCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export type InsertTask = {
  title: string;
  description: string;
  xpReward: number;
  xnrtReward?: string;
  category: string;
  requirements?: string | null;
  missionType?: "one_time" | "daily" | "weekly" | string;
  triggerKey?: string;
  targetCount?: number;
  sortOrder?: number;
  isActive?: boolean;
};

// ─── UserTask ────────────────────────────────────────────────────────────────

export interface UserTask {
  id: string;
  userId: string;
  taskId: string;
  periodKey: string;
  progress: number;
  maxProgress: number;
  completed: boolean;
  completedAt?: Date | null;
  claimed: boolean;
  claimedAt?: Date | null;
  progressSource?: string | null;
  lastProgressAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

export type InsertUserTask = {
  userId: string;
  taskId: string;
  periodKey?: string;
  progress?: number;
  maxProgress?: number;
  completed?: boolean;
  completedAt?: Date | null;
  claimed?: boolean;
  claimedAt?: Date | null;
  progressSource?: string | null;
  lastProgressAt?: Date | null;
  expiresAt?: Date | null;
};

// ─── Achievement ─────────────────────────────────────────────────────────────

export type BadgeTier = "bronze" | "silver" | "gold" | "diamond";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  requirement: number;
  xpReward: number;
  badgeTier: BadgeTier | string;
  badgeColor?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export type InsertAchievement = {
  title: string;
  description: string;
  icon: string;
  category: string;
  requirement: number;
  xpReward: number;
  badgeTier?: BadgeTier | string;
  badgeColor?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

// ─── UserAchievement ─────────────────────────────────────────────────────────

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  claimed: boolean;
  claimedAt?: Date | null;
  isFeatured: boolean;
  featuredSlot?: number | null;
}

export type InsertUserAchievement = {
  userId: string;
  achievementId: string;
  unlockedAt?: Date;
  isFeatured?: boolean;
  featuredSlot?: number | null;
};


// ─── Learn & Earn Lessons ───────────────────────────────────────────────────

export interface LessonQuestion {
  id: string;
  lessonId: string;
  question: string;
  options: string[];
  correctAnswer?: number;
  explanation?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  estimatedMinutes: number;
  xpReward: number;
  xnrtReward: string;
  passingScore: number;
  isActive: boolean;
  isResponsibleUsage: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt?: Date;
  questions?: LessonQuestion[];
}

export interface UserLessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  status: "not_started" | "completed" | string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  rewarded: boolean;
  xpReward: number;
  xnrtReward: string;
  requestedXnrtReward: string;
  rewardCapped: boolean;
  answers?: any;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertLesson = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  category?: string;
  estimatedMinutes?: number;
  xpReward?: number;
  xnrtReward?: string;
  passingScore?: number;
  isActive?: boolean;
  isResponsibleUsage?: boolean;
  sortOrder?: number;
};

export type InsertLessonQuestion = {
  lessonId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string | null;
  sortOrder?: number;
};

// ─── Activity ────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  userId: string;
  type: string;
  description: string;
  metadata?: string | null;
  createdAt: Date;
}

export type InsertActivity = {
  userId: string;
  type: string;
  description: string;
  metadata?: string | null;
};


// ─── Notification Preferences ───────────────────────────────────────────────

export interface NotificationPreference {
  id: string;
  userId: string;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  inAppSoundEnabled: boolean;
  soundVolume: number;
  soundType: string;
  walletAlerts: boolean;
  miningAlerts: boolean;
  stakingAlerts: boolean;
  referralAlerts: boolean;
  achievementAlerts: boolean;
  taskAlerts: boolean;
  systemAlerts: boolean;
  adminBroadcastAlerts: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const notificationPreferenceUpdateSchema = z.object({
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  inAppSoundEnabled: z.boolean().optional(),
  soundVolume: z.number().int().min(0).max(100).optional(),
  soundType: z.enum(["default", "success", "reward", "warning", "silent"]).optional(),
  walletAlerts: z.boolean().optional(),
  miningAlerts: z.boolean().optional(),
  stakingAlerts: z.boolean().optional(),
  referralAlerts: z.boolean().optional(),
  achievementAlerts: z.boolean().optional(),
  taskAlerts: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  adminBroadcastAlerts: z.boolean().optional(),
});

export type NotificationPreferenceUpdate = z.infer<typeof notificationPreferenceUpdateSchema>;

// ─── Notification ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  read: boolean;
  deliveryAttempts?: number | null;
  deliveredAt?: Date | null;
  lastAttemptAt?: Date | null;
  pendingPush: boolean;
  pushError?: string | null;
  createdAt: Date;
}

export type InsertNotification = {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  read?: boolean;
  pendingPush?: boolean;
};

// ─── PushSubscription ─────────────────────────────────────────────────────────

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: Date | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPushSubscription = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: Date | null;
  enabled?: boolean;
};

// ─── Session ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  jwtId: string;
  userId: string;
  createdAt: Date;
  revokedAt?: Date | null;
}

export type InsertSession = {
  jwtId: string;
  userId: string;
  revokedAt?: Date | null;
};

// ─── PasswordReset ───────────────────────────────────────────────────────────

export interface PasswordReset {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

export type InsertPasswordReset = {
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt?: Date | null;
};

// ─── Announcement ────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date | null;
}

export const insertAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["info", "warning", "success", "error"]),
  isActive: z.boolean().optional(),
  expiresAt: z.string().optional().nullable(),
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

// ─── Staking Tier Config ──────────────────────────────────────────────────────

export const STAKING_TIERS = {
  royal_sapphire: {
    name: "Royal Sapphire",
    duration: 15,
    minAmount: 50000,
    maxAmount: 1000000,
    dailyRate: 1.1,
    apy: 402,
  },
  legendary_emerald: {
    name: "Legendary Emerald",
    duration: 30,
    minAmount: 10000,
    maxAmount: 10000000,
    dailyRate: 1.4,
    apy: 511,
  },
  imperial_platinum: {
    name: "Imperial Platinum",
    duration: 45,
    minAmount: 5000,
    maxAmount: 10000000,
    dailyRate: 1.5,
    apy: 547,
  },
  mythic_diamond: {
    name: "Mythic Diamond",
    duration: 90,
    minAmount: 100,
    maxAmount: 10000000,
    dailyRate: 2.0,
    apy: 730,
  },
} as const;

export type StakingTier = keyof typeof STAKING_TIERS;

// ─── Engagement / XP / Reward Caps ─────────────────────────────────────────

export interface EngagementConfig {
  id: string;
  enabled: boolean;
  levelXpStep: number;
  dailyTotalXnrtCap: string;
  weeklyTotalXnrtCap: string;
  dailyTaskXnrtCap: string;
  weeklyTaskXnrtCap: string;
  dailyCheckinBaseXnrt: string;
  dailyCheckinStreakBonusXnrt: string;
  dailyCheckinMaxXnrt: string;
  dailyCheckinBaseXp: number;
  dailyCheckinStreakBonusXp: number;
  dailyCheckinMaxXp: number;
  taskCompletionXpDailyCap: number;
  publicLevelLabels?: any;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface XpLedger {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  source: string;
  sourceId?: string | null;
  totalXpBefore: number;
  totalXpAfter: number;
  levelBefore: number;
  levelAfter: number;
  metadata?: any;
  createdAt: Date;
}

export interface RewardCapLedger {
  id: string;
  userId: string;
  source: string;
  sourceId?: string | null;
  amount: string;
  reason?: string | null;
  createdAt: Date;
}

export interface DailyCheckin {
  id: string;
  userId: string;
  checkinDate: string;
  streakDay: number;
  xpReward: number;
  xnrtReward: string;
  requestedXnrtReward: string;
  rewardCapped: boolean;
  createdAt: Date;
}
