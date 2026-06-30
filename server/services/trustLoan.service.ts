import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";

export type TrustLoanProgramConfig = {
  id: string;
  enabled: boolean;
  programKey: string;
  title: string;
  description: string;
  terms: string;
  amountXnrt: number;
  dailyRate: number;
  durationDays: number;
  requiredReferrals: number;
  requiredInvestingReferrals: number;
  minInvestUsdtPerReferral: number;
  updatedBy?: string | null;
  updatedAt?: Date | string | null;
};

export const TRUST_LOAN_CONFIG = {
  id: "default",
  enabled: true,
  programKey: "trust_loan",
  title: "Trust Loan",
  description:
    "Unlock a virtual staking principal after building an active referral network. Principal is not withdrawable; only generated profit can be withdrawn after maturity.",
  terms:
    "Trust Loan is an in-app simulated platform reward program. Eligibility, reward rates, and duration may change. Virtual principal is not a cash deposit and is not withdrawable.",
  durationDays: 30,
  amountXnrt: 10000,
  dailyRate: 1.3,
  requiredReferrals: 3,
  requiredInvestingReferrals: 2,
  minInvestUsdtPerReferral: 100,
} as const;

function numberOrFallback(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeConfig(row: any | null | undefined): TrustLoanProgramConfig {
  return {
    id: String(row?.id || TRUST_LOAN_CONFIG.id),
    enabled: Boolean(row?.enabled ?? TRUST_LOAN_CONFIG.enabled),
    programKey: String(row?.programKey || TRUST_LOAN_CONFIG.programKey),
    title: String(row?.title || TRUST_LOAN_CONFIG.title),
    description: String(row?.description || TRUST_LOAN_CONFIG.description),
    terms: String(row?.terms || TRUST_LOAN_CONFIG.terms),
    amountXnrt: numberOrFallback(row?.amountXnrt, TRUST_LOAN_CONFIG.amountXnrt),
    dailyRate: numberOrFallback(row?.dailyRate, TRUST_LOAN_CONFIG.dailyRate),
    durationDays: numberOrFallback(row?.durationDays, TRUST_LOAN_CONFIG.durationDays),
    requiredReferrals: numberOrFallback(row?.requiredReferrals, TRUST_LOAN_CONFIG.requiredReferrals),
    requiredInvestingReferrals: numberOrFallback(
      row?.requiredInvestingReferrals,
      TRUST_LOAN_CONFIG.requiredInvestingReferrals,
    ),
    minInvestUsdtPerReferral: numberOrFallback(
      row?.minInvestUsdtPerReferral,
      TRUST_LOAN_CONFIG.minInvestUsdtPerReferral,
    ),
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}


function isMissingTrustLoanConfigTable(error: unknown) {
  const code = (error as { code?: string })?.code;
  const message = String((error as Error)?.message ?? "").toLowerCase();
  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("trustloanconfig") ||
    message.includes("trust_loan_config") ||
    message.includes("does not exist")
  );
}

function defaultTrustLoanConfig(): TrustLoanProgramConfig {
  return normalizeConfig(TRUST_LOAN_CONFIG);
}

function createDefaultConfigData(updatedBy?: string | null) {
  return {
    id: TRUST_LOAN_CONFIG.id,
    enabled: TRUST_LOAN_CONFIG.enabled,
    programKey: TRUST_LOAN_CONFIG.programKey,
    title: TRUST_LOAN_CONFIG.title,
    description: TRUST_LOAN_CONFIG.description,
    terms: TRUST_LOAN_CONFIG.terms,
    amountXnrt: new Prisma.Decimal(TRUST_LOAN_CONFIG.amountXnrt),
    dailyRate: new Prisma.Decimal(TRUST_LOAN_CONFIG.dailyRate),
    durationDays: TRUST_LOAN_CONFIG.durationDays,
    requiredReferrals: TRUST_LOAN_CONFIG.requiredReferrals,
    requiredInvestingReferrals: TRUST_LOAN_CONFIG.requiredInvestingReferrals,
    minInvestUsdtPerReferral: new Prisma.Decimal(TRUST_LOAN_CONFIG.minInvestUsdtPerReferral),
    updatedBy: updatedBy ?? null,
  };
}

export async function getTrustLoanConfig() {
  const model = (prisma as any).trustLoanConfig;

  if (!model?.findUnique || !model?.create) {
    console.warn(
      "[trust-loan/config] Prisma client does not expose TrustLoanConfig yet. Using default config. Run `pnpm prisma generate` after applying the Trust Loan schema patch.",
    );
    return defaultTrustLoanConfig();
  }

  try {
    const existing = await model.findUnique({
      where: { id: TRUST_LOAN_CONFIG.id },
    });
    if (existing) return normalizeConfig(existing);

    const created = await model.create({
      data: createDefaultConfigData(),
    });
    return normalizeConfig(created);
  } catch (error) {
    if (isMissingTrustLoanConfigTable(error)) {
      console.warn(
        "[trust-loan/config] TrustLoanConfig table is not available yet. Using default config. Run `pnpm db:push && pnpm prisma generate` to enable admin config persistence.",
      );
      return defaultTrustLoanConfig();
    }
    throw error;
  }
}


export function getDefaultTrustLoanStatus() {
  const config = defaultTrustLoanConfig();
  const projectedProfit = (config.amountXnrt * config.dailyRate * config.durationDays) / 100;

  return {
    hasLoanStake: false,
    stake: null,
    directCount: 0,
    investingCount: 0,
    requiredReferrals: config.requiredReferrals,
    requiredInvestingReferrals: config.requiredInvestingReferrals,
    minInvestUsdtPerReferral: String(config.minInvestUsdtPerReferral),
    eligible: false,
    program: config.programKey,
    amountXnrt: config.amountXnrt,
    dailyRate: config.dailyRate,
    durationDays: config.durationDays,
    projectedProfit,
    config,
    fallback: true,
  };
}

export async function updateTrustLoanConfig(
  input: Partial<{
    enabled: boolean;
    title: string;
    description: string;
    terms: string;
    amountXnrt: number;
    dailyRate: number;
    durationDays: number;
    requiredReferrals: number;
    requiredInvestingReferrals: number;
    minInvestUsdtPerReferral: number;
  }>,
  updatedBy?: string | null,
) {
  const data: Record<string, unknown> = { updatedBy: updatedBy ?? null };

  if (typeof input.enabled === "boolean") data.enabled = input.enabled;
  if (input.title !== undefined) data.title = String(input.title).trim();
  if (input.description !== undefined) data.description = String(input.description).trim();
  if (input.terms !== undefined) data.terms = String(input.terms).trim();
  if (input.amountXnrt !== undefined) data.amountXnrt = new Prisma.Decimal(String(input.amountXnrt));
  if (input.dailyRate !== undefined) data.dailyRate = new Prisma.Decimal(String(input.dailyRate));
  if (input.durationDays !== undefined) data.durationDays = Math.round(Number(input.durationDays));
  if (input.requiredReferrals !== undefined) data.requiredReferrals = Math.round(Number(input.requiredReferrals));
  if (input.requiredInvestingReferrals !== undefined) {
    data.requiredInvestingReferrals = Math.round(Number(input.requiredInvestingReferrals));
  }
  if (input.minInvestUsdtPerReferral !== undefined) {
    data.minInvestUsdtPerReferral = new Prisma.Decimal(String(input.minInvestUsdtPerReferral));
  }

  const updated = await prisma.trustLoanConfig.upsert({
    where: { id: TRUST_LOAN_CONFIG.id },
    create: { ...createDefaultConfigData(updatedBy), ...data } as any,
    update: data as any,
  });

  return normalizeConfig(updated);
}

export async function getDirectReferralStats(
  userId: string,
  config?: Pick<TrustLoanProgramConfig, "minInvestUsdtPerReferral">,
) {
  const activeConfig = config ?? (await getTrustLoanConfig());

  const directs = await prisma.referral.findMany({
    where: { referrerId: userId, level: 1 },
    select: { referredUserId: true },
  });
  const directCount = directs.length;
  if (!directCount) return { directCount: 0, investingCount: 0 };

  const ids = directs.map((d) => d.referredUserId);
  const investingRows = await prisma.transaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: ids },
      type: "deposit",
      status: "approved",
      usdtAmount: {
        gte: new Prisma.Decimal(activeConfig.minInvestUsdtPerReferral),
      },
    },
    _count: { _all: true },
  });

  return { directCount, investingCount: investingRows.length };
}

export async function getTrustLoanStatusForUser(userId: string) {
  const config = await getTrustLoanConfig();
  const [stakes, referralStats] = await Promise.all([
    prisma.stake.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getDirectReferralStats(userId, config),
  ]);

  const loan = stakes.find((stake) => stake.tier === config.programKey || stake.loanProgram === config.programKey) ?? null;
  const projectedProfit = (config.amountXnrt * config.dailyRate * config.durationDays) / 100;
  const eligible =
    config.enabled &&
    referralStats.directCount >= config.requiredReferrals &&
    referralStats.investingCount >= config.requiredInvestingReferrals;

  return {
    hasLoanStake: Boolean(loan),
    stake: loan,
    directCount: referralStats.directCount,
    investingCount: referralStats.investingCount,
    requiredReferrals: config.requiredReferrals,
    requiredInvestingReferrals: config.requiredInvestingReferrals,
    minInvestUsdtPerReferral: String(config.minInvestUsdtPerReferral),
    eligible,
    program: config.programKey,
    amountXnrt: config.amountXnrt,
    dailyRate: config.dailyRate,
    durationDays: config.durationDays,
    projectedProfit,
    config,
  };
}

export class TrustLoanServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TrustLoanServiceError";
    this.statusCode = statusCode;
  }
}

export async function claimTrustLoanForUser(userId: string) {
  const status = await getTrustLoanStatusForUser(userId);
  const config = status.config;

  if (!config.enabled) {
    throw new TrustLoanServiceError("Trust Loan program is currently disabled.", 403);
  }

  if (status.hasLoanStake) {
    throw new TrustLoanServiceError("Trust Loan already claimed.", 409);
  }

  if (!status.eligible) {
    throw new TrustLoanServiceError(
      `Trust Loan requires ${config.requiredReferrals} direct referrals and ${config.requiredInvestingReferrals} investing referrals.`,
      403,
    );
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + config.durationDays * 24 * 60 * 60 * 1000);

  const stake = await prisma.stake.create({
    data: {
      userId,
      tier: config.programKey,
      amount: new Prisma.Decimal(config.amountXnrt),
      duration: config.durationDays,
      dailyRate: new Prisma.Decimal(config.dailyRate),
      startDate: now,
      endDate,
      totalProfit: new Prisma.Decimal(0),
      lastProfitDate: null,
      status: "active",
      loanProgram: config.programKey,
      unlockMet: true,
      requiredReferrals: config.requiredReferrals,
      requiredInvestingReferrals: config.requiredInvestingReferrals,
      minInvestUsdtPerReferral: new Prisma.Decimal(config.minInvestUsdtPerReferral),
    },
  });

  await prisma.activity.create({
    data: {
      userId,
      type: "trust_loan_claimed",
      description: `Trust Loan claimed: virtual ${config.amountXnrt} XNRT principal for ${config.durationDays} days (profits only).`,
      metadata: JSON.stringify({
        source: "trust_loan",
        stakeId: stake.id,
        config: {
          amountXnrt: config.amountXnrt,
          dailyRate: config.dailyRate,
          durationDays: config.durationDays,
          requiredReferrals: config.requiredReferrals,
          requiredInvestingReferrals: config.requiredInvestingReferrals,
        },
      }),
    },
  });

  return { stake, status: await getTrustLoanStatusForUser(userId) };
}
