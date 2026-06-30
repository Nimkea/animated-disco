import { createTestPrismaClient, maskDatabaseUrl, requireSafeTestDatabaseUrl } from "../helpers/test-database";

const url = requireSafeTestDatabaseUrl();
const prisma = createTestPrismaClient(url);

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log(`[test-db] OK: ${maskDatabaseUrl(url)}`);
} finally {
  await prisma.$disconnect();
}
