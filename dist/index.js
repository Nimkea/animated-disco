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
    lastProfitDate: stake.lastProfitDate || void 0
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
  return {
    ...notification,
    metadata: notification.metadata || void 0
  };
}
function convertPrismaPushSubscription(subscription) {
  return {
    ...subscription,
    expirationTime: subscription.expirationTime || void 0
  };
}
var prisma, DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    prisma = new PrismaClient();
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
          if (userData.email !== void 0 && userData.email !== null) updateData.email = userData.email;
          if (userData.username !== void 0 && userData.username !== null) updateData.username = userData.username;
          if (userData.isAdmin !== void 0) updateData.isAdmin = userData.isAdmin;
          if (userData.xp !== void 0) updateData.xp = userData.xp;
          if (userData.level !== void 0) updateData.level = userData.level;
          if (userData.streak !== void 0) updateData.streak = userData.streak;
          if (userData.lastCheckIn !== void 0) updateData.lastCheckIn = userData.lastCheckIn;
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
        if (updates.lastCheckIn !== void 0) updateData.lastCheckIn = updates.lastCheckIn;
        updateData.updatedAt = /* @__PURE__ */ new Date();
        const user = await prisma.user.update({
          where: { id: userId },
          data: updateData
        });
        return convertPrismaUser(user);
      }
      async getAllUsers() {
        const users2 = await prisma.user.findMany();
        return users2.map(convertPrismaUser);
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
        if (updates.xnrtBalance !== void 0) data.xnrtBalance = new Prisma.Decimal(updates.xnrtBalance);
        if (updates.stakingBalance !== void 0) data.stakingBalance = new Prisma.Decimal(updates.stakingBalance);
        if (updates.miningBalance !== void 0) data.miningBalance = new Prisma.Decimal(updates.miningBalance);
        if (updates.referralBalance !== void 0) data.referralBalance = new Prisma.Decimal(updates.referralBalance);
        if (updates.totalEarned !== void 0) data.totalEarned = new Prisma.Decimal(updates.totalEarned);
        const balance = await prisma.balance.update({
          where: { userId },
          data
        });
        return convertPrismaBalance(balance);
      }
      // Staking operations
      async getStakes(userId) {
        const stakes2 = await prisma.stake.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" }
        });
        return stakes2.map(convertPrismaStake);
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
            status: stake.status || "active"
          }
        });
        return convertPrismaStake(newStake);
      }
      async updateStake(id, updates) {
        const data = {};
        if (updates.totalProfit !== void 0) data.totalProfit = new Prisma.Decimal(updates.totalProfit);
        if (updates.lastProfitDate !== void 0) data.lastProfitDate = updates.lastProfitDate;
        if (updates.status !== void 0) data.status = updates.status;
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
              OR: [
                { status: "completed" },
                { status: "active" }
              ]
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
        } catch (error) {
          return null;
        }
      }
      async getAllActiveStakes() {
        const stakes2 = await prisma.stake.findMany({
          where: { status: "active" }
        });
        return stakes2.map(convertPrismaStake);
      }
      async processStakingRewards() {
        const activeStakes = await this.getAllActiveStakes();
        const now = /* @__PURE__ */ new Date();
        const DAY_MS = 24 * 60 * 60 * 1e3;
        for (const stake of activeStakes) {
          const lastProfitDate = new Date(stake.lastProfitDate || stake.startDate);
          const endDate = new Date(stake.endDate);
          const daysSinceLastProfit = Math.floor((now.getTime() - lastProfitDate.getTime()) / DAY_MS);
          const daysUntilEnd = Math.floor((endDate.getTime() - lastProfitDate.getTime()) / DAY_MS);
          const creditedDays = Math.max(0, Math.min(daysSinceLastProfit, daysUntilEnd));
          if (creditedDays >= 1) {
            const dailyProfit = parseFloat(stake.amount) * parseFloat(stake.dailyRate) / 100;
            const profitToAdd = dailyProfit * creditedDays;
            const newTotalProfit = parseFloat(stake.totalProfit) + profitToAdd;
            const calculatedLastProfitDate = new Date(lastProfitDate.getTime() + creditedDays * DAY_MS);
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
              description: `Earned ${profitToAdd.toFixed(2)} XNRT from staking (${creditedDays} day${creditedDays > 1 ? "s" : ""})`
            });
            const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
            void notifyUser2(stake.userId, {
              type: "staking_reward",
              title: "\u{1F48E} Staking Rewards!",
              message: `You earned ${profitToAdd.toFixed(2)} XNRT from ${creditedDays} day${creditedDays > 1 ? "s" : ""} of staking`,
              url: "/staking",
              metadata: {
                amount: profitToAdd.toString(),
                days: creditedDays,
                stakeId: stake.id
              }
            }).catch((err) => {
              console.error("Error sending staking reward notification (non-blocking):", err);
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
      async processMiningRewards() {
        const activeSessions = await prisma.miningSession.findMany({
          where: { status: "active" }
        });
        const now = /* @__PURE__ */ new Date();
        for (const session of activeSessions) {
          if (!session.endTime) continue;
          const endTime = new Date(session.endTime);
          if (now >= endTime) {
            const xpReward = session.finalReward;
            const xnrtReward = session.finalReward * 0.5;
            await this.updateMiningSession(session.id, {
              status: "completed",
              endTime: now
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
              description: `Auto-completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(1)} XNRT`
            });
            const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
            void notifyUser2(session.userId, {
              type: "mining_completed",
              title: "\u26CF\uFE0F Mining Complete!",
              message: `You earned ${xpReward} XP and ${xnrtReward.toFixed(1)} XNRT from your 24-hour mining session`,
              url: "/mining",
              metadata: {
                xpReward,
                xnrtReward: xnrtReward.toString(),
                sessionId: session.id
              }
            }).catch((err) => {
              console.error("Error sending mining notification (non-blocking):", err);
            });
            await this.checkAndUnlockAchievements(session.userId);
          }
        }
      }
      // Mining operations
      async getCurrentMiningSession(userId) {
        const session = await prisma.miningSession.findFirst({
          where: {
            userId,
            status: "active"
          },
          orderBy: { createdAt: "desc" }
        });
        if (session && session.endTime && /* @__PURE__ */ new Date() >= new Date(session.endTime)) {
          const baseReward = session.baseReward || 10;
          const boostPercentage = session.boostPercentage || 0;
          const finalReward = baseReward + Math.floor(baseReward * boostPercentage / 100);
          const xpReward = finalReward;
          const xnrtReward = finalReward * 0.5;
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
            description: `Completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(1)} XNRT`
          });
          await this.checkAndUnlockAchievements(userId);
          return void 0;
        }
        return session || void 0;
      }
      async getMiningHistory(userId) {
        const sessions2 = await prisma.miningSession.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50
        });
        return sessions2;
      }
      async createMiningSession(session) {
        const newSession = await prisma.miningSession.create({
          data: {
            userId: session.userId,
            baseReward: session.baseReward || 10,
            adBoostCount: session.adBoostCount || 0,
            boostPercentage: session.boostPercentage || 0,
            finalReward: session.finalReward || 10,
            startTime: session.startTime || /* @__PURE__ */ new Date(),
            endTime: session.endTime,
            nextAvailable: session.nextAvailable,
            status: session.status || "active"
          }
        });
        return newSession;
      }
      async updateMiningSession(id, updates) {
        const data = {};
        if (updates.baseReward !== void 0) data.baseReward = updates.baseReward;
        if (updates.adBoostCount !== void 0) data.adBoostCount = updates.adBoostCount;
        if (updates.boostPercentage !== void 0) data.boostPercentage = updates.boostPercentage;
        if (updates.finalReward !== void 0) data.finalReward = updates.finalReward;
        if (updates.endTime !== void 0) data.endTime = updates.endTime;
        if (updates.status !== void 0) data.status = updates.status;
        const session = await prisma.miningSession.update({
          where: { id },
          data
        });
        return session;
      }
      // Referral operations
      async getReferralsByReferrer(referrerId) {
        const referrals2 = await prisma.referral.findMany({
          where: { referrerId }
        });
        return referrals2.map(convertPrismaReferral);
      }
      async createReferral(referral) {
        const newReferral = await prisma.referral.create({
          data: {
            referrerId: referral.referrerId,
            referredUserId: referral.referredUserId,
            level: referral.level,
            totalCommission: new Prisma.Decimal(referral.totalCommission || "0")
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
        console.log(`[REFERRAL] Starting distribution for userId: ${userId}, amount: ${amount}`);
        const COMMISSION_RATES = {
          1: 0.06,
          2: 0.03,
          3: 0.01
        };
        const referrerChain = await this.getReferrerChain(userId, 3);
        console.log(`[REFERRAL] Referrer chain length: ${referrerChain.length}`, referrerChain.map((r) => ({ id: r?.id, email: r?.email })));
        for (let level = 1; level <= 3; level++) {
          const referrer = referrerChain[level - 1];
          const commission = amount * COMMISSION_RATES[level];
          console.log(`[REFERRAL] Level ${level}: referrer=${referrer?.email || "null"}, commission=${commission}`);
          if (!referrer) {
            const COMPANY_ADMIN_EMAIL = "noahkeaneowen@hotmail.com";
            console.log(`[REFERRAL] No referrer at level ${level}, using company fallback: ${COMPANY_ADMIN_EMAIL}`);
            const companyAccount = await prisma.user.findFirst({
              where: {
                email: COMPANY_ADMIN_EMAIL,
                isAdmin: true
              }
            });
            if (!companyAccount) {
              console.error(`[REFERRAL] Company admin account not found: ${COMPANY_ADMIN_EMAIL}`);
              throw new Error(`Company admin account (${COMPANY_ADMIN_EMAIL}) not found - cannot process commission fallback`);
            }
            console.log(`[REFERRAL] Company account found: ${companyAccount.id}, crediting ${commission} XNRT`);
            const companyBalance = await this.getBalance(companyAccount.id);
            if (companyBalance) {
              const newReferralBalance = (parseFloat(companyBalance.referralBalance) + commission).toString();
              const newTotalEarned = (parseFloat(companyBalance.totalEarned) + commission).toString();
              console.log(`[REFERRAL] Updating company balance: referral ${companyBalance.referralBalance} \u2192 ${newReferralBalance}`);
              await this.updateBalance(companyAccount.id, {
                referralBalance: newReferralBalance,
                totalEarned: newTotalEarned
              });
              await this.createActivity({
                userId: companyAccount.id,
                type: "company_commission",
                description: `Received ${commission.toFixed(2)} XNRT company commission from missing level ${level} referrer`
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
            console.log(`[REFERRAL] Updating referrer ${referrer.email} balance: referral ${referrerBalance.referralBalance} \u2192 ${newReferralBalance}`);
            await this.updateBalance(referrer.id, {
              referralBalance: newReferralBalance,
              totalEarned: newTotalEarned
            });
          } else {
            console.warn(`[REFERRAL] No balance found for referrer ${referrer.email} (${referrer.id})`);
          }
          await this.createActivity({
            userId: referrer.id,
            type: "referral_commission",
            description: `Earned ${commission.toFixed(2)} XNRT commission from level ${level} referral`
          });
          const { notifyUser: notifyUser2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
          void notifyUser2(referrer.id, {
            type: "referral_commission",
            title: "\u{1F4B0} Referral Bonus!",
            message: `You earned ${commission.toFixed(2)} XNRT commission from a level ${level} referral`,
            url: "/referrals",
            metadata: {
              amount: commission.toString(),
              level,
              referredUserId: userId
            }
          }).catch((err) => {
            console.error("Error sending referral commission notification (non-blocking):", err);
          });
          console.log(`[REFERRAL] Level ${level} commission complete for ${referrer.email}`);
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
        const transactions2 = await prisma.transaction.findMany({
          where,
          orderBy: { createdAt: "desc" }
        });
        return transactions2.map(convertPrismaTransaction);
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
        if (transaction.usdtAmount !== void 0 && transaction.usdtAmount !== null) {
          data.usdtAmount = new Prisma.Decimal(transaction.usdtAmount);
        }
        if (transaction.source !== void 0 && transaction.source !== null) data.source = transaction.source;
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
        const transactions2 = await prisma.transaction.findMany({
          where,
          orderBy: { createdAt: "desc" }
        });
        return transactions2.map(convertPrismaTransaction);
      }
      async getPendingTransactions(type) {
        const transactions2 = await prisma.transaction.findMany({
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
        return transactions2.map(convertPrismaTransaction);
      }
      // Task operations
      async getAllTasks() {
        const tasks2 = await prisma.task.findMany({
          where: { isActive: true }
        });
        return tasks2.map(convertPrismaTask);
      }
      async getUserTasks(userId) {
        const userTasks2 = await prisma.userTask.findMany({
          where: { userId }
        });
        return userTasks2.map(convertPrismaUserTask);
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
        if (updates.maxProgress !== void 0) data.maxProgress = updates.maxProgress;
        if (updates.completed !== void 0) data.completed = updates.completed;
        if (updates.completedAt !== void 0) data.completedAt = updates.completedAt;
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
        const unlockedIds = new Set(userAchievementsList.map((ua) => ua.achievementId));
        const totalEarned = parseFloat(balance.totalEarned);
        const userReferrals = await this.getReferralsByReferrer(userId);
        const directReferrals = userReferrals.filter((r) => r.level === 1);
        const miningSessions2 = await this.getMiningHistory(userId);
        const completedMining = miningSessions2.filter((s) => s.status === "completed");
        let totalXpReward = 0;
        const unlockedAchievements = [];
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
            unlockedAchievements.push(achievement);
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
              console.error("Error sending achievement notification (non-blocking):", err);
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
        const activities2 = await prisma.activity.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit
        });
        return activities2.map(convertPrismaActivity);
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
          data.metadata = JSON.stringify(notification.metadata);
        }
        const newNotification = await prisma.notification.create({ data });
        return convertPrismaNotification(newNotification);
      }
      async getNotifications(userId, limit = 20) {
        const notifications2 = await prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit
        });
        return notifications2.map(convertPrismaNotification);
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
        const notifications2 = await prisma.notification.findMany({
          where: {
            pendingPush: true,
            deliveryAttempts: {
              lt: 5
            }
          },
          orderBy: { createdAt: "asc" },
          take: limit
        });
        return notifications2.map(convertPrismaNotification);
      }
      async updateNotificationDelivery(id, updates) {
        const data = {};
        if (updates.deliveredAt !== void 0) data.deliveredAt = updates.deliveredAt;
        if (updates.deliveryAttempts !== void 0) data.deliveryAttempts = updates.deliveryAttempts;
        if (updates.lastAttemptAt !== void 0) data.lastAttemptAt = updates.lastAttemptAt;
        if (updates.pendingPush !== void 0) data.pendingPush = updates.pendingPush;
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
          case "weekly":
            const dayOfWeek = now.getDay();
            startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1e3);
            startDate.setHours(0, 0, 0, 0);
            break;
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
            // Get top 100 to find current user
          });
          const leaderboard = users2.slice(0, 10).map((user, index2) => {
            const baseData = {
              xp: user.xp,
              categoryXp: user.xp,
              rank: index2 + 1
            };
            if (isAdmin) {
              return {
                ...baseData,
                userId: user.id,
                username: user.username,
                email: user.email,
                displayName: user.username || user.email
              };
            } else {
              return {
                ...baseData,
                displayName: generateAnonymizedHandle(user.id)
              };
            }
          });
          const currentUserRank = users2.findIndex((u) => u.id === currentUserId);
          let userPosition = null;
          if (currentUserRank > 9) {
            const currentUser = users2[currentUserRank];
            const baseData = {
              xp: currentUser.xp,
              categoryXp: currentUser.xp,
              rank: currentUserRank + 1
            };
            if (isAdmin) {
              userPosition = {
                ...baseData,
                userId: currentUser.id,
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
        } else {
          const typeFilter = category === "mining" ? "mining" : category === "staking" ? "stak" : "referral";
          const users2 = await prisma.user.findMany({
            select: {
              id: true,
              username: true,
              email: true,
              xp: true
            }
          });
          const userXPData = await Promise.all(
            users2.map(async (user) => {
              const whereClause = {
                userId: user.id,
                type: { contains: typeFilter }
              };
              if (startDate) {
                whereClause.createdAt = { gte: startDate };
              }
              const activities2 = await prisma.activity.findMany({
                where: whereClause
              });
              let categoryXp = 0;
              activities2.forEach((activity) => {
                const xpMatch = activity.description.match(/(\d+)\s*XP/i);
                if (xpMatch) {
                  categoryXp += parseInt(xpMatch[1]);
                }
              });
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
          const leaderboard = userXPData.slice(0, 10).map((user, index2) => {
            const baseData = {
              xp: user.xp,
              categoryXp: user.categoryXp,
              rank: index2 + 1
            };
            if (isAdmin) {
              return {
                ...baseData,
                userId: user.userId,
                username: user.username,
                email: user.email,
                displayName: user.username || user.email
              };
            } else {
              return {
                ...baseData,
                displayName: generateAnonymizedHandle(user.userId)
              };
            }
          });
          const currentUserRank = userXPData.findIndex((u) => u.userId === currentUserId);
          let userPosition = null;
          if (currentUserRank > 9) {
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
      }
      // Raw query support
      async raw(query, params = []) {
        return await prisma.$queryRawUnsafe(query, ...params);
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/services/verifyBscUsdt.ts
var verifyBscUsdt_exports = {};
__export(verifyBscUsdt_exports, {
  verifyBscUsdtDeposit: () => verifyBscUsdtDeposit
});
import { ethers } from "ethers";
async function verifyBscUsdtDeposit(params) {
  try {
    const { txHash, expectedTo } = params;
    const need = params.requiredConf ?? Number(process.env.BSC_CONFIRMATIONS ?? 12);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { verified: false, confirmations: 0, reason: "Transaction not found" };
    }
    if (receipt.status !== 1) {
      const conf2 = await provider.getBlockNumber() - (receipt.blockNumber ?? 0);
      return { verified: false, confirmations: conf2, reason: "Transaction failed" };
    }
    let totalToExpected = BigInt(0);
    for (const log2 of receipt.logs) {
      if (log2.address.toLowerCase() !== process.env.USDT_BSC_ADDRESS.toLowerCase()) continue;
      try {
        const parsed = usdt.interface.parseLog({ topics: log2.topics, data: log2.data });
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
var provider, USDT_ABI, usdt;
var init_verifyBscUsdt = __esm({
  "server/services/verifyBscUsdt.ts"() {
    "use strict";
    provider = new ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
    USDT_ABI = [
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];
    usdt = new ethers.Contract(
      process.env.USDT_BSC_ADDRESS,
      USDT_ABI,
      provider
    );
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
    const users2 = await prisma4.user.findMany({
      where: { depositAddress: { not: null } },
      select: { id: true, depositAddress: true }
    });
    const addressToUserId = /* @__PURE__ */ new Map();
    users2.forEach((user) => {
      if (user.depositAddress) {
        addressToUserId.set(user.depositAddress.toLowerCase(), user.id);
      }
    });
    console.log(`[DepositScanner] Watching ${users2.length} deposit addresses`);
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
var JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
var JWT_EXPIRES_IN = "7d";
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
function generateVerificationEmailHTML(username, verificationLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - XNRT</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
        <tr>
          <td style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
            <h1 style="color: #d4a72c; font-size: 32px; margin: 0; font-weight: 700; letter-spacing: 1px;">XNRT</h1>
            <p style="color: #888; font-size: 14px; margin: 5px 0 0 0;">NextGen Gamification Platform</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px; background-color: #1a1a1a;">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">Welcome to XNRT, ${username}! \u{1F680}</h2>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for joining the XNRT community! We're excited to have you on board.
            </p>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              To get started and access all the amazing features of our platform, please verify your email address by clicking the button below:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #d4a72c 0%, #f4c542 100%); color: #000000; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(212, 167, 44, 0.3);">
                Verify Email Address
              </a>
            </div>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationLink}" style="color: #d4a72c; word-break: break-all;">${verificationLink}</a>
            </p>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
              This verification link will expire in 24 hours.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px; background-color: #0a0a0a; border-top: 1px solid #2a2a2a;">
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong style="color: #888;">Start Earning:</strong> Stake, mine, refer friends, and complete tasks to earn XNRT tokens!
            </p>
            <p style="color: #666; font-size: 12px; margin: 20px 0 0 0;">
              If you didn't create an account with XNRT, please ignore this email.
            </p>
            <p style="color: #444; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
              \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} NextGen Rise Foundation. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
function generatePasswordResetEmailHTML(username, resetLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - XNRT</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
        <tr>
          <td style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
            <h1 style="color: #d4a72c; font-size: 32px; margin: 0; font-weight: 700; letter-spacing: 1px;">XNRT</h1>
            <p style="color: #888; font-size: 14px; margin: 5px 0 0 0;">NextGen Gamification Platform</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px; background-color: #1a1a1a;">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">Password Reset Request</h2>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi ${username},
            </p>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              We received a request to reset your password for your XNRT account. If you made this request, click the button below to reset your password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #d4a72c 0%, #f4c542 100%); color: #000000; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(212, 167, 44, 0.3);">
                Reset Password
              </a>
            </div>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetLink}" style="color: #d4a72c; word-break: break-all;">${resetLink}</a>
            </p>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
              This password reset link will expire in 1 hour for security reasons.
            </p>
            <div style="margin: 30px 0; padding: 15px; background-color: #2a1a0a; border-left: 4px solid #d4a72c; border-radius: 4px;">
              <p style="color: #f4c542; font-size: 14px; margin: 0; font-weight: 600;">
                \u26A0\uFE0F Security Notice
              </p>
              <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 10px 0 0 0;">
                If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
              </p>
            </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px; background-color: #0a0a0a; border-top: 1px solid #2a2a2a;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              For security reasons, never share your password with anyone. XNRT staff will never ask for your password.
            </p>
            <p style="color: #444; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
              \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} NextGen Rise Foundation. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
async function sendVerificationEmail(email, username, token) {
  const baseUrl = process.env.APP_URL || "https://xnrt.org";
  const verificationLink = `${baseUrl}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Verify Your Email - XNRT Platform",
    html: generateVerificationEmailHTML(username, verificationLink)
  });
}
async function sendPasswordResetEmail(email, username, token) {
  const baseUrl = process.env.APP_URL || "https://xnrt.org";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Reset Your Password - XNRT Platform",
    html: generatePasswordResetEmailHTML(username, resetLink)
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
import { sql } from "drizzle-orm";
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
  unique
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
var sessions = pgTable("Session", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jwtId: varchar("jwtId").unique().notNull(),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt")
}, (table) => [
  index("sessions_userId_idx").on(table.userId),
  index("sessions_jwtId_idx").on(table.jwtId)
]);
var users = pgTable("User", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  username: varchar("username").unique().notNull(),
  passwordHash: varchar("passwordHash").notNull(),
  referralCode: varchar("referralCode").unique().notNull(),
  referredBy: varchar("referredBy"),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken"),
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  streak: integer("streak").default(0).notNull(),
  lastCheckIn: timestamp("lastCheckIn"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => sql`now()`).notNull()
});
var balances = pgTable("Balance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").unique().notNull().references(() => users.id, { onDelete: "cascade" }),
  xnrtBalance: decimal("xnrtBalance", { precision: 38, scale: 18 }).default("0").notNull(),
  stakingBalance: decimal("stakingBalance", { precision: 38, scale: 18 }).default("0").notNull(),
  miningBalance: decimal("miningBalance", { precision: 38, scale: 18 }).default("0").notNull(),
  referralBalance: decimal("referralBalance", { precision: 38, scale: 18 }).default("0").notNull(),
  totalEarned: decimal("totalEarned", { precision: 38, scale: 18 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => sql`now()`).notNull()
});
var stakes = pgTable("Stake", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tier: varchar("tier").notNull(),
  // royal_sapphire, legendary_emerald, imperial_platinum, mythic_diamond
  amount: decimal("amount", { precision: 38, scale: 18 }).notNull(),
  dailyRate: decimal("dailyRate", { precision: 8, scale: 6 }).notNull(),
  // 1.1, 1.4, 1.5, 2.0
  duration: integer("duration").notNull(),
  // 15, 30, 45, 90 days
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate").notNull(),
  totalProfit: decimal("totalProfit", { precision: 38, scale: 18 }).default("0").notNull(),
  lastProfitDate: timestamp("lastProfitDate"),
  status: varchar("status").default("active").notNull(),
  // active, completed, withdrawn
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("stakes_userId_idx").on(table.userId),
  index("stakes_status_idx").on(table.status),
  index("stakes_userId_createdAt_idx").on(table.userId, table.createdAt)
]);
var miningSessions = pgTable("MiningSession", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  baseReward: integer("baseReward").default(10).notNull(),
  adBoostCount: integer("adBoostCount").default(0).notNull(),
  boostPercentage: integer("boostPercentage").default(0).notNull(),
  finalReward: integer("finalReward").default(10).notNull(),
  startTime: timestamp("startTime").defaultNow().notNull(),
  endTime: timestamp("endTime"),
  nextAvailable: timestamp("nextAvailable").notNull(),
  status: varchar("status").default("active").notNull(),
  // active, completed
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("mining_sessions_userId_idx").on(table.userId),
  index("mining_sessions_status_idx").on(table.status)
]);
var referrals = pgTable("Referral", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredUserId: varchar("referredUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  // 1, 2, 3
  totalCommission: decimal("totalCommission", { precision: 38, scale: 18 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("referrals_referrerId_idx").on(table.referrerId),
  index("referrals_referredUserId_idx").on(table.referredUserId)
]);
var transactions = pgTable("Transaction", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(),
  // deposit, withdrawal
  amount: decimal("amount", { precision: 38, scale: 18 }).notNull(),
  usdtAmount: decimal("usdtAmount", { precision: 38, scale: 18 }),
  source: varchar("source"),
  // For withdrawals: main, referral
  walletAddress: text("walletAddress"),
  transactionHash: text("transactionHash"),
  proofImageUrl: varchar("proofImageUrl"),
  status: varchar("status").default("pending").notNull(),
  // pending, approved, rejected, paid
  adminNotes: text("adminNotes"),
  fee: decimal("fee", { precision: 38, scale: 18 }),
  netAmount: decimal("netAmount", { precision: 38, scale: 18 }),
  approvedBy: varchar("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  verified: boolean("verified").default(false).notNull(),
  confirmations: integer("confirmations").default(0).notNull(),
  verificationData: jsonb("verificationData"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("transactions_userId_idx").on(table.userId),
  index("transactions_type_idx").on(table.type),
  index("transactions_status_idx").on(table.status),
  index("transactions_createdAt_idx").on(table.createdAt),
  index("transactions_userId_createdAt_idx").on(table.userId, table.createdAt),
  unique("transactions_txhash_unique").on(table.transactionHash)
]);
var tasks = pgTable("Task", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xpReward").notNull(),
  xnrtReward: decimal("xnrtReward", { precision: 38, scale: 18 }).default("0").notNull(),
  category: varchar("category").notNull(),
  // daily, weekly, special
  requirements: text("requirements"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  unique("tasks_title_unique").on(table.title)
]);
var userTasks = pgTable("UserTask", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: varchar("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  progress: integer("progress").default(0).notNull(),
  maxProgress: integer("maxProgress").default(1).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("user_tasks_userId_idx").on(table.userId),
  index("user_tasks_taskId_idx").on(table.taskId),
  unique("user_tasks_user_task_unique").on(table.userId, table.taskId)
]);
var achievements = pgTable("Achievement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon").notNull(),
  category: varchar("category").notNull(),
  // earnings, referrals, streaks, mining
  requirement: integer("requirement").notNull(),
  xpReward: integer("xpReward").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  unique("achievements_title_unique").on(table.title)
]);
var userAchievements = pgTable("UserAchievement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: varchar("achievementId").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull()
}, (table) => [
  index("user_achievements_userId_idx").on(table.userId),
  index("user_achievements_achievementId_idx").on(table.achievementId)
]);
var activities = pgTable("Activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(),
  // stake_created, mining_completed, referral_earned, task_completed, etc.
  description: text("description").notNull(),
  metadata: varchar("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("activities_user_id_idx").on(table.userId),
  index("activities_created_at_idx").on(table.createdAt),
  index("activities_userId_createdAt_idx").on(table.userId, table.createdAt)
]);
var notifications = pgTable("Notification", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(),
  // referral_commission, new_referral, achievement_unlocked, etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  metadata: varchar("metadata"),
  read: boolean("read").default(false).notNull(),
  deliveryAttempts: integer("deliveryAttempts"),
  deliveredAt: timestamp("deliveredAt"),
  lastAttemptAt: timestamp("lastAttemptAt"),
  pendingPush: boolean("pendingPush").default(false).notNull(),
  pushError: text("pushError"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
  index("notifications_created_at_idx").on(table.createdAt),
  index("notifications_pending_push_idx").on(table.pendingPush)
]);
var pushSubscriptions = pgTable("PushSubscription", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  expirationTime: timestamp("expirationTime"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => sql`now()`).notNull()
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
  index("push_subscriptions_endpoint_idx").on(table.endpoint),
  unique("push_subscriptions_user_endpoint_unique").on(table.userId, table.endpoint)
]);
var passwordResets = pgTable("PasswordReset", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").unique().notNull(),
  userId: varchar("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("password_resets_userId_idx").on(table.userId),
  index("password_resets_token_idx").on(table.token)
]);
var usersRelations = relations(users, ({ one, many }) => ({
  balance: one(balances, {
    fields: [users.id],
    references: [balances.userId]
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
  passwordResets: many(passwordResets)
}));
var balancesRelations = relations(balances, ({ one }) => ({
  user: one(users, {
    fields: [balances.userId],
    references: [users.id]
  })
}));
var stakesRelations = relations(stakes, ({ one }) => ({
  user: one(users, {
    fields: [stakes.userId],
    references: [users.id]
  })
}));
var miningSessionsRelations = relations(miningSessions, ({ one }) => ({
  user: one(users, {
    fields: [miningSessions.userId],
    references: [users.id]
  })
}));
var referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer"
  }),
  referredUser: one(users, {
    fields: [referrals.referredUserId],
    references: [users.id],
    relationName: "referred"
  })
}));
var transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id]
  })
}));
var userTasksRelations = relations(userTasks, ({ one }) => ({
  user: one(users, {
    fields: [userTasks.userId],
    references: [users.id]
  }),
  task: one(tasks, {
    fields: [userTasks.taskId],
    references: [tasks.id]
  })
}));
var userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id]
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id]
  })
}));
var activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id]
  })
}));
var notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  })
}));
var pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id]
  })
}));
var sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));
var passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id]
  })
}));
var insertStakeSchema = createInsertSchema(stakes).omit({ id: true, createdAt: true });
var insertMiningSessionSchema = createInsertSchema(miningSessions).omit({ id: true, createdAt: true });
var insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
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
init_verifyBscUsdt();
import { PrismaClient as PrismaClient5, Prisma as Prisma3 } from "@prisma/client";
import webpush2 from "web-push";
import rateLimit3 from "express-rate-limit";
import { ethers as ethers4 } from "ethers";
import { nanoid as nanoid5 } from "nanoid";

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
var VAPID_PUBLIC_KEY2 = (process.env.VAPID_PUBLIC_KEY || "").replace(/^"publicKey":"/, "").replace(/"$/, "");
var VAPID_PRIVATE_KEY2 = (process.env.VAPID_PRIVATE_KEY || "").replace(/^"privateKey":"/, "").replace(/}$/, "").replace(/"$/, "");
var VAPID_SUBJECT2 = process.env.VAPID_SUBJECT || "mailto:support@xnrt.org";
if (VAPID_PUBLIC_KEY2 && VAPID_PRIVATE_KEY2) {
  webpush2.setVapidDetails(VAPID_SUBJECT2, VAPID_PUBLIC_KEY2, VAPID_PRIVATE_KEY2);
}
var pushSubscriptionLimiter = rateLimit3({
  windowMs: 60 * 1e3,
  max: 10,
  message: { message: "Too many subscription requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === "development";
  }
});
async function registerRoutes(app2) {
  app2.post("/csp-report", (req, res) => {
    console.log("[CSP Violation]", JSON.stringify(req.body, null, 2));
    res.status(204).end();
  });
  app2.use("/auth", routes_default);
  app2.get("/api/balance", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const balance = await storage.getBalance(userId);
      res.json(balance || { xnrtBalance: "0", stakingBalance: "0", miningBalance: "0", referralBalance: "0", totalEarned: "0" });
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });
  app2.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const stakes2 = await storage.getStakes(userId);
      const miningSessions2 = await storage.getMiningHistory(userId);
      const referrals2 = await storage.getReferralsByReferrer(userId);
      const recentActivity = await storage.getActivities(userId, 5);
      res.json({
        activeStakes: stakes2.filter((s) => s.status === "active").length,
        miningSessions: miningSessions2.filter((s) => s.status === "completed").length,
        totalReferrals: referrals2.length,
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
      const stakes2 = await storage.getStakes(userId);
      res.json(stakes2);
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
        return res.status(400).json({ message: `Stake amount must be between ${tierConfig.minAmount} and ${tierConfig.maxAmount} XNRT` });
      }
      const balance = await storage.getBalance(userId);
      if (!balance || parseFloat(balance.xnrtBalance) < stakeAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      const startDate = /* @__PURE__ */ new Date();
      const endDate = new Date(startDate.getTime() + tierConfig.duration * 24 * 60 * 60 * 1e3);
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
  app2.post("/api/stakes/process-rewards", requireAuth, validateCSRF, async (req, res) => {
    try {
      await storage.processStakingRewards();
      res.json({ success: true, message: "Staking rewards processed successfully" });
    } catch (error) {
      console.error("Error processing staking rewards:", error);
      res.status(500).json({ message: "Failed to process staking rewards" });
    }
  });
  app2.post("/api/stakes/:id/withdraw", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const stakeId = req.params.id;
      const stake = await storage.getStakeById(stakeId);
      if (!stake) {
        return res.status(404).json({ message: "Stake not found" });
      }
      if (stake.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      if (stake.status !== "completed" && stake.status !== "active") {
        return res.status(400).json({ message: "Stake has already been withdrawn or is not ready for withdrawal" });
      }
      if (new Date(stake.endDate) > /* @__PURE__ */ new Date()) {
        return res.status(400).json({ message: "Stake has not matured yet" });
      }
      const dailyRate = parseFloat(stake.dailyRate) / 100;
      const startDate = new Date(stake.startDate);
      const endDate = new Date(stake.endDate);
      const totalDurationDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1e3 * 60 * 60 * 24));
      const stakeAmount = parseFloat(stake.amount);
      const dailyProfit = stakeAmount * dailyRate;
      const totalProfit = dailyProfit * totalDurationDays;
      const withdrawnStake = await storage.atomicWithdrawStake(stakeId, totalProfit.toString());
      if (!withdrawnStake) {
        return res.status(409).json({ message: "Stake has already been withdrawn" });
      }
      const balance = await storage.getBalance(userId);
      if (!balance) {
        return res.status(404).json({ message: "Balance not found" });
      }
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
  });
  app2.get("/api/mining/current", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const session = await storage.getCurrentMiningSession(userId);
      if (!session) {
        const history = await storage.getMiningHistory(userId);
        const lastSession = history[0];
        if (!lastSession) {
          return res.json({ nextAvailable: /* @__PURE__ */ new Date() });
        }
        res.json({ nextAvailable: lastSession.nextAvailable });
      } else {
        res.json(session);
      }
    } catch (error) {
      console.error("Error fetching mining session:", error);
      res.status(500).json({ message: "Failed to fetch mining session" });
    }
  });
  app2.get("/api/mining/history", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const sessions2 = await storage.getMiningHistory(userId);
      res.json(sessions2);
    } catch (error) {
      console.error("Error fetching mining history:", error);
      res.status(500).json({ message: "Failed to fetch mining history" });
    }
  });
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
        baseReward: 10,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: 10,
        startTime,
        endTime,
        nextAvailable: /* @__PURE__ */ new Date(),
        // Set to now so user can restart immediately after completion
        status: "active"
      });
      res.json(session);
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });
  app2.post("/api/mining/process-rewards", requireAuth, validateCSRF, async (req, res) => {
    try {
      await storage.processMiningRewards();
      res.json({ success: true, message: "Mining rewards processed successfully" });
    } catch (error) {
      console.error("Error processing mining rewards:", error);
      res.status(500).json({ message: "Failed to process mining rewards" });
    }
  });
  app2.post("/api/mining/stop", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const session = await storage.getCurrentMiningSession(userId);
      if (!session || session.status !== "active") {
        return res.status(400).json({ message: "No active mining session" });
      }
      await storage.updateMiningSession(session.id, {
        status: "completed",
        endTime: /* @__PURE__ */ new Date()
      });
      const xpReward = session.finalReward;
      const xnrtReward = session.finalReward * 0.5;
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUser(userId, {
          xp: (user.xp || 0) + xpReward
        });
      }
      const balance = await storage.getBalance(userId);
      if (balance) {
        await storage.updateBalance(userId, {
          miningBalance: (parseFloat(balance.miningBalance) + xnrtReward).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + xnrtReward).toString()
        });
      }
      await storage.createActivity({
        userId,
        type: "mining_completed",
        description: `Completed mining session and earned ${xpReward} XP and ${xnrtReward.toFixed(1)} XNRT`
      });
      void notifyUser(userId, {
        type: "mining_completed",
        title: "\u26CF\uFE0F Mining Complete!",
        message: `You earned ${xpReward} XP and ${xnrtReward.toFixed(1)} XNRT from your mining session`,
        url: "/mining",
        metadata: {
          xpReward,
          xnrtReward: xnrtReward.toString(),
          sessionId: session.id
        }
      }).catch((err) => {
        console.error("Error sending mining notification (non-blocking):", err);
      });
      await storage.checkAndUnlockAchievements(userId);
      res.json({ xpReward, xnrtReward });
    } catch (error) {
      console.error("Error stopping mining:", error);
      res.status(500).json({ message: "Failed to stop mining" });
    }
  });
  app2.get("/api/referrals/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const referrals2 = await storage.getReferralsByReferrer(userId);
      const balance = await storage.getBalance(userId);
      const level1Total = referrals2.filter((r) => r.level === 1).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level2Total = referrals2.filter((r) => r.level === 2).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const level3Total = referrals2.filter((r) => r.level === 3).reduce((sum, r) => sum + parseFloat(r.totalCommission), 0);
      const directCommissions = level1Total + level2Total + level3Total;
      const actualBalance = parseFloat(balance?.referralBalance || "0");
      const companyCommissions = actualBalance - directCommissions;
      const stats = {
        level1Count: referrals2.filter((r) => r.level === 1).length,
        level2Count: referrals2.filter((r) => r.level === 2).length,
        level3Count: referrals2.filter((r) => r.level === 3).length,
        level1Commission: level1Total.toString(),
        level2Commission: level2Total.toString(),
        level3Commission: level3Total.toString(),
        totalCommission: referrals2.reduce((sum, r) => sum + parseFloat(r.totalCommission), 0).toString(),
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
      const referrals2 = await storage.getReferralsByReferrer(userId);
      res.json(referrals2);
    } catch (error) {
      console.error("Error fetching referral tree:", error);
      res.status(500).json({ message: "Failed to fetch referral tree" });
    }
  });
  app2.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const limit = req.query.limit ? parseInt(req.query.limit) : 20;
      const notifications2 = await storage.getNotifications(userId, limit);
      res.json(notifications2);
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
      const userNotifications = await storage.getNotifications(userId, 1e3);
      const notification = userNotifications.find((n) => n.id === id);
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
  app2.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });
  app2.get("/api/push/vapid-public-key", async (req, res) => {
    try {
      res.json({ publicKey: VAPID_PUBLIC_KEY2 });
    } catch (error) {
      console.error("Error getting VAPID public key:", error);
      res.status(500).json({ message: "Failed to get VAPID public key" });
    }
  });
  app2.post("/api/push/subscribe", requireAuth, pushSubscriptionLimiter, validateCSRF, async (req, res) => {
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
  });
  app2.delete("/api/push/unsubscribe", requireAuth, pushSubscriptionLimiter, validateCSRF, async (req, res) => {
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
  });
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
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
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
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
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
      const userPosition = leaderboard.findIndex((item) => item.userId === currentUserId);
      res.json({
        leaderboard: leaderboard.map((item, index2) => {
          const baseData = {
            totalReferrals: parseInt(item.totalReferrals),
            totalCommission: item.totalCommission.toString(),
            level1Count: parseInt(item.level1Count),
            level2Count: parseInt(item.level2Count),
            level3Count: parseInt(item.level3Count),
            rank: index2 + 1
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
        }),
        userPosition: userPosition === -1 && userStats.length > 0 ? (() => {
          const baseData = {
            totalReferrals: parseInt(userStats[0].totalReferrals),
            totalCommission: userStats[0].totalCommission.toString(),
            level1Count: parseInt(userStats[0].level1Count),
            level2Count: parseInt(userStats[0].level2Count),
            level3Count: parseInt(userStats[0].level3Count),
            rank: userPosition + 1
          };
          if (isAdmin) {
            return {
              ...baseData,
              userId: userStats[0].userId,
              username: userStats[0].username,
              email: userStats[0].email,
              displayName: userStats[0].username || userStats[0].email
            };
          } else {
            return {
              ...baseData,
              displayName: "You"
            };
          }
        })() : null
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
      const result = await storage.getXPLeaderboard(currentUserId, period, category, isAdmin);
      res.json(result);
    } catch (error) {
      console.error("Error fetching XP leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch XP leaderboard" });
    }
  });
  app2.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const transactions2 = await storage.getTransactionsByUser(userId);
      res.json(transactions2);
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
      const withdrawals = await storage.getTransactionsByUser(userId, "withdrawal");
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
      const nonce = nanoid5(16);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
      const issuedAt = /* @__PURE__ */ new Date();
      await prisma5.walletNonce.upsert({
        where: { userId_address: { userId, address } },
        update: { nonce, expiresAt, issuedAt },
        create: { userId, address, nonce, expiresAt, issuedAt }
      });
      const message = `XNRT Wallet Link

Address: ${address}
Nonce: ${nonce}
Issued: ${issuedAt.toISOString()}`;
      res.json({ message, nonce, issuedAt: issuedAt.toISOString() });
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).json({ message: "Failed to generate challenge" });
    }
  });
  app2.post("/api/wallet/link/confirm", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const { address, signature, nonce, issuedAt } = req.body;
      const normalized = String(address || "").toLowerCase();
      if (!address || !signature || !nonce || !issuedAt) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const rec = await prisma5.walletNonce.findUnique({
        where: { userId_address: { userId, address: normalized } }
      });
      if (!rec || rec.nonce !== nonce || rec.expiresAt < /* @__PURE__ */ new Date()) {
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
            nonce
          }
        })
      ]);
      res.json({ address: normalized });
    } catch (error) {
      console.error("Error linking wallet:", error);
      res.status(500).json({ message: "Failed to link wallet" });
    }
  });
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
          data: {
            depositAddress: address,
            derivationIndex: nextIndex
          }
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
  app2.post("/api/wallet/report-deposit", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      let { transactionHash, amount, description } = req.body;
      if (!transactionHash || !amount) {
        return res.status(400).json({ message: "Transaction hash and amount required" });
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
      const { verifyBscUsdtDeposit: verifyBscUsdtDeposit2 } = await Promise.resolve().then(() => (init_verifyBscUsdt(), verifyBscUsdt_exports));
      const treasuryAddress = process.env.XNRT_WALLET || "";
      const verification = await verifyBscUsdtDeposit2({
        txHash: transactionHash,
        expectedTo: treasuryAddress,
        minAmount: amount,
        requiredConf: Number(process.env.BSC_CONFIRMATIONS || 12)
      });
      if (!verification.verified) {
        const report = await prisma5.depositReport.create({
          data: {
            userId,
            fromAddress: "",
            txHash: transactionHash,
            amount: new Prisma3.Decimal(amount),
            notes: description || `Verification: ${verification.reason}`,
            status: "open"
          }
        });
        return res.json({
          message: "Report submitted for admin review",
          reportId: report.id,
          reason: verification.reason
        });
      }
      const provider3 = new (await import("ethers")).ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
      const receipt = await provider3.getTransactionReceipt(transactionHash);
      const transaction = await provider3.getTransaction(transactionHash);
      const fromAddress = transaction?.from?.toLowerCase() || "";
      const linkedWallet = await prisma5.linkedWallet.findFirst({
        where: {
          userId,
          address: fromAddress,
          active: true
        }
      });
      const xnrtRate = Number(process.env.XNRT_RATE_USDT || 100);
      const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || 0);
      const usdtAmount = verification.amountOnChain || amount;
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
        console.log(`[ReportDeposit] Auto-credited ${xnrtAmount} XNRT to user ${userId}`);
        const { sendDepositNotification: sendDepositNotification2 } = await Promise.resolve().then(() => (init_depositScanner(), depositScanner_exports));
        void sendDepositNotification2(userId, xnrtAmount, transactionHash).catch((err) => {
          console.error("[ReportDeposit] Notification error:", err);
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
            blockNumber: receipt?.blockNumber || 0,
            confirmations: verification.confirmations,
            reportedByUserId: userId,
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
  });
  app2.post("/api/transactions/deposit", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      let { usdtAmount, transactionHash, proofImageUrl } = req.body;
      if (!usdtAmount || !transactionHash) {
        return res.status(400).json({ message: "Missing required fields" });
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
      const rate = Number(process.env.XNRT_RATE_USDT ?? 100);
      const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 0);
      const usdt2 = Number(usdtAmount);
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
  });
  app2.post("/api/transactions/withdrawal", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const { source, amount, walletAddress } = req.body;
      if (!source || !amount || !walletAddress) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const withdrawAmount = parseFloat(amount);
      const fee = withdrawAmount * 2 / 100;
      const netAmount = withdrawAmount - fee;
      const usdtAmount = netAmount / 100;
      const balance = await storage.getBalance(userId);
      let availableBalance = 0;
      switch (source) {
        case "main":
          availableBalance = parseFloat(balance?.xnrtBalance || "0");
          break;
        case "staking":
          availableBalance = parseFloat(balance?.stakingBalance || "0");
          break;
        case "mining":
          availableBalance = parseFloat(balance?.miningBalance || "0");
          break;
        case "referral":
          availableBalance = parseFloat(balance?.referralBalance || "0");
          break;
        default:
          return res.status(400).json({ message: "Invalid source" });
      }
      if (withdrawAmount > availableBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      if (source === "referral" && withdrawAmount < 5e3) {
        return res.status(400).json({ message: "Minimum withdrawal from referral balance is 5,000 XNRT" });
      }
      if (source === "mining" && withdrawAmount < 5e3) {
        return res.status(400).json({ message: "Minimum withdrawal from mining balance is 5,000 XNRT" });
      }
      const transaction = await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount: amount.toString(),
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
  });
  app2.get("/api/tasks/user", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const userTasks2 = await storage.getUserTasks(userId);
      const allTasks = await storage.getAllTasks();
      const populated = await Promise.all(
        userTasks2.map(async (ut) => {
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
  app2.post("/api/tasks/:taskId/complete", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const { taskId } = req.params;
      const userTasks2 = await storage.getUserTasks(userId);
      const userTask = userTasks2.find((ut) => ut.taskId === taskId);
      if (!userTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (userTask.completed) {
        return res.status(400).json({ message: "Task already completed" });
      }
      const allTasks = await storage.getAllTasks();
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
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
      res.json({ xpReward: task.xpReward, xnrtReward: task.xnrtReward });
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });
  app2.get("/api/achievements", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const allAchievements = await storage.getAllAchievements();
      const userAchievements2 = await storage.getUserAchievements(userId);
      const populated = allAchievements.map((achievement) => {
        const unlocked = userAchievements2.find((ua) => ua.achievementId === achievement.id);
        return {
          ...achievement,
          unlocked: !!unlocked,
          unlockedAt: unlocked?.unlockedAt
        };
      });
      res.json(populated);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });
  app2.get("/api/profile/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const stakes2 = await storage.getStakes(userId);
      const miningSessions2 = await storage.getMiningHistory(userId);
      const referrals2 = await storage.getReferralsByReferrer(userId);
      const userTasks2 = await storage.getUserTasks(userId);
      const userAchievements2 = await storage.getUserAchievements(userId);
      res.json({
        totalReferrals: referrals2.length,
        activeStakes: stakes2.filter((s) => s.status === "active").length,
        totalStaked: stakes2.reduce((sum, s) => sum + parseFloat(s.amount), 0),
        miningSessions: miningSessions2.filter((s) => s.status === "completed").length,
        totalMined: miningSessions2.reduce((sum, s) => sum + s.finalReward, 0),
        referralEarnings: referrals2.reduce((sum, r) => sum + parseFloat(r.totalCommission), 0),
        tasksCompleted: userTasks2.filter((t) => t.completed).length,
        achievementsUnlocked: userAchievements2.length
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
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStart = today.toISOString();
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
      const lastCheckInDay = lastCheckIn ? new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate()) : null;
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
      const targetYear = year ? parseInt(year) : (/* @__PURE__ */ new Date()).getFullYear();
      const targetMonth = month ? parseInt(month) : (/* @__PURE__ */ new Date()).getMonth();
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
      const checkinActivities = await prisma5.activity.findMany({
        where: {
          userId,
          type: "daily_checkin",
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      });
      const checkinDates = checkinActivities.map(
        (activity) => new Date(activity.createdAt).toISOString().split("T")[0]
      );
      res.json({
        dates: checkinDates,
        year: targetYear,
        month: targetMonth
      });
    } catch (error) {
      console.error("Error fetching check-in history:", error);
      res.status(500).json({ message: "Failed to fetch check-in history" });
    }
  });
  app2.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allDeposits = await storage.getAllTransactions("deposit");
      const allWithdrawals = await storage.getAllTransactions("withdrawal");
      const activeStakes = await storage.getAllActiveStakes();
      const pendingDeposits = allDeposits.filter((d) => d.status === "pending");
      const pendingWithdrawals = allWithdrawals.filter((w) => w.status === "pending");
      const totalDeposits = allDeposits.filter((d) => d.status === "approved").reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const totalWithdrawals = allWithdrawals.filter((w) => w.status === "approved").reduce((sum, w) => sum + parseFloat(w.amount), 0);
      const today = /* @__PURE__ */ new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayDeposits = allDeposits.filter((d) => d.status === "approved" && d.createdAt && new Date(d.createdAt) >= today).reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const todayWithdrawals = allWithdrawals.filter((w) => w.status === "approved" && w.createdAt && new Date(w.createdAt) >= today).reduce((sum, w) => sum + parseFloat(w.amount), 0);
      const todayNewUsers = allUsers.filter((u) => u.createdAt && new Date(u.createdAt) >= today).length;
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
  app2.get("/api/admin/deposits/pending", requireAuth, requireAdmin, async (req, res) => {
    try {
      const pendingDeposits = await storage.getPendingTransactions("deposit");
      res.json(pendingDeposits);
    } catch (error) {
      console.error("Error fetching pending deposits:", error);
      res.status(500).json({ message: "Failed to fetch pending deposits" });
    }
  });
  app2.get("/api/admin/withdrawals/pending", requireAuth, requireAdmin, async (req, res) => {
    try {
      const pendingWithdrawals = await storage.getPendingTransactions("withdrawal");
      res.json(pendingWithdrawals);
    } catch (error) {
      console.error("Error fetching pending withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch pending withdrawals" });
    }
  });
  app2.post("/api/admin/deposits/:id/verify", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
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
        requiredConf: Number(process.env.BSC_CONFIRMATIONS ?? 12)
      });
      await storage.updateTransaction(id, {
        verified: result.verified,
        confirmations: result.confirmations,
        verificationData: result
      });
      res.json(result);
    } catch (error) {
      console.error("Error verifying deposit:", error);
      res.status(500).json({ message: "Failed to verify deposit" });
    }
  });
  app2.post("/api/admin/deposits/:id/approve", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const deposit = await storage.getTransactionById(id);
      if (!deposit || deposit.type !== "deposit") {
        return res.status(404).json({ message: "Deposit not found" });
      }
      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Deposit already processed" });
      }
      if (!deposit.verified) {
        return res.status(400).json({ message: "Deposit not verified on-chain yet" });
      }
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
            adminNotes: notes || deposit.adminNotes,
            approvedBy: req.authUser.id,
            approvedAt: /* @__PURE__ */ new Date()
          }
        });
      });
      await storage.distributeReferralCommissions(deposit.userId, parseFloat(deposit.amount));
      await storage.createActivity({
        userId: deposit.userId,
        type: "deposit_approved",
        description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT approved`
      });
      void notifyUser(deposit.userId, {
        type: "deposit_approved",
        title: "\u{1F4B0} Deposit Approved!",
        message: `Your deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT has been approved and credited to your account`,
        url: "/wallet",
        metadata: {
          amount: deposit.amount,
          transactionId: id
        }
      }).catch((err) => {
        console.error("Error sending deposit notification (non-blocking):", err);
      });
      res.json({ message: "Deposit approved successfully" });
    } catch (error) {
      console.error("Error approving deposit:", error);
      res.status(500).json({ message: "Failed to approve deposit" });
    }
  });
  app2.post("/api/admin/deposits/:id/reject", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const deposit = await storage.getTransactionById(id);
      if (!deposit || deposit.type !== "deposit") {
        return res.status(404).json({ message: "Deposit not found" });
      }
      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Deposit already processed" });
      }
      await storage.updateTransaction(id, { status: "rejected" });
      await storage.createActivity({
        userId: deposit.userId,
        type: "deposit_rejected",
        description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT rejected`
      });
      res.json({ message: "Deposit rejected" });
    } catch (error) {
      console.error("Error rejecting deposit:", error);
      res.status(500).json({ message: "Failed to reject deposit" });
    }
  });
  app2.post("/api/admin/deposits/bulk-approve", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
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
          if (deposit.status !== "pending") {
            throw new Error(`Deposit ${id} already processed`);
          }
          if (!deposit.verified) {
            throw new Error(`Deposit ${id} not verified on-chain yet`);
          }
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
                adminNotes: notes || deposit.adminNotes,
                approvedBy: req.authUser.id,
                approvedAt: /* @__PURE__ */ new Date()
              }
            });
          });
          await storage.distributeReferralCommissions(deposit.userId, parseFloat(deposit.amount));
          await storage.createActivity({
            userId: deposit.userId,
            type: "deposit_approved",
            description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT approved${notes ? ` - ${notes}` : ""}`
          });
          void notifyUser(deposit.userId, {
            type: "deposit_approved",
            title: "\u{1F4B0} Deposit Approved!",
            message: `Your deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT has been approved and credited to your account`,
            url: "/wallet",
            metadata: {
              amount: deposit.amount,
              transactionId: id
            }
          }).catch((err) => {
            console.error("Error sending bulk deposit notification (non-blocking):", err);
          });
          successful.push(id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          failed.push({
            id,
            error: errorMessage
          });
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
  });
  app2.post("/api/admin/deposits/bulk-reject", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
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
          if (deposit.status !== "pending") {
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
            description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT rejected${notes ? ` - ${notes}` : ""}`
          });
          successful.push(id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          failed.push({
            id,
            error: errorMessage
          });
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
  });
  app2.get("/api/admin/unmatched-deposits", requireAuth, requireAdmin, async (req, res) => {
    try {
      const unmatched = await prisma5.unmatchedDeposit.findMany({
        where: { matched: false },
        orderBy: { detectedAt: "desc" },
        take: 100
      });
      res.json(unmatched);
    } catch (error) {
      console.error("Error fetching unmatched deposits:", error);
      res.status(500).json({ message: "Failed to fetch unmatched deposits" });
    }
  });
  app2.post("/api/admin/unmatched-deposits/:id/match", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
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
      if (unmatchedDeposit.matched) {
        return res.status(400).json({ message: "Deposit already matched" });
      }
      const usdtAmount = parseFloat(unmatchedDeposit.amount.toString());
      const xnrtRate = Number(process.env.XNRT_RATE_USDT || 100);
      const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || 0);
      const netUsdt = usdtAmount * (1 - platformFeeBps / 1e4);
      const xnrtAmount = netUsdt * xnrtRate;
      await prisma5.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            userId,
            type: "deposit",
            amount: new Prisma3.Decimal(xnrtAmount),
            usdtAmount: new Prisma3.Decimal(usdtAmount),
            transactionHash: unmatchedDeposit.transactionHash,
            walletAddress: unmatchedDeposit.fromAddress,
            status: "approved",
            verified: true,
            confirmations: unmatchedDeposit.confirmations,
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
          data: {
            matched: true,
            matchedUserId: userId,
            matchedAt: /* @__PURE__ */ new Date()
          }
        });
      });
      res.json({ message: "Deposit matched and credited successfully" });
    } catch (error) {
      console.error("Error matching deposit:", error);
      res.status(500).json({ message: "Failed to match deposit" });
    }
  });
  app2.get("/api/admin/deposit-reports", requireAuth, requireAdmin, async (req, res) => {
    try {
      const reports = await prisma5.depositReport.findMany({
        where: { status: "pending" },
        include: {
          user: {
            select: { email: true, username: true }
          }
        },
        orderBy: { reportedAt: "desc" },
        take: 100
      });
      res.json(reports);
    } catch (error) {
      console.error("Error fetching deposit reports:", error);
      res.status(500).json({ message: "Failed to fetch deposit reports" });
    }
  });
  app2.post("/api/admin/deposit-reports/:id/resolve", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
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
        const xnrtRate = Number(process.env.XNRT_RATE_USDT || 100);
        const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || 0);
        const usdtAmount = parseFloat(report.amount.toString());
        const netUsdt = usdtAmount * (1 - platformFeeBps / 1e4);
        const xnrtAmount = netUsdt * xnrtRate;
        await prisma5.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              userId: report.userId,
              type: "deposit",
              amount: new Prisma3.Decimal(xnrtAmount),
              usdtAmount: new Prisma3.Decimal(usdtAmount),
              transactionHash: report.transactionHash,
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
              xnrtBalance: { increment: new Prisma3.Decimal(xnrtAmount) },
              totalEarned: { increment: new Prisma3.Decimal(xnrtAmount) }
            }
          });
          await tx.depositReport.update({
            where: { id },
            data: {
              status: "approved",
              resolvedBy: req.authUser.id,
              resolvedAt: /* @__PURE__ */ new Date(),
              adminNotes: adminNotes || null
            }
          });
        });
      } else {
        await prisma5.depositReport.update({
          where: { id },
          data: {
            status: "rejected",
            resolvedBy: req.authUser.id,
            resolvedAt: /* @__PURE__ */ new Date(),
            adminNotes: adminNotes || null
          }
        });
      }
      res.json({ message: `Report ${resolution} successfully` });
    } catch (error) {
      console.error("Error resolving deposit report:", error);
      res.status(500).json({ message: "Failed to resolve report" });
    }
  });
  app2.post("/api/admin/reconcile-referrals", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      console.log("[RECONCILE] Starting referral commission reconciliation...");
      const approvedDeposits = await storage.raw(`
        SELECT id, "userId", amount, "createdAt"
        FROM "Transaction"
        WHERE type = 'deposit' AND status = 'approved'
        ORDER BY "createdAt" ASC
      `);
      console.log(`[RECONCILE] Found ${approvedDeposits.length} approved deposits to process`);
      await storage.raw(`DELETE FROM "Referral"`);
      console.log("[RECONCILE] Cleared existing referral records");
      await storage.raw(`UPDATE "Balance" SET "referralBalance" = 0`);
      console.log("[RECONCILE] Reset all referral balances");
      let totalProcessed = 0;
      for (const deposit of approvedDeposits) {
        const amount = parseFloat(deposit.amount);
        console.log(`[RECONCILE] Processing deposit ${deposit.id}: ${amount} XNRT for user ${deposit.userId}`);
        await storage.distributeReferralCommissions(deposit.userId, amount);
        totalProcessed++;
      }
      console.log(`[RECONCILE] Reconciliation complete. Processed ${totalProcessed} deposits.`);
      res.json({
        message: "Referral commissions reconciled successfully",
        depositsProcessed: totalProcessed
      });
    } catch (error) {
      console.error("Error reconciling referrals:", error);
      res.status(500).json({ message: "Failed to reconcile referrals" });
    }
  });
  app2.post("/api/admin/withdrawals/:id/approve", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const withdrawal = await storage.getTransactionById(id);
      if (!withdrawal || withdrawal.type !== "withdrawal") {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      if (withdrawal.status !== "pending") {
        return res.status(400).json({ message: "Withdrawal already processed" });
      }
      await storage.updateTransaction(id, { status: "approved" });
      const balance = await storage.getBalance(withdrawal.userId);
      if (balance) {
        let sourceBalance;
        switch (withdrawal.source) {
          case "main":
            sourceBalance = "xnrtBalance";
            break;
          case "staking":
            sourceBalance = "stakingBalance";
            break;
          case "mining":
            sourceBalance = "miningBalance";
            break;
          case "referral":
            sourceBalance = "referralBalance";
            break;
          default:
            sourceBalance = "xnrtBalance";
        }
        await storage.updateBalance(withdrawal.userId, {
          [sourceBalance]: (parseFloat(balance[sourceBalance]) - parseFloat(withdrawal.amount)).toString()
        });
      }
      await storage.createActivity({
        userId: withdrawal.userId,
        type: "withdrawal_approved",
        description: `Withdrawal of ${parseFloat(withdrawal.amount).toLocaleString()} XNRT approved`
      });
      res.json({ message: "Withdrawal approved successfully" });
    } catch (error) {
      console.error("Error approving withdrawal:", error);
      res.status(500).json({ message: "Failed to approve withdrawal" });
    }
  });
  app2.post("/api/admin/withdrawals/:id/reject", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
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
        description: `Withdrawal of ${parseFloat(withdrawal.amount).toLocaleString()} XNRT rejected`
      });
      res.json({ message: "Withdrawal rejected" });
    } catch (error) {
      console.error("Error rejecting withdrawal:", error);
      res.status(500).json({ message: "Failed to reject withdrawal" });
    }
  });
  app2.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithData = await Promise.all(
        allUsers.map(async (user) => {
          const balance = await storage.getBalance(user.id);
          const stakes2 = await storage.getStakes(user.id);
          const referrals2 = await storage.getReferralsByReferrer(user.id);
          const transactions2 = await storage.getTransactionsByUser(user.id);
          const activeStakes = stakes2.filter((s) => s.status === "active").length;
          const totalStaked = stakes2.filter((s) => s.status === "active").reduce((sum, s) => sum + parseFloat(s.amount), 0);
          const depositCount = transactions2.filter((t) => t.type === "deposit" && t.status === "approved").length;
          const withdrawalCount = transactions2.filter((t) => t.type === "withdrawal" && t.status === "approved").length;
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
              referralsCount: referrals2.length,
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
  });
  app2.get("/api/admin/analytics", requireAuth, requireAdmin, async (req, res) => {
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
              dailyData[dateKey] = { deposits: 0, withdrawals: 0, revenue: 0 };
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
        // Aggregate all user balances in one query
        prisma5.balance.aggregate({
          _sum: {
            referralBalance: true
          }
        }),
        // Get referral counts
        prisma5.referral.groupBy({
          by: ["referrerId"],
          _count: true
        })
      ]);
      const totalReferralBalance = balancesAgg._sum.referralBalance || 0;
      const activeReferrers = referralsAgg.length;
      const totalReferrals = referralsAgg.reduce((sum, r) => sum + r._count, 0);
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
        userGrowth: Object.entries(dailyUsers).map(([date, count]) => ({
          date,
          newUsers: count
        })).sort((a, b) => a.date.localeCompare(b.date)),
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
  });
  app2.get("/api/admin/activities", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const adminUsers = await prisma5.user.findMany({
        where: { isAdmin: true },
        select: { id: true }
      });
      const adminUserIds = adminUsers.map((u) => u.id);
      const activities2 = await prisma5.activity.findMany({
        where: {
          OR: [
            { userId: { in: adminUserIds } },
            { type: { in: ["deposit_approved", "deposit_rejected", "withdrawal_approved", "withdrawal_rejected"] } }
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
      res.json(activities2);
    } catch (error) {
      console.error("Error fetching admin activities:", error);
      res.status(500).json({ message: "Failed to fetch admin activities" });
    }
  });
  app2.get("/api/admin/info", requireAuth, requireAdmin, async (req, res) => {
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
        { name: "Royal Sapphire", min: 1e3, max: 9999, apy: 5, duration: 30 },
        { name: "Legendary Emerald", min: 1e4, max: 49999, apy: 8, duration: 60 },
        { name: "Imperial Platinum", min: 5e4, max: 99999, apy: 12, duration: 90 },
        { name: "Mythic Diamond", min: 1e5, max: null, apy: 15, duration: 180 }
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
          companyWallet: "0x715C32deC9534d2fB34e0B567288AF8d895efB59"
        }
      });
    } catch (error) {
      console.error("Error fetching platform info:", error);
      res.status(500).json({ message: "Failed to fetch platform info" });
    }
  });
  app2.get("/api/admin/stakes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stakes2 = await prisma5.stake.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      res.json(stakes2);
    } catch (error) {
      console.error("Error fetching stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });
  app2.post("/api/admin/stakes", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { userId, tier, amount, duration } = req.body;
      if (!userId || !tier || !amount || !duration) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const dailyRates = {
        "royal_sapphire": 1.1,
        "legendary_emerald": 1.4,
        "imperial_platinum": 1.5,
        "mythic_diamond": 2
      };
      const dailyRate = dailyRates[tier] || 1.1;
      const endDate = /* @__PURE__ */ new Date();
      endDate.setDate(endDate.getDate() + parseInt(duration));
      const stake = await prisma5.stake.create({
        data: {
          userId,
          tier,
          amount: new Prisma3.Decimal(amount),
          dailyRate: new Prisma3.Decimal(dailyRate),
          duration: parseInt(duration),
          startDate: /* @__PURE__ */ new Date(),
          endDate,
          totalProfit: new Prisma3.Decimal(0),
          status: "active"
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_stake_created",
        description: `Admin created stake for ${stake.user.username}: ${amount} XNRT (${tier}, ${duration} days)`
      });
      res.json(stake);
    } catch (error) {
      console.error("Error creating stake:", error);
      res.status(500).json({ message: "Failed to create stake" });
    }
  });
  app2.put("/api/admin/stakes/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, totalProfit } = req.body;
      const data = {};
      if (status !== void 0) data.status = status;
      if (totalProfit !== void 0) {
        const parsed = typeof totalProfit === "string" ? parseFloat(totalProfit) : totalProfit;
        data.totalProfit = new Prisma3.Decimal(parsed);
      }
      const stake = await prisma5.stake.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_stake_updated",
        description: `Admin updated stake for ${stake.user.username}`
      });
      res.json(stake);
    } catch (error) {
      console.error("Error updating stake:", error);
      res.status(500).json({ message: "Failed to update stake" });
    }
  });
  app2.delete("/api/admin/stakes/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const stake = await prisma5.stake.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              username: true
            }
          }
        }
      });
      if (!stake) {
        return res.status(404).json({ message: "Stake not found" });
      }
      await prisma5.stake.delete({
        where: { id }
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_stake_deleted",
        description: `Admin deleted stake for ${stake.user.username}`
      });
      res.json({ message: "Stake deleted successfully" });
    } catch (error) {
      console.error("Error deleting stake:", error);
      res.status(500).json({ message: "Failed to delete stake" });
    }
  });
  app2.get("/api/admin/tasks", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tasks2 = await prisma5.task.findMany({
        orderBy: { createdAt: "desc" }
      });
      const tasksWithStats = await Promise.all(
        tasks2.map(async (task) => {
          const completionCount = await prisma5.userTask.count({
            where: {
              taskId: task.id,
              completed: true
            }
          });
          return {
            ...task,
            completionCount
          };
        })
      );
      res.json(tasksWithStats);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });
  app2.post("/api/admin/tasks", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { title, description, xpReward, xnrtReward, category, requirements, isActive } = req.body;
      if (!title || !description || xpReward === void 0 || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const parsedXpReward = typeof xpReward === "string" ? parseInt(xpReward, 10) : xpReward;
      const parsedXnrtReward = xnrtReward ? typeof xnrtReward === "string" ? parseFloat(xnrtReward) : xnrtReward : 0;
      const task = await prisma5.task.create({
        data: {
          title,
          description,
          xpReward: parsedXpReward,
          xnrtReward: new Prisma3.Decimal(parsedXnrtReward),
          category,
          requirements: requirements || null,
          isActive: isActive !== void 0 ? isActive : true
        }
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_task_created",
        description: `Admin created task: ${title}`
      });
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });
  app2.put("/api/admin/tasks/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, xpReward, xnrtReward, category, requirements, isActive } = req.body;
      const data = {};
      if (title !== void 0) data.title = title;
      if (description !== void 0) data.description = description;
      if (xpReward !== void 0) {
        data.xpReward = typeof xpReward === "string" ? parseInt(xpReward, 10) : xpReward;
      }
      if (xnrtReward !== void 0) {
        const parsed = typeof xnrtReward === "string" ? parseFloat(xnrtReward) : xnrtReward;
        data.xnrtReward = new Prisma3.Decimal(parsed);
      }
      if (category !== void 0) data.category = category;
      if (requirements !== void 0) data.requirements = requirements;
      if (isActive !== void 0) data.isActive = isActive;
      const task = await prisma5.task.update({
        where: { id },
        data
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_task_updated",
        description: `Admin updated task: ${task.title}`
      });
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });
  app2.patch("/api/admin/tasks/:id/toggle", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const task = await prisma5.task.findUnique({ where: { id } });
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      const updatedTask = await prisma5.task.update({
        where: { id },
        data: { isActive: !task.isActive }
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_task_toggled",
        description: `Admin ${updatedTask.isActive ? "activated" : "deactivated"} task: ${updatedTask.title}`
      });
      res.json(updatedTask);
    } catch (error) {
      console.error("Error toggling task:", error);
      res.status(500).json({ message: "Failed to toggle task" });
    }
  });
  app2.delete("/api/admin/tasks/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const task = await prisma5.task.findUnique({ where: { id } });
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      await prisma5.userTask.deleteMany({ where: { taskId: id } });
      await prisma5.task.delete({ where: { id } });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_task_deleted",
        description: `Admin deleted task: ${task.title}`
      });
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });
  app2.get("/api/admin/achievements", requireAuth, requireAdmin, async (req, res) => {
    try {
      const achievements2 = await prisma5.achievement.findMany({
        orderBy: { createdAt: "desc" }
      });
      const achievementsWithStats = await Promise.all(
        achievements2.map(async (achievement) => {
          const unlockCount = await prisma5.userAchievement.count({
            where: { achievementId: achievement.id }
          });
          return {
            ...achievement,
            unlockCount
          };
        })
      );
      res.json(achievementsWithStats);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });
  app2.post("/api/admin/achievements", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { title, description, icon, category, requirement, xpReward } = req.body;
      if (!title || !description || !icon || !category || requirement === void 0 || xpReward === void 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const parsedRequirement = typeof requirement === "string" ? parseInt(requirement, 10) : requirement;
      const parsedXpReward = typeof xpReward === "string" ? parseInt(xpReward, 10) : xpReward;
      const achievement = await prisma5.achievement.create({
        data: {
          title,
          description,
          icon,
          category,
          requirement: parsedRequirement,
          xpReward: parsedXpReward
        }
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_achievement_created",
        description: `Admin created achievement: ${title}`
      });
      res.json(achievement);
    } catch (error) {
      console.error("Error creating achievement:", error);
      res.status(500).json({ message: "Failed to create achievement" });
    }
  });
  app2.put("/api/admin/achievements/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, icon, category, requirement, xpReward } = req.body;
      const data = {};
      if (title !== void 0) data.title = title;
      if (description !== void 0) data.description = description;
      if (icon !== void 0) data.icon = icon;
      if (category !== void 0) data.category = category;
      if (requirement !== void 0) {
        data.requirement = typeof requirement === "string" ? parseInt(requirement, 10) : requirement;
      }
      if (xpReward !== void 0) {
        data.xpReward = typeof xpReward === "string" ? parseInt(xpReward, 10) : xpReward;
      }
      const achievement = await prisma5.achievement.update({
        where: { id },
        data
      });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_achievement_updated",
        description: `Admin updated achievement: ${achievement.title}`
      });
      res.json(achievement);
    } catch (error) {
      console.error("Error updating achievement:", error);
      res.status(500).json({ message: "Failed to update achievement" });
    }
  });
  app2.delete("/api/admin/achievements/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const achievement = await prisma5.achievement.findUnique({ where: { id } });
      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }
      await prisma5.userAchievement.deleteMany({ where: { achievementId: id } });
      await prisma5.achievement.delete({ where: { id } });
      await storage.createActivity({
        userId: req.authUser.id,
        type: "admin_achievement_deleted",
        description: `Admin deleted achievement: ${achievement.title}`
      });
      res.json({ message: "Achievement deleted successfully" });
    } catch (error) {
      console.error("Error deleting achievement:", error);
      res.status(500).json({ message: "Failed to delete achievement" });
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
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html"
      },
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "favicon-16x16.png",
        "favicon-32x32.png"
      ],
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
        orientation: "portrait-primary",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-256.png", sizes: "256x256", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
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
    }),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    commonjsOptions: {
      include: [/recharts/, /d3-/, /node_modules/]
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom"))
            return "vendor-react";
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/lucide-react") || id.includes("node_modules/framer-motion"))
            return "vendor-ui";
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-"))
            return "vendor-charts";
          if (id.includes("node_modules")) return "vendor-libs";
          if (id.includes("/pages/admin/")) return "admin";
          if (id.includes("/pages/staking") || id.includes("/pages/mining"))
            return "earning";
          if (id.includes("/pages/referrals") || id.includes("/pages/leaderboard"))
            return "social";
          if (id.includes("/pages/deposit") || id.includes("/pages/withdrawal"))
            return "transactions";
        },
        inlineDynamicImports: false,
        compact: false,
        minifyInternalExports: false
      }
    },
    // ✅ safer minifier to avoid Recharts scope issues
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 2,
        pure_funcs: ["console.log"]
      },
      mangle: false
    },
    target: "esnext",
    chunkSizeWarningLimit: 600
  },
  // ✅ ensure Recharts pre-bundles correctly and global scope exists
  optimizeDeps: {
    include: ["recharts"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      }
    }
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid as nanoid6 } from "nanoid";
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
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
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
        `src="/src/main.tsx?v=${nanoid6()}"`
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
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
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
app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'"],
      reportUri: ["/csp-report"]
    },
    reportOnly: true
    // Start with report-only mode
  },
  crossOriginEmbedderPolicy: false
  // Disabled - not needed and could break third-party resources
}));
var CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5000";
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use(cookieParser());
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
    startRetryWorker();
    startDepositScanner();
  });
  process.on("SIGTERM", () => {
    log("SIGTERM received, shutting down gracefully");
    stopRetryWorker();
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });
  });
  process.on("SIGINT", () => {
    log("SIGINT received, shutting down gracefully");
    stopRetryWorker();
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });
  });
})();
