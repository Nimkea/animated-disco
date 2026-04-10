var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/notifications.ts
var notifications_exports = {};
__export(notifications_exports, {
  notifyUser: () => notifyUser,
  sendPushNotification: () => sendPushNotification
});
import webpush from "web-push";
async function sendPushNotification(userId, payload) {
  if (!ENABLE_PUSH_NOTIFICATIONS) {
    console.log(`Push notifications disabled`);
    return false;
  }
  try {
    const subscriptions = await storage.getUserPushSubscriptions(userId);
    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return false;
    }
    const pushPayload = JSON.stringify({
      ...payload,
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge || "/icon-192.png"
    });
    let successCount = 0;
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        };
        await webpush.sendNotification(pushSubscription, pushPayload);
        console.log(`Push notification sent successfully to ${subscription.endpoint}`);
        successCount++;
      } catch (error) {
        console.error(`Error sending push notification to ${subscription.endpoint}:`, error);
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`Subscription expired/gone, disabling: ${subscription.endpoint}`);
          await storage.disablePushSubscription(subscription.endpoint);
        }
      }
    });
    await Promise.allSettled(sendPromises);
    return successCount > 0;
  } catch (error) {
    console.error("Error in sendPushNotification:", error);
    return false;
  }
}
async function notifyUser(userId, notification) {
  try {
    const createdNotification = await storage.createNotification({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata
    });
    const pushPayload = {
      title: notification.title,
      body: notification.message,
      data: {
        url: notification.url || "/",
        type: notification.type,
        id: createdNotification.id,
        ...notification.metadata
      }
    };
    try {
      const pushSuccess = await sendPushNotification(userId, pushPayload);
      const currentAttempts = createdNotification.deliveryAttempts || 0;
      if (pushSuccess) {
        await storage.updateNotificationDelivery(createdNotification.id, {
          deliveredAt: /* @__PURE__ */ new Date(),
          deliveryAttempts: currentAttempts + 1,
          lastAttemptAt: /* @__PURE__ */ new Date(),
          pendingPush: false
        });
      } else if (ENABLE_PUSH_NOTIFICATIONS) {
        await storage.updateNotificationDelivery(createdNotification.id, {
          deliveryAttempts: currentAttempts + 1,
          lastAttemptAt: /* @__PURE__ */ new Date(),
          pendingPush: true,
          pushError: "No active subscriptions or push failed"
        });
      }
    } catch (pushError) {
      console.error("Error sending push notification (non-blocking):", pushError);
      if (ENABLE_PUSH_NOTIFICATIONS) {
        const currentAttempts = createdNotification.deliveryAttempts || 0;
        await storage.updateNotificationDelivery(createdNotification.id, {
          deliveryAttempts: currentAttempts + 1,
          lastAttemptAt: /* @__PURE__ */ new Date(),
          pendingPush: true,
          pushError: pushError.message || "Unknown push error"
        });
      }
    }
    return createdNotification;
  } catch (error) {
    console.error("Error in notifyUser:", error);
    throw error;
  }
}
var VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, ENABLE_PUSH_NOTIFICATIONS;
var init_notifications = __esm({
  "server/notifications.ts"() {
    "use strict";
    init_storage();
    VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || "").replace(/^"publicKey":"/, "").replace(/"$/, "");
    VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || "").replace(/^"privateKey":"/, "").replace(/}$/, "").replace(/"$/, "");
    VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@xnrt.org";
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    }
    ENABLE_PUSH_NOTIFICATIONS = process.env.ENABLE_PUSH_NOTIFICATIONS !== "false";
  }
});

// server/storage.ts
import { PrismaClient, Prisma } from "@prisma/client";
import crypto from "crypto";
import { nanoid } from "nanoid";
function generateReferralCode() {
  return `XNRT${nanoid(8).toUpperCase()}`;
}
function generateAnonymizedHandle(userId) {
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  return `Player-${hash.substring(0, 4).toUpperCase()}`;
}
function decimalToString(value) {
  if (value === null || value === void 0) return "0";
  return value.toString();
}
function convertPrismaUser(user) {
  return {
    ...user,
    email: user.email || void 0,
    firstName: user.firstName || void 0,
    lastName: user.lastName || void 0,
    profileImageUrl: user.profileImageUrl || void 0,
    username: user.username || void 0,
    referredBy: user.referredBy || void 0,
    lastCheckIn: user.lastCheckIn || void 0
  };
}
function convertPrismaBalance(balance) {
  return {
    ...balance,
    xnrtBalance: decimalToString(balance.xnrtBalance),
    stakingBalance: decimalToString(balance.stakingBalance),
    miningBalance: decimalToString(balance.miningBalance),
    referralBalance: decimalToString(balance.referralBalance),
    totalEarned: decimalToString(balance.totalEarned)
  };
}
function convertPrismaStake(stake) {
  return {
    ...stake,
    amount: decimalToString(stake.amount),
    dailyRate: decimalToString(stake.dailyRate),
    totalProfit: decimalToString(stake.totalProfit),
    lastProfitDate: stake.lastProfitDate || void 0,
    // Derived field for app type (Stake.has isLoan in shared/schema)
    isLoan: !!(stake.loanProgram && stake.loanProgram.startsWith("trust_")),
    // Trust Loan / loan-related fields
    loanProgram: stake.loanProgram || void 0,
    unlockMet: stake.unlockMet,
    requiredReferrals: stake.requiredReferrals,
    requiredInvestingReferrals: stake.requiredInvestingReferrals,
    minInvestUsdtPerReferral: decimalToString(stake.minInvestUsdtPerReferral)
  };
}
function convertPrismaReferral(referral) {
  return {
    ...referral,
    totalCommission: decimalToString(referral.totalCommission)
  };
}
function convertPrismaTransaction(transaction) {
  return {
    ...transaction,
    amount: decimalToString(transaction.amount),
    usdtAmount: transaction.usdtAmount ? decimalToString(transaction.usdtAmount) : void 0,
    source: transaction.source || void 0,
    walletAddress: transaction.walletAddress || void 0,
    transactionHash: transaction.transactionHash || void 0,
    proofImageUrl: transaction.proofImageUrl || void 0,
    adminNotes: transaction.adminNotes || void 0,
    fee: transaction.fee ? decimalToString(transaction.fee) : void 0,
    netAmount: transaction.netAmount ? decimalToString(transaction.netAmount) : void 0,
    approvedBy: transaction.approvedBy || void 0,
    approvedAt: transaction.approvedAt || void 0,
    user: transaction.user ? {
      email: transaction.user.email,
      username: transaction.user.username
    } : void 0
  };
}
function convertPrismaTask(task) {
  return {
    ...task,
    xnrtReward: decimalToString(task.xnrtReward),
    requirements: task.requirements || void 0
  };
}
function convertPrismaUserTask(userTask) {
  return {
    ...userTask,
    completedAt: userTask.completedAt || void 0
  };
}
function convertPrismaActivity(activity) {
  return {
    ...activity,
    metadata: activity.metadata || void 0
  };
}
function convertPrismaNotification(notification) {
  let metadata = notification.metadata;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch {
    }
  }
  return {
    ...notification,
    metadata: metadata ?? void 0
  };
}
function convertPrismaPushSubscription(subscription) {
  return {
    ...subscription,
    expirationTime: subscription.expirationTime || void 0
  };
}
var prisma, DEFAULT_MINING_BASE_REWARD, XP_TO_XNRT_RATE, DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    prisma = new PrismaClient();
    DEFAULT_MINING_BASE_REWARD = 20;
    XP_TO_XNRT_RATE = 0.5;
    DatabaseStorage = class {
      // User operations (IMPORTANT: mandatory for Replit Auth)
      async getUser(id) {
        const user = await prisma.user.findUnique({
          where: { id }
        });
        return user ? convertPrismaUser(user) : void 0;
      }
      async upsertUser(userData, refCode) {
        const existingUser = await this.getUser(userData.id);
        if (existingUser) {
          const updateData = {};
          if (userData.email !== void 0 && userData.email !== null)
            updateData.email = userData.email;
          if (userData.username !== void 0 && userData.username !== null)
            updateData.username = userData.username;
          if (userData.isAdmin !== void 0) updateData.isAdmin = userData.isAdmin;
          if (userData.xp !== void 0) updateData.xp = userData.xp;
          if (userData.level !== void 0) updateData.level = userData.level;
          if (userData.streak !== void 0) updateData.streak = userData.streak;
          if (userData.lastCheckIn !== void 0)
            updateData.lastCheckIn = userData.lastCheckIn;
          updateData.updatedAt = /* @__PURE__ */ new Date();
          const user2 = await prisma.user.update({
            where: { id: userData.id },
            data: updateData
          });
          return convertPrismaUser(user2);
        }
        const referralCode = generateReferralCode();
        const user = await prisma.user.create({
          data: {
            id: userData.id,
            email: userData.email || "",
            username: userData.username || userData.email?.split("@")[0] || `user${Date.now()}`,
            passwordHash: userData.passwordHash || "",
            referralCode,
            referredBy: refCode || null,
            isAdmin: userData.isAdmin || false,
            xp: userData.xp || 0,
            level: userData.level || 1,
            streak: userData.streak || 0,
            lastCheckIn: userData.lastCheckIn || null
          }
        });
        await this.createBalance({
          userId: user.id,
          xnrtBalance: "0",
          stakingBalance: "0",
          miningBalance: "0",
          referralBalance: "0",
          totalEarned: "0"
        });
        if (refCode) {
          const referrer = await prisma.user.findUnique({
            where: { referralCode: refCode }
          });
          if (referrer) {
            await this.createReferral({
              referrerId: referrer.id,
              referredUserId: user.id,
              level: 1,
              totalCommission: "0"
            });
            await this.createNotification({
              userId: referrer.id,
              type: "new_referral",
              title: "\u{1F389} New Referral!",
              message: `${user.username || "A new user"} just joined using your referral code!`,
              // pass plain object; createNotification handles stringify
              metadata: {
                referredUserId: user.id,
                referredUsername: user.username
              }
            });
            await this.checkAndUnlockAchievements(referrer.id);
          }
        }
        return convertPrismaUser(user);
      }
      async updateUser(userId, updates) {
        const updateData = {};
        if (updates.email !== void 0) updateData.email = updates.email;
        if (updates.username !== void 0) updateData.username = updates.username;
        if (updates.isAdmin !== void 0) updateData.isAdmin = updates.isAdmin;
        if (updates.xp !== void 0) updateData.xp = updates.xp;
        if (updates.level !== void 0) updateData.level = updates.level;
        if (updates.streak !== void 0) updateData.streak = updates.streak;
        if (updates.lastCheckIn !== void 0)
          updateData.lastCheckIn = updates.lastCheckIn;
        updateData.updatedAt = /* @__PURE__ */ new Date();
        const user = await prisma.user.update({
          where: { id: userId },
          data: updateData
        });
        return convertPrismaUser(user);
      }
      async getAllUsers() {
        const users = await prisma.user.findMany();
        return users.map(convertPrismaUser);
      }
      // Balance operations
      async getBalance(userId) {
        const balance = await prisma.balance.findUnique({
          where: { userId }
        });
        return balance ? convertPrismaBalance(balance) : void 0;
      }
      async createBalance(balance) {
        const newBalance = await prisma.balance.create({
          data: {
            userId: balance.userId,
            xnrtBalance: new Prisma.Decimal(balance.xnrtBalance || "0"),
            stakingBalance: new Prisma.Decimal(balance.stakingBalance || "0"),
            miningBalance: new Prisma.Decimal(balance.miningBalance || "0"),
            referralBalance: new Prisma.Decimal(balance.referralBalance || "0"),
            totalEarned: new Prisma.Decimal(balance.totalEarned || "0")
          }
        });
        return convertPrismaBalance(newBalance);
      }
      async updateBalance(userId, updates) {
        const data = { updatedAt: /* @__PURE__ */ new Date() };
        if (updates.xnrtBalance !== void 0)
          data.xnrtBalance = new Prisma.Decimal(updates.xnrtBalance);
        if (updates.stakingBalance !== void 0)
          data.stakingBalance = new Prisma.Decimal(updates.stakingBalance);
        if (updates.miningBalance !== void 0)
          data.miningBalance = new Prisma.Decimal(updates.miningBalance);
        if (updates.referralBalance !== void 0)
          data.referralBalance = new Prisma.Decimal(updates.referralBalance);
        if (updates.totalEarned !== void 0)
          data.totalEarned = new Prisma.Decimal(updates.totalEarned);
        const balance = await prisma.balance.update({
          where: { userId },
          data
        });
        return convertPrismaBalance(balance);
      }
      async adjustStakingBalance({
        userId,
        amount,
        operation = "add"
      }) {
        const balance = await prisma.balance.update({
          where: { userId },
          data: {
            stakingBalance: {
              [operation === "add" ? "increment" : "decrement"]: new Prisma.Decimal(amount)
            }
          }
        });
        return convertPrismaBalance(balance);
      }
      // Staking operations
      async getStakes(userId) {
        const stakes = await prisma.stake.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" }
        });
        return stakes.map(convertPrismaStake);
      }
      async getStakeById(id) {
        const stake = await prisma.stake.findUnique({
          where: { id }
        });
        return stake ? convertPrismaStake(stake) : void 0;
      }
      async createStake(stake) {
        const newStake = await prisma.stake.create({
          data: {
            userId: stake.userId,
            tier: stake.tier,
            amount: new Prisma.Decimal(stake.amount),
            dailyRate: new Prisma.Decimal(stake.dailyRate),
            duration: stake.duration,
            startDate: stake.startDate || /* @__PURE__ */ new Date(),
            endDate: stake.endDate,
            totalProfit: new Prisma.Decimal(stake.totalProfit || "0"),
            lastProfitDate: stake.lastProfitDate,
            status: stake.status || "active",
            // Trust Loan fields (no isLoan column in DB)
            loanProgram: stake.loanProgram,
            unlockMet: stake.unlockMet || false,
            requiredReferrals: stake.requiredReferrals,
            requiredInvestingReferrals: stake.requiredInvestingReferrals,
            minInvestUsdtPerReferral: stake.minInvestUsdtPerReferral ? new Prisma.Decimal(stake.minInvestUsdtPerReferral) : void 0
          }
        });
        return convertPrismaStake(newStake);
      }
      async updateStake(id, updates) {
        const data = {};
        if (updates.totalProfit !== void 0)
          data.totalProfit = new Prisma.Decimal(updates.totalProfit);
        if (updates.lastProfitDate !== void 0)
          data.lastProfitDate = updates.lastProfitDate;
        if (updates.status !== void 0) data.status = updates.status;
        if (updates.unlockMet !== void 0) data.unlockMet = updates.unlockMet;
        const stake = await prisma.stake.update({
          where: { id },
          data
        });
        return convertPrismaStake(stake);
      }
      async atomicWithdrawStake(id, totalProfit) {
        try {
          const stake = await prisma.stake.updateMany({
            where: {
              id,
              OR: [{ status: "completed" }, { status: "active" }]
            },
            data: {
              status: "withdrawn",
              totalProfit: new Prisma.Decimal(totalProfit)
            }
          });
          if (stake.count === 0) return null;
          const updatedStake = await prisma.stake.findUnique({
            where: { id }
          });
          return updatedStake ? convertPrismaStake(updatedStake) : null;
        } catch {
          return null;
        }
      }
      async getAllActiveStakes() {
        const stakes = await prisma.stake.findMany({
          where: { status: "active" }
        });
        return stakes.map(convertPrismaStake);
      }
      async processStakingRewards() {
        const activeStakes = await this.getAllActiveStakes();
        const now = /* @__PURE__ */ new Date();
        const DAY_MS = 24 * 60 * 60 * 1e3;
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
            const dailyProfit = parseFloat(stake.amount) * parseFloat(stake.dailyRate) / 100;
            const profitToAdd = dailyProfit * creditedDays;
            const newTotalProfit = parseFloat(stake.totalProfit) + profitToAdd;
            const calculatedLastProfitDate = new Date(
              lastProfitDate.getTime() + creditedDays * DAY_MS
            );
            const newLastProfitDate = calculatedLastProfitDate > endDate ? endDate : calculatedLastProfitDate;
            await this.updateStake(stake.id, {
              totalProfit: newTotalProfit.toString(),
              lastProfitDate: newLastProfitDate
            });
            const balance = await this.getBalance(stake.userId);
            if (balance) {
              await this.updateBalance(stake.userId, {
                stakingBalance: (parseFloat(balance.stakingBalance) + profitToAdd).toString(),
                totalEarned: (parseFloat(balance.totalEarned) + profitToAdd).toString()
              });
            }
            await this.createActivity({
              userId: stake.userId,
              type: "staking_reward",
              description: `Earned ${profitToAdd.toFixed(
                2
              )} XNRT from staking (${creditedDays} day${creditedDays > 1 ? "s" : ""})`
            });
            const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
            void notifyUser2(stake.userId, {
              type: "staking_reward",
              title: "\u{1F48E} Staking Rewards!",
              message: `You earned ${profitToAdd.toFixed(
                2
              )} XNRT from ${creditedDays} day${creditedDays > 1 ? "s" : ""} of staking`,
              url: "/staking",
              metadata: {
                amount: profitToAdd.toString(),
                days: creditedDays,
                stakeId: stake.id
              }
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
              status: "completed"
            });
          }
        }
      }
      // -------------------- Mining reward processor --------------------
      async processMiningRewards() {
        const activeSessions = await prisma.miningSession.findMany({
          where: { status: "active" }
        });
        const now = /* @__PURE__ */ new Date();
        for (const session of activeSessions) {
          if (!session.endTime) continue;
          const endTime = new Date(session.endTime);
          if (now < endTime) continue;
          const baseReward = session.baseReward ?? DEFAULT_MINING_BASE_REWARD;
          const boostPercentage = session.boostPercentage ?? 0;
          const finalReward = session.finalReward ?? baseReward + Math.floor(baseReward * boostPercentage / 100);
          const xpReward = finalReward;
          const xnrtReward = finalReward * XP_TO_XNRT_RATE;
          await this.updateMiningSession(session.id, {
            status: "completed",
            finalReward,
            endTime: now
            // completion time = when processor runs
          });
          const user = await this.getUser(session.userId);
          if (user) {
            await this.updateUser(session.userId, {
              xp: (user.xp || 0) + xpReward
            });
          }
          const balance = await this.getBalance(session.userId);
          if (balance) {
            await this.updateBalance(session.userId, {
              miningBalance: (parseFloat(balance.miningBalance) + xnrtReward).toString(),
              totalEarned: (parseFloat(balance.totalEarned) + xnrtReward).toString()
            });
          }
          await this.createActivity({
            userId: session.userId,
            type: "mining_completed",
            description: `Auto-completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(
              1
            )} XNRT`
          });
          const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
          void notifyUser2(session.userId, {
            type: "mining_completed",
            title: "\u26CF\uFE0F Mining Complete!",
            message: `You earned ${xpReward} XP and ${xnrtReward.toFixed(
              1
            )} XNRT from your 24-hour mining session`,
            url: "/mining",
            metadata: {
              xpReward,
              xnrtReward: xnrtReward.toString(),
              sessionId: session.id
            }
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
      async getCurrentMiningSession(userId) {
        const session = await prisma.miningSession.findFirst({
          where: {
            userId,
            status: "active"
          },
          orderBy: { createdAt: "desc" }
        });
        if (session && session.endTime && /* @__PURE__ */ new Date() >= new Date(session.endTime)) {
          const baseReward = session.baseReward ?? DEFAULT_MINING_BASE_REWARD;
          const boostPercentage = session.boostPercentage ?? 0;
          const finalReward = session.finalReward ?? baseReward + Math.floor(baseReward * boostPercentage / 100);
          const xpReward = finalReward;
          const xnrtReward = finalReward * XP_TO_XNRT_RATE;
          await this.updateMiningSession(session.id, {
            status: "completed",
            finalReward,
            endTime: /* @__PURE__ */ new Date()
          });
          const user = await this.getUser(userId);
          if (user) {
            await this.updateUser(userId, {
              xp: (user.xp || 0) + xpReward
            });
          }
          const balance = await this.getBalance(userId);
          if (balance) {
            await this.updateBalance(userId, {
              miningBalance: (parseFloat(balance.miningBalance) + xnrtReward).toString(),
              totalEarned: (parseFloat(balance.totalEarned) + xnrtReward).toString()
            });
          }
          await this.createActivity({
            userId,
            type: "mining_completed",
            description: `Completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(
              1
            )} XNRT`
          });
          await this.checkAndUnlockAchievements(userId);
          return void 0;
        }
        return session || void 0;
      }
      async getMiningHistory(userId) {
        const sessions = await prisma.miningSession.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50
        });
        return sessions;
      }
      async createMiningSession(session) {
        const now = /* @__PURE__ */ new Date();
        const startTime = session.startTime ?? now;
        const defaultEndTime = new Date(
          startTime.getTime() + 24 * 60 * 60 * 1e3
        );
        const defaultNextAvailable = new Date(
          defaultEndTime.getTime() + 60 * 60 * 1e3
        );
        const base = session.baseReward ?? DEFAULT_MINING_BASE_REWARD;
        const boost = session.boostPercentage ?? 0;
        const computedFinal = base + Math.floor(base * boost / 100);
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
            status: session.status ?? "active"
          }
        });
        return newSession;
      }
      async updateMiningSession(id, updates) {
        const data = {};
        if (updates.baseReward !== void 0) data.baseReward = updates.baseReward;
        if (updates.adBoostCount !== void 0)
          data.adBoostCount = updates.adBoostCount;
        if (updates.boostPercentage !== void 0)
          data.boostPercentage = updates.boostPercentage;
        if (updates.finalReward !== void 0) data.finalReward = updates.finalReward;
        if (updates.endTime !== void 0) data.endTime = updates.endTime;
        if (updates.nextAvailable !== void 0)
          data.nextAvailable = updates.nextAvailable;
        if (updates.status !== void 0) data.status = updates.status;
        const session = await prisma.miningSession.update({
          where: { id },
          data
        });
        return session;
      }
      // Referral operations
      async getReferralsByReferrer(referrerId) {
        const referrals = await prisma.referral.findMany({
          where: { referrerId }
        });
        return referrals.map(convertPrismaReferral);
      }
      async createReferral(referral) {
        const newReferral = await prisma.referral.create({
          data: {
            referrerId: referral.referrerId,
            referredUserId: referral.referredUserId,
            level: referral.level,
            totalCommission: new Prisma.Decimal(
              referral.totalCommission || "0"
            )
          }
        });
        return convertPrismaReferral(newReferral);
      }
      async updateReferral(id, updates) {
        const data = {};
        if (updates.totalCommission !== void 0) {
          data.totalCommission = new Prisma.Decimal(updates.totalCommission);
        }
        const referral = await prisma.referral.update({
          where: { id },
          data
        });
        return convertPrismaReferral(referral);
      }
      async distributeReferralCommissions(userId, amount) {
        console.log(
          `[REFERRAL] Starting distribution for userId: ${userId}, amount: ${amount}`
        );
        const COMMISSION_RATES = {
          1: 0.06,
          2: 0.03,
          3: 0.01
        };
        const referrerChain = await this.getReferrerChain(userId, 3);
        console.log(
          `[REFERRAL] Referrer chain length: ${referrerChain.length}`,
          referrerChain.map((r) => ({ id: r?.id, email: r?.email }))
        );
        for (let level = 1; level <= 3; level++) {
          const referrer = referrerChain[level - 1];
          const commission = amount * COMMISSION_RATES[level];
          console.log(
            `[REFERRAL] Level ${level}: referrer=${referrer?.email || "null"}, commission=${commission}`
          );
          if (!referrer) {
            const COMPANY_ADMIN_EMAIL = "noahkeaneowen@hotmail.com";
            console.log(
              `[REFERRAL] No referrer at level ${level}, using company fallback: ${COMPANY_ADMIN_EMAIL}`
            );
            const companyAccount = await prisma.user.findFirst({
              where: {
                email: COMPANY_ADMIN_EMAIL,
                isAdmin: true
              }
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
              const newReferralBalance = (parseFloat(companyBalance.referralBalance) + commission).toString();
              const newTotalEarned = (parseFloat(companyBalance.totalEarned) + commission).toString();
              console.log(
                `[REFERRAL] Updating company balance: referral ${companyBalance.referralBalance} \u2192 ${newReferralBalance}`
              );
              await this.updateBalance(companyAccount.id, {
                referralBalance: newReferralBalance,
                totalEarned: newTotalEarned
              });
              await this.createActivity({
                userId: companyAccount.id,
                type: "company_commission",
                description: `Received ${commission.toFixed(
                  2
                )} XNRT company commission from missing level ${level} referrer`
              });
            }
            continue;
          }
          const existingReferral = await prisma.referral.findFirst({
            where: {
              referrerId: referrer.id,
              referredUserId: userId
            }
          });
          if (existingReferral) {
            const newCommission = parseFloat(decimalToString(existingReferral.totalCommission)) + commission;
            await this.updateReferral(existingReferral.id, {
              totalCommission: newCommission.toString()
            });
          } else {
            await this.createReferral({
              referrerId: referrer.id,
              referredUserId: userId,
              level,
              totalCommission: commission.toString()
            });
          }
          const referrerBalance = await this.getBalance(referrer.id);
          if (referrerBalance) {
            const newReferralBalance = (parseFloat(referrerBalance.referralBalance) + commission).toString();
            const newTotalEarned = (parseFloat(referrerBalance.totalEarned) + commission).toString();
            console.log(
              `[REFERRAL] Updating referrer ${referrer.email} balance: referral ${referrerBalance.referralBalance} \u2192 ${newReferralBalance}`
            );
            await this.updateBalance(referrer.id, {
              referralBalance: newReferralBalance,
              totalEarned: newTotalEarned
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
            )} XNRT commission from level ${level} referral`
          });
          const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
          void notifyUser2(referrer.id, {
            type: "referral_commission",
            title: "\u{1F4B0} Referral Bonus!",
            message: `You earned ${commission.toFixed(
              2
            )} XNRT commission from a level ${level} referral`,
            url: "/referrals",
            // pass plain object; notifications module / createNotification will stringify
            metadata: {
              amount: commission.toString(),
              level,
              referredUserId: userId
            }
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
      async getReferrerChain(userId, maxLevels) {
        const chain = [];
        let currentUserId = userId;
        for (let i = 0; i < maxLevels; i++) {
          const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId }
          });
          if (!currentUser || !currentUser.referredBy) break;
          const referrer = await prisma.user.findUnique({
            where: { id: currentUser.referredBy }
          });
          if (!referrer) break;
          chain.push(convertPrismaUser(referrer));
          currentUserId = referrer.id;
        }
        return chain;
      }
      // Transaction operations
      async getTransactionsByUser(userId, type) {
        const where = { userId };
        if (type) {
          where.type = type;
        }
        const transactions = await prisma.transaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 1e3
        });
        return transactions.map(convertPrismaTransaction);
      }
      async getTransactionById(id) {
        const transaction = await prisma.transaction.findUnique({
          where: { id }
        });
        return transaction ? convertPrismaTransaction(transaction) : void 0;
      }
      async createTransaction(transaction) {
        const data = {
          userId: transaction.userId,
          type: transaction.type,
          amount: new Prisma.Decimal(transaction.amount),
          status: transaction.status || "pending"
        };
        if (transaction.usdtAmount !== void 0 && transaction.usdtAmount !== null)
          data.usdtAmount = new Prisma.Decimal(transaction.usdtAmount);
        if (transaction.source !== void 0 && transaction.source !== null)
          data.source = transaction.source;
        if (transaction.walletAddress !== void 0 && transaction.walletAddress !== null) {
          data.walletAddress = transaction.walletAddress;
        }
        if (transaction.transactionHash !== void 0 && transaction.transactionHash !== null) {
          data.transactionHash = transaction.transactionHash;
        }
        if (transaction.proofImageUrl !== void 0 && transaction.proofImageUrl !== null) {
          data.proofImageUrl = transaction.proofImageUrl;
        }
        if (transaction.adminNotes !== void 0 && transaction.adminNotes !== null) {
          data.adminNotes = transaction.adminNotes;
        }
        if (transaction.fee !== void 0 && transaction.fee !== null) {
          data.fee = new Prisma.Decimal(transaction.fee);
        }
        if (transaction.netAmount !== void 0 && transaction.netAmount !== null) {
          data.netAmount = new Prisma.Decimal(transaction.netAmount);
        }
        if (transaction.approvedBy !== void 0 && transaction.approvedBy !== null) {
          data.approvedBy = transaction.approvedBy;
        }
        if (transaction.approvedAt !== void 0 && transaction.approvedAt !== null) {
          data.approvedAt = transaction.approvedAt;
        }
        if (transaction.verified !== void 0) {
          data.verified = transaction.verified;
        }
        if (transaction.confirmations !== void 0) {
          data.confirmations = transaction.confirmations;
        }
        if (transaction.verificationData !== void 0 && transaction.verificationData !== null) {
          data.verificationData = transaction.verificationData;
        }
        const newTransaction = await prisma.transaction.create({ data });
        return convertPrismaTransaction(newTransaction);
      }
      async updateTransaction(id, updates) {
        const data = {};
        if (updates.amount !== void 0 && updates.amount !== null) {
          data.amount = new Prisma.Decimal(updates.amount);
        }
        if (updates.usdtAmount !== void 0 && updates.usdtAmount !== null) {
          data.usdtAmount = new Prisma.Decimal(updates.usdtAmount);
        }
        if (updates.status !== void 0) data.status = updates.status;
        if (updates.adminNotes !== void 0 && updates.adminNotes !== null) {
          data.adminNotes = updates.adminNotes;
        }
        if (updates.fee !== void 0 && updates.fee !== null) {
          data.fee = new Prisma.Decimal(updates.fee);
        }
        if (updates.netAmount !== void 0 && updates.netAmount !== null) {
          data.netAmount = new Prisma.Decimal(updates.netAmount);
        }
        if (updates.approvedBy !== void 0 && updates.approvedBy !== null) {
          data.approvedBy = updates.approvedBy;
        }
        if (updates.approvedAt !== void 0 && updates.approvedAt !== null) {
          data.approvedAt = updates.approvedAt;
        }
        if (updates.verified !== void 0) {
          data.verified = updates.verified;
        }
        if (updates.confirmations !== void 0) {
          data.confirmations = updates.confirmations;
        }
        if (updates.verificationData !== void 0 && updates.verificationData !== null) {
          data.verificationData = updates.verificationData;
        }
        const transaction = await prisma.transaction.update({
          where: { id },
          data
        });
        return convertPrismaTransaction(transaction);
      }
      async getAllTransactions(type) {
        const where = {};
        if (type) {
          where.type = type;
        }
        const transactions = await prisma.transaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 1e3
        });
        return transactions.map(convertPrismaTransaction);
      }
      async getPendingTransactions(type) {
        const transactions = await prisma.transaction.findMany({
          where: {
            type,
            status: "pending"
          },
          include: {
            user: {
              select: {
                email: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        });
        return transactions.map(convertPrismaTransaction);
      }
      // Task operations
      async getAllTasks() {
        const tasks = await prisma.task.findMany({
          where: { isActive: true }
        });
        return tasks.map(convertPrismaTask);
      }
      async getUserTasks(userId) {
        const userTasks = await prisma.userTask.findMany({
          where: { userId }
        });
        return userTasks.map(convertPrismaUserTask);
      }
      async createUserTask(userTask) {
        const newUserTask = await prisma.userTask.create({
          data: {
            userId: userTask.userId,
            taskId: userTask.taskId,
            progress: userTask.progress || 0,
            maxProgress: userTask.maxProgress || 1,
            completed: userTask.completed || false,
            completedAt: userTask.completedAt
          }
        });
        return convertPrismaUserTask(newUserTask);
      }
      async updateUserTask(id, updates) {
        const data = {};
        if (updates.progress !== void 0) data.progress = updates.progress;
        if (updates.maxProgress !== void 0)
          data.maxProgress = updates.maxProgress;
        if (updates.completed !== void 0) data.completed = updates.completed;
        if (updates.completedAt !== void 0)
          data.completedAt = updates.completedAt;
        const userTask = await prisma.userTask.update({
          where: { id },
          data
        });
        return convertPrismaUserTask(userTask);
      }
      // Achievement operations
      async getAllAchievements() {
        return await prisma.achievement.findMany();
      }
      async getUserAchievements(userId) {
        return await prisma.userAchievement.findMany({
          where: { userId }
        });
      }
      async createUserAchievement(userAchievement) {
        const newUserAchievement = await prisma.userAchievement.create({
          data: {
            userId: userAchievement.userId,
            achievementId: userAchievement.achievementId
          }
        });
        return newUserAchievement;
      }
      async checkAndUnlockAchievements(userId) {
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
              achievementId: achievement.id
            });
            totalXpReward += achievement.xpReward;
            await this.createActivity({
              userId,
              type: "achievement_unlocked",
              description: `Unlocked achievement: ${achievement.title} (+${achievement.xpReward} XP)`
            });
            const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
            void notifyUser2(userId, {
              type: "achievement_unlocked",
              title: "\u{1F3C6} Achievement Unlocked!",
              message: `${achievement.title} - You earned ${achievement.xpReward} XP!`,
              url: "/achievements",
              metadata: {
                achievementId: achievement.id,
                achievementTitle: achievement.title,
                xpReward: achievement.xpReward
              }
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
              xp: (user.xp || 0) + totalXpReward
            }
          });
        }
      }
      async getAchievementsWithUnlockCount() {
        const achievements = await prisma.achievement.findMany({
          orderBy: { requirement: "asc" }
        });
        const counts = await Promise.all(
          achievements.map(
            (achievement) => prisma.userAchievement.count({
              where: { achievementId: achievement.id }
            })
          )
        );
        return achievements.map((achievement, index) => ({
          ...achievement,
          unlockCount: counts[index] ?? 0
        }));
      }
      // Activity operations
      async createActivity(activity) {
        const data = {
          userId: activity.userId,
          type: activity.type,
          description: activity.description
        };
        if (activity.metadata !== void 0 && activity.metadata !== null) {
          data.metadata = activity.metadata;
        }
        const newActivity = await prisma.activity.create({ data });
        return convertPrismaActivity(newActivity);
      }
      async getActivities(userId, limit = 10) {
        const activities = await prisma.activity.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit
        });
        return activities.map(convertPrismaActivity);
      }
      // Notification operations
      async createNotification(notification) {
        const data = {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: notification.read || false
        };
        if (notification.metadata !== void 0 && notification.metadata !== null) {
          data.metadata = typeof notification.metadata === "string" ? notification.metadata : JSON.stringify(notification.metadata);
        }
        const newNotification = await prisma.notification.create({ data });
        return convertPrismaNotification(newNotification);
      }
      async getNotifications(userId, limit = 20) {
        const notifications = await prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit
        });
        return notifications.map(convertPrismaNotification);
      }
      async getUnreadNotificationCount(userId) {
        return await prisma.notification.count({
          where: {
            userId,
            read: false
          }
        });
      }
      async markNotificationAsRead(id) {
        const notification = await prisma.notification.update({
          where: { id },
          data: { read: true }
        });
        return convertPrismaNotification(notification);
      }
      async markAllNotificationsAsRead(userId) {
        await prisma.notification.updateMany({
          where: {
            userId,
            read: false
          },
          data: { read: true }
        });
      }
      async getNotificationsPendingPush(limit = 50) {
        const notifications = await prisma.notification.findMany({
          where: {
            pendingPush: true,
            deliveryAttempts: {
              lt: 5
            }
          },
          orderBy: { createdAt: "asc" },
          take: limit
        });
        return notifications.map(convertPrismaNotification);
      }
      async updateNotificationDelivery(id, updates) {
        const data = {};
        if (updates.deliveredAt !== void 0)
          data.deliveredAt = updates.deliveredAt;
        if (updates.deliveryAttempts !== void 0)
          data.deliveryAttempts = updates.deliveryAttempts;
        if (updates.lastAttemptAt !== void 0)
          data.lastAttemptAt = updates.lastAttemptAt;
        if (updates.pendingPush !== void 0)
          data.pendingPush = updates.pendingPush;
        if (updates.pushError !== void 0) data.pushError = updates.pushError;
        const notification = await prisma.notification.update({
          where: { id },
          data
        });
        return convertPrismaNotification(notification);
      }
      // Push Subscription operations
      async getPushSubscription(userId, endpoint) {
        try {
          const subscription = await prisma.pushSubscription.findFirst({
            where: { userId, endpoint }
          });
          return subscription ? convertPrismaPushSubscription(subscription) : null;
        } catch (error) {
          console.error("Error getting push subscription:", error);
          return null;
        }
      }
      async createPushSubscription(data) {
        try {
          const subscription = await prisma.pushSubscription.upsert({
            where: {
              userId_endpoint: {
                userId: data.userId,
                endpoint: data.endpoint
              }
            },
            update: {
              p256dh: data.p256dh,
              auth: data.auth,
              expirationTime: data.expirationTime || null,
              enabled: true,
              updatedAt: /* @__PURE__ */ new Date()
            },
            create: {
              userId: data.userId,
              endpoint: data.endpoint,
              p256dh: data.p256dh,
              auth: data.auth,
              expirationTime: data.expirationTime || null,
              enabled: true
            }
          });
          return convertPrismaPushSubscription(subscription);
        } catch (error) {
          console.error("Error creating push subscription:", error);
          throw new Error("Failed to create push subscription");
        }
      }
      async deletePushSubscription(userId, endpoint) {
        try {
          await prisma.pushSubscription.deleteMany({
            where: { userId, endpoint }
          });
        } catch (error) {
          console.error("Error deleting push subscription:", error);
          throw new Error("Failed to delete push subscription");
        }
      }
      async getUserPushSubscriptions(userId) {
        try {
          const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId, enabled: true },
            orderBy: { createdAt: "desc" }
          });
          return subscriptions.map(convertPrismaPushSubscription);
        } catch (error) {
          console.error("Error getting user push subscriptions:", error);
          return [];
        }
      }
      async disablePushSubscription(endpoint) {
        try {
          await prisma.pushSubscription.updateMany({
            where: { endpoint },
            data: { enabled: false, updatedAt: /* @__PURE__ */ new Date() }
          });
        } catch (error) {
          console.error("Error disabling push subscription:", error);
        }
      }
      // XP Leaderboard operations
      async getXPLeaderboard(currentUserId, period, category, isAdmin = false) {
        const now = /* @__PURE__ */ new Date();
        let startDate = null;
        switch (period) {
          case "daily":
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case "weekly": {
            const dayOfWeek = now.getDay();
            startDate = new Date(
              now.getTime() - dayOfWeek * 24 * 60 * 60 * 1e3
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
        if (category === "overall") {
          const users2 = await prisma.user.findMany({
            select: {
              id: true,
              username: true,
              email: true,
              xp: true
            },
            orderBy: { xp: "desc" },
            take: 100
          });
          const leaderboard2 = users2.slice(0, 10).map((user, index) => {
            const baseData = {
              xp: user.xp,
              categoryXp: user.xp,
              rank: index + 1
            };
            if (isAdmin) {
              return {
                ...baseData,
                userId: user.id,
                username: user.username,
                email: user.email,
                displayName: user.username || user.email
              };
            }
            return {
              ...baseData,
              displayName: generateAnonymizedHandle(user.id)
            };
          });
          const currentUserRank2 = users2.findIndex((u) => u.id === currentUserId);
          let userPosition2 = null;
          if (currentUserRank2 !== -1 && currentUserRank2 > 9) {
            const currentUser = users2[currentUserRank2];
            const baseData = {
              xp: currentUser.xp,
              categoryXp: currentUser.xp,
              rank: currentUserRank2 + 1
            };
            if (isAdmin) {
              userPosition2 = {
                ...baseData,
                userId: currentUser.id,
                username: currentUser.username,
                email: currentUser.email,
                displayName: currentUser.username || currentUser.email
              };
            } else {
              userPosition2 = {
                ...baseData,
                displayName: "You"
              };
            }
          }
          return { leaderboard: leaderboard2, userPosition: userPosition2 };
        }
        const typeFilter = category === "mining" ? "mining" : category === "staking" ? "stak" : "referral";
        const users = await prisma.user.findMany({
          select: {
            id: true,
            username: true,
            email: true,
            xp: true
          },
          orderBy: { xp: "desc" },
          take: 100
        });
        const userXPData = await Promise.all(
          users.map(async (user) => {
            const whereClause = {
              userId: user.id,
              type: { contains: typeFilter }
            };
            if (startDate) {
              whereClause.createdAt = { gte: startDate };
            }
            const activities = await prisma.activity.findMany({
              where: whereClause
            });
            let categoryXp = 0;
            for (const activity of activities) {
              const desc = activity.description || "";
              if (category === "mining") {
                const xpMatch = desc.match(/(\d+)\s*XP/i);
                if (xpMatch) {
                  categoryXp += parseInt(xpMatch[1], 10);
                }
              } else {
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
              categoryXp
            };
          })
        );
        userXPData.sort((a, b) => b.categoryXp - a.categoryXp);
        const leaderboard = userXPData.slice(0, 10).map((user, index) => {
          const baseData = {
            xp: user.xp,
            categoryXp: user.categoryXp,
            rank: index + 1
          };
          if (isAdmin) {
            return {
              ...baseData,
              userId: user.userId,
              username: user.username,
              email: user.email,
              displayName: user.username || user.email
            };
          }
          return {
            ...baseData,
            displayName: generateAnonymizedHandle(user.userId)
          };
        });
        const currentUserRank = userXPData.findIndex(
          (u) => u.userId === currentUserId
        );
        let userPosition = null;
        if (currentUserRank !== -1 && currentUserRank > 9) {
          const currentUser = userXPData[currentUserRank];
          const baseData = {
            xp: currentUser.xp,
            categoryXp: currentUser.categoryXp,
            rank: currentUserRank + 1
          };
          if (isAdmin) {
            userPosition = {
              ...baseData,
              userId: currentUser.userId,
              username: currentUser.username,
              email: currentUser.email,
              displayName: currentUser.username || currentUser.email
            };
          } else {
            userPosition = {
              ...baseData,
              displayName: "You"
            };
          }
        }
        return { leaderboard, userPosition };
      }
      // Raw query support
      async raw(query, params = []) {
        return await prisma.$queryRawUnsafe(query, ...params);
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/services/depositScanner.ts
var depositScanner_exports = {};
__export(depositScanner_exports, {
  scanForDeposits: () => scanForDeposits,
  sendDepositNotification: () => sendDepositNotification,
  startDepositScanner: () => startDepositScanner
});
import { ethers as ethers3 } from "ethers";
import { PrismaClient as PrismaClient4, Prisma as Prisma2 } from "@prisma/client";
async function startDepositScanner() {
  if (!AUTO_DEPOSIT_ENABLED) {
    console.log("[DepositScanner] AUTO_DEPOSIT not enabled, scanner disabled");
    return;
  }
  const scanInterval = 60 * 1e3;
  console.log("[DepositScanner] Starting scanner service...");
  console.log(`[DepositScanner] Treasury (legacy): ${TREASURY_ADDRESS}`);
  console.log(`[DepositScanner] USDT: ${USDT_ADDRESS}`);
  console.log(`[DepositScanner] Required confirmations: ${REQUIRED_CONFIRMATIONS}`);
  console.log(`[DepositScanner] Scan batch size: ${SCAN_BATCH}`);
  console.log(`[DepositScanner] Watching user deposit addresses...`);
  await scanForDeposits().catch((err) => {
    console.error("[DepositScanner] Initial scan error:", err);
  });
  setInterval(async () => {
    if (!isScanning) {
      await scanForDeposits().catch((err) => {
        console.error("[DepositScanner] Scan error:", err);
      });
    }
  }, scanInterval);
}
async function scanForDeposits() {
  if (isScanning) return;
  isScanning = true;
  const startTime = Date.now();
  try {
    let state = await prisma4.scannerState.findFirst();
    const currentBlock = await provider2.getBlockNumber();
    if (!state) {
      let startBlock = currentBlock - 100;
      if (process.env.BSC_START_FROM === "latest") {
        startBlock = Math.max(0, currentBlock - REQUIRED_CONFIRMATIONS - 3);
        console.log(`[DepositScanner] Starting from latest (block ${startBlock})`);
      }
      state = await prisma4.scannerState.create({
        data: {
          lastBlock: Math.max(0, startBlock),
          lastScanAt: /* @__PURE__ */ new Date(),
          isScanning: true
        }
      });
    }
    const fromBlock = state.lastBlock + 1;
    const toBlock = Math.min(currentBlock - REQUIRED_CONFIRMATIONS, fromBlock + SCAN_BATCH - 1);
    if (fromBlock > toBlock) {
      console.log(`[DepositScanner] No new blocks to scan`);
      await prisma4.scannerState.update({
        where: { id: state.id },
        data: { isScanning: false, lastScanAt: /* @__PURE__ */ new Date() }
      });
      return;
    }
    console.log(`[DepositScanner] Scanning blocks ${fromBlock} to ${toBlock}...`);
    const users = await prisma4.user.findMany({
      where: { depositAddress: { not: null } },
      select: { id: true, depositAddress: true }
    });
    const addressToUserId = /* @__PURE__ */ new Map();
    users.forEach((user) => {
      if (user.depositAddress) {
        addressToUserId.set(user.depositAddress.toLowerCase(), user.id);
      }
    });
    console.log(`[DepositScanner] Watching ${users.length} deposit addresses`);
    const filter = usdtContract.filters.Transfer();
    const events = await usdtContract.queryFilter(filter, fromBlock, toBlock);
    console.log(`[DepositScanner] Found ${events.length} transfer events`);
    for (const event of events) {
      if (event instanceof ethers3.EventLog) {
        await processDepositEvent(event, currentBlock, addressToUserId);
      }
    }
    await prisma4.scannerState.update({
      where: { id: state.id },
      data: {
        lastBlock: toBlock,
        lastScanAt: /* @__PURE__ */ new Date(),
        isScanning: false,
        errorCount: 0,
        lastError: null
      }
    });
    const duration = Date.now() - startTime;
    console.log(`[DepositScanner] Scan completed in ${duration}ms`);
  } catch (error) {
    console.error("[DepositScanner] Scan failed:", error);
    const state = await prisma4.scannerState.findFirst();
    if (state) {
      await prisma4.scannerState.update({
        where: { id: state.id },
        data: {
          isScanning: false,
          errorCount: state.errorCount + 1,
          lastError: error.message,
          lastScanAt: /* @__PURE__ */ new Date()
        }
      });
    }
  } finally {
    isScanning = false;
  }
}
async function processDepositEvent(event, currentBlock, addressToUserId) {
  try {
    const txHash = event.transactionHash.toLowerCase();
    const from = event.args.from.toLowerCase();
    const to = event.args.to.toLowerCase();
    const value = event.args.value;
    const blockNumber = event.blockNumber;
    const confirmations = currentBlock - blockNumber;
    const usdtAmount = Number(ethers3.formatUnits(value, 18));
    const userId = addressToUserId.get(to);
    if (!userId) {
      if (to === TREASURY_ADDRESS) {
        const linkedWallet = await prisma4.linkedWallet.findFirst({
          where: { address: from, active: true }
        });
        if (linkedWallet) {
          const existing = await prisma4.transaction.findFirst({
            where: { transactionHash: txHash }
          });
          if (existing) return;
          await processUserDeposit(
            linkedWallet.userId,
            to,
            from,
            usdtAmount,
            txHash,
            blockNumber,
            confirmations
          );
        }
      }
      return;
    }
    const existingTx = await prisma4.transaction.findFirst({
      where: { transactionHash: txHash }
    });
    if (existingTx) {
      return;
    }
    console.log(`[DepositScanner] New deposit: ${usdtAmount} USDT to user deposit address ${to}`);
    await processUserDeposit(
      userId,
      to,
      from,
      usdtAmount,
      txHash,
      blockNumber,
      confirmations
    );
  } catch (error) {
    console.error("[DepositScanner] Event processing error:", error);
  }
}
async function processUserDeposit(userId, toAddress, fromAddress, usdtAmount, txHash, blockNumber, confirmations) {
  try {
    const netUsdt = usdtAmount * (1 - PLATFORM_FEE_BPS / 1e4);
    const xnrtAmount = netUsdt * XNRT_RATE;
    if (confirmations >= REQUIRED_CONFIRMATIONS) {
      await prisma4.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            userId,
            type: "deposit",
            amount: new Prisma2.Decimal(xnrtAmount),
            usdtAmount: new Prisma2.Decimal(usdtAmount),
            transactionHash: txHash,
            walletAddress: toAddress,
            // User's deposit address
            status: "approved",
            verified: true,
            confirmations,
            verificationData: {
              autoDeposit: true,
              blockNumber,
              scannedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        });
        await tx.balance.upsert({
          where: { userId },
          create: {
            userId,
            xnrtBalance: new Prisma2.Decimal(xnrtAmount),
            totalEarned: new Prisma2.Decimal(xnrtAmount)
          },
          update: {
            xnrtBalance: { increment: new Prisma2.Decimal(xnrtAmount) },
            totalEarned: { increment: new Prisma2.Decimal(xnrtAmount) }
          }
        });
      });
      console.log(`[DepositScanner] Auto-credited ${xnrtAmount} XNRT to user ${userId}`);
      void sendDepositNotification(userId, xnrtAmount, txHash).catch((err) => {
        console.error("[DepositScanner] Notification error:", err);
      });
    } else {
      await prisma4.transaction.create({
        data: {
          userId,
          type: "deposit",
          amount: new Prisma2.Decimal(xnrtAmount),
          usdtAmount: new Prisma2.Decimal(usdtAmount),
          transactionHash: txHash,
          walletAddress: toAddress,
          // User's deposit address
          status: "pending",
          verified: true,
          confirmations,
          verificationData: {
            autoDeposit: true,
            blockNumber,
            scannedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      });
      console.log(`[DepositScanner] Pending deposit (${confirmations}/${REQUIRED_CONFIRMATIONS} confirmations)`);
    }
  } catch (error) {
    console.error("[DepositScanner] Linked deposit processing error:", error);
  }
}
async function sendDepositNotification(userId, amount, txHash) {
  const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
  await notifyUser2(userId, {
    type: "deposit_approved",
    title: "\u{1F4B0} Deposit Auto-Credited!",
    message: `Your deposit of ${amount.toLocaleString()} XNRT has been automatically credited to your account`,
    url: "/wallet",
    metadata: {
      amount: amount.toString(),
      transactionHash: txHash,
      autoDeposit: true
    }
  });
}
var prisma4, RPC_URL, USDT_ADDRESS, TREASURY_ADDRESS, REQUIRED_CONFIRMATIONS, XNRT_RATE, PLATFORM_FEE_BPS, SCAN_BATCH, AUTO_DEPOSIT_ENABLED, provider2, USDT_ABI2, usdtContract, isScanning;
var init_depositScanner = __esm({
  "server/services/depositScanner.ts"() {
    "use strict";
    prisma4 = new PrismaClient4();
    RPC_URL = process.env.RPC_BSC_URL || "";
    USDT_ADDRESS = (process.env.USDT_BSC_ADDRESS || "").toLowerCase();
    TREASURY_ADDRESS = (process.env.XNRT_WALLET || "").toLowerCase();
    REQUIRED_CONFIRMATIONS = Number(process.env.BSC_CONFIRMATIONS || 12);
    XNRT_RATE = Number(process.env.XNRT_RATE_USDT || 100);
    PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 0);
    SCAN_BATCH = Number(process.env.BSC_SCAN_BATCH || 300);
    AUTO_DEPOSIT_ENABLED = process.env.AUTO_DEPOSIT === "true";
    provider2 = new ethers3.JsonRpcProvider(RPC_URL);
    USDT_ABI2 = [
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];
    usdtContract = new ethers3.Contract(USDT_ADDRESS, USDT_ABI2, provider2);
    isScanning = false;
  }
});

// server/index.ts
import express2 from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

// server/routes.ts
init_storage();
import { createServer } from "http";

// server/auth/middleware.ts
import { PrismaClient as PrismaClient2 } from "@prisma/client";

// server/auth/jwt.ts
import jwt from "jsonwebtoken";
import { nanoid as nanoid2 } from "nanoid";
var JWT_SECRET = process.env.JWT_SECRET;
var JWT_EXPIRES_IN = "7d";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for security. Generate one with: openssl rand -hex 32");
}
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long for security");
}
function signToken(payload) {
  const jwtId = nanoid2();
  const token = jwt.sign(
    { ...payload, jwtId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  return { token, jwtId };
}
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

// server/auth/csrf.ts
import { nanoid as nanoid3 } from "nanoid";
function generateCSRFToken() {
  return nanoid3(32);
}
function validateCSRFToken(headerToken, cookieToken) {
  if (!headerToken || !cookieToken) {
    return false;
  }
  return headerToken === cookieToken;
}

// server/auth/middleware.ts
import rateLimit from "express-rate-limit";
var prisma2 = new PrismaClient2();
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.sid;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    const session = await prisma2.session.findUnique({
      where: { jwtId: payload.jwtId }
    });
    if (!session || session.revokedAt) {
      return res.status(401).json({ message: "Unauthorized: Session revoked" });
    }
    req.authUser = {
      id: payload.userId,
      email: payload.email,
      jwtId: payload.jwtId
    };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
async function requireAdmin(req, res, next) {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: "Unauthorized: Please log in first" });
    }
    const user = await prisma2.user.findUnique({
      where: { id: req.authUser.id },
      select: { isAdmin: true }
    });
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
function validateCSRF(req, res, next) {
  const headerToken = req.headers["x-csrf-token"];
  const cookieToken = req.cookies.csrfToken;
  if (!validateCSRFToken(headerToken, cookieToken)) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next();
}
var loginRateLimiter = rateLimit({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 5,
  // 5 requests per minute
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === "development";
  }
});

// server/auth/routes.ts
import { Router } from "express";
import { z } from "zod";
import { PrismaClient as PrismaClient3 } from "@prisma/client";
import { nanoid as nanoid4 } from "nanoid";
import crypto3 from "crypto";

// server/auth/password.ts
import bcrypt from "bcrypt";
import crypto2 from "crypto";
var SALT_ROUNDS = 12;
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
function generateResetToken() {
  return crypto2.randomBytes(32).toString("hex");
}

// server/auth/routes.ts
import rateLimit2 from "express-rate-limit";

// server/services/email.ts
import nodemailer from "nodemailer";

// server/email/templates.ts
var BRAND_COLOR = "#D4AF37";
var BRAND_NAME = "XNRT";
var BRAND_TAGLINE = "We Build the NextGen";
function getBaseTemplate(content, preheader) {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${BRAND_NAME}</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;font-family:Arial,sans-serif;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
  <style>
    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      border-collapse: collapse;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    p {
      display: block;
      margin: 13px 0;
    }
  </style>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="background-color: #000000; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <center style="width: 100%; background-color: #000000;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 40px 10px 40px 10px;">
          <!-- Main Container -->
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(0,0,0,0.95) 100%); border-radius: 8px 8px 0 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <h1 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 36px; font-weight: 700; color: ${BRAND_COLOR}; margin: 0; letter-spacing: 1px;">
                        ${BRAND_NAME}
                      </h1>
                      <p style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 14px; color: ${BRAND_COLOR}; margin: 8px 0 0 0; opacity: 0.9;">
                        ${BRAND_TAGLINE}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td align="center" style="padding: 40px 40px 40px 40px; background-color: #0a0a0a; border-left: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">
                ${content}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td align="center" style="padding: 30px 40px 40px 40px; background-color: #050505; border-radius: 0 0 8px 8px; border-left: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <p style="font-family: Arial, sans-serif; font-size: 12px; color: #666666; margin: 0; line-height: 18px;">
                        \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${BRAND_NAME}. All rights reserved.
                      </p>
                      <p style="font-family: Arial, sans-serif; font-size: 12px; color: #666666; margin: 10px 0 0 0; line-height: 18px;">
                        Off-chain gamification earning platform
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `.trim();
}
function createButton(text, url) {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 6px; background-color: ${BRAND_COLOR};">
                <a href="${url}" target="_blank" style="font-size: 16px; font-family: 'Space Grotesk', Arial, sans-serif; font-weight: 600; color: #000000; text-decoration: none; display: inline-block; padding: 14px 40px; border-radius: 6px; letter-spacing: 0.5px;">
                  ${text}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}
function generateVerificationEmail(email, token, baseUrl) {
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">
            Verify Your Email Address
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 20px 0; line-height: 24px;">
            Welcome to ${BRAND_NAME}! Please verify your email address to activate your account and start earning XNRT tokens.
          </p>
          ${createButton("Verify Email Address", verifyUrl)}
          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #999999; margin: 20px 0 0 0; line-height: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-family: monospace; font-size: 12px; color: ${BRAND_COLOR}; margin: 10px 0 0 0; word-break: break-all;">
            ${verifyUrl}
          </p>
          <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 25px 0 0 0; line-height: 18px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            This link will expire in 24 hours for security reasons. If you didn't create an account with ${BRAND_NAME}, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>
  `;
  return getBaseTemplate(content, "Please verify your email address to activate your XNRT account");
}
function generatePasswordResetEmail(email, token, baseUrl) {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">
            Reset Your Password
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 20px 0; line-height: 24px;">
            We received a request to reset the password for your ${BRAND_NAME} account. Click the button below to set a new password.
          </p>
          ${createButton("Reset Password", resetUrl)}
          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #999999; margin: 20px 0 0 0; line-height: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-family: monospace; font-size: 12px; color: ${BRAND_COLOR}; margin: 10px 0 0 0; word-break: break-all;">
            ${resetUrl}
          </p>
          <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 25px 0 0 0; line-height: 18px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            This link will expire in 1 hour for security reasons. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </p>
        </td>
      </tr>
    </table>
  `;
  return getBaseTemplate(content, "Reset your XNRT account password");
}

// server/services/email.ts
var SMTP_HOST = "smtp-relay.brevo.com";
var SMTP_PORT = 587;
var SMTP_USER = "95624d002@smtp-brevo.com";
var SMTP_PASS = process.env.SMTP_PASSWORD;
var FROM_EMAIL = "NextGen Rise Foundation <noreply@xnrt.org>";
var transporter = null;
function getTransporter() {
  if (!transporter) {
    if (!SMTP_PASS) {
      throw new Error("SMTP_PASSWORD environment variable is not set");
    }
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      // use STARTTLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }
  return transporter;
}
async function sendEmail(options) {
  const transport = getTransporter();
  await transport.sendMail({
    from: FROM_EMAIL,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, "")
    // Strip HTML for text version
  });
}
async function sendVerificationEmail(email, username, token) {
  const baseUrl = process.env.APP_URL || "https://xnrt.org";
  await sendEmail({
    to: email,
    subject: "Verify Your Email - XNRT Platform",
    html: generateVerificationEmail(email, token, baseUrl)
  });
}
async function sendPasswordResetEmail(email, username, token) {
  const baseUrl = process.env.APP_URL || "https://xnrt.org";
  await sendEmail({
    to: email,
    subject: "Reset Your Password - XNRT Platform",
    html: generatePasswordResetEmail(email, token, baseUrl)
  });
}

// server/auth/routes.ts
var router = Router();
var prisma3 = new PrismaClient3();
var registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(8),
  referralCode: z.string().optional()
});
var loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
var forgotPasswordSchema = z.object({
  email: z.string().email()
});
var resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8)
});
var verifyTokenSchema = z.object({
  token: z.string()
});
var verifyEmailSchema = z.object({
  token: z.string()
});
var resendVerificationSchema = z.object({
  email: z.string().email()
});
var forgotPasswordRateLimiter = rateLimit2({
  windowMs: 15 * 60 * 1e3,
  max: 3,
  message: "Too many password reset attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === "development";
  }
});
router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await prisma3.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username }
        ]
      }
    });
    if (existingUser) {
      return res.status(400).json({
        message: existingUser.email === data.email ? "Email already registered" : "Username already taken"
      });
    }
    const passwordHash = await hashPassword(data.password);
    const userReferralCode = `XNRT${nanoid4(8).toUpperCase()}`;
    let referredBy = null;
    if (data.referralCode) {
      const referrer = await prisma3.user.findUnique({
        where: { referralCode: data.referralCode }
      });
      if (referrer) {
        referredBy = referrer.id;
      }
    }
    const emailVerificationToken = crypto3.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    const user = await prisma3.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        referralCode: userReferralCode,
        referredBy,
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires
      }
    });
    await prisma3.balance.create({
      data: {
        userId: user.id
      }
    });
    if (referredBy) {
      const referrerChain = await getReferrerChain(referredBy);
      for (let i = 0; i < Math.min(referrerChain.length, 3); i++) {
        await prisma3.referral.create({
          data: {
            referrerId: referrerChain[i],
            referredUserId: user.id,
            level: i + 1
          }
        });
      }
    }
    try {
      await sendVerificationEmail(user.email, user.username, emailVerificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }
    res.status(201).json({
      message: "Registration successful! Please check your email to verify your account.",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: false
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma3.user.findUnique({
      where: { email: data.email }
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const isValid = await comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email address before logging in. Check your inbox for the verification link.",
        emailVerified: false
      });
    }
    const { token, jwtId } = signToken({
      userId: user.id,
      email: user.email
    });
    await prisma3.session.create({
      data: {
        jwtId,
        userId: user.id
      }
    });
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("sid", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    });
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/verify-email", async (req, res) => {
  try {
    const data = verifyEmailSchema.parse(req.body);
    const user = await prisma3.user.findFirst({
      where: {
        emailVerificationToken: data.token
      }
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid verification token" });
    }
    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }
    if (user.emailVerificationExpires && /* @__PURE__ */ new Date() > user.emailVerificationExpires) {
      return res.status(400).json({ message: "Verification token has expired. Please request a new one." });
    }
    await prisma3.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      }
    });
    const { token, jwtId } = signToken({
      userId: user.id,
      email: user.email
    });
    await prisma3.session.create({
      data: {
        jwtId,
        userId: user.id
      }
    });
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("sid", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    });
    res.json({
      message: "Email verified successfully!",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: true
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Verify email error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/resend-verification", forgotPasswordRateLimiter, async (req, res) => {
  try {
    const data = resendVerificationSchema.parse(req.body);
    const user = await prisma3.user.findUnique({
      where: { email: data.email }
    });
    const uniformResponse = { message: "If an account exists with this email and is not yet verified, a verification link has been sent" };
    if (!user) {
      return res.json(uniformResponse);
    }
    if (user.emailVerified) {
      return res.json(uniformResponse);
    }
    const emailVerificationToken = crypto3.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    await prisma3.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires
      }
    });
    try {
      await sendVerificationEmail(user.email, user.username, emailVerificationToken);
    } catch (emailError) {
      console.error("Failed to resend verification email:", emailError);
    }
    res.json(uniformResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/logout", requireAuth, async (req, res) => {
  try {
    const jwtId = req.authUser?.jwtId;
    if (jwtId) {
      await prisma3.session.update({
        where: { jwtId },
        data: { revokedAt: /* @__PURE__ */ new Date() }
      });
    }
    res.clearCookie("sid");
    res.status(204).send();
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma3.user.findUnique({
      where: { id: req.authUser.id },
      select: {
        id: true,
        email: true,
        username: true,
        referralCode: true,
        emailVerified: true,
        isAdmin: true,
        xp: true,
        level: true,
        streak: true,
        lastCheckIn: true,
        createdAt: true
      }
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/csrf", (req, res) => {
  const csrfToken = generateCSRFToken();
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("csrfToken", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1e3
    // 24 hours
  });
  res.json({ csrfToken });
});
router.post("/forgot-password", forgotPasswordRateLimiter, async (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    const user = await prisma3.user.findUnique({
      where: { email: data.email }
    });
    if (!user) {
      return res.json({ message: "If an account exists with this email, a password reset link has been sent" });
    }
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
    await prisma3.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt
      }
    });
    try {
      await sendPasswordResetEmail(user.email, user.username, token);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
    }
    res.json({ message: "If an account exists with this email, a password reset link has been sent" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/verify-reset-token", async (req, res) => {
  try {
    const data = verifyTokenSchema.parse(req.body);
    const resetToken = await prisma3.passwordReset.findUnique({
      where: { token: data.token }
    });
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    if (resetToken.usedAt) {
      return res.status(400).json({ message: "This reset token has already been used" });
    }
    if (/* @__PURE__ */ new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: "Reset token has expired" });
    }
    res.json({ valid: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Verify token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.post("/reset-password", async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const resetToken = await prisma3.passwordReset.findUnique({
      where: { token: data.token },
      include: { user: true }
    });
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    if (resetToken.usedAt) {
      return res.status(400).json({ message: "This reset token has already been used" });
    }
    if (/* @__PURE__ */ new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: "Reset token has expired" });
    }
    const passwordHash = await hashPassword(data.password);
    await prisma3.$transaction([
      prisma3.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      prisma3.passwordReset.update({
        where: { id: resetToken.id },
        data: { usedAt: /* @__PURE__ */ new Date() }
      }),
      prisma3.session.updateMany({
        where: { userId: resetToken.userId },
        data: { revokedAt: /* @__PURE__ */ new Date() }
      })
    ]);
    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
async function getReferrerChain(userId) {
  const chain = [userId];
  let currentUserId = userId;
  for (let i = 0; i < 2; i++) {
    const user = await prisma3.user.findUnique({
      where: { id: currentUserId },
      select: { referredBy: true }
    });
    if (!user?.referredBy) break;
    chain.push(user.referredBy);
    currentUserId = user.referredBy;
  }
  return chain;
}
var routes_default = router;

// shared/schema.ts
import { z as z2 } from "zod";
var insertStakeSchema = z2.object({
  userId: z2.string(),
  tier: z2.string(),
  amount: z2.string(),
  dailyRate: z2.string(),
  duration: z2.number().int(),
  startDate: z2.date().optional(),
  endDate: z2.date(),
  totalProfit: z2.string().optional().default("0"),
  lastProfitDate: z2.date().nullable().optional(),
  status: z2.string().optional().default("active"),
  isLoan: z2.boolean().optional(),
  loanProgram: z2.string().nullable().optional(),
  unlockMet: z2.boolean().optional(),
  requiredReferrals: z2.number().int().optional(),
  requiredInvestingReferrals: z2.number().int().optional(),
  minInvestUsdtPerReferral: z2.string().nullable().optional()
});
var insertMiningSessionSchema = z2.object({
  userId: z2.string(),
  baseReward: z2.number().int().optional().default(10),
  adBoostCount: z2.number().int().optional().default(0),
  boostPercentage: z2.number().int().optional().default(0),
  finalReward: z2.number().int().optional().default(10),
  startTime: z2.date().optional(),
  endTime: z2.date().nullable().optional(),
  nextAvailable: z2.date(),
  status: z2.string().optional().default("active")
});
var insertTransactionSchema = z2.object({
  userId: z2.string(),
  type: z2.string(),
  amount: z2.string(),
  usdtAmount: z2.string().nullable().optional(),
  source: z2.string().nullable().optional(),
  walletAddress: z2.string().nullable().optional(),
  transactionHash: z2.string().nullable().optional(),
  proofImageUrl: z2.string().nullable().optional(),
  status: z2.string().optional().default("pending"),
  adminNotes: z2.string().nullable().optional(),
  fee: z2.string().nullable().optional(),
  netAmount: z2.string().nullable().optional(),
  approvedBy: z2.string().nullable().optional(),
  approvedAt: z2.date().nullable().optional(),
  verified: z2.boolean().optional(),
  confirmations: z2.number().int().optional(),
  verificationData: z2.any().optional()
});
var insertAnnouncementSchema = z2.object({
  title: z2.string().min(1, "Title is required").max(255, "Title too long"),
  content: z2.string().min(1, "Content is required"),
  type: z2.enum(["info", "warning", "success", "error"]),
  isActive: z2.boolean().optional(),
  expiresAt: z2.string().optional().nullable()
});
var STAKING_TIERS = {
  royal_sapphire: {
    name: "Royal Sapphire",
    duration: 15,
    minAmount: 5e4,
    maxAmount: 1e6,
    dailyRate: 1.1,
    apy: 402
  },
  legendary_emerald: {
    name: "Legendary Emerald",
    duration: 30,
    minAmount: 1e4,
    maxAmount: 1e7,
    dailyRate: 1.4,
    apy: 511
  },
  imperial_platinum: {
    name: "Imperial Platinum",
    duration: 45,
    minAmount: 5e3,
    maxAmount: 1e7,
    dailyRate: 1.5,
    apy: 547
  },
  mythic_diamond: {
    name: "Mythic Diamond",
    duration: 90,
    minAmount: 100,
    maxAmount: 1e7,
    dailyRate: 2,
    apy: 730
  }
};

// server/routes.ts
init_notifications();
import { PrismaClient as PrismaClient5, Prisma as Prisma3 } from "@prisma/client";
import webpush2 from "web-push";
import rateLimit3 from "express-rate-limit";

// server/services/verifyBscUsdt.ts
import { ethers } from "ethers";
var provider = new ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
var USDT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
var usdt = new ethers.Contract(
  process.env.USDT_BSC_ADDRESS,
  USDT_ABI,
  provider
);
async function verifyBscUsdtDeposit(params) {
  try {
    const { txHash, expectedTo } = params;
    const allowOverride = process.env.ALLOW_VERIFY_OVERRIDE === "1" && (process.env.NODE_ENV !== "production" || process.env.FORCE_OVERRIDE_IN_PROD === "1");
    const prefix = (process.env.VERIFY_OVERRIDE_PREFIX || "").toLowerCase();
    const matchPrefix = prefix ? txHash?.toLowerCase().startsWith(prefix) : true;
    const forceByParam = params.requiredConf === -1;
    if (allowOverride && (matchPrefix || forceByParam)) {
      const fakeConf = Number(process.env.OVERRIDE_CONFIRMATIONS ?? 12);
      const amt = typeof params.minAmount === "number" ? params.minAmount : void 0;
      return {
        verified: true,
        confirmations: fakeConf,
        amountOnChain: amt,
        reason: "override"
      };
    }
    const need = params.requiredConf ?? Number(process.env.BSC_CONFIRMATIONS ?? 12);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        verified: false,
        confirmations: 0,
        reason: "Transaction not found"
      };
    }
    if (receipt.status !== 1) {
      const conf2 = await provider.getBlockNumber() - (receipt.blockNumber ?? 0);
      return {
        verified: false,
        confirmations: conf2,
        reason: "Transaction failed"
      };
    }
    let totalToExpected = BigInt(0);
    for (const log2 of receipt.logs) {
      if (log2.address.toLowerCase() !== process.env.USDT_BSC_ADDRESS.toLowerCase())
        continue;
      try {
        const parsed = usdt.interface.parseLog({
          topics: log2.topics,
          data: log2.data
        });
        if (parsed?.name !== "Transfer") continue;
        const to = parsed.args.to;
        const value = parsed.args.value;
        if (to.toLowerCase() === expectedTo.toLowerCase()) {
          totalToExpected += value;
        }
      } catch {
      }
    }
    const conf = await provider.getBlockNumber() - (receipt.blockNumber ?? 0);
    if (totalToExpected === BigInt(0)) {
      return {
        verified: false,
        confirmations: conf,
        reason: "No USDT transfer to expected address"
      };
    }
    const amountFloat = Number(ethers.formatUnits(totalToExpected, 18));
    if (typeof params.minAmount === "number" && amountFloat + 1e-10 < params.minAmount) {
      return {
        verified: false,
        confirmations: conf,
        reason: `On-chain ${amountFloat} USDT < claimed ${params.minAmount} USDT`
      };
    }
    if (conf < need) {
      return {
        verified: false,
        confirmations: conf,
        amountOnChain: amountFloat,
        reason: `Only ${conf}/${need} confirmations`
      };
    }
    return { verified: true, confirmations: conf, amountOnChain: amountFloat };
  } catch (e) {
    return {
      verified: false,
      confirmations: 0,
      reason: e?.message ?? "Verify error"
    };
  }
}

// server/routes.ts
import { ethers as ethers4 } from "ethers";

// server/services/hdWallet.ts
import { ethers as ethers2 } from "ethers";
var MASTER_SEED_ENV = "MASTER_SEED";
var BSC_DERIVATION_PATH = "m/44'/714'/0'/0";
function deriveDepositAddress(derivationIndex) {
  const masterSeed = process.env[MASTER_SEED_ENV];
  if (!masterSeed) {
    throw new Error("MASTER_SEED environment variable not set");
  }
  let mnemonic;
  try {
    if (masterSeed.split(" ").length >= 12) {
      mnemonic = ethers2.Mnemonic.fromPhrase(masterSeed);
    } else {
      throw new Error("MASTER_SEED must be a 12 or 24 word mnemonic phrase");
    }
  } catch (error) {
    throw new Error("Invalid MASTER_SEED format. Must be 12/24 word mnemonic");
  }
  const derivationPath = `${BSC_DERIVATION_PATH}/${derivationIndex}`;
  const hdNode = ethers2.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);
  return hdNode.address.toLowerCase();
}

// server/routes.ts
var prisma5 = new PrismaClient5();
var TRUST_LOAN_CONFIG = {
  programKey: "trust_loan",
  durationDays: 30,
  amountXnrt: 1e4,
  requiredReferrals: 3,
  requiredInvestingReferrals: 2,
  minInvestUsdtPerReferral: 100
};
async function getDirectReferralStats(userId) {
  const directs = await prisma5.referral.findMany({
    where: { referrerId: userId, level: 1 },
    select: { referredUserId: true }
  });
  const directCount = directs.length;
  if (!directCount) return { directCount: 0, investingCount: 0 };
  const ids = directs.map((d) => d.referredUserId);
  const investingRows = await prisma5.transaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: ids },
      type: "deposit",
      status: "approved",
      usdtAmount: {
        gte: new Prisma3.Decimal(TRUST_LOAN_CONFIG.minInvestUsdtPerReferral)
      }
    },
    _count: { _all: true }
  });
  const investingCount = investingRows.length;
  return { directCount, investingCount };
}
var VAPID_PUBLIC_KEY2 = (process.env.VAPID_PUBLIC_KEY || "").replace(/^"publicKey":"/, "").replace(/"$/, "");
var VAPID_PRIVATE_KEY2 = (process.env.VAPID_PRIVATE_KEY || "").replace(/^"privateKey":"/, "").replace(/}$/, "").replace(/"$/, "");
var VAPID_SUBJECT2 = process.env.VAPID_SUBJECT || "mailto:support@xnrt.org";
var MINING_BASE_REWARD_XP = 5;
if (VAPID_PUBLIC_KEY2 && VAPID_PRIVATE_KEY2) {
  webpush2.setVapidDetails(VAPID_SUBJECT2, VAPID_PUBLIC_KEY2, VAPID_PRIVATE_KEY2);
}
var pushSubscriptionLimiter = rateLimit3({
  windowMs: 60 * 1e3,
  max: 10,
  message: { message: "Too many subscription requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development"
});
var DEFAULT_ACHIEVEMENTS = [
  // 🟢 Earnings
  {
    title: "Sign-in Bonus",
    description: "Claim your first daily check-in reward",
    icon: "\u2705",
    category: "streaks",
    requirement: 1,
    // 1 din ka streak
    xpReward: 5
  },
  {
    title: "First Earnings",
    description: "Earn a total of 1,000 XNRT from any source",
    icon: "\u{1F4B0}",
    category: "earnings",
    requirement: 1e3,
    xpReward: 25
  },
  {
    title: "Rising Earner",
    description: "Earn a total of 5,000 XNRT",
    icon: "\u{1F4C8}",
    category: "earnings",
    requirement: 5e3,
    xpReward: 75
  },
  {
    title: "Pro Earner",
    description: "Earn a total of 25,000 XNRT",
    icon: "\u{1F3C5}",
    category: "earnings",
    requirement: 25e3,
    xpReward: 150
  },
  // 🧑‍🤝‍🧑 Referrals
  {
    title: "First Referral",
    description: "Invite your first friend to XNRT",
    icon: "\u{1F465}",
    category: "referrals",
    requirement: 1,
    xpReward: 25
  },
  {
    title: "Team Builder",
    description: "Refer 5 direct users",
    icon: "\u{1F9F1}",
    category: "referrals",
    requirement: 5,
    xpReward: 75
  },
  {
    title: "Community Leader",
    description: "Refer 25 direct users",
    icon: "\u{1F451}",
    category: "referrals",
    requirement: 25,
    xpReward: 200
  },
  // 🔥 Streaks
  {
    title: "3-Day Streak",
    description: "Check in 3 days in a row",
    icon: "\u{1F525}",
    category: "streaks",
    requirement: 3,
    xpReward: 30
  },
  {
    title: "Weekly Grinder",
    description: "Maintain a 7-day login streak",
    icon: "\u{1F4C6}",
    category: "streaks",
    requirement: 7,
    xpReward: 70
  },
  {
    title: "Monthly Legend",
    description: "Maintain a 30-day login streak",
    icon: "\u{1F3C6}",
    category: "streaks",
    requirement: 30,
    xpReward: 200
  },
  // ⛏ Mining
  {
    title: "First Mining Session",
    description: "Complete your first mining session",
    icon: "\u26CF\uFE0F",
    category: "mining",
    requirement: 1,
    xpReward: 15
  },
  {
    title: "Daily Miner",
    description: "Complete 10 mining sessions",
    icon: "\u{1FA99}",
    category: "mining",
    requirement: 10,
    xpReward: 60
  },
  {
    title: "Pro Miner",
    description: "Complete 50 mining sessions",
    icon: "\u2699\uFE0F",
    category: "mining",
    requirement: 50,
    xpReward: 200
  }
];
function parseAchievementPayload(body) {
  const {
    title,
    description,
    icon = "\u{1F3C6}",
    category = "earnings",
    requirement,
    xpReward
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
  const allowedCategories = /* @__PURE__ */ new Set(["earnings", "referrals", "streaks", "mining"]);
  return {
    title: String(title),
    description: String(description),
    icon: String(icon || "\u{1F3C6}"),
    category: allowedCategories.has(category) ? category : "earnings",
    requirement: Math.floor(requirementNum),
    xpReward: Math.floor(xpRewardNum)
  };
}
async function ensureDefaultAchievements() {
  for (const def of DEFAULT_ACHIEVEMENTS) {
    try {
      await prisma5.achievement.upsert({
        where: { title: def.title },
        // title must be unique in schema
        create: def,
        update: {
          description: def.description,
          icon: def.icon,
          category: def.category,
          requirement: def.requirement,
          xpReward: def.xpReward
        }
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
async function registerRoutes(app2) {
  await ensureDefaultAchievements();
  app2.post("/csp-report", (req, res) => {
    console.log("[CSP Violation]", JSON.stringify(req.body, null, 2));
    res.status(204).end();
  });
  app2.use("/auth", routes_default);
  app2.get("/api/balance", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const balance = await storage.getBalance(userId);
      res.json(
        balance || {
          xnrtBalance: "0",
          stakingBalance: "0",
          miningBalance: "0",
          referralBalance: "0",
          totalEarned: "0"
        }
      );
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });
  app2.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const stakes = await storage.getStakes(userId);
      const miningSessions = await storage.getMiningHistory(userId);
      const referrals = await storage.getReferralsByReferrer(userId);
      const recentActivity = await storage.getActivities(userId, 5);
      res.json({
        activeStakes: stakes.filter((s) => s.status === "active").length,
        miningSessions: miningSessions.filter((s) => s.status === "completed").length,
        totalReferrals: referrals.length,
        recentActivity
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
  app2.get("/api/stakes", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const stakes = await storage.getStakes(userId);
      res.json(stakes);
    } catch (error) {
      console.error("Error fetching stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });
  app2.post("/api/stakes", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const { tier, amount } = req.body;
      if (!STAKING_TIERS[tier]) {
        return res.status(400).json({ message: "Invalid staking tier" });
      }
      const tierConfig = STAKING_TIERS[tier];
      const stakeAmount = parseFloat(amount);
      if (stakeAmount < tierConfig.minAmount || stakeAmount > tierConfig.maxAmount) {
        return res.status(400).json({
          message: `Stake amount must be between ${tierConfig.minAmount} and ${tierConfig.maxAmount} XNRT`
        });
      }
      const balance = await storage.getBalance(userId);
      if (!balance || parseFloat(balance.xnrtBalance) < stakeAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      const startDate = /* @__PURE__ */ new Date();
      const endDate = new Date(
        startDate.getTime() + tierConfig.duration * 24 * 60 * 60 * 1e3
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
        status: "active"
      });
      await storage.updateBalance(userId, {
        xnrtBalance: (parseFloat(balance.xnrtBalance) - stakeAmount).toString(),
        stakingBalance: (parseFloat(balance.stakingBalance) + stakeAmount).toString()
      });
      await storage.createActivity({
        userId,
        type: "stake_created",
        description: `Staked ${stakeAmount.toLocaleString()} XNRT in ${tierConfig.name}`
      });
      res.json(stake);
    } catch (error) {
      console.error("Error creating stake:", error);
      res.status(500).json({ message: "Failed to create stake" });
    }
  });
  app2.post(
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
  app2.post(
    "/api/stakes/:id/withdraw",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        const stakeId = req.params.id;
        const stake = await storage.getStakeById(stakeId);
        if (!stake) return res.status(404).json({ message: "Stake not found" });
        if (stake.userId !== userId)
          return res.status(403).json({ message: "Unauthorized" });
        if (stake.status !== "completed" && stake.status !== "active") {
          return res.status(400).json({
            message: "Stake has already been withdrawn or is not ready for withdrawal"
          });
        }
        if (new Date(stake.endDate) > /* @__PURE__ */ new Date()) {
          return res.status(400).json({ message: "Stake has not matured yet" });
        }
        const dailyRate = parseFloat(stake.dailyRate) / 100;
        const startDate = new Date(stake.startDate);
        const endDate = new Date(stake.endDate);
        const totalDurationDays = Math.floor(
          (endDate.getTime() - startDate.getTime()) / (1e3 * 60 * 60 * 24)
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
          stakingBalance: (parseFloat(balance.stakingBalance) - stakeAmount).toString()
        });
        const tierConfig = STAKING_TIERS[stake.tier];
        await storage.createActivity({
          userId,
          type: "stake_withdrawn",
          description: `Withdrew ${stakeAmount.toLocaleString()} XNRT + ${totalProfit.toLocaleString()} profit from ${tierConfig.name}`
        });
        res.json({ success: true, totalAmount: totalWithdrawalAmount, profit: totalProfit });
      } catch (error) {
        console.error("Error withdrawing stake:", error);
        res.status(500).json({ message: "Failed to withdraw stake" });
      }
    }
  );
  app2.post("/api/mining/start", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const currentSession = await storage.getCurrentMiningSession(userId);
      if (currentSession && currentSession.status === "active") {
        return res.status(400).json({ message: "You already have an active mining session" });
      }
      const startTime = /* @__PURE__ */ new Date();
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      const session = await storage.createMiningSession({
        userId,
        baseReward: MINING_BASE_REWARD_XP,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: MINING_BASE_REWARD_XP,
        startTime,
        endTime,
        nextAvailable: /* @__PURE__ */ new Date(),
        status: "active"
      });
      res.json(session);
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });
  app2.get("/api/referrals/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const referrals = await storage.getReferralsByReferrer(userId);
      const balance = await storage.getBalance(userId);
      const level1Total = referrals.filter((r) => r.level === 1).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level2Total = referrals.filter((r) => r.level === 2).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level3Total = referrals.filter((r) => r.level === 3).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const directCommissions = level1Total + level2Total + level3Total;
      const actualBalance = parseFloat(balance?.referralBalance || "0");
      const companyCommissions = actualBalance - directCommissions;
      const stats = {
        level1Count: referrals.filter((r) => r.level === 1).length,
        level2Count: referrals.filter((r) => r.level === 2).length,
        level3Count: referrals.filter((r) => r.level === 3).length,
        level1Commission: level1Total.toString(),
        level2Commission: level2Total.toString(),
        level3Commission: level3Total.toString(),
        totalCommission: referrals.reduce((sum, r) => sum + parseFloat(r.totalCommission), 0).toString(),
        actualBalance: actualBalance.toString(),
        companyCommissions: companyCommissions.toString()
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });
  app2.get("/api/referrals/tree", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const referrals = await storage.getReferralsByReferrer(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referral tree:", error);
      res.status(500).json({ message: "Failed to fetch referral tree" });
    }
  });
  app2.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const limit = req.query.limit ? parseInt(req.query.limit) : 20;
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });
  app2.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });
  app2.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.authUser.id;
      const notification = await prisma5.notification.findFirst({
        where: { id, userId },
        select: { id: true }
      });
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });
  app2.post(
    "/api/notifications/mark-all-read",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        await storage.markAllNotificationsAsRead(userId);
        res.json({ message: "All notifications marked as read" });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ message: "Failed to mark all notifications as read" });
      }
    }
  );
  app2.get("/api/push/vapid-public-key", async (_req, res) => {
    try {
      res.json({ publicKey: VAPID_PUBLIC_KEY2 });
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      res.status(500).json({ message: "Failed to get VAPID public key" });
    }
  });
  app2.post(
    "/api/push/subscribe",
    requireAuth,
    pushSubscriptionLimiter,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
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
          expirationTime: expirationTime || null
        });
        res.json(subscription);
      } catch (error) {
        console.error("Error creating push subscription:", error);
        res.status(500).json({ message: "Failed to create push subscription" });
      }
    }
  );
  app2.delete(
    "/api/push/unsubscribe",
    requireAuth,
    pushSubscriptionLimiter,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
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
  app2.get("/api/push/subscriptions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const subscriptions = await storage.getUserPushSubscriptions(userId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error getting push subscriptions:", error);
      res.status(500).json({ message: "Failed to get push subscriptions" });
    }
  });
  app2.post("/api/admin/push/test", requireAdmin, validateCSRF, async (req, res) => {
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
  app2.get("/api/leaderboard/referrals", requireAuth, async (req, res) => {
    try {
      const period = req.query.period || "all-time";
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const currentUserId = req.authUser.id;
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;
      let dateFilter = null;
      const now = /* @__PURE__ */ new Date();
      if (period === "daily") {
        dateFilter = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        ).toISOString();
      } else if (period === "weekly") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = weekAgo.toISOString();
      } else if (period === "monthly") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = monthAgo.toISOString();
      }
      const query = `
        SELECT 
          u.id as "userId",
          u.username,
          u.email,
          COUNT(r.id) as "totalReferrals",
          COALESCE(SUM(r."totalCommission"), 0) as "totalCommission",
          COUNT(CASE WHEN r.level = 1 THEN 1 END) as "level1Count",
          COUNT(CASE WHEN r.level = 2 THEN 1 END) as "level2Count",
          COUNT(CASE WHEN r.level = 3 THEN 1 END) as "level3Count"
        FROM "User" u
        LEFT JOIN "Referral" r ON r."referrerId" = u.id
          ${dateFilter ? `AND r."createdAt" >= $1` : ""}
        GROUP BY u.id, u.username, u.email
        HAVING COUNT(r.id) > 0
        ORDER BY COUNT(r.id) DESC, COALESCE(SUM(r."totalCommission"), 0) DESC
        LIMIT $${dateFilter ? "2" : "1"}
      `;
      const leaderboard = dateFilter ? await storage.raw(query, [dateFilter, limit]) : await storage.raw(query, [limit]);
      const userQuery = `
        SELECT 
          u.id as "userId",
          u.username,
          u.email,
          COUNT(r.id) as "totalReferrals",
          COALESCE(SUM(r."totalCommission"), 0) as "totalCommission",
          COUNT(CASE WHEN r.level = 1 THEN 1 END) as "level1Count",
          COUNT(CASE WHEN r.level = 2 THEN 1 END) as "level2Count",
          COUNT(CASE WHEN r.level = 3 THEN 1 END) as "level3Count"
        FROM "User" u
        LEFT JOIN "Referral" r ON r."referrerId" = u.id
          ${dateFilter ? `AND r."createdAt" >= $1` : ""}
        WHERE u.id = $${dateFilter ? "2" : "1"}
        GROUP BY u.id, u.username, u.email
      `;
      const userStats = dateFilter ? await storage.raw(userQuery, [dateFilter, currentUserId]) : await storage.raw(userQuery, [currentUserId]);
      const userIndexInLeaderboard = leaderboard.findIndex(
        (item) => item.userId === currentUserId
      );
      const formattedLeaderboard = leaderboard.map((item, index) => {
        const baseData = {
          totalReferrals: parseInt(item.totalReferrals),
          totalCommission: item.totalCommission.toString(),
          level1Count: parseInt(item.level1Count),
          level2Count: parseInt(item.level2Count),
          level3Count: parseInt(item.level3Count),
          rank: index + 1
        };
        if (isAdmin) {
          return {
            ...baseData,
            userId: item.userId,
            username: item.username,
            email: item.email,
            displayName: item.username || item.email
          };
        } else {
          return {
            ...baseData,
            displayName: generateAnonymizedHandle(item.userId)
          };
        }
      });
      let userPosition = null;
      if (userStats.length > 0) {
        const raw = userStats[0];
        const baseData = {
          totalReferrals: parseInt(raw.totalReferrals),
          totalCommission: raw.totalCommission.toString(),
          level1Count: parseInt(raw.level1Count),
          level2Count: parseInt(raw.level2Count),
          level3Count: parseInt(raw.level3Count),
          rank: userIndexInLeaderboard === -1 ? null : userIndexInLeaderboard + 1
        };
        if (isAdmin) {
          userPosition = {
            ...baseData,
            userId: raw.userId,
            username: raw.username,
            email: raw.email,
            displayName: raw.username || raw.email
          };
        } else {
          userPosition = {
            ...baseData,
            displayName: userIndexInLeaderboard === -1 ? "You" : "You"
          };
        }
      }
      res.json({
        leaderboard: formattedLeaderboard,
        userPosition
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });
  app2.get("/api/leaderboard/xp", requireAuth, async (req, res) => {
    try {
      const period = req.query.period || "all-time";
      const category = req.query.category || "overall";
      const currentUserId = req.authUser.id;
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.isAdmin || false;
      const result = await storage.getXPLeaderboard(
        currentUserId,
        period,
        category,
        isAdmin
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching XP leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch XP leaderboard" });
    }
  });
  app2.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const transactions = await storage.getTransactionsByUser(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.get("/api/transactions/deposits", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const deposits = await storage.getTransactionsByUser(userId, "deposit");
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });
  app2.get("/api/transactions/withdrawals", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
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
  app2.get("/api/wallet/me", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const wallets = await prisma5.linkedWallet.findMany({
        where: { userId, active: true },
        select: { address: true, linkedAt: true },
        orderBy: { linkedAt: "desc" }
      });
      res.json(wallets.map((w) => w.address));
    } catch (error) {
      console.error("Error fetching linked wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });
  app2.get("/api/wallet/link/challenge", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const address = String(req.query.address || "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(address)) {
        return res.status(400).json({ message: "Invalid address format" });
      }
      const nonce = Math.floor(1e5 + Math.random() * 9e5);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
      const issuedAt = /* @__PURE__ */ new Date();
      await prisma5.walletNonce.upsert({
        where: { userId_address: { userId, address } },
        update: { nonce: String(nonce), expiresAt },
        create: { userId, address, nonce: String(nonce), expiresAt }
      });
      const message = `XNRT Wallet Link

Address: ${address}
Nonce: ${nonce}
Issued: ${issuedAt.toISOString()}`;
      res.json({
        message,
        nonce: String(nonce),
        issuedAt: issuedAt.toISOString()
      });
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).json({ message: "Failed to generate challenge" });
    }
  });
  app2.post(
    "/api/wallet/link/confirm",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        const { address, signature, nonce, issuedAt } = req.body;
        const normalized = String(address || "").toLowerCase();
        if (!address || !signature || !nonce || !issuedAt) {
          return res.status(400).json({ message: "Missing required fields" });
        }
        const rec = await prisma5.walletNonce.findUnique({
          where: {
            userId_address: { userId, address: normalized }
          }
        });
        if (!rec || String(rec.nonce) !== String(nonce) || !rec.expiresAt || rec.expiresAt < /* @__PURE__ */ new Date()) {
          return res.status(400).json({ message: "Invalid or expired challenge" });
        }
        const message = `XNRT Wallet Link

Address: ${normalized}
Nonce: ${nonce}
Issued: ${issuedAt}`;
        let recoveredAddress;
        try {
          recoveredAddress = ethers4.verifyMessage(message, signature).toLowerCase();
        } catch {
          return res.status(400).json({ message: "Invalid signature" });
        }
        if (recoveredAddress !== normalized) {
          return res.status(400).json({ message: "Signature does not match address" });
        }
        const existing = await prisma5.linkedWallet.findFirst({
          where: { address: normalized, active: true }
        });
        if (existing && existing.userId !== userId) {
          return res.status(409).json({ message: "This wallet is already linked to another account" });
        }
        if (existing && existing.userId === userId) {
          return res.json({ address: existing.address, alreadyLinked: true });
        }
        await prisma5.$transaction([
          prisma5.walletNonce.delete({ where: { id: rec.id } }),
          prisma5.linkedWallet.create({
            data: {
              userId,
              address: normalized,
              signature,
              nonce: rec.nonce
            }
          })
        ]);
        res.json({ address: normalized });
      } catch (error) {
        console.error("Error linking wallet:", error);
        res.status(500).json({ message: "Failed to link wallet" });
      }
    }
  );
  app2.get("/api/wallet/deposit-address", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      let user = await prisma5.user.findUnique({
        where: { id: userId },
        select: { depositAddress: true, derivationIndex: true }
      });
      if (!user?.depositAddress || user?.derivationIndex === null) {
        const maxIndexUser = await prisma5.user.findFirst({
          where: { derivationIndex: { not: null } },
          orderBy: { derivationIndex: "desc" },
          select: { derivationIndex: true }
        });
        const nextIndex = (maxIndexUser?.derivationIndex ?? -1) + 1;
        const address = deriveDepositAddress(nextIndex);
        await prisma5.user.update({
          where: { id: userId },
          data: { depositAddress: address, derivationIndex: nextIndex }
        });
        return res.json({
          address,
          network: "BSC (BEP-20)",
          token: "USDT",
          instructions: [
            "Send USDT (BEP-20) from your exchange to this address",
            "Deposits will be automatically detected and credited",
            "No gas fees or wallet connection needed",
            "Minimum 12 block confirmations required"
          ]
        });
      }
      res.json({
        address: user.depositAddress,
        network: "BSC (BEP-20)",
        token: "USDT",
        instructions: [
          "Send USDT (BEP-20) from your exchange to this address",
          "Deposits will be automatically detected and credited",
          "No gas fees or wallet connection needed",
          "Minimum 12 block confirmations required"
        ]
      });
    } catch (error) {
      console.error("Error getting deposit address:", error);
      res.status(500).json({ message: "Failed to get deposit address" });
    }
  });
  app2.post(
    "/api/wallet/report-deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        let { transactionHash, amount, description } = req.body;
        if (!transactionHash || amount === void 0 || amount === null) {
          return res.status(400).json({ message: "Transaction hash and amount required" });
        }
        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return res.status(400).json({ message: "Invalid amount" });
        }
        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res.status(400).json({ message: "Invalid transaction hash format" });
        }
        const existingTx = await prisma5.transaction.findFirst({
          where: { transactionHash }
        });
        if (existingTx) {
          return res.status(409).json({
            message: "This deposit has already been credited",
            alreadyProcessed: true
          });
        }
        const existingReport = await prisma5.depositReport.findFirst({
          where: { txHash: transactionHash }
        });
        if (existingReport) {
          return res.status(409).json({ message: "This deposit has already been reported" });
        }
        const treasuryAddress = process.env.XNRT_WALLET || "";
        const verification = await verifyBscUsdtDeposit({
          txHash: transactionHash,
          expectedTo: treasuryAddress,
          minAmount: amountNum,
          requiredConf: parseInt(process.env.BSC_CONFIRMATIONS ?? "12", 10)
        });
        if (!verification.verified) {
          const report = await prisma5.depositReport.create({
            data: {
              userId,
              txHash: transactionHash,
              amount: new Prisma3.Decimal(amountNum),
              notes: description || `Verification: ${verification.reason}`,
              status: "pending"
            }
          });
          return res.json({
            message: "Report submitted for admin review",
            reportId: report.id,
            reason: verification.reason
          });
        }
        const provider3 = new ethers4.JsonRpcProvider(process.env.RPC_BSC_URL);
        const receipt = await provider3.getTransactionReceipt(transactionHash);
        const transaction = await provider3.getTransaction(transactionHash);
        const fromAddress = transaction?.from?.toLowerCase() || "";
        const linkedWallet = await prisma5.linkedWallet.findFirst({
          where: { userId, address: fromAddress, active: true }
        });
        const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
        const platformFeeBps = parseFloat(process.env.PLATFORM_FEE_BPS || "0");
        const usdtAmount = verification.amountOnChain ?? amountNum;
        const netUsdt = usdtAmount * (1 - platformFeeBps / 1e4);
        const xnrtAmount = netUsdt * xnrtRate;
        if (linkedWallet) {
          await prisma5.$transaction(async (tx) => {
            await tx.transaction.create({
              data: {
                userId,
                type: "deposit",
                amount: new Prisma3.Decimal(xnrtAmount),
                usdtAmount: new Prisma3.Decimal(usdtAmount),
                transactionHash,
                walletAddress: fromAddress,
                status: "approved",
                verified: true,
                confirmations: verification.confirmations,
                verificationData: {
                  autoVerified: true,
                  reportSubmitted: true,
                  verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
                  blockNumber: receipt?.blockNumber
                }
              }
            });
            await tx.balance.upsert({
              where: { userId },
              create: {
                userId,
                xnrtBalance: new Prisma3.Decimal(xnrtAmount),
                totalEarned: new Prisma3.Decimal(xnrtAmount)
              },
              update: {
                xnrtBalance: { increment: new Prisma3.Decimal(xnrtAmount) },
                totalEarned: { increment: new Prisma3.Decimal(xnrtAmount) }
              }
            });
          });
          console.log(
            `[ReportDeposit] Auto-credited ${xnrtAmount} XNRT to user ${userId}`
          );
          const { sendDepositNotification: sendDepositNotification2 } = await Promise.resolve().then(() => (init_depositScanner(), depositScanner_exports));
          void sendDepositNotification2(
            userId,
            xnrtAmount,
            transactionHash
          ).catch((err) => {
            console.error("[ReportDeposit] Notification error:", err);
          });
          await storage.distributeReferralCommissions(userId, xnrtAmount);
          await storage.createActivity({
            userId,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via auto-detection`
          });
          return res.json({
            message: "Deposit verified and credited automatically!",
            credited: true,
            amount: xnrtAmount
          });
        } else {
          await prisma5.unmatchedDeposit.create({
            data: {
              fromAddress,
              toAddress: treasuryAddress,
              amount: new Prisma3.Decimal(usdtAmount),
              transactionHash,
              blockNumber: receipt?.blockNumber ?? 0,
              confirmations: verification.confirmations ?? 0,
              matched: false
            }
          });
          return res.json({
            message: "Deposit verified on blockchain. Admin will credit your account shortly.",
            verified: true,
            pendingAdminReview: true
          });
        }
      } catch (error) {
        console.error("Error reporting deposit:", error);
        if (error.code === "P2002" && error.meta?.target?.includes("transactionHash")) {
          return res.status(409).json({
            message: "This transaction has already been processed",
            alreadyProcessed: true
          });
        }
        res.status(500).json({ message: "Failed to process deposit report" });
      }
    }
  );
  app2.post(
    "/api/transactions/deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        let { usdtAmount, transactionHash, proofImageUrl } = req.body;
        if (!usdtAmount || !transactionHash) {
          return res.status(400).json({ message: "Missing required fields" });
        }
        const usdt2 = Number(usdtAmount);
        if (!Number.isFinite(usdt2) || usdt2 <= 0) {
          return res.status(400).json({ message: "Invalid USDT amount" });
        }
        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res.status(400).json({ message: "Invalid transaction hash format" });
        }
        const existing = await prisma5.transaction.findFirst({
          where: { transactionHash }
        });
        if (existing) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit."
          });
        }
        if (proofImageUrl) {
          const isBase64DataUrl = proofImageUrl.startsWith("data:image/");
          const isValidUrl = /^https?:\/\//.test(proofImageUrl);
          if (!isBase64DataUrl && !isValidUrl) {
            return res.status(400).json({ message: "Invalid proof image URL format" });
          }
        }
        const rate = parseFloat(process.env.XNRT_RATE_USDT ?? "100");
        const feeBps = parseFloat(process.env.PLATFORM_FEE_BPS ?? "0");
        const netUsdt = usdt2 * (1 - feeBps / 1e4);
        const xnrtAmount = netUsdt * rate;
        const transaction = await storage.createTransaction({
          userId,
          type: "deposit",
          amount: xnrtAmount.toString(),
          usdtAmount: usdt2.toString(),
          transactionHash,
          walletAddress: process.env.XNRT_WALLET,
          ...proofImageUrl && { proofImageUrl },
          status: "pending",
          verified: false,
          confirmations: 0
        });
        res.json(transaction);
      } catch (error) {
        if (error.code === "P2002" && error.meta?.target?.includes("transactionHash")) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit."
          });
        }
        console.error("Error creating deposit:", error);
        res.status(500).json({ message: "Failed to create deposit" });
      }
    }
  );
  app2.post(
    "/api/transactions/withdrawal",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        const { source, amount, walletAddress } = req.body;
        if (!source || amount === void 0 || amount === null || !walletAddress) {
          return res.status(400).json({ message: "Missing required fields" });
        }
        const withdrawAmount = Number(amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res.status(400).json({ message: "Withdrawal amount must be a positive number" });
        }
        const fee = withdrawAmount * 2 / 100;
        const netAmount = withdrawAmount - fee;
        const usdtAmount = netAmount / 100;
        const balance = await storage.getBalance(userId);
        if (!balance) {
          return res.status(404).json({ message: "Balance not found" });
        }
        let availableBalance = 0;
        switch (source) {
          case "main":
            availableBalance = parseFloat(balance.xnrtBalance || "0");
            break;
          case "staking":
            availableBalance = parseFloat(balance.stakingBalance || "0");
            break;
          case "mining":
            availableBalance = parseFloat(balance.miningBalance || "0");
            break;
          case "referral":
            availableBalance = parseFloat(balance.referralBalance || "0");
            break;
          default:
            return res.status(400).json({ message: "Invalid source" });
        }
        if (withdrawAmount > availableBalance) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
        if (source === "referral" && withdrawAmount < 5e3) {
          return res.status(400).json({
            message: "Minimum withdrawal from referral balance is 5,000 XNRT"
          });
        }
        if (source === "mining" && withdrawAmount < 5e3) {
          return res.status(400).json({ message: "Minimum withdrawal from mining balance is 5,000 XNRT" });
        }
        const transaction = await storage.createTransaction({
          userId,
          type: "withdrawal",
          amount: withdrawAmount.toString(),
          usdtAmount: usdtAmount.toString(),
          source,
          walletAddress,
          status: "pending",
          fee: fee.toString(),
          netAmount: netAmount.toString()
        });
        res.json(transaction);
      } catch (error) {
        console.error("Error creating withdrawal:", error);
        res.status(500).json({ message: "Failed to create withdrawal" });
      }
    }
  );
  app2.get("/api/tasks/user", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const userTasks = await storage.getUserTasks(userId);
      const allTasks = await storage.getAllTasks();
      const populated = await Promise.all(
        userTasks.map(async (ut) => {
          const task = allTasks.find((t) => t.id === ut.taskId);
          return { ...ut, task };
        })
      );
      res.json(populated);
    } catch (error) {
      console.error("Error fetching user tasks:", error);
      res.status(500).json({ message: "Failed to fetch user tasks" });
    }
  });
  app2.post(
    "/api/tasks/:taskId/complete",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        const { taskId } = req.params;
        const userTasks = await storage.getUserTasks(userId);
        const userTask = userTasks.find((ut) => ut.taskId === taskId);
        if (!userTask) return res.status(404).json({ message: "Task not found" });
        if (userTask.completed) {
          return res.status(400).json({ message: "Task already completed" });
        }
        const allTasks = await storage.getAllTasks();
        const task = allTasks.find((t) => t.id === taskId);
        if (!task) return res.status(404).json({ message: "Task not found" });
        await storage.updateUserTask(userTask.id, {
          completed: true,
          completedAt: /* @__PURE__ */ new Date(),
          progress: userTask.maxProgress
        });
        const user = await storage.getUser(userId);
        const balance = await storage.getBalance(userId);
        if (user) {
          await storage.updateUser(userId, {
            xp: (user.xp || 0) + task.xpReward
          });
        }
        if (balance && parseFloat(task.xnrtReward) > 0) {
          const xnrtAmount = parseFloat(task.xnrtReward);
          await storage.updateBalance(userId, {
            xnrtBalance: (parseFloat(balance.xnrtBalance) + xnrtAmount).toString(),
            totalEarned: (parseFloat(balance.totalEarned) + xnrtAmount).toString()
          });
        }
        await storage.createActivity({
          userId,
          type: "task_completed",
          description: `Completed task: ${task.title}`
        });
        await storage.checkAndUnlockAchievements(userId);
        res.json({
          xpReward: task.xpReward,
          xnrtReward: task.xnrtReward
        });
      } catch (error) {
        console.error("Error completing task:", error);
        res.status(500).json({ message: "Failed to complete task" });
      }
    }
  );
  app2.get("/api/achievements", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const allAchievements = await storage.getAllAchievements();
      const userAchievements = await storage.getUserAchievements(userId);
      const populated = allAchievements.map((achievement) => {
        const ua = userAchievements.find(
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
          claimable: unlocked && !claimed
        };
      });
      res.json(populated);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });
  app2.post(
    "/api/achievements/:id/claim",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        const achievementId = req.params.id;
        const achievement = await prisma5.achievement.findUnique({
          where: { id: achievementId }
        });
        if (!achievement) {
          return res.status(404).json({ message: "Achievement not found" });
        }
        const userAchievement = await prisma5.userAchievement.findFirst({
          where: { userId, achievementId }
        });
        if (!userAchievement) {
          return res.status(400).json({ message: "Achievement not unlocked yet" });
        }
        if (userAchievement.claimed) {
          return res.status(400).json({ message: "Achievement already claimed" });
        }
        const updated = await prisma5.userAchievement.update({
          where: { id: userAchievement.id },
          data: {
            claimed: true,
            claimedAt: /* @__PURE__ */ new Date()
          }
        });
        await storage.createActivity({
          userId,
          type: "achievement_claimed",
          description: `Claimed achievement: ${achievement.title}`
        });
        res.json({
          achievementId,
          claimed: updated.claimed,
          claimedAt: updated.claimedAt
        });
      } catch (error) {
        console.error("Error claiming achievement:", error);
        res.status(500).json({ message: "Failed to claim achievement" });
      }
    }
  );
  app2.get(
    "/api/admin/achievements",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const [achievements, unlockGroups] = await Promise.all([
          prisma5.achievement.findMany({
            orderBy: { createdAt: "asc" }
          }),
          prisma5.userAchievement.groupBy({
            by: ["achievementId"],
            _count: { achievementId: true }
          })
        ]);
        const unlockMap = /* @__PURE__ */ new Map();
        unlockGroups.forEach((row) => {
          const count = row?._count?.achievementId ?? row?._count?._all ?? row?._count ?? 0;
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
          unlockCount: unlockMap.get(a.id) ?? 0
        }));
        res.json(result);
      } catch (error) {
        console.error("Error fetching admin achievements:", error);
        res.status(500).json({ message: "Failed to fetch achievements" });
      }
    }
  );
  app2.post(
    "/api/admin/achievements",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        let payload;
        try {
          payload = parseAchievementPayload(req.body);
        } catch (e) {
          return res.status(400).json({ message: e?.message ?? "Invalid achievement payload" });
        }
        const achievement = await prisma5.achievement.create({
          data: payload
        });
        res.status(201).json({
          ...achievement,
          unlockCount: 0
        });
      } catch (error) {
        console.error("Error creating achievement:", error);
        if (error.code === "P2002") {
          return res.status(409).json({
            message: "An achievement with this title already exists"
          });
        }
        res.status(500).json({ message: "Failed to create achievement" });
      }
    }
  );
  app2.put(
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
        } catch (e) {
          return res.status(400).json({ message: e?.message ?? "Invalid achievement payload" });
        }
        const achievement = await prisma5.achievement.update({
          where: { id },
          data: payload
        });
        const unlockCount = await prisma5.userAchievement.count({
          where: { achievementId: id }
        });
        res.json({
          ...achievement,
          unlockCount
        });
      } catch (error) {
        console.error("Error updating achievement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Achievement not found" });
        }
        if (error.code === "P2002") {
          return res.status(409).json({
            message: "An achievement with this title already exists"
          });
        }
        res.status(500).json({ message: "Failed to update achievement" });
      }
    }
  );
  app2.delete(
    "/api/admin/achievements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma5.achievement.delete({ where: { id } });
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting achievement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Achievement not found" });
        }
        res.status(500).json({ message: "Failed to delete achievement" });
      }
    }
  );
  app2.get("/api/profile/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const stakes = await storage.getStakes(userId);
      const miningSessions = await storage.getMiningHistory(userId);
      const referrals = await storage.getReferralsByReferrer(userId);
      const userTasks = await storage.getUserTasks(userId);
      const userAchievements = await storage.getUserAchievements(userId);
      res.json({
        totalReferrals: referrals.length,
        activeStakes: stakes.filter((s) => s.status === "active").length,
        totalStaked: stakes.reduce(
          (sum, s) => sum + parseFloat(s.amount),
          0
        ),
        miningSessions: miningSessions.filter(
          (s) => s.status === "completed"
        ).length,
        totalMined: miningSessions.reduce(
          (sum, s) => sum + s.finalReward,
          0
        ),
        referralEarnings: referrals.reduce(
          (sum, r) => sum + parseFloat(r.totalCommission),
          0
        ),
        tasksCompleted: userTasks.filter((t) => t.completed).length,
        achievementsUnlocked: userAchievements.length
      });
    } catch (error) {
      console.error("Error fetching profile stats:", error);
      res.status(500).json({ message: "Failed to fetch profile stats" });
    }
  });
  app2.post("/api/checkin", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const now = /* @__PURE__ */ new Date();
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
      const lastCheckInDay = lastCheckIn ? new Date(
        lastCheckIn.getFullYear(),
        lastCheckIn.getMonth(),
        lastCheckIn.getDate()
      ) : null;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let newStreak = 1;
      if (lastCheckInDay && lastCheckInDay.getTime() === yesterday.getTime()) {
        newStreak = (user.streak || 0) + 1;
      }
      const streakReward = Math.min(newStreak * 10, 100);
      const xpReward = Math.min(newStreak * 5, 50);
      if (lastCheckIn && lastCheckInDay && lastCheckInDay.getTime() === today.getTime()) {
        return res.status(400).json({ message: "Already checked in today" });
      }
      await storage.updateUser(userId, {
        lastCheckIn: now,
        streak: newStreak,
        xp: (user.xp || 0) + xpReward
      });
      const balance = await storage.getBalance(userId);
      if (balance) {
        await storage.updateBalance(userId, {
          xnrtBalance: (parseFloat(balance.xnrtBalance) + streakReward).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + streakReward).toString()
        });
      }
      await storage.createActivity({
        userId,
        type: "daily_checkin",
        description: `Day ${newStreak} streak! Earned ${streakReward} XNRT and ${xpReward} XP`
      });
      await storage.checkAndUnlockAchievements(userId);
      res.json({
        streak: newStreak,
        xnrtReward: streakReward,
        xpReward,
        message: `Day ${newStreak} check-in complete!`
      });
    } catch (error) {
      console.error("Error during check-in:", error);
      res.status(500).json({ message: "Failed to check in" });
    }
  });
  app2.get("/api/checkin/history", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const { year, month } = req.query;
      const now = /* @__PURE__ */ new Date();
      const targetYear = year ? parseInt(year, 10) : now.getFullYear();
      let targetMonth;
      if (typeof month !== "undefined") {
        const monthNum = parseInt(month, 10);
        const clamped = Math.min(Math.max(monthNum, 1), 12);
        targetMonth = clamped - 1;
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
      const checkinActivities = await prisma5.activity.findMany({
        where: {
          userId,
          type: "daily_checkin",
          createdAt: { gte: startDate, lte: endDate }
        },
        orderBy: { createdAt: "asc" }
      });
      const checkinDates = checkinActivities.map(
        (activity) => new Date(activity.createdAt).toISOString().split("T")[0]
      );
      res.json({ dates: checkinDates, year: targetYear, month: targetMonth });
    } catch (error) {
      console.error("Error fetching check-in history:", error);
      res.status(500).json({ message: "Failed to fetch check-in history" });
    }
  });
  app2.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res) => {
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
      const totalDeposits = allDeposits.filter((d) => d.status === "approved").reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const totalWithdrawals = allWithdrawals.filter((w) => w.status === "approved").reduce((sum, w) => sum + parseFloat(w.amount), 0);
      const today = /* @__PURE__ */ new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayDeposits = allDeposits.filter(
        (d) => d.status === "approved" && d.createdAt && new Date(d.createdAt) >= today
      ).reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const todayWithdrawals = allWithdrawals.filter(
        (w) => w.status === "approved" && w.createdAt && new Date(w.createdAt) >= today
      ).reduce((sum, w) => sum + parseFloat(w.amount), 0);
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
        activeStakesCount
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });
  app2.get(
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
  app2.get(
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
        res.status(500).json({ message: "Failed to fetch pending withdrawals" });
      }
    }
  );
  app2.post(
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
          expectedTo: deposit.walletAddress || process.env.XNRT_WALLET,
          minAmount: deposit.usdtAmount ? parseFloat(deposit.usdtAmount) : void 0,
          requiredConf: parseInt(
            process.env.BSC_CONFIRMATIONS ?? "12",
            10
          )
        });
        await prisma5.transaction.update({
          where: { id },
          data: {
            verified: !!result.verified,
            confirmations: result.confirmations ?? 0,
            verificationData: {
              verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
              reason: result.reason || null,
              amountOnChain: result.amountOnChain ?? null
            }
          }
        });
        res.json(result);
      } catch (error) {
        console.error("Error verifying deposit:", error);
        res.status(500).json({ message: "Failed to verify deposit" });
      }
    }
  );
  app2.post(
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
        if (deposit.status === "approved" || deposit.status === "rejected") {
          return res.status(400).json({ message: "Deposit already processed" });
        }
        const override = !deposit.verified || !!force;
        await prisma5.$transaction(async (tx) => {
          await tx.balance.upsert({
            where: { userId: deposit.userId },
            create: {
              userId: deposit.userId,
              xnrtBalance: new Prisma3.Decimal(deposit.amount),
              totalEarned: new Prisma3.Decimal(deposit.amount)
            },
            update: {
              xnrtBalance: { increment: new Prisma3.Decimal(deposit.amount) },
              totalEarned: { increment: new Prisma3.Decimal(deposit.amount) }
            }
          });
          await tx.transaction.update({
            where: { id },
            data: {
              status: "approved",
              adminNotes: notes ?? deposit.adminNotes,
              approvedBy: req.authUser.id,
              approvedAt: /* @__PURE__ */ new Date(),
              verificationData: deposit.verificationData
            }
          });
          if (override) {
            await tx.activity.create({
              data: {
                userId: req.authUser.id,
                type: "ADMIN_DEPOSIT_OVERRIDE",
                description: `Force-approved deposit ${id} for user ${deposit.userId} (scanner: ${deposit.verified ? "verified" : "failed/unverified"})`
              }
            });
          }
        });
        await storage.distributeReferralCommissions(
          deposit.userId,
          parseFloat(deposit.amount)
        );
        await storage.createActivity({
          userId: deposit.userId,
          type: "deposit_approved",
          description: `Deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT approved`
        });
        void notifyUser(deposit.userId, {
          type: "deposit_approved",
          title: "\u{1F4B0} Deposit Approved!",
          message: `Your deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT has been approved and credited to your account`,
          url: "/wallet",
          metadata: { amount: deposit.amount, transactionId: id }
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
  app2.post(
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
        if (deposit.status === "approved" || deposit.status === "rejected") {
          return res.status(400).json({ message: "Deposit already processed" });
        }
        await storage.updateTransaction(id, {
          status: "rejected",
          adminNotes: notes ?? deposit.adminNotes
        });
        await storage.createActivity({
          userId: deposit.userId,
          type: "deposit_rejected",
          description: `Deposit of ${parseFloat(
            deposit.amount
          ).toLocaleString()} XNRT rejected${notes ? ` - ${notes}` : ""}`
        });
        res.json({ message: "Deposit rejected" });
      } catch (error) {
        console.error("Error rejecting deposit:", error);
        res.status(500).json({ message: "Failed to reject deposit" });
      }
    }
  );
  app2.post(
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
        const successful = [];
        const failed = [];
        const errors = [];
        for (const id of depositIds) {
          try {
            const deposit = await storage.getTransactionById(id);
            if (!deposit || deposit.type !== "deposit") {
              throw new Error(`Deposit ${id} not found`);
            }
            if (deposit.status === "approved" || deposit.status === "rejected") {
              throw new Error(`Deposit ${id} already processed`);
            }
            const override = !deposit.verified;
            await prisma5.$transaction(async (tx) => {
              await tx.balance.upsert({
                where: { userId: deposit.userId },
                create: {
                  userId: deposit.userId,
                  xnrtBalance: new Prisma3.Decimal(deposit.amount),
                  totalEarned: new Prisma3.Decimal(deposit.amount)
                },
                update: {
                  xnrtBalance: {
                    increment: new Prisma3.Decimal(deposit.amount)
                  },
                  totalEarned: {
                    increment: new Prisma3.Decimal(deposit.amount)
                  }
                }
              });
              await tx.transaction.update({
                where: { id },
                data: {
                  status: "approved",
                  adminNotes: notes ?? deposit.adminNotes,
                  approvedBy: req.authUser.id,
                  approvedAt: /* @__PURE__ */ new Date()
                }
              });
              if (override) {
                await tx.activity.create({
                  data: {
                    userId: req.authUser.id,
                    type: "ADMIN_DEPOSIT_OVERRIDE",
                    description: `Force-approved deposit ${id} for user ${deposit.userId} via bulk`
                  }
                });
              }
            });
            await storage.distributeReferralCommissions(
              deposit.userId,
              parseFloat(deposit.amount)
            );
            await storage.createActivity({
              userId: deposit.userId,
              type: "deposit_approved",
              description: `Deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT approved${notes ? ` - ${notes}` : ""}`
            });
            void notifyUser(deposit.userId, {
              type: "deposit_approved",
              title: "\u{1F4B0} Deposit Approved!",
              message: `Your deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT has been approved and credited to your account`,
              url: "/wallet",
              metadata: { amount: deposit.amount, transactionId: id }
            }).catch((err) => {
              console.error(
                "Error sending bulk deposit notification (non-blocking):",
                err
              );
            });
            successful.push(id);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
          errors
        });
      } catch (error) {
        console.error("Error bulk approving deposits:", error);
        res.status(500).json({ message: "Failed to process bulk approval" });
      }
    }
  );
  app2.post(
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
        const successful = [];
        const failed = [];
        const errors = [];
        for (const id of depositIds) {
          try {
            const deposit = await storage.getTransactionById(id);
            if (!deposit || deposit.type !== "deposit") {
              throw new Error(`Deposit ${id} not found`);
            }
            if (deposit.status === "approved" || deposit.status === "rejected") {
              throw new Error(`Deposit ${id} already processed`);
            }
            await storage.updateTransaction(id, {
              status: "rejected",
              adminNotes: notes || deposit.adminNotes,
              approvedBy: req.authUser.id,
              approvedAt: /* @__PURE__ */ new Date()
            });
            await storage.createActivity({
              userId: deposit.userId,
              type: "deposit_rejected",
              description: `Deposit of ${parseFloat(
                deposit.amount
              ).toLocaleString()} XNRT rejected${notes ? ` - ${notes}` : ""}`
            });
            successful.push(id);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
          errors
        });
      } catch (error) {
        console.error("Error bulk rejecting deposits:", error);
        res.status(500).json({ message: "Failed to process bulk rejection" });
      }
    }
  );
  app2.get(
    "/api/admin/unmatched-deposits",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const unmatched = await prisma5.unmatchedDeposit.findMany({
          where: { matched: false },
          orderBy: { createdAt: "desc" },
          take: 100
        });
        res.json(unmatched);
      } catch (error) {
        console.error("Error fetching unmatched deposits:", error);
        res.status(500).json({ message: "Failed to fetch unmatched deposits" });
      }
    }
  );
  app2.post(
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
        const unmatchedDeposit = await prisma5.unmatchedDeposit.findUnique({
          where: { id }
        });
        if (!unmatchedDeposit) {
          return res.status(404).json({ message: "Unmatched deposit not found" });
        }
        if (unmatchedDeposit.resolved) {
          return res.status(400).json({ message: "Deposit already matched" });
        }
        const usdtAmount = parseFloat(unmatchedDeposit.amount.toString());
        const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
        const platformFeeBps = parseFloat(process.env.PLATFORM_FEE_BPS || "0");
        const netUsdt = usdtAmount * (1 - platformFeeBps / 1e4);
        const xnrtAmount = netUsdt * xnrtRate;
        const txHash = unmatchedDeposit.txHash ?? unmatchedDeposit.transactionHash;
        await prisma5.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              userId,
              type: "deposit",
              amount: new Prisma3.Decimal(xnrtAmount),
              usdtAmount: new Prisma3.Decimal(usdtAmount),
              transactionHash: txHash,
              walletAddress: unmatchedDeposit.fromAddress,
              status: "approved",
              verified: true,
              confirmations: unmatchedDeposit.confirmations ?? 0,
              verificationData: {
                manualMatch: true,
                matchedBy: req.authUser.id,
                matchedAt: (/* @__PURE__ */ new Date()).toISOString()
              },
              approvedBy: req.authUser.id,
              approvedAt: /* @__PURE__ */ new Date()
            }
          });
          await tx.balance.upsert({
            where: { userId },
            create: {
              userId,
              xnrtBalance: new Prisma3.Decimal(xnrtAmount),
              totalEarned: new Prisma3.Decimal(xnrtAmount)
            },
            update: {
              xnrtBalance: { increment: new Prisma3.Decimal(xnrtAmount) },
              totalEarned: { increment: new Prisma3.Decimal(xnrtAmount) }
            }
          });
          await tx.unmatchedDeposit.update({
            where: { id },
            data: { resolved: true }
          });
        });
        await storage.distributeReferralCommissions(userId, xnrtAmount);
        await storage.createActivity({
          userId,
          type: "deposit_approved",
          description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via manual match`
        });
        res.json({
          message: "Deposit matched and credited successfully"
        });
      } catch (error) {
        console.error("Error matching deposit:", error);
        res.status(500).json({ message: "Failed to match deposit" });
      }
    }
  );
  app2.get(
    "/api/admin/deposit-reports",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const reports = await prisma5.depositReport.findMany({
          where: { status: "pending" },
          include: { user: { select: { email: true, username: true } } },
          orderBy: { createdAt: "desc" },
          take: 100
        });
        res.json(reports);
      } catch (error) {
        console.error("Error fetching deposit reports:", error);
        res.status(500).json({ message: "Failed to fetch deposit reports" });
      }
    }
  );
  app2.post(
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
        const report = await prisma5.depositReport.findUnique({
          where: { id }
        });
        if (!report) {
          return res.status(404).json({ message: "Report not found" });
        }
        if (report.status !== "pending") {
          return res.status(400).json({ message: "Report already resolved" });
        }
        if (resolution === "approved") {
          const xnrtRate = parseFloat(process.env.XNRT_RATE_USDT || "100");
          const platformFeeBps = parseFloat(
            process.env.PLATFORM_FEE_BPS || "0"
          );
          const usdtAmount = report.amount ? parseFloat(report.amount.toString()) : 0;
          const netUsdt = usdtAmount * (1 - platformFeeBps / 1e4);
          const xnrtAmount = netUsdt * xnrtRate;
          await prisma5.$transaction(async (tx) => {
            await tx.transaction.create({
              data: {
                userId: report.userId,
                type: "deposit",
                amount: new Prisma3.Decimal(xnrtAmount),
                usdtAmount: new Prisma3.Decimal(usdtAmount),
                transactionHash: report.txHash,
                status: "approved",
                adminNotes: adminNotes || "Credited from deposit report",
                approvedBy: req.authUser.id,
                approvedAt: /* @__PURE__ */ new Date()
              }
            });
            await tx.balance.upsert({
              where: { userId: report.userId },
              create: {
                userId: report.userId,
                xnrtBalance: new Prisma3.Decimal(xnrtAmount),
                totalEarned: new Prisma3.Decimal(xnrtAmount)
              },
              update: {
                xnrtBalance: {
                  increment: new Prisma3.Decimal(xnrtAmount)
                },
                totalEarned: {
                  increment: new Prisma3.Decimal(xnrtAmount)
                }
              }
            });
            await tx.depositReport.update({
              where: { id },
              data: {
                status: "approved",
                resolvedAt: /* @__PURE__ */ new Date(),
                notes: adminNotes || null
              }
            });
          });
          await storage.distributeReferralCommissions(
            report.userId,
            xnrtAmount
          );
          await storage.createActivity({
            userId: report.userId,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved from deposit report`
          });
        } else {
          await prisma5.depositReport.update({
            where: { id },
            data: {
              status: "rejected",
              resolvedAt: /* @__PURE__ */ new Date(),
              notes: adminNotes || null
            }
          });
        }
        res.json({ message: `Report ${resolution} successfully` });
      } catch (error) {
        console.error("Error resolving deposit report:", error);
        res.status(500).json({ message: "Failed to resolve report" });
      }
    }
  );
  app2.post(
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
        await storage.raw(`DELETE FROM "Referral"`);
        console.log("[RECONCILE] Cleared existing referral records");
        await storage.raw(`UPDATE "Balance" SET "referralBalance" = 0`);
        console.log("[RECONCILE] Reset all referral balances");
        let totalProcessed = 0;
        for (const deposit of approvedDeposits) {
          const amount = parseFloat(deposit.amount);
          console.log(
            `[RECONCILE] Processing deposit ${deposit.id}: ${amount} XNRT for user ${deposit.userId}`
          );
          await storage.distributeReferralCommissions(
            deposit.userId,
            amount
          );
          totalProcessed++;
        }
        console.log(
          `[RECONCILE] Reconciliation complete. Processed ${totalProcessed} deposits.`
        );
        res.json({
          message: "Referral commissions reconciled successfully",
          depositsProcessed: totalProcessed
        });
      } catch (error) {
        console.error("Error reconciling referrals:", error);
        res.status(500).json({ message: "Failed to reconcile referrals" });
      }
    }
  );
  app2.post(
    "/api/admin/withdrawals/:id/approve",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const withdrawal = await storage.getTransactionById(id);
        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }
        if (withdrawal.status !== "pending") {
          return res.status(400).json({ message: "Withdrawal already processed" });
        }
        const withdrawAmount = Number(withdrawal.amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res.status(400).json({ message: "Invalid withdrawal amount" });
        }
        const balance = await storage.getBalance(withdrawal.userId);
        if (!balance) {
          return res.status(400).json({
            message: "User balance not found; cannot approve withdrawal"
          });
        }
        let sourceBalanceKey;
        switch (withdrawal.source) {
          case "main":
            sourceBalanceKey = "xnrtBalance";
            break;
          case "staking":
            sourceBalanceKey = "stakingBalance";
            break;
          case "mining":
            sourceBalanceKey = "miningBalance";
            break;
          case "referral":
            sourceBalanceKey = "referralBalance";
            break;
          default:
            sourceBalanceKey = "xnrtBalance";
        }
        const currentBalance = parseFloat(balance[sourceBalanceKey] || "0");
        if (withdrawAmount > currentBalance) {
          return res.status(400).json({
            message: "Insufficient balance to approve withdrawal"
          });
        }
        await storage.updateBalance(withdrawal.userId, {
          [sourceBalanceKey]: (currentBalance - withdrawAmount).toString()
        });
        await storage.updateTransaction(id, { status: "approved" });
        await storage.createActivity({
          userId: withdrawal.userId,
          type: "withdrawal_approved",
          description: `Withdrawal of ${withdrawAmount.toLocaleString()} XNRT approved`
        });
        res.json({ message: "Withdrawal approved successfully" });
      } catch (error) {
        console.error("Error approving withdrawal:", error);
        res.status(500).json({ message: "Failed to approve withdrawal" });
      }
    }
  );
  app2.post(
    "/api/admin/withdrawals/:id/reject",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        const withdrawal = await storage.getTransactionById(id);
        if (!withdrawal || withdrawal.type !== "withdrawal") {
          return res.status(404).json({ message: "Withdrawal not found" });
        }
        if (withdrawal.status !== "pending") {
          return res.status(400).json({ message: "Withdrawal already processed" });
        }
        await storage.updateTransaction(id, { status: "rejected" });
        await storage.createActivity({
          userId: withdrawal.userId,
          type: "withdrawal_rejected",
          description: `Withdrawal of ${parseFloat(
            withdrawal.amount
          ).toLocaleString()} XNRT rejected`
        });
        res.json({ message: "Withdrawal rejected" });
      } catch (error) {
        console.error("Error rejecting withdrawal:", error);
        res.status(500).json({ message: "Failed to reject withdrawal" });
      }
    }
  );
  app2.get(
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
            const totalStaked = stakes.filter((s) => s.status === "active").reduce((sum, s) => sum + parseFloat(s.amount), 0);
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
              balance: balance ? {
                xnrtBalance: balance.xnrtBalance,
                stakingBalance: balance.stakingBalance,
                miningBalance: balance.miningBalance,
                referralBalance: balance.referralBalance,
                totalEarned: balance.totalEarned
              } : null,
              stats: {
                activeStakes,
                totalStaked: totalStaked.toString(),
                referralsCount: referrals.length,
                depositCount,
                withdrawalCount
              }
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
  app2.get(
    "/api/admin/analytics",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const allTransactions = await storage.getAllTransactions();
        const allUsers = await storage.getAllUsers();
        const allStakes = await storage.getAllActiveStakes();
        const dailyData = {};
        const thirtyDaysAgo = /* @__PURE__ */ new Date();
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
                  revenue: 0
                };
              }
              if (tx.type === "deposit" && tx.status === "approved") {
                dailyData[dateKey].deposits += parseFloat(tx.amount);
              } else if (tx.type === "withdrawal" && tx.status === "approved") {
                dailyData[dateKey].withdrawals += parseFloat(tx.amount);
                dailyData[dateKey].revenue += parseFloat(tx.amount) * 0.02;
              }
            }
          }
        });
        const dailyUsers = {};
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
          "Mythic Diamond": 0
        };
        allStakes.forEach((stake) => {
          const amount = parseFloat(stake.amount);
          if (amount >= 1e5) stakingTiers["Mythic Diamond"]++;
          else if (amount >= 5e4) stakingTiers["Imperial Platinum"]++;
          else if (amount >= 1e4) stakingTiers["Legendary Emerald"]++;
          else stakingTiers["Royal Sapphire"]++;
        });
        const [balancesAgg, referralsAgg] = await Promise.all([
          prisma5.balance.aggregate({
            _sum: { referralBalance: true }
          }),
          prisma5.referral.groupBy({
            by: ["referrerId"],
            _count: { referrerId: true }
          })
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
          activeReferrers
        };
        const totalRevenue = Object.values(dailyData).reduce(
          (sum, day) => sum + day.revenue,
          0
        );
        res.json({
          dailyTransactions: Object.entries(dailyData).map(([date, data]) => ({
            date,
            deposits: data.deposits,
            withdrawals: data.withdrawals,
            revenue: data.revenue
          })).sort((a, b) => a.date.localeCompare(b.date)),
          userGrowth: Object.entries(dailyUsers).map(([date, count]) => ({ date, newUsers: count })).sort((a, b) => a.date.localeCompare(b.date)),
          stakingTiers,
          referralStats,
          totalRevenue,
          totalUsers: allUsers.length,
          totalStakes: allStakes.length
        });
      } catch (error) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );
  app2.get(
    "/api/admin/analytics/realtime",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1e3);
        const startOfToday = /* @__PURE__ */ new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const activeUsers = await prisma5.activity.groupBy({
          by: ["userId"],
          where: { createdAt: { gte: fifteenMinutesAgo } }
        });
        const todayDeposits = await prisma5.transaction.aggregate({
          where: {
            type: "deposit",
            status: "approved",
            createdAt: { gte: startOfToday }
          },
          _count: true,
          _sum: { amount: true }
        });
        const todayWithdrawals = await prisma5.transaction.aggregate({
          where: {
            type: "withdrawal",
            status: "approved",
            createdAt: { gte: startOfToday }
          },
          _count: true,
          _sum: { amount: true }
        });
        const [pendingDeposits, pendingWithdrawals] = await Promise.all([
          prisma5.transaction.count({
            where: { type: "deposit", status: "pending" }
          }),
          prisma5.transaction.count({
            where: { type: "withdrawal", status: "pending" }
          })
        ]);
        res.json({
          activeUsers: activeUsers.length,
          todayDeposits: {
            count: todayDeposits._count,
            total: Number(todayDeposits._sum.amount || 0)
          },
          todayWithdrawals: {
            count: todayWithdrawals._count,
            total: Number(todayWithdrawals._sum.amount || 0)
          },
          pendingTransactions: {
            deposits: pendingDeposits,
            withdrawals: pendingWithdrawals,
            total: pendingDeposits + pendingWithdrawals
          }
        });
      } catch (error) {
        console.error("Error fetching real-time analytics:", error);
        res.status(500).json({ message: "Failed to fetch real-time analytics" });
      }
    }
  );
  app2.get(
    "/api/admin/analytics/export",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const format = req.query.format || "csv";
        const allTransactions = await storage.getAllTransactions();
        const allUsers = await storage.getAllUsers();
        const allStakes = await storage.getAllActiveStakes();
        const dailyData = {};
        const thirtyDaysAgo = /* @__PURE__ */ new Date();
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
                  revenue: 0
                };
              }
              if (tx.type === "deposit" && tx.status === "approved") {
                dailyData[dateKey].deposits += parseFloat(tx.amount);
              } else if (tx.type === "withdrawal" && tx.status === "approved") {
                dailyData[dateKey].withdrawals += parseFloat(tx.amount);
                dailyData[dateKey].revenue += parseFloat(tx.amount) * 0.02;
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
          Object.entries(dailyData).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, data]) => {
            csv += `${date},${data.deposits},${data.withdrawals},${data.revenue}
`;
          });
          csv += `
Summary
`;
          csv += `Total Users,${allUsers.length}
`;
          csv += `Total Active Stakes,${allStakes.length}
`;
          csv += `Total Revenue (30 days),${totalRevenue}
`;
          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=xnrt-analytics-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`
          );
          res.send(csv);
        } else {
          const jsonData = {
            exportDate: (/* @__PURE__ */ new Date()).toISOString(),
            summary: {
              totalUsers: allUsers.length,
              totalActiveStakes: allStakes.length,
              totalRevenue30Days: totalRevenue
            },
            dailyTransactions: Object.entries(dailyData).map(([date, data]) => ({
              date,
              deposits: data.deposits,
              withdrawals: data.withdrawals,
              revenue: data.revenue
            })).sort((a, b) => a.date.localeCompare(b.date))
          };
          res.setHeader("Content-Type", "application/json");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=xnrt-analytics-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`
          );
          res.json(jsonData);
        }
      } catch (error) {
        console.error("Error exporting analytics:", error);
        res.status(500).json({ message: "Failed to export analytics" });
      }
    }
  );
  app2.get(
    "/api/admin/activities",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const adminUsers = await prisma5.user.findMany({
          where: { isAdmin: true },
          select: { id: true }
        });
        const adminUserIds = adminUsers.map((u) => u.id);
        const activities = await prisma5.activity.findMany({
          where: {
            OR: [
              { userId: { in: adminUserIds } },
              {
                type: {
                  in: [
                    "deposit_approved",
                    "deposit_rejected",
                    "withdrawal_approved",
                    "withdrawal_rejected"
                  ]
                }
              }
            ]
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                isAdmin: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: limit
        });
        res.json(activities);
      } catch (error) {
        console.error("Error fetching admin activities:", error);
        res.status(500).json({ message: "Failed to fetch admin activities" });
      }
    }
  );
  app2.get(
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
          totalActivities
        ] = await Promise.all([
          prisma5.user.count(),
          prisma5.transaction.count({ where: { type: "deposit" } }),
          prisma5.transaction.count({ where: { type: "withdrawal" } }),
          prisma5.stake.count(),
          prisma5.activity.count()
        ]);
        const stakingTiers = [
          {
            name: "Royal Sapphire",
            min: 5e4,
            max: 1e6,
            apy: 402,
            duration: 15
          },
          {
            name: "Legendary Emerald",
            min: 1e4,
            max: 1e7,
            apy: 511,
            duration: 30
          },
          {
            name: "Imperial Platinum",
            min: 5e3,
            max: 1e7,
            apy: 547,
            duration: 47
          },
          {
            name: "Mythic Diamond",
            min: 100,
            max: 1e7,
            apy: 730,
            duration: 90
          }
        ];
        res.json({
          platform: {
            name: "XNRT",
            version: "1.0.0",
            environment: process.env.NODE_ENV || "development"
          },
          statistics: {
            totalUsers,
            totalDeposits,
            totalWithdrawals,
            totalStakes,
            totalActivities
          },
          configuration: {
            stakingTiers,
            depositRate: 100,
            withdrawalFee: 2,
            // 🔐 now reading from env, with your old address as fallback
            companyWallet: process.env.XNRT_WALLET ?? "0x715C32deC9534d2fB34e0B567288AF8d895efB59"
          }
        });
      } catch (error) {
        console.error("Error fetching platform info:", error);
        res.status(500).json({ message: "Failed to fetch platform info" });
      }
    }
  );
  app2.get("/api/announcements", async (_req, res) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const announcements = await prisma5.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }]
        },
        orderBy: { createdAt: "desc" },
        take: 5
      });
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });
  app2.get(
    "/api/admin/announcements",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const announcements = await prisma5.announcement.findMany({
          include: {
            creator: { select: { id: true, username: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        });
        res.json(announcements);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        res.status(500).json({ message: "Failed to fetch announcements" });
      }
    }
  );
  app2.post(
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
            errors: validationResult.error.issues
          });
        }
        const { title, content, type, isActive, expiresAt } = validationResult.data;
        const announcement = await prisma5.announcement.create({
          data: {
            title,
            content,
            type: type || "info",
            isActive: isActive !== void 0 ? isActive : true,
            createdBy: req.authUser.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null
          },
          include: {
            creator: { select: { id: true, username: true, email: true } }
          }
        });
        res.status(201).json(announcement);
      } catch (error) {
        console.error("Error creating announcement:", error);
        res.status(500).json({ message: "Failed to create announcement" });
      }
    }
  );
  app2.put(
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
            errors: validationResult.error.issues
          });
        }
        const { title, content, type, isActive, expiresAt } = validationResult.data;
        const announcement = await prisma5.announcement.update({
          where: { id },
          data: {
            ...title !== void 0 && { title },
            ...content !== void 0 && { content },
            ...type !== void 0 && { type },
            ...isActive !== void 0 && { isActive },
            ...expiresAt !== void 0 && {
              expiresAt: expiresAt ? new Date(expiresAt) : null
            }
          },
          include: {
            creator: { select: { id: true, username: true, email: true } }
          }
        });
        res.json(announcement);
      } catch (error) {
        console.error("Error updating announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res.status(500).json({ message: "Failed to update announcement" });
      }
    }
  );
  app2.delete(
    "/api/admin/announcements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma5.announcement.delete({ where: { id } });
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res.status(500).json({ message: "Failed to delete announcement" });
      }
    }
  );
  app2.post(
    "/api/trust-loan/claim",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser.id;
        const existing = await storage.getStakes(userId);
        const already = existing.find(
          (s) => s.tier === TRUST_LOAN_CONFIG.programKey && (s.status === "active" || s.status === "completed" || s.status === "withdrawn")
        );
        if (already) {
          return res.status(409).json({ message: "Trust Loan already claimed." });
        }
        const tierKey = TRUST_LOAN_CONFIG.programKey;
        const tier = STAKING_TIERS[tierKey];
        if (!tier) {
          return res.status(400).json({ message: "Trust Loan tier not configured." });
        }
        const now = /* @__PURE__ */ new Date();
        const endDate = new Date(
          now.getTime() + TRUST_LOAN_CONFIG.durationDays * 24 * 60 * 60 * 1e3
        );
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
          requiredInvestingReferrals: TRUST_LOAN_CONFIG.requiredInvestingReferrals,
          minInvestUsdtPerReferral: String(
            TRUST_LOAN_CONFIG.minInvestUsdtPerReferral
          )
        });
        await storage.createActivity({
          userId,
          type: "trust_loan_claimed",
          description: `Trust Loan claimed: virtual ${TRUST_LOAN_CONFIG.amountXnrt} XNRT principal for ${TRUST_LOAN_CONFIG.durationDays} days (profits only).`
        });
        return res.json({ ok: true, stake });
      } catch (e) {
        console.error("[trust-loan/claim] error:", e);
        return res.status(500).json({ message: "Failed to claim Trust Loan" });
      }
    }
  );
  app2.get("/api/trust-loan/status", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const stakes = await storage.getStakes(userId);
      const loan = stakes.find(
        (s) => s.tier === TRUST_LOAN_CONFIG.programKey
      );
      const { directCount, investingCount } = await getDirectReferralStats(userId);
      const requiredReferrals = TRUST_LOAN_CONFIG.requiredReferrals;
      const requiredInvestingReferrals = TRUST_LOAN_CONFIG.requiredInvestingReferrals;
      const minInvestUsdtPerReferral = TRUST_LOAN_CONFIG.minInvestUsdtPerReferral;
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
        durationDays: TRUST_LOAN_CONFIG.durationDays
      });
    } catch (e) {
      console.error("[trust-loan/status] error:", e);
      return res.status(500).json({ message: "Failed to get Trust Loan status" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
var vite_config_default = defineConfig(async ({ mode }) => {
  const isDev = mode === "development";
  const plugins = [react()];
  if (isDev && process.env.REPL_ID) {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    const { devBanner } = await import("@replit/vite-plugin-dev-banner");
    plugins.push(cartographer(), devBanner());
  }
  plugins.push(
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: "auto",
      devOptions: {
        enabled: isDev,
        type: "module",
        navigateFallback: "index.html"
      },
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "favicon-16x16.png", "favicon-32x32.png"],
      manifest: {
        id: "/?app-id=xnrt",
        name: "XNRT - We Build the NextGen",
        short_name: "XNRT",
        description: "Off-chain gamification earning platform. Earn XNRT tokens through staking, mining, referrals, and task completion.",
        start_url: "/?source=pwa",
        scope: "/",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        display_override: ["standalone", "fullscreen", "minimal-ui"],
        orientation: "portrait-primary",
        categories: ["finance", "lifestyle", "productivity"],
        iarc_rating_id: "e84b072d-71b3-4d3e-86ae-31a8ce4e53b7",
        lang: "en-US",
        dir: "ltr",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icon-256.png",
            sizes: "256x256",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        shortcuts: [
          {
            name: "Staking",
            short_name: "Stake",
            description: "Start staking XNRT tokens",
            url: "/staking",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Mining",
            short_name: "Mine",
            description: "Start a mining session",
            url: "/mining",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Referrals",
            short_name: "Refer",
            description: "View referral network",
            url: "/referrals",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }]
          }
        ]
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}"]
      }
    })
  );
  return {
    base: "/",
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets")
      },
      dedupe: ["react", "react-dom"]
    },
    root: path.resolve(import.meta.dirname, "client"),
    optimizeDeps: {
      include: ["react", "react-dom"]
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("react-dom") || id.includes("react/")) {
                return "react-vendor";
              }
              if (id.includes("recharts") || id.includes("d3-")) {
                return "charts-vendor";
              }
              if (id.includes("@radix-ui") || id.includes("@tanstack")) {
                return "ui-vendor";
              }
              if (id.includes("ethers") || id.includes("@walletconnect")) {
                return "web3-vendor";
              }
              return "vendor";
            }
          },
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split(".");
            const ext = info?.[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext ?? "")) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff|woff2|ttf|eot/.test(ext ?? "")) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          }
        }
      },
      chunkSizeWarningLimit: 600,
      minify: !isDev
    },
    server: {
      fs: { strict: true, deny: ["**/.*"] },
      watch: {
        usePolling: true,
        interval: 300,
        ignored: [
          "**/dist/**",
          "**/.pnpm/**",
          "**/pnpm-store/**",
          "**/.local/**",
          "/nix/store/**",
          "**/.cache/**"
        ]
      }
    }
  };
});

// server/vite.ts
import { nanoid as nanoid5 } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const userConfig = typeof vite_config_default === "function" ? await vite_config_default({ command: "serve", mode: process.env.NODE_ENV || "development" }) : vite_config_default;
  const vite = await createViteServer({
    ...userConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      }
    },
    server: {
      ...typeof userConfig === "object" && "server" in userConfig ? userConfig.server : {},
      ...serverOptions
    },
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const hasFileExtension = /\.[a-z0-9]+$/i.test(url.split("?")[0]);
    if (hasFileExtension && !url.endsWith(".html")) {
      return next();
    }
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid5()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(process.cwd(), "dist/public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use((req, res, next) => {
    if (req.method === "GET" && (req.path === "/" || req.path.endsWith(".html"))) {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });
  app2.use(
    express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders(res, file) {
        if (file.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        }
        if (file.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        }
        if (file.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        }
      }
    })
  );
  app2.get("*", (req, res) => {
    if (/\.[a-z0-9]+$/i.test(req.path)) {
      return res.status(404).end();
    }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/retryWorker.ts
init_storage();
init_notifications();
var retryWorkerInterval = null;
var RETRY_INTERVAL_MS = 5 * 60 * 1e3;
var MAX_RETRY_ATTEMPTS = 5;
var EXPONENTIAL_BACKOFF_DELAYS = [
  0,
  // Attempt 1: Immediate (already tried)
  5 * 60,
  // Attempt 2: 5 min delay (in seconds)
  15 * 60,
  // Attempt 3: 15 min delay
  30 * 60,
  // Attempt 4: 30 min delay
  60 * 60
  // Attempt 5: 60 min delay (final attempt)
];
function shouldRetryNotification(notification) {
  const attempts = notification.deliveryAttempts || 0;
  if (attempts >= MAX_RETRY_ATTEMPTS) {
    return false;
  }
  if (attempts === 0) {
    return true;
  }
  const delaySeconds = EXPONENTIAL_BACKOFF_DELAYS[attempts] || EXPONENTIAL_BACKOFF_DELAYS[EXPONENTIAL_BACKOFF_DELAYS.length - 1];
  const lastAttempt = notification.lastAttemptAt || notification.createdAt;
  const lastAttemptTime = new Date(lastAttempt).getTime();
  const now = Date.now();
  const timeSinceLastAttempt = Math.floor((now - lastAttemptTime) / 1e3);
  return timeSinceLastAttempt >= delaySeconds;
}
async function processRetryQueue() {
  try {
    const pendingNotifications = await storage.getNotificationsPendingPush(50);
    if (pendingNotifications.length === 0) {
      return;
    }
    console.log(`Processing retry queue: ${pendingNotifications.length} notifications pending push`);
    for (const notification of pendingNotifications) {
      if (!shouldRetryNotification(notification)) {
        continue;
      }
      const currentAttempts = notification.deliveryAttempts || 0;
      try {
        const subscriptions = await storage.getUserPushSubscriptions(notification.userId);
        if (subscriptions.length === 0) {
          console.log(`No active subscriptions for user ${notification.userId}, marking notification ${notification.id} as failed`);
          await storage.updateNotificationDelivery(notification.id, {
            pendingPush: false,
            deliveryAttempts: currentAttempts + 1,
            lastAttemptAt: /* @__PURE__ */ new Date(),
            pushError: "No active push subscriptions"
          });
          continue;
        }
        console.log(`Retrying push notification ${notification.id}, attempt ${currentAttempts + 1}/${MAX_RETRY_ATTEMPTS}`);
        const pushPayload = {
          title: notification.title,
          body: notification.message,
          data: {
            url: "/",
            type: notification.type,
            id: notification.id,
            ...notification.metadata || {}
          }
        };
        const pushSuccess = await sendPushNotification(notification.userId, pushPayload);
        if (pushSuccess) {
          console.log(`Push notification retry successful for notification ${notification.id}`);
          await storage.updateNotificationDelivery(notification.id, {
            deliveredAt: /* @__PURE__ */ new Date(),
            deliveryAttempts: currentAttempts + 1,
            lastAttemptAt: /* @__PURE__ */ new Date(),
            pendingPush: false
          });
        } else {
          const newAttempts = currentAttempts + 1;
          if (newAttempts >= MAX_RETRY_ATTEMPTS) {
            console.error(`Push notification failed permanently for notification ${notification.id} after ${newAttempts} attempts`);
            await storage.updateNotificationDelivery(notification.id, {
              deliveryAttempts: newAttempts,
              lastAttemptAt: /* @__PURE__ */ new Date(),
              pendingPush: false,
              pushError: "Max retry attempts reached"
            });
          } else {
            console.log(`Push notification retry failed for notification ${notification.id}, will retry later (attempt ${newAttempts}/${MAX_RETRY_ATTEMPTS})`);
            await storage.updateNotificationDelivery(notification.id, {
              deliveryAttempts: newAttempts,
              lastAttemptAt: /* @__PURE__ */ new Date(),
              pushError: "Push delivery failed, will retry"
            });
          }
        }
      } catch (error) {
        const newAttempts = currentAttempts + 1;
        const errorMessage = error.message || "Unknown error during retry";
        console.error(`Error processing notification ${notification.id}:`, error);
        if (newAttempts >= MAX_RETRY_ATTEMPTS) {
          console.error(`Push notification failed permanently for notification ${notification.id} after ${newAttempts} attempts`);
          await storage.updateNotificationDelivery(notification.id, {
            deliveryAttempts: newAttempts,
            lastAttemptAt: /* @__PURE__ */ new Date(),
            pendingPush: false,
            pushError: `Max retries reached: ${errorMessage}`
          });
        } else {
          await storage.updateNotificationDelivery(notification.id, {
            deliveryAttempts: newAttempts,
            lastAttemptAt: /* @__PURE__ */ new Date(),
            pushError: errorMessage
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in retry worker processRetryQueue:", error);
  }
}
function startRetryWorker() {
  if (retryWorkerInterval) {
    console.log("Retry worker is already running");
    return;
  }
  console.log(`Starting push notification retry worker (runs every ${RETRY_INTERVAL_MS / 1e3 / 60} minutes)`);
  processRetryQueue().catch((err) => {
    console.error("Error in initial retry queue process:", err);
  });
  retryWorkerInterval = setInterval(() => {
    processRetryQueue().catch((err) => {
      console.error("Error in retry queue process:", err);
    });
  }, RETRY_INTERVAL_MS);
}
function stopRetryWorker() {
  if (retryWorkerInterval) {
    console.log("Stopping push notification retry worker");
    clearInterval(retryWorkerInterval);
    retryWorkerInterval = null;
  }
}

// server/index.ts
init_depositScanner();
var app = express2();
app.set("trust proxy", 1);
var isDevelopment = app.get("env") === "development";
app.use(
  helmet({
    contentSecurityPolicy: isDevelopment ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "wss:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'", "blob:"],
        reportUri: ["/csp-report"]
      },
      reportOnly: false
    },
    crossOriginEmbedderPolicy: false
  })
);
var APP_URL = process.env.APP_URL?.trim();
var CLIENT_URL = process.env.CLIENT_URL?.trim();
var allowedHosts = /* @__PURE__ */ new Set([
  "xnrt.org",
  "www.xnrt.org",
  ...APP_URL ? [safeHost(APP_URL)] : [],
  ...CLIENT_URL ? [safeHost(CLIENT_URL)] : []
]);
var REPLIT_RE = /\.repl\.co$/i;
var LOCAL_RE = /^localhost(?::\d+)?$/i;
function safeHost(u) {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
}
var corsDelegate = (req, cb) => {
  const origin = req.header("Origin") || "";
  if (!origin) {
    return cb(null, { origin: true, credentials: true });
  }
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    return cb(null, { origin: false });
  }
  const allow = allowedHosts.has(host) || REPLIT_RE.test(host) || LOCAL_RE.test(host);
  cb(null, { origin: allow, credentials: true });
};
app.use(cors(corsDelegate));
app.options("*", cors(corsDelegate));
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use(cookieParser());
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJson;
  const originalJson = res.json.bind(res);
  res.json = ((body) => {
    capturedJson = body;
    return originalJson(body);
  });
  res.on("finish", () => {
    if (!path3.startsWith("/api")) return;
    const duration = Date.now() - start;
    let line = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
    if (capturedJson !== void 0) {
      const s = safeStringify(capturedJson);
      if (s) line += ` :: ${s}`;
    }
    if (line.length > 200) line = line.slice(0, 199) + "\u2026";
    log(line);
  });
  next();
});
function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, env: app.get("env") }));
app.get("/readyz", (_req, res) => res.status(200).json({ ready: true }));
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error(err);
  });
  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const HOST = process.env.HOST || "0.0.0.0";
  const PORT = Number(process.env.PORT || "5000");
  server.listen(
    {
      host: HOST,
      port: PORT,
      reusePort: true
      // OK in Replit; allows same port across restarts in some cases
    },
    () => {
      log(`serving on http://${HOST}:${PORT}`);
      const enableScanner = (process.env.ENABLE_SCANNER ?? (isDevelopment ? "false" : "true")).toLowerCase() === "true";
      try {
        startRetryWorker();
      } catch (e) {
        console.error("[retryWorker] failed to start:", e);
      }
      if (enableScanner) {
        try {
          startDepositScanner();
        } catch (e) {
          console.error("[depositScanner] failed to start:", e);
        }
      } else {
        log("[depositScanner] disabled (set ENABLE_SCANNER=true to enable)");
      }
    }
  );
  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`[server] Port ${PORT} is already in use. Stop the other process or change PORT.`);
    } else {
      console.error("[server] error:", err);
    }
  });
  const shutdown = (sig) => {
    log(`${sig} received, shutting down gracefully`);
    stopRetryWorker();
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 1e4).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
