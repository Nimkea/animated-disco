import { prisma } from "../lib/db";
import { generateAnonymizedHandle, storage } from "../storage";

export async function getReferralStatsForUser(userId: string) {
  const balance = await storage.getBalance(userId);

  const referralGroups = await prisma.referral.groupBy({
    by: ["level"],
    where: { referrerId: userId },
    _count: { _all: true },
  });

  const commissionGroups = await prisma.referralCommission.groupBy({
    by: ["level"],
    where: { referrerId: userId, status: "paid" },
    _sum: { commission: true },
  });

  const getCount = (level: number) =>
    referralGroups.find((row) => row.level === level)?._count?._all || 0;
  const getCommission = (level: number) =>
    commissionGroups.find((row) => row.level === level)?._sum?.commission?.toString() || "0";

  const level1Total = parseFloat(getCommission(1));
  const level2Total = parseFloat(getCommission(2));
  const level3Total = parseFloat(getCommission(3));
  const paidNetworkCommission = level1Total + level2Total + level3Total;
  const actualBalance = parseFloat(balance?.referralBalance || "0");

  return {
    level1Count: getCount(1),
    level2Count: getCount(2),
    level3Count: getCount(3),
    level1Commission: level1Total.toString(),
    level2Commission: level2Total.toString(),
    level3Commission: level3Total.toString(),
    totalCommission: paidNetworkCommission.toString(),
    paidNetworkCommission: paidNetworkCommission.toString(),
    actualBalance: actualBalance.toString(),
    companyCommissions: Math.max(0, actualBalance - paidNetworkCommission).toString(),
    ledgerBacked: true,
  };
}

export async function getReferralTreeForUser(userId: string) {
  const currentUser = await storage.getUser(userId);
  const isAdmin = currentUser?.isAdmin || false;

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    include: {
      referredUser: {
        select: { id: true, username: true, email: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const referredIds = referrals.map((referral) => referral.referredUserId);
  const depositGroups = referredIds.length
    ? await prisma.transaction.groupBy({
        by: ["userId"],
        where: {
          userId: { in: referredIds },
          type: "deposit",
          status: "approved",
        },
        _sum: { amount: true },
        _count: { _all: true },
      })
    : [];

  const depositsByUser = new Map<string, { count: number; total: string }>(
    depositGroups.map((row) => [
      row.userId,
      {
        count: row._count?._all || 0,
        total: row._sum?.amount?.toString() || "0",
      },
    ])
  );

  return referrals.map((referral) => {
    const deposit = depositsByUser.get(referral.referredUserId);
    return {
      id: referral.id,
      referrerId: referral.referrerId,
      referredUserId: referral.referredUserId,
      level: referral.level,
      totalCommission: referral.totalCommission.toString(),
      createdAt: referral.createdAt,
      displayName: isAdmin
        ? referral.referredUser.username || referral.referredUser.email || "Unknown user"
        : generateAnonymizedHandle(referral.referredUserId),
      joinedAt: referral.referredUser.createdAt,
      hasDeposited: (deposit?.count || 0) > 0,
      depositCount: deposit?.count || 0,
      totalDeposited: deposit?.total || "0",
    };
  });
}

export async function getReferralCommissionHistoryForUser(userId: string, requestedLimit: unknown) {
  const limit = Math.min(Math.max(parseInt(String(requestedLimit || "25"), 10) || 25, 1), 100);

  const commissions = await prisma.referralCommission.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const referredIds = Array.from(new Set(commissions.map((item) => item.referredUserId)));
  const referredUsers = referredIds.length
    ? await prisma.user.findMany({
        where: { id: { in: referredIds } },
        select: { id: true, username: true, email: true },
      })
    : [];
  const usersById = new Map<string, { id: string; username: string | null; email: string | null }>(
    referredUsers.map((user) => [user.id, user])
  );

  return commissions.map((item) => {
    const referredUser = usersById.get(item.referredUserId);
    return {
      id: item.id,
      transactionId: item.transactionId,
      referrerId: item.referrerId,
      referredUserId: item.referredUserId,
      level: item.level,
      baseAmount: item.baseAmount.toString(),
      rate: item.rate.toString(),
      commission: item.commission.toString(),
      status: item.status,
      createdAt: item.createdAt,
      referredDisplayName: referredUser
        ? generateAnonymizedHandle(referredUser.id)
        : generateAnonymizedHandle(item.referredUserId),
    };
  });
}
