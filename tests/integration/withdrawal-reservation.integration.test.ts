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

describeIntegration("integration: withdrawal reservation ledger", () => {
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

  it("reserves balance when a pending withdrawal transaction is created", async () => {
    const suffix = uniqueTestSuffix();
    const user = await prisma.user.create({
      data: {
        email: `itest+withdraw_${suffix}@example.com`,
        username: `itest_withdraw_${suffix}`,
        passwordHash: "test-password-hash",
        referralCode: `ITESTWDR${suffix}`.slice(0, 32),
        balance: {
          create: {
            xnrtBalance: new Prisma.Decimal(1000),
            totalEarned: new Prisma.Decimal(1000),
          },
        },
      },
    });

    const withdrawal = await prisma.$transaction(async (tx) => {
      const balance = await tx.balance.findUniqueOrThrow({ where: { userId: user.id } });
      await tx.balance.update({
        where: { userId: user.id },
        data: { xnrtBalance: new Prisma.Decimal(balance.xnrtBalance).minus(250) },
      });
      return tx.transaction.create({
        data: {
          userId: user.id,
          type: "withdrawal",
          amount: new Prisma.Decimal(250),
          fee: new Prisma.Decimal(5),
          netAmount: new Prisma.Decimal(245),
          source: "main",
          walletAddress: "0x0000000000000000000000000000000000000001",
          status: "pending",
          verificationData: {
            reservedBalance: true,
            sourceBalanceKey: "xnrtBalance",
          },
        },
      });
    });

    const balanceAfter = await prisma.balance.findUniqueOrThrow({ where: { userId: user.id } });

    expect(withdrawal.status).toBe("pending");
    expect(Number(balanceAfter.xnrtBalance)).toBe(750);
    expect(withdrawal.verificationData).toMatchObject({ reservedBalance: true });
  });
});
