import type { NextFunction, Request, Response } from "express";
import { getPrismaErrorCode, isPrismaConnectivityError, isPrismaMissingSchemaError, sanitizeErrorMessage } from "./db";

export type ApiErrorPayload = {
  message: string;
  code?: string;
  retryable?: boolean;
  details?: unknown;
};

export type ApiSuccessPayload<T> = {
  ok: true;
  data: T;
};

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  expose: boolean;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown; expose?: boolean }) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
    this.expose = options?.expose ?? status < 500;
  }
}

export function sendOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json(data);
}

export function sendApiOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data } satisfies ApiSuccessPayload<T>);
}

export function sendError(res: Response, status: number, payload: ApiErrorPayload) {
  return res.status(status).json(payload);
}

export function sendUnauthorized(res: Response, message = "Unauthorized") {
  return sendError(res, 401, { message, code: "UNAUTHORIZED" });
}

export function sendForbidden(res: Response, message = "Forbidden") {
  return sendError(res, 403, { message, code: "FORBIDDEN" });
}

export function sendDbUnavailable(res: Response, error?: unknown) {
  return sendError(res, 503, {
    message: "Database is temporarily unavailable. Please try again shortly.",
    code: getPrismaErrorCode(error) || "DATABASE_UNAVAILABLE",
    retryable: true,
  });
}

export function getHttpStatusFromError(error: unknown) {
  if (error instanceof HttpError) return error.status;
  const status = typeof (error as { status?: unknown })?.status === "number" ? Number((error as { status?: unknown }).status) : undefined;
  const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number" ? Number((error as { statusCode?: unknown }).statusCode) : undefined;
  if (status && status >= 400 && status <= 599) return status;
  if (statusCode && statusCode >= 400 && statusCode <= 599) return statusCode;
  if (isPrismaConnectivityError(error)) return 503;
  if (isPrismaMissingSchemaError(error)) return 503;
  return 500;
}

export function toPublicErrorPayload(error: unknown): ApiErrorPayload {
  if (error instanceof HttpError) {
    return {
      message: error.expose ? error.message : "Internal server error",
      code: error.code,
      details: error.expose ? error.details : undefined,
    };
  }

  if (isPrismaConnectivityError(error)) {
    return {
      message: "Database is temporarily unavailable. Please try again shortly.",
      code: getPrismaErrorCode(error) || "DATABASE_UNAVAILABLE",
      retryable: true,
    };
  }

  if (isPrismaMissingSchemaError(error)) {
    return {
      message: "Database schema is not ready. Run `pnpm db:push` and restart the server.",
      code: getPrismaErrorCode(error) || "DATABASE_SCHEMA_NOT_READY",
      retryable: false,
    };
  }

  const status = getHttpStatusFromError(error);
  if (status >= 500) {
    return { message: "Internal server error", code: "INTERNAL_SERVER_ERROR" };
  }

  return {
    message: sanitizeErrorMessage(error) || "Request failed",
    code: getPrismaErrorCode(error),
  };
}

export function handleApiError(error: unknown, res: Response, context = "api") {
  const status = getHttpStatusFromError(error);
  const payload = toPublicErrorPayload(error);
  if (status >= 500) {
    console.error(`[${context}]`, error);
  } else {
    console.warn(`[${context}] ${payload.message}`);
  }
  return res.status(status).json(payload);
}

export function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
