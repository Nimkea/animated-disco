import type {
  Activity,
  Balance,
  Notification,
  PushSubscription,
  Referral,
  Stake,
  Task,
  Transaction,
  User,
  UserTask,
} from "@shared/schema";

export function decimalToString(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return value.toString();
}

export function convertPrismaUser(user: any): User {
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

export function convertPrismaBalance(balance: any): Balance {
  return {
    ...balance,
    xnrtBalance: decimalToString(balance.xnrtBalance),
    stakingBalance: decimalToString(balance.stakingBalance),
    miningBalance: decimalToString(balance.miningBalance),
    referralBalance: decimalToString(balance.referralBalance),
    totalEarned: decimalToString(balance.totalEarned),
  } as Balance;
}


export function convertPrismaStake(stake: any): Stake {
  return {
    ...stake,
    amount: decimalToString(stake.amount),
    dailyRate: decimalToString(stake.dailyRate),
    totalProfit: decimalToString(stake.totalProfit),
    lastProfitDate: stake.lastProfitDate || undefined,
    isLoan: !!(stake.loanProgram && stake.loanProgram.startsWith("trust_")),
    loanProgram: stake.loanProgram || undefined,
    unlockMet: stake.unlockMet,
    requiredReferrals: stake.requiredReferrals,
    requiredInvestingReferrals: stake.requiredInvestingReferrals,
    minInvestUsdtPerReferral: decimalToString(stake.minInvestUsdtPerReferral),
  } as Stake;
}

export function convertPrismaReferral(referral: any): Referral {
  return {
    ...referral,
    totalCommission: decimalToString(referral.totalCommission),
  } as Referral;
}

export function convertPrismaTask(task: any): Task {
  return {
    ...task,
    xnrtReward: decimalToString(task.xnrtReward),
    requirements: task.requirements || undefined,
  } as Task;
}

export function convertPrismaUserTask(userTask: any): UserTask {
  return {
    ...userTask,
    completedAt: userTask.completedAt || undefined,
  } as UserTask;
}

export function convertPrismaTransaction(transaction: any): Transaction {
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

export function convertPrismaActivity(activity: any): Activity {
  return {
    ...activity,
    metadata: activity.metadata || undefined,
  } as Activity;
}

export function convertPrismaNotification(notification: any): Notification {
  let metadata = notification.metadata;

  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      // Keep raw string metadata when it is not valid JSON.
    }
  }

  return {
    ...notification,
    metadata: metadata ?? undefined,
  } as Notification;
}

export function convertPrismaPushSubscription(subscription: any): PushSubscription {
  return {
    ...subscription,
    expirationTime: subscription.expirationTime || undefined,
  } as PushSubscription;
}
