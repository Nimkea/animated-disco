import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const apiResponse = readFileSync("server/lib/api-response.ts", "utf8");
const dbLib = readFileSync("server/lib/db.ts", "utf8");
const authMiddleware = readFileSync("server/auth/middleware.ts", "utf8");
const healthService = readFileSync("server/services/health.service.ts", "utf8");
const serverIndex = readFileSync("server/index.ts", "utf8");

describe("API/Auth/DB safety contracts", () => {
  it("centralizes safe API error responses", () => {
    expect(apiResponse).toContain("sendDbUnavailable");
    expect(apiResponse).toContain("handleApiError");
    expect(apiResponse).toContain("Database is temporarily unavailable");
    expect(apiResponse).toContain("Internal server error");
  });

  it("classifies Prisma connectivity and missing-schema failures", () => {
    expect(dbLib).toContain("isPrismaConnectivityError");
    expect(dbLib).toContain("isPrismaMissingSchemaError");
    expect(dbLib).toContain("P1001");
    expect(dbLib).toContain("P2024");
    expect(dbLib).toContain("P2021");
    expect(dbLib).toContain("P2022");
    expect(dbLib).toContain("sanitizeErrorMessage");
  });

  it("keeps auth failures safe and DB outages retryable", () => {
    expect(authMiddleware).toContain("clearAuthCookies");
    expect(authMiddleware).toContain("sendUnauthorized");
    expect(authMiddleware).toContain("sendDbUnavailable");
    expect(authMiddleware).toContain("select: { id: true, revokedAt: true }");
    expect(authMiddleware).toContain("Admin access required");
  });

  it("checks schema readiness before startup seed and exposes health endpoints", () => {
    expect(healthService).toContain("getSchemaReadiness");
    expect(healthService).toContain("Achievement.badgeTier");
    expect(healthService).toContain("LessonQuestion");
    expect(healthService).toContain("Startup seed skipped");
    expect(healthService).toContain("engagement_config");
    expect(serverIndex).toContain('/api/health/schema');
    expect(serverIndex).toContain("schemaOk");
  });
});
