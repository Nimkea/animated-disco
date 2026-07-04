import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function prismaLogLevels(): Array<"error" | "warn"> {
  return process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogLevels(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export async function pingDatabase(timeoutMs = Number(process.env.DB_HEALTH_TIMEOUT_MS || 5_000)) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Database ping timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getPrismaErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Unknown error");
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://****")
    .replace(/password=[^&\s]+/gi, "password=****")
    .replace(/:\/{0,2}[^:@\s]+@/g, ":****@")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPrismaConnectivityError(error: unknown): boolean {
  const code = getPrismaErrorCode(error);
  if (["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code || "")) return true;
  const message = sanitizeErrorMessage(error).toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("timed out fetching a new connection") ||
    message.includes("connection pool") ||
    message.includes("database ping timed out") ||
    message.includes("connect etimedout") ||
    message.includes("connection terminated")
  );
}

export function isPrismaMissingSchemaError(error: unknown): boolean {
  const code = getPrismaErrorCode(error);
  if (["P2021", "P2022"].includes(code || "")) return true;
  const message = sanitizeErrorMessage(error).toLowerCase();
  return message.includes("does not exist in the current database") || message.includes("table") && message.includes("does not exist");
}

export function isUniqueConstraintError(error: unknown): boolean {
  return getPrismaErrorCode(error) === "P2002";
}
