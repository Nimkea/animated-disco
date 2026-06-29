import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMMISSION_RATES: Record<1 | 2 | 3, number> = {
  1: 0.06,
  2: 0.03,
  3: 0.01,
};

function normalizeReferralCode(code?: string | null): string | null {
  const normalized = (code || '').trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

async function getReferrerChain(userId: string): Promise<Array<{ id: string; email: string }>> {
  const chain: Array<{ id: string; email: string }> = [];
  const seen = new Set<string>([userId]);
  let currentUserId = userId;

  for (let i = 0; i < 3; i++) {
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (!currentUser?.referredBy) break;

    let referrer = await prisma.user.findUnique({ where: { id: currentUser.referredBy } });
    if (!referrer) {
      const normalizedCode = normalizeReferralCode(currentUser.referredBy);
      referrer = normalizedCode
        ? await prisma.user.findUnique({ where: { referralCode: normalizedCode } })
        : null;

      if (referrer) {
        await prisma.user.update({
          where: { id: currentUser.id },
          data: { referredBy: referrer.id },
        });
      }
    }

    if (!referrer || seen.has(referrer.id)) break;
    chain.push({ id: referrer.id, email: referrer.email });
    seen.add(referrer.id);
    currentUserId = referrer.id;
  }

  return chain;
}

async function ensureReferralRecord(referrerId: string, referredUserId: string, level: number, commission = 0) {
  const existing = await prisma.referral.findFirst({
    where: { referrerId, referredUserId, level },
    select: { id: true },
  });

  if (existing) {
    await prisma.referral.update({
      where: { id: existing.id },
      data: { totalCommission: { increment: new Prisma.Decimal(commission) } },
    });
    return;
  }

  await prisma.referral.create({
    data: {
      referrerId,
      referredUserId,
      level,
      totalCommission: new Prisma.Decimal(commission),
    },
  });
}

async function reconcileCommissions() {
  try {
    console.log('[RECONCILE] Starting safe referral commission reconciliation...');

    const approvedDeposits = await prisma.transaction.findMany({
      where: { type: 'deposit', status: 'approved' },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`[RECONCILE] Found ${approvedDeposits.length} approved deposits`);

    await prisma.referralCommission.deleteMany({});
    await prisma.referral.updateMany({ data: { totalCommission: new Prisma.Decimal(0) } });
    await prisma.balance.updateMany({ data: { referralBalance: new Prisma.Decimal(0) } });

    let totalProcessed = 0;
    let totalPaid = 0;

    for (const deposit of approvedDeposits) {
      const depositAmount = parseFloat(deposit.amount.toString());
      const sourceId = `tx:${deposit.id}`;
      console.log(`\n[RECONCILE] Processing ${sourceId}: ${depositAmount} XNRT for user ${deposit.userId}`);

      const referrerChain = await getReferrerChain(deposit.userId);
      console.log(`[RECONCILE] Referrer chain length: ${referrerChain.length}`);

      for (let level = 1 as 1 | 2 | 3; level <= 3; level = (level + 1) as 1 | 2 | 3) {
        const referrer = referrerChain[level - 1];
        if (!referrer) continue;

        const rate = COMMISSION_RATES[level];
        const commission = depositAmount * rate;

        await prisma.referralCommission.create({
          data: {
            transactionId: sourceId,
            referrerId: referrer.id,
            referredUserId: deposit.userId,
            level,
            baseAmount: new Prisma.Decimal(depositAmount),
            rate: new Prisma.Decimal(rate),
            commission: new Prisma.Decimal(commission),
            status: 'paid',
          },
        });

        await ensureReferralRecord(referrer.id, deposit.userId, level, commission);
        await prisma.balance.upsert({
          where: { userId: referrer.id },
          create: {
            userId: referrer.id,
            referralBalance: new Prisma.Decimal(commission),
            totalEarned: new Prisma.Decimal(0),
          },
          update: {
            referralBalance: { increment: new Prisma.Decimal(commission) },
          },
        });

        totalPaid += commission;
        console.log(`[RECONCILE] Level ${level}: ${referrer.email} gets ${commission.toFixed(2)} XNRT`);
      }

      totalProcessed++;
    }

    console.log('\n[RECONCILE] Safe reconciliation complete!');
    console.log(`[RECONCILE] Deposits processed: ${totalProcessed}`);
    console.log(`[RECONCILE] Referral commission recalculated: ${totalPaid.toFixed(2)} XNRT`);
    console.log('[RECONCILE] Referral tree records were preserved; only ledger and referral balances were rebuilt.');
  } catch (error) {
    console.error('[RECONCILE] Error:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

reconcileCommissions();
