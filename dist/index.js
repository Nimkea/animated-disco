// server/index.ts
import express2 from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { PrismaClient, Prisma } from "@prisma/client";
var prisma = new PrismaClient();
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
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
var DatabaseStorage = class {
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
        await this.checkAndUnlockAchievements(stake.userId);
      }
      if (now >= endDate) {
        await this.updateStake(stake.id, {
          status: "completed"
        });
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
      await this.createNotification({
        userId: referrer.id,
        type: "referral_commission",
        title: "\u{1F4B0} Commission Earned!",
        message: `You earned ${commission.toFixed(2)} XNRT commission from a level ${level} referral`,
        metadata: {
          amount: commission.toString(),
          level,
          referredUserId: userId
        }
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
  // Raw query support
  async raw(query, params = []) {
    return await prisma.$queryRawUnsafe(query, ...params);
  }
};
var storage = new DatabaseStorage();

// server/auth/middleware.ts
import { PrismaClient as PrismaClient2 } from "@prisma/client";

// server/auth/jwt.ts
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
var JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
var JWT_EXPIRES_IN = "7d";
function signToken(payload) {
  const jwtId = nanoid();
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
import { nanoid as nanoid2 } from "nanoid";
function generateCSRFToken() {
  return nanoid2(32);
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
  legacyHeaders: false
});

// server/auth/routes.ts
import { Router } from "express";
import { z } from "zod";
import { PrismaClient as PrismaClient3 } from "@prisma/client";

// server/auth/password.ts
import bcrypt from "bcrypt";
import crypto from "crypto";
var SALT_ROUNDS = 12;
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

// server/auth/routes.ts
import rateLimit2 from "express-rate-limit";
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
var forgotPasswordRateLimiter = rateLimit2({
  windowMs: 15 * 60 * 1e3,
  max: 3,
  message: "Too many password reset attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false
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
    const userReferralCode = `REF${data.username.substring(0, 4).toUpperCase()}${Date.now().toString().slice(-4)}`;
    let referredBy = null;
    if (data.referralCode) {
      const referrer = await prisma3.user.findUnique({
        where: { referralCode: data.referralCode }
      });
      if (referrer) {
        referredBy = referrer.id;
      }
    }
    const user = await prisma3.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        referralCode: userReferralCode,
        referredBy
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
    res.cookie("sid", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    });
    res.status(201).json({
      message: "User registered successfully",
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
    res.cookie("sid", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
  res.cookie("csrfToken", csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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
    console.log("Password reset requested for user:", { userId: user.id, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
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
  boolean
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
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
  updatedAt: timestamp("updated_at").defaultNow()
});
var balances = pgTable("balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  xnrtBalance: decimal("xnrt_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  stakingBalance: decimal("staking_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  miningBalance: decimal("mining_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  referralBalance: decimal("referral_balance", { precision: 18, scale: 2 }).default("0").notNull(),
  totalEarned: decimal("total_earned", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var stakes = pgTable("stakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tier: varchar("tier").notNull(),
  // royal_sapphire, legendary_emerald, imperial_platinum, mythic_diamond
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  dailyRate: decimal("daily_rate", { precision: 5, scale: 3 }).notNull(),
  // 1.1, 1.4, 1.5, 2.0
  duration: integer("duration").notNull(),
  // 15, 30, 45, 90 days
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  totalProfit: decimal("total_profit", { precision: 18, scale: 2 }).default("0").notNull(),
  lastProfitDate: timestamp("last_profit_date"),
  status: varchar("status").default("active").notNull(),
  // active, completed, withdrawn
  createdAt: timestamp("created_at").defaultNow()
});
var miningSessions = pgTable("mining_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  baseReward: integer("base_reward").default(10).notNull(),
  adBoostCount: integer("ad_boost_count").default(0).notNull(),
  boostPercentage: integer("boost_percentage").default(0).notNull(),
  finalReward: integer("final_reward").default(10).notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  nextAvailable: timestamp("next_available").notNull(),
  status: varchar("status").default("active").notNull(),
  // active, completed
  createdAt: timestamp("created_at").defaultNow()
});
var referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull().references(() => users.id),
  referredUserId: varchar("referred_user_id").notNull().references(() => users.id),
  level: integer("level").notNull(),
  // 1, 2, 3
  totalCommission: decimal("total_commission", { precision: 18, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(),
  // deposit, withdrawal
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  usdtAmount: decimal("usdt_amount", { precision: 18, scale: 2 }),
  source: varchar("source"),
  // For withdrawals: main, referral
  walletAddress: varchar("wallet_address"),
  transactionHash: varchar("transaction_hash"),
  proofImageUrl: varchar("proof_image_url"),
  status: varchar("status").default("pending").notNull(),
  // pending, approved, rejected, paid
  adminNotes: text("admin_notes"),
  fee: decimal("fee", { precision: 18, scale: 2 }),
  netAmount: decimal("net_amount", { precision: 18, scale: 2 }),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow()
});
var tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull(),
  xnrtReward: decimal("xnrt_reward", { precision: 18, scale: 2 }).default("0").notNull(),
  category: varchar("category").notNull(),
  // daily, weekly, special
  requirements: text("requirements"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var userTasks = pgTable("user_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  progress: integer("progress").default(0).notNull(),
  maxProgress: integer("max_progress").default(1).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow()
});
var achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon").notNull(),
  category: varchar("category").notNull(),
  // earnings, referrals, streaks, mining
  requirement: integer("requirement").notNull(),
  xpReward: integer("xp_reward").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementId: varchar("achievement_id").notNull().references(() => achievements.id),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull()
});
var activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(),
  // stake_created, mining_completed, referral_earned, task_completed, etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("activities_user_id_idx").on(table.userId),
  index("activities_created_at_idx").on(table.createdAt)
]);
var notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(),
  // referral_commission, new_referral, achievement_unlocked, etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
  index("notifications_created_at_idx").on(table.createdAt)
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
  notifications: many(notifications)
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
import { PrismaClient as PrismaClient4 } from "@prisma/client";
var prisma4 = new PrismaClient4();
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
      const history = await storage.getMiningHistory(userId);
      const lastSession = history[0];
      if (lastSession && new Date(lastSession.nextAvailable) > /* @__PURE__ */ new Date()) {
        return res.status(400).json({ message: "Please wait 24 hours between mining sessions" });
      }
      const startTime = /* @__PURE__ */ new Date();
      const endTime = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      const nextAvailable = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      const session = await storage.createMiningSession({
        userId,
        baseReward: 10,
        adBoostCount: 0,
        boostPercentage: 0,
        finalReward: 10,
        startTime,
        endTime,
        nextAvailable,
        status: "active"
      });
      res.json(session);
    } catch (error) {
      console.error("Error starting mining:", error);
      res.status(500).json({ message: "Failed to start mining" });
    }
  });
  app2.post("/api/mining/watch-ad", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const session = await storage.getCurrentMiningSession(userId);
      if (!session || session.status !== "active") {
        return res.status(400).json({ message: "No active mining session" });
      }
      if (session.adBoostCount >= 5) {
        return res.status(400).json({ message: "Maximum ad boosts reached" });
      }
      const newAdBoostCount = session.adBoostCount + 1;
      const newBoostPercentage = newAdBoostCount * 10;
      const newFinalReward = session.baseReward + Math.floor(session.baseReward * newBoostPercentage / 100);
      await storage.updateMiningSession(session.id, {
        adBoostCount: newAdBoostCount,
        boostPercentage: newBoostPercentage,
        finalReward: newFinalReward
      });
      res.json({ success: true, boost: newBoostPercentage });
    } catch (error) {
      console.error("Error watching ad:", error);
      res.status(500).json({ message: "Failed to watch ad" });
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
  app2.get("/api/leaderboard/referrals", requireAuth, async (req, res) => {
    try {
      const period = req.query.period || "all-time";
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const currentUserId = req.authUser.id;
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
        leaderboard: leaderboard.map((item, index2) => ({
          ...item,
          totalReferrals: parseInt(item.totalReferrals),
          totalCommission: item.totalCommission.toString(),
          level1Count: parseInt(item.level1Count),
          level2Count: parseInt(item.level2Count),
          level3Count: parseInt(item.level3Count),
          rank: index2 + 1
        })),
        userPosition: userPosition === -1 && userStats.length > 0 ? {
          ...userStats[0],
          totalReferrals: parseInt(userStats[0].totalReferrals),
          totalCommission: userStats[0].totalCommission.toString(),
          level1Count: parseInt(userStats[0].level1Count),
          level2Count: parseInt(userStats[0].level2Count),
          level3Count: parseInt(userStats[0].level3Count),
          rank: userPosition + 1
        } : null
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
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
  app2.post("/api/transactions/deposit", requireAuth, validateCSRF, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const { usdtAmount, transactionHash } = req.body;
      if (!usdtAmount || !transactionHash) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const xnrtAmount = parseFloat(usdtAmount) * 100;
      const transaction = await storage.createTransaction({
        userId,
        type: "deposit",
        amount: xnrtAmount.toString(),
        usdtAmount: usdtAmount.toString(),
        transactionHash,
        status: "pending"
      });
      res.json(transaction);
    } catch (error) {
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
      const availableBalance = source === "main" ? parseFloat(balance?.xnrtBalance || "0") : parseFloat(balance?.referralBalance || "0");
      if (withdrawAmount > availableBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      if (source === "referral" && withdrawAmount < 5e3) {
        return res.status(400).json({ message: "Minimum withdrawal from referral balance is 5000 XNRT" });
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
  app2.post("/api/admin/deposits/:id/approve", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const deposit = await storage.getTransactionById(id);
      if (!deposit || deposit.type !== "deposit") {
        return res.status(404).json({ message: "Deposit not found" });
      }
      if (deposit.status !== "pending") {
        return res.status(400).json({ message: "Deposit already processed" });
      }
      await storage.updateTransaction(id, { status: "approved" });
      const balance = await storage.getBalance(deposit.userId);
      if (balance) {
        await storage.updateBalance(deposit.userId, {
          xnrtBalance: (parseFloat(balance.xnrtBalance) + parseFloat(deposit.amount)).toString(),
          totalEarned: (parseFloat(balance.totalEarned) + parseFloat(deposit.amount)).toString()
        });
      }
      await storage.distributeReferralCommissions(deposit.userId, parseFloat(deposit.amount));
      await storage.createActivity({
        userId: deposit.userId,
        type: "deposit_approved",
        description: `Deposit of ${parseFloat(deposit.amount).toLocaleString()} XNRT approved`
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
        const sourceBalance = withdrawal.source === "main" ? "xnrtBalance" : "referralBalance";
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
        prisma4.balance.aggregate({
          _sum: {
            referralBalance: true
          }
        }),
        // Get referral counts
        prisma4.referral.groupBy({
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
      const adminUsers = await prisma4.user.findMany({
        where: { isAdmin: true },
        select: { id: true }
      });
      const adminUserIds = adminUsers.map((u) => u.id);
      const activities2 = await prisma4.activity.findMany({
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
        prisma4.user.count(),
        prisma4.transaction.count({ where: { type: "deposit" } }),
        prisma4.transaction.count({ where: { type: "withdrawal" } }),
        prisma4.stake.count(),
        prisma4.activity.count()
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
        orientation: "portrait-primary",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
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
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid as nanoid3 } from "nanoid";
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
        `src="/src/main.tsx?v=${nanoid3()}"`
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

// server/index.ts
var app = express2();
app.set("trust proxy", true);
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
  });
})();
