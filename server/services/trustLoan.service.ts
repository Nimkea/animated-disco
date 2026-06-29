import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";

export const TRUST_LOAN_CONFIG = {
  programKey: "trust_loan",
  durationDays: 30,
  amountXnrt: 10000,
  requiredReferrals: 3,
  requiredInvestingReferrals: 2,
  minInvestUsdtPerReferral: 100,
} as const;

export async function getDirectReferralStats(userId: string) {
  // Count L1 referrals
  const directs = await prisma.referral.findMany({
    where: { referrerId: userId, level: 1 },
    select: { referredUserId: true },
  });
  const directCount = directs.length;
  if (!directCount) return { directCount: 0, investingCount: 0 };

  // Of those L1 referrals, count how many have >= min USDT approved deposits
  const ids = directs.map((d) => d.referredUserId);
  const investingRows = await prisma.transaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: ids },
      type: "deposit",
      status: "approved",
      usdtAmount: {
        gte: new Prisma.Decimal(TRUST_LOAN_CONFIG.minInvestUsdtPerReferral),
      },
    },
    _count: { _all: true },
  });
  const investingCount = investingRows.length;

  return { directCount, investingCount };
}
