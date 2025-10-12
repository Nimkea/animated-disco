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

// Session storage table - Mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Extended for XNRT platform
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  username: varchar("username").unique(),
  referralCode: varchar("referral_code").unique().notNull(),
  referredBy: varchar("referred_by"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  streak: integer("streak").default(0).notNull(),
  lastCheckIn: timestamp("last_check_in"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User balances
export const balances = pgTable("balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  xnrtBalance: decimal("xnrt_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  stakingBalance: decimal("staking_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  miningBalance: decimal("mining_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  referralBalance: decimal("referral_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  totalEarned: decimal("total_earned", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staking tiers
export const stakes = pgTable("stakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tier: varchar("tier").notNull(), // royal_sapphire, legendary_emerald, imperial_platinum, mythic_diamond
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  dailyRate: decimal("daily_rate", { precision: 5, scale: 3 }).notNull(), // 1.1, 1.4, 1.5, 2.0
  duration: integer("duration").notNull(), // 15, 30, 45, 90 days
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  totalProfit: decimal("total_profit", { precision: 18, scale: 2 }).default("0").notNull(),
  lastProfitDate: timestamp("last_profit_date"),
  status: varchar("status").default("active").notNull(), // active, completed, withdrawn
  createdAt: timestamp("created_at").defaultNow(),
});

// Mining sessions
export const miningSessions = pgTable("mining_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  baseReward: integer("base_reward").default(10).notNull(),
  adBoostCount: integer("ad_boost_count").default(0).notNull(),
  boostPercentage: integer("boost_percentage").default(0).notNull(),
  finalReward: integer("final_reward").default(10).notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  nextAvailable: timestamp("next_available").notNull(),
  status: varchar("status").default("active").notNull(), // active, completed
  createdAt: timestamp("created_at").defaultNow(),
});

// Referrals
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull().references(() => users.id),
  referredUserId: varchar("referred_user_id").notNull().references(() => users.id),
  level: integer("level").notNull(), // 1, 2, 3
  totalCommission: decimal("total_commission", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions (deposits & withdrawals)
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // deposit, withdrawal
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  usdtAmount: decimal("usdt_amount", { precision: 18, scale: 2 }),
  source: varchar("source"), // For withdrawals: main, referral
  walletAddress: varchar("wallet_address"),
  transactionHash: varchar("transaction_hash"),
  proofImageUrl: varchar("proof_image_url"),
  status: varchar("status").default("pending").notNull(), // pending, approved, rejected, paid
  adminNotes: text("admin_notes"),
  fee: decimal("fee", { precision: 18, scale: 2 }),
  netAmount: decimal("net_amount", { precision: 18, scale: 2 }),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull(),
  xnrtReward: decimal("xnrt_reward", { precision: 18, scale: 2 }).default("0").notNull(),
  category: varchar("category").notNull(), // daily, weekly, special
  requirements: text("requirements"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User task completions
export const userTasks = pgTable("user_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  progress: integer("progress").default(0).notNull(),
  maxProgress: integer("max_progress").default(1).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievements
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon").notNull(),
  category: varchar("category").notNull(), // earnings, referrals, streaks, mining
  requirement: integer("requirement").notNull(),
  xpReward: integer("xp_reward").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User achievements
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementId: varchar("achievement_id").notNull().references(() => achievements.id),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

// Activity feed
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // stake_created, mining_completed, referral_earned, task_completed, etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("activities_user_id_idx").on(table.userId),
  index("activities_created_at_idx").on(table.createdAt),
]);

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // referral_commission, new_referral, achievement_unlocked, etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  read: boolean("read").default(false).notNull(),
  deliveryAttempts: integer("delivery_attempts"),
  deliveredAt: timestamp("delivered_at"),
  pendingPush: boolean("pending_push").default(false).notNull(),
  pushError: text("push_error"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
  index("notifications_created_at_idx").on(table.createdAt),
  index("notifications_pending_push_idx").on(table.pendingPush),
]);

// Push Subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  expirationTime: timestamp("expiration_time"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
  index("push_subscriptions_endpoint_idx").on(table.endpoint),
  unique("push_subscriptions_user_endpoint_unique").on(table.userId, table.endpoint),
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
