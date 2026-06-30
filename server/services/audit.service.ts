import type { Request } from "express";
import { prisma } from "../lib/db";

type AuditDb = {
  adminAuditLog?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export interface AdminAuditInput {
  req?: Request;
  adminUserId?: string | null;
  targetUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  status?: "success" | "failed" | "blocked" | string;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

function getClientIp(req?: Request) {
  if (!req) return null;
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  return req.ip || req.socket?.remoteAddress || null;
}

export async function recordAdminAuditLog(input: AdminAuditInput, db: AuditDb = prisma as unknown as AuditDb) {
  try {
    if (!db.adminAuditLog) return;
    await db.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId ?? input.req?.authUser?.id ?? null,
        targetUserId: input.targetUserId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        status: input.status ?? "success",
        summary: input.summary,
        metadata: input.metadata ?? undefined,
        ipAddress: getClientIp(input.req),
        userAgent: input.req?.headers["user-agent"] || null,
      },
    });
  } catch (error) {
    console.error("[Audit] Failed to write admin audit log:", error);
  }
}

export function appendTransactionAuditTrail(
  metadata: Record<string, unknown> | null | undefined,
  event: Record<string, unknown>,
) {
  const base = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  const previous = Array.isArray(base.auditTrail) ? base.auditTrail : [];
  return {
    ...base,
    auditTrail: [
      ...previous,
      {
        at: new Date().toISOString(),
        ...event,
      },
    ],
  };
}
