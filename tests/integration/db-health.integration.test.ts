import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupIntegrationFixtures,
  createTestPrismaClient,
  getTestDatabaseUrl,
  isProbablySafeTestDatabaseUrl,
} from "../helpers/test-database";

const testDbUrl = getTestDatabaseUrl();
const shouldRunIntegration = Boolean(testDbUrl && isProbablySafeTestDatabaseUrl(testDbUrl));
const describeIntegration = shouldRunIntegration ? describe : describe.skip;

describeIntegration("integration: test database health", () => {
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

  it("connects to TEST_DATABASE_URL and executes a simple query", async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
  });

  it("has core app tables available after test db push", async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `;
    const tableNames = new Set(tables.map((row) => row.tablename));

    expect(tableNames.has("User")).toBe(true);
    expect(tableNames.has("Balance")).toBe(true);
    expect(tableNames.has("Transaction")).toBe(true);
    expect(tableNames.has("ReferralCommission")).toBe(true);
    expect(tableNames.has("AdminAuditLog")).toBe(true);
  });
});
