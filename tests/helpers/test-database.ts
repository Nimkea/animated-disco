import { PrismaClient } from "@prisma/client";

const REMOTE_ACK_ENV = "ALLOW_REMOTE_TEST_DATABASE_URL";
const RESET_ACK_ENV = "ALLOW_TEST_DB_RESET";

export function getTestDatabaseUrl(): string | null {
  const raw = process.env.TEST_DATABASE_URL?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function maskDatabaseUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ":****@");
}

export function isProbablySafeTestDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const combined = [
      parsed.hostname,
      parsed.pathname,
      parsed.username,
      parsed.search,
    ]
      .join(" ")
      .toLowerCase();

    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) return true;
    if (combined.includes("test")) return true;
    if (process.env[REMOTE_ACK_ENV] === "true") return true;
    return false;
  } catch {
    return false;
  }
}

export function requireSafeTestDatabaseUrl(options?: { allowMissing?: boolean }) {
  const url = getTestDatabaseUrl();
  if (!url) {
    if (options?.allowMissing) return null;
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy .env.test.example and point TEST_DATABASE_URL to a dedicated test database."
    );
  }

  if (!isProbablySafeTestDatabaseUrl(url)) {
    throw new Error(
      `Refusing to use TEST_DATABASE_URL because it does not look like a safe test database: ${maskDatabaseUrl(
        url
      )}. Use localhost, include \"test\" in the database/branch name, or set ${REMOTE_ACK_ENV}=true after verifying it is not production.`
    );
  }

  return url;
}

export function requireResetAllowed() {
  if (process.env[RESET_ACK_ENV] !== "true") {
    throw new Error(
      `Refusing to reset test database. Set ${RESET_ACK_ENV}=true only for a disposable test database.`
    );
  }
}

export function createTestPrismaClient(url = requireSafeTestDatabaseUrl()) {
  return new PrismaClient({
    datasources: {
      db: { url },
    },
    log: process.env.TEST_PRISMA_LOG === "true" ? ["query", "warn", "error"] : ["error"],
  });
}

export async function cleanupIntegrationFixtures(prisma: PrismaClient) {
  const emailPrefix = "itest+";
  const usernamePrefix = "itest_";

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: emailPrefix } },
        { username: { startsWith: usernamePrefix } },
        { referralCode: { startsWith: "ITEST" } },
      ],
    },
    select: { id: true },
  });

  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  await prisma.$transaction([
    prisma.referralCommission.deleteMany({
      where: { OR: [{ referrerId: { in: userIds } }, { referredUserId: { in: userIds } }] },
    }),
    prisma.referral.deleteMany({
      where: { OR: [{ referrerId: { in: userIds } }, { referredUserId: { in: userIds } }] },
    }),
    prisma.transaction.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.activity.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.notification.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userTask.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userAchievement.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.miningSession.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.stake.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.balance.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

export function uniqueTestSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
