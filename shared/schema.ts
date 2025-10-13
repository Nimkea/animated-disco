// Referenced from Replit Auth blueprint for user authentication
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  decimal,
  text,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// JWT Session table - for authentication
export const sessions = pgTable("Session", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jwtId: varchar("jwtId").unique().notNull(),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
}, (table) => [
  index("sessions_userId_idx").on(table.userId),
  index("sessions_jwtId_idx").on(table.jwtId),
]);

// User storage table - Extended for XNRT platform
export const users = pgTable("User", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  username: varchar("username").unique().notNull(),
  passwordHash: varchar("passwordHash").notNull(),
  referralCode: varchar("referralCode").unique().notNull(),
  referredBy: varchar("referredBy"),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  streak: integer("streak").default(0).notNull(),
  lastCheckIn: timestamp("lastCheckIn"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// User balances
export const balances = pgTable("Balance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").unique().notNull().references(() => users.id, { onDelete: "cascade" }),
  xnrtBalance: decimal("xnrtBalance", { precision: 18, scale: 2 }).default("0").notNull(),
  stakingBalance: decimal("stakingBalance", { precision: 18, scale: 2 }).default("0").notNull(),
  miningBalance: decimal("miningBalance", { precision: 18, scale: 2 }).default("0").notNull(),
  referralBalance: decimal("referralBalance", { precision: 18, scale: 2 }).default("0").notNull(),
  totalEarned: decimal("totalEarned", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Staking tiers
export const stakes = pgTable("Stake", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tier: varchar("tier").notNull(), // royal_sapphire, legendary_emerald, imperial_platinum, mythic_diamond
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  dailyRate: decimal("dailyRate", { precision: 5, scale: 3 }).notNull(), // 1.1, 1.4, 1.5, 2.0
  duration: integer("duration").notNull(), // 15, 30, 45, 90 days
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate").notNull(),
  totalProfit: decimal("totalProfit", { precision: 18, scale: 2 }).default("0").notNull(),
  lastProfitDate: timestamp("lastProfitDate"),
  status: varchar("status").default("active").notNull(), // active, completed, withdrawn
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("stakes_userId_idx").on(table.userId),
  index("stakes_status_idx").on(table.status),
]);

// Mining sessions
export const miningSessions = pgTable("MiningSession", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  baseReward: integer("baseReward").default(10).notNull(),
  adBoostCount: integer("adBoostCount").default(0).notNull(),
  boostPercentage: integer("boostPercentage").default(0).notNull(),
  finalReward: integer("finalReward").default(10).notNull(),
  startTime: timestamp("startTime").defaultNow().notNull(),
  endTime: timestamp("endTime"),
  nextAvailable: timestamp("nextAvailable").notNull(),
  status: varchar("status").default("active").notNull(), // active, completed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("mining_sessions_userId_idx").on(table.userId),
  index("mining_sessions_status_idx").on(table.status),
]);

// Referrals
export const referrals = pgTable("Referral", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredUserId: varchar("referredUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  level: integer("level").notNull(), // 1, 2, 3
  totalCommission: decimal("totalCommission", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("referrals_referrerId_idx").on(table.referrerId),
  index("referrals_referredUserId_idx").on(table.referredUserId),
]);

// Transactions (deposits & withdrawals)
export const transactions = pgTable("Transaction", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // deposit, withdrawal
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  usdtAmount: decimal("usdtAmount", { precision: 18, scale: 2 }),
  source: varchar("source"), // For withdrawals: main, referral
  walletAddress: varchar("walletAddress"),
  transactionHash: varchar("transactionHash"),
  proofImageUrl: varchar("proofImageUrl"),
  status: varchar("status").default("pending").notNull(), // pending, approved, rejected, paid
  adminNotes: text("adminNotes"),
  fee: decimal("fee", { precision: 18, scale: 2 }),
  netAmount: decimal("netAmount", { precision: 18, scale: 2 }),
  approvedBy: varchar("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("transactions_userId_idx").on(table.userId),
  index("transactions_type_idx").on(table.type),
  index("transactions_status_idx").on(table.status),
]);

// Tasks
export const tasks = pgTable("Task", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xpReward").notNull(),
  xnrtReward: decimal("xnrtReward", { precision: 18, scale: 2 }).default("0").notNull(),
  category: varchar("category").notNull(), // daily, weekly, special
  requirements: text("requirements"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// User task completions
export const userTasks = pgTable("UserTask", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: varchar("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  progress: integer("progress").default(0).notNull(),
  maxProgress: integer("maxProgress").default(1).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("user_tasks_userId_idx").on(table.userId),
  index("user_tasks_taskId_idx").on(table.taskId),
]);

// Achievements
export const achievements = pgTable("Achievement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon").notNull(),
  category: varchar("category").notNull(), // earnings, referrals, streaks, mining
  requirement: integer("requirement").notNull(),
  xpReward: integer("xpReward").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// User achievements
export const userAchievements = pgTable("UserAchievement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: varchar("achievementId").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
}, (table) => [
  index("user_achievements_userId_idx").on(table.userId),
  index("user_achievements_achievementId_idx").on(table.achievementId),
]);

// Activity feed
export const activities = pgTable("Activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // stake_created, mining_completed, referral_earned, task_completed, etc.
  description: text("description").notNull(),
  metadata: varchar("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("activities_user_id_idx").on(table.userId),
  index("activities_created_at_idx").on(table.createdAt),
]);

// Notifications
export const notifications = pgTable("Notification", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // referral_commission, new_referral, achievement_unlocked, etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  metadata: varchar("metadata"),
  read: boolean("read").default(false).notNull(),
  deliveryAttempts: integer("deliveryAttempts"),
  deliveredAt: timestamp("deliveredAt"),
  lastAttemptAt: timestamp("lastAttemptAt"),
  pendingPush: boolean("pendingPush").default(false).notNull(),
  pushError: text("pushError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
  index("notifications_created_at_idx").on(table.createdAt),
  index("notifications_pending_push_idx").on(table.pendingPush),
]);

// Push Subscriptions
export const pushSubscriptions = pgTable("PushSubscription", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  expirationTime: timestamp("expirationTime"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
  index("push_subscriptions_endpoint_idx").on(table.endpoint),
  unique("push_subscriptions_user_endpoint_unique").on(table.userId, table.endpoint),
]);

// Password Reset
export const passwordResets = pgTable("PasswordReset", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").unique().notNull(),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("password_resets_userId_idx").on(table.userId),
  index("password_resets_token_idx").on(table.token),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  balance: one(balances, {
    fields: [users.id],
    references: [balances.userId],
  }),
  stakes: many(stakes),
  miningSessions: many(miningSessions),
  referredUsers: many(referrals, { relationName: "referrer" }),
  referrer: many(referrals, { relationName: "referred" }),
  transactions: many(transactions),
  userTasks: many(userTasks),
  userAchievements: many(userAchievements),
  activities: many(activities),
  notifications: many(notifications),
  pushSubscriptions: many(pushSubscriptions),
  sessions: many(sessions),
  passwordResets: many(passwordResets),
}));

export const balancesRelations = relations(balances, ({ one }) => ({
  user: one(users, {
    fields: [balances.userId],
    references: [users.id],
  }),
}));

export const stakesRelations = relations(stakes, ({ one }) => ({
  user: one(users, {
    fields: [stakes.userId],
    references: [users.id],
  }),
}));

export const miningSessionsRelations = relations(miningSessions, ({ one }) => ({
  user: one(users, {
    fields: [miningSessions.userId],
    references: [users.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer",
  }),
  referredUser: one(users, {
    fields: [referrals.referredUserId],
    references: [users.id],
    relationName: "referred",
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const userTasksRelations = relations(userTasks, ({ one }) => ({
  user: one(users, {
    fields: [userTasks.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [userTasks.taskId],
    references: [tasks.id],
  }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type Balance = typeof balances.$inferSelect;
export type InsertBalance = typeof balances.$inferInsert;

export type Stake = typeof stakes.$inferSelect;
export const insertStakeSchema = createInsertSchema(stakes).omit({ id: true, createdAt: true });
export type InsertStake = z.infer<typeof insertStakeSchema>;

export type MiningSession = typeof miningSessions.$inferSelect;
export const insertMiningSessionSchema = createInsertSchema(miningSessions).omit({ id: true, createdAt: true });
export type InsertMiningSession = z.infer<typeof insertMiningSessionSchema>;

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export type UserTask = typeof userTasks.$inferSelect;
export type InsertUserTask = typeof userTasks.$inferInsert;

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertPasswordReset = typeof passwordResets.$inferInsert;

// Staking tier configurations
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
