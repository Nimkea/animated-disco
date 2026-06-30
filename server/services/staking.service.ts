import { Prisma } from "@prisma/client";
import { STAKING_TIERS, type StakingTier } from "../../shared/schema";
import { prisma } from "../lib/db";
import { notifyUser } from "../notifications";
import { getDirectReferralStats, TRUST_LOAN_CONFIG } from "./trustLoan.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const STAKE_STATUSES = new Set(["active", "completed", "withdrawn"]);

export class StakingServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "StakingServiceError";
    this.statusCode = statusCode;
  }
}

function decimalToString(value: unknown) {
  if (value && typeof (value as any).toString === "function") return (value as any).toString();
  return String(value ?? "0");
}

function decimalToNumber(value: unknown) {
  const parsed = Number(decimalToString(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(8)) : 0;
}

function parseStakeAmount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function assertTier(tier: unknown): StakingTier {
  if (!tier || typeof tier !== "string" || !(tier in STAKING_TIERS)) {
    throw new StakingServiceError("Invalid staking tier", 400);
  }
  return tier as StakingTier;
}

function isTrustLoanStake(stake: { tier: string; loanProgram?: string | null }) {
  return stake.tier === TRUST_LOAN_CONFIG.programKey || stake.loanProgram === TRUST_LOAN_CONFIG.programKey;
}

export function serializeStake(stake: any) {
  const amount = decimalToNumber(stake.amount);
  const totalProfit = decimalToNumber(stake.totalProfit);
  const dailyRate = decimalToNumber(stake.dailyRate);
  const now = Date.now();
  const startTime = new Date(stake.startDate).getTime();
  const endTime = new Date(stake.endDate).getTime();
  const totalMs = Math.max(1, endTime - startTime);
  const elapsedMs = Math.max(0, Math.min(now - startTime, totalMs));
  const progressPercent = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  const daysLeft = Math.max(0, Math.ceil((endTime - now) / DAY_MS));
  const dailyProfit = amount * (dailyRate / 100);
  const projectedProfit = dailyProfit * Number(stake.duration || 0);
  const loan = isTrustLoanStake(stake);

  return {
    ...stake,
    amount: amount.toString(),
    dailyRate: dailyRate.toString(),
    totalProfit: totalProfit.toString(),
    minInvestUsdtPerReferral: stake.minInvestUsdtPerReferral
      ? decimalToString(stake.minInvestUsdtPerReferral)
      : stake.minInvestUsdtPerReferral,
    dailyProfit: money(dailyProfit).toString(),
    projectedProfit: money(projectedProfit).toString(),
    progressPercent: money(progressPercent),
    daysLeft,
    isMatured: now >= endTime,
    canWithdraw: (stake.status === "completed" || stake.status === "active") && now >= endTime,
    isLoan: loan,
    withdrawablePrincipal: loan ? "0" : amount.toString(),
    withdrawableAmount: money((loan ? 0 : amount) + totalProfit).toString(),
  };
}

async function settleStakeRewards(stakeId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const stake = await tx.stake.findUnique({ where: { id: stakeId } });
    if (!stake || stake.status !== "active") return { creditedProfit: 0, matured: false };

    const lastProfitDate = new Date(stake.lastProfitDate || stake.startDate);
    const endDate = new Date(stake.endDate);
    const effectiveUntil = now > endDate ? endDate : now;

    const creditedDays = Math.floor((effectiveUntil.getTime() - lastProfitDate.getTime()) / DAY_MS);
    let creditedProfit = 0;

    if (creditedDays > 0) {
      const stakeAmount = decimalToNumber(stake.amount);
      const dailyRate = decimalToNumber(stake.dailyRate) / 100;
      creditedProfit = stakeAmount * dailyRate * creditedDays;
      const newLastProfitDate = new Date(lastProfitDate.getTime() + creditedDays * DAY_MS);

      await tx.stake.update({
        where: { id: stake.id },
        data: {
          totalProfit: { increment: new Prisma.Decimal(creditedProfit.toString()) },
          lastProfitDate: newLastProfitDate > endDate ? endDate : newLastProfitDate,
        },
      });

      await tx.balance.upsert({
        where: { userId: stake.userId },
        create: {
          userId: stake.userId,
          xnrtBalance: new Prisma.Decimal(0),
          stakingBalance: new Prisma.Decimal(creditedProfit.toString()),
          miningBalance: new Prisma.Decimal(0),
          referralBalance: new Prisma.Decimal(0),
          totalEarned: new Prisma.Decimal(creditedProfit.toString()),
        },
        update: {
          stakingBalance: { increment: new Prisma.Decimal(creditedProfit.toString()) },
          totalEarned: { increment: new Prisma.Decimal(creditedProfit.toString()) },
        },
      });

      await tx.activity.create({
        data: {
          userId: stake.userId,
          type: "staking_reward",
          description: `Earned ${creditedProfit.toFixed(2)} XNRT from staking (${creditedDays} day${creditedDays > 1 ? "s" : ""})`,
          metadata: JSON.stringify({
            source: "staking",
            stakeId: stake.id,
            creditedDays,
            creditedProfit: creditedProfit.toString(),
          }),
        },
      });
    }

    const matured = now >= endDate;
    if (matured) {
      await tx.stake.update({ where: { id: stake.id }, data: { status: "completed" } });
    }

    return { creditedProfit, matured };
  });
}

export async function processStakingRewardsForUser(userId?: string) {
  const activeStakes = await prisma.stake.findMany({
    where: { status: "active", ...(userId ? { userId } : {}) },
    select: { id: true, userId: true },
  });

  let processedCount = 0;
  let maturedCount = 0;
  let totalProfitCredited = 0;
  const affectedUsers = new Set<string>();

  for (const stake of activeStakes) {
    const result = await settleStakeRewards(stake.id);
    if (result.creditedProfit > 0) {
      processedCount += 1;
      totalProfitCredited += result.creditedProfit;
      affectedUsers.add(stake.userId);
    }
    if (result.matured) maturedCount += 1;
  }

  for (const affectedUserId of Array.from(affectedUsers)) {
    void notifyUser(affectedUserId, {
      type: "staking_reward",
      title: "💎 Staking rewards updated",
      message: "Your staking rewards were credited to your staking balance.",
      url: "/staking",
      metadata: { totalProfitCredited: totalProfitCredited.toString() },
    }).catch((err) => console.error("Error sending staking notification:", err));
  }

  return {
    success: true,
    processedCount,
    maturedCount,
    totalProfitCredited: money(totalProfitCredited),
  };
}

export async function createStakeForUser(userId: string, input: { tier: unknown; amount: unknown }) {
  const tierKey = assertTier(input.tier);
  const amount = parseStakeAmount(input.amount);
  if (!amount) throw new StakingServiceError("Enter a valid stake amount", 400);

  const tier = STAKING_TIERS[tierKey];
  if (amount < tier.minAmount || amount > tier.maxAmount) {
    throw new StakingServiceError(
      `Stake amount must be between ${tier.minAmount.toLocaleString()} and ${tier.maxAmount.toLocaleString()} XNRT`,
      400
    );
  }

  const stake = await prisma.$transaction(async (tx) => {
    const balance = await tx.balance.findUnique({ where: { userId } });
    if (!balance || new Prisma.Decimal(balance.xnrtBalance).lessThan(amount)) {
      throw new StakingServiceError("Insufficient available XNRT balance", 400);
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + tier.duration * DAY_MS);
    const amountDecimal = new Prisma.Decimal(amount.toString());

    const created = await tx.stake.create({
      data: {
        userId,
        tier: tierKey,
        amount: amountDecimal,
        dailyRate: new Prisma.Decimal(tier.dailyRate.toString()),
        duration: tier.duration,
        startDate,
        endDate,
        totalProfit: new Prisma.Decimal(0),
        lastProfitDate: null,
        status: "active",
      },
    });

    await tx.balance.update({
      where: { userId },
      data: {
        xnrtBalance: { decrement: amountDecimal },
        stakingBalance: { increment: amountDecimal },
      },
    });

    await tx.activity.create({
      data: {
        userId,
        type: "stake_created",
        description: `Staked ${amount.toLocaleString()} XNRT in ${tier.name}`,
        metadata: JSON.stringify({ source: "staking", stakeId: created.id, tier: tierKey, amount }),
      },
    });

    return created;
  });

  return serializeStake(stake);
}

export async function withdrawStakeForUser(userId: string, stakeId: string) {
  await processStakingRewardsForUser(userId);

  const result = await prisma.$transaction(async (tx) => {
    const stake = await tx.stake.findUnique({ where: { id: stakeId } });
    if (!stake) throw new StakingServiceError("Stake not found", 404);
    if (stake.userId !== userId) throw new StakingServiceError("Unauthorized", 403);
    if (stake.status !== "active" && stake.status !== "completed") {
      throw new StakingServiceError("Stake has already been withdrawn", 400);
    }
    if (new Date(stake.endDate) > new Date()) {
      throw new StakingServiceError("Stake has not matured yet", 400);
    }

    const updateResult = await tx.stake.updateMany({
      where: { id: stake.id, userId, status: { in: ["active", "completed"] } },
      data: { status: "withdrawn" },
    });
    if (updateResult.count === 0) throw new StakingServiceError("Stake has already been withdrawn", 409);

    const principal = isTrustLoanStake(stake) ? 0 : decimalToNumber(stake.amount);
    const profit = decimalToNumber(stake.totalProfit);
    const totalAmount = principal + profit;
    const balance = await tx.balance.findUnique({ where: { userId } });
    if (!balance) throw new StakingServiceError("Balance not found", 404);

    const currentStakingBalance = new Prisma.Decimal(balance.stakingBalance);
    const amountToMove = new Prisma.Decimal(totalAmount.toString());
    const nextStakingBalance = currentStakingBalance.lessThan(amountToMove)
      ? new Prisma.Decimal(0)
      : currentStakingBalance.minus(amountToMove);

    await tx.balance.update({
      where: { userId },
      data: {
        xnrtBalance: { increment: amountToMove },
        stakingBalance: nextStakingBalance,
      },
    });

    await tx.activity.create({
      data: {
        userId,
        type: "stake_withdrawn",
        description: isTrustLoanStake(stake)
          ? `Withdrew ${profit.toLocaleString()} XNRT Trust Loan profit`
          : `Withdrew ${principal.toLocaleString()} XNRT principal + ${profit.toLocaleString()} XNRT profit from staking`,
        metadata: JSON.stringify({ source: "staking", stakeId: stake.id, principal, profit, totalAmount }),
      },
    });

    const updatedStake = await tx.stake.findUnique({ where: { id: stake.id } });
    return {
      stake: updatedStake,
      principal: money(principal),
      profit: money(profit),
      totalAmount: money(totalAmount),
    };
  });

  return {
    success: true,
    principal: result.principal,
    profit: result.profit,
    totalAmount: result.totalAmount,
    stake: result.stake ? serializeStake(result.stake) : null,
  };
}

export async function getStakesForUser(userId: string) {
  const stakes = await prisma.stake.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return stakes.map(serializeStake);
}

export async function getStakingSummaryForUser(userId: string) {
  const [stakes, balance, referralStats] = await Promise.all([
    prisma.stake.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.balance.findUnique({ where: { userId } }),
    getDirectReferralStats(userId),
  ]);

  const serializedStakes = stakes.map(serializeStake);
  const active = serializedStakes.filter((stake) => stake.status === "active");
  const completed = serializedStakes.filter((stake) => stake.status === "completed");
  const withdrawn = serializedStakes.filter((stake) => stake.status === "withdrawn");
  const open = serializedStakes.filter((stake) => stake.status === "active" || stake.status === "completed");
  const withdrawable = open.filter((stake) => stake.canWithdraw);

  const activePrincipal = open.reduce((sum, stake) => sum + Number(stake.withdrawablePrincipal || 0), 0);
  const accruedProfit = open.reduce((sum, stake) => sum + Number(stake.totalProfit || 0), 0);
  const projectedProfit = open.reduce((sum, stake) => sum + Number(stake.projectedProfit || 0), 0);
  const withdrawableAmount = withdrawable.reduce((sum, stake) => sum + Number(stake.withdrawableAmount || 0), 0);
  const nextMaturity = active
    .filter((stake) => new Date(stake.endDate).getTime() > Date.now())
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0];

  const tierStats = Object.entries(STAKING_TIERS).map(([key, tier]) => ({
    key,
    ...tier,
    estimatedTotalProfitAtMin: money((tier.minAmount * tier.dailyRate * tier.duration) / 100),
    riskLabel: "Platform reward tier",
  }));

  return {
    balance: {
      available: decimalToString(balance?.xnrtBalance),
      staking: decimalToString(balance?.stakingBalance),
      totalEarned: decimalToString(balance?.totalEarned),
    },
    totals: {
      activeCount: active.length,
      completedCount: completed.length,
      withdrawnCount: withdrawn.length,
      activePrincipal: money(activePrincipal).toString(),
      accruedProfit: money(accruedProfit).toString(),
      projectedProfit: money(projectedProfit).toString(),
      withdrawableAmount: money(withdrawableAmount).toString(),
      nextMaturityAt: nextMaturity?.endDate ?? null,
    },
    trustLoan: {
      directCount: referralStats.directCount,
      investingCount: referralStats.investingCount,
      requiredReferrals: TRUST_LOAN_CONFIG.requiredReferrals,
      requiredInvestingReferrals: TRUST_LOAN_CONFIG.requiredInvestingReferrals,
      amountXnrt: TRUST_LOAN_CONFIG.amountXnrt,
      durationDays: TRUST_LOAN_CONFIG.durationDays,
      eligible:
        referralStats.directCount >= TRUST_LOAN_CONFIG.requiredReferrals &&
        referralStats.investingCount >= TRUST_LOAN_CONFIG.requiredInvestingReferrals,
    },
    tiers: tierStats,
    stakes: serializedStakes,
    disclaimer:
      "Staking rewards are simulated in-app platform rewards. They are not guaranteed external yield, investment advice, or a promise of profit.",
  };
}

export function validateAdminStakeStatus(status: unknown) {
  return typeof status === "string" && STAKE_STATUSES.has(status);
}
