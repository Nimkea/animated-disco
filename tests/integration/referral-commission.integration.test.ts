import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupIntegrationFixtures,
  createTestPrismaClient,
  getTestDatabaseUrl,
  isProbablySafeTestDatabaseUrl,
  uniqueTestSuffix,
} from "../helpers/test-database";

const testDbUrl = getTestDatabaseUrl();
const shouldRunIntegration = Boolean(testDbUrl && isProbablySafeTestDatabaseUrl(testDbUrl));
const describeIntegration = shouldRunIntegration ? describe : describe.skip;

describeIntegration("integration: referral commission ledger", () => {
  let prisma: ReturnType<typeof createTestPrismaClient>;

  beforeAll(async () => {
    prisma = createTestPrismaClient(testDbUrl!);
    await cleanupIntegrationFixtures(prisma);
  });

  afterAll(async () => {
    if (!prisma) return;
    await cleanupIntegrationFixtures(prisma);
    await prisma.$disconnect();
  });

  it("prevents duplicate commission payouts for the same transaction/referrer/level", async () => {
    const suffix = uniqueTestSuffix();
    const referrer = await prisma.user.create({
      data: {
        email: `itest+referrer_${suffix}@example.com`,
        username: `itest_referrer_${suffix}`,
        passwordHash: "test-password-hash",
        referralCode: `ITESTREF${suffix}`.slice(0, 32),
      },
    });
    const referred = await prisma.user.create({
      data: {
        email: `itest+referred_${suffix}@example.com`,
        username: `itest_referred_${suffix}`,
        passwordHash: "test-password-hash",
        referralCode: `ITESTUSR${suffix}`.slice(0, 32),
        referredBy: referrer.id,
      },
    });
    const deposit = await prisma.transaction.create({
      data: {
        userId: referred.id,
        type: "deposit",
        amount: new Prisma.Decimal(1000),
        status: "approved",
      },
    });

    await prisma.referralCommission.create({
      data: {
        transactionId: deposit.id,
        referrerId: referrer.id,
        referredUserId: referred.id,
        level: 1,
        baseAmount: new Prisma.Decimal(1000),
        rate: new Prisma.Decimal(0.06),
        commission: new Prisma.Decimal(60),
      },
    });

    await expect(
      prisma.referralCommission.create({
        data: {
          transactionId: deposit.id,
          referrerId: referrer.id,
          referredUserId: referred.id,
          level: 1,
          baseAmount: new Prisma.Decimal(1000),
          rate: new Prisma.Decimal(0.06),
          commission: new Prisma.Decimal(60),
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
