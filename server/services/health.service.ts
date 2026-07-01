import { prisma } from "../lib/db";
import { ensureDefaultAchievements, ensureDefaultTasks } from "./reward.service";
import { ensureEngagementConfig } from "./engagement.service";

export type HealthStatus = "ok" | "degraded" | "unreachable" | "skipped";

type DatabaseTarget = {
  provider: "postgresql";
  host: string | null;
  port: string | null;
  database: string | null;
  pooler: boolean;
};

type DatabaseHealth = {
  ok: boolean;
  status: HealthStatus;
  checkedAt: string;
  latencyMs: number | null;
  target: DatabaseTarget;
  error?: {
    name?: string;
    code?: string;
    message: string;
  };
  hints?: string[];
};

type StartupSeedState = {
  attempted: boolean;
  completed: boolean;
  skipped: boolean;
  databaseOk: boolean | null;
  checkedAt: string | null;
  message: string;
  latencyMs: number | null;
};

const startedAt = Date.now();

let startupSeedState: StartupSeedState = {
  attempted: false,
  completed: false,
  skipped: false,
  databaseOk: null,
  checkedAt: null,
  message: "Startup seed has not run yet.",
  latencyMs: null,
};

export function getDatabaseTarget(): DatabaseTarget {
  const url = process.env.DATABASE_URL || "";
  try {
    const parsed = new URL(url);
    return {
      provider: "postgresql",
      host: parsed.hostname || null,
      port: parsed.port || "5432",
      database: parsed.pathname ? parsed.pathname.replace(/^\//, "") : null,
      pooler: parsed.hostname.includes("pooler"),
    };
  } catch {
    return {
      provider: "postgresql",
      host: null,
      port: null,
      database: null,
      pooler: false,
    };
  }
}

function cleanErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Unknown database error");
  return raw
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/postgresql:\/\/[^\s]+/gi, "postgresql://****")
    .trim();
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function buildDbHints(error: unknown): string[] {
  const message = cleanErrorMessage(error).toLowerCase();
  const hints = [
    "Confirm DATABASE_URL in .env points to the active Neon branch/connection string.",
    "Run `pnpm prisma db push` to verify database connectivity outside the dev server.",
  ];

  if (message.includes("can't reach database server") || message.includes("connect") || message.includes("timeout")) {
    hints.push("Check internet/VPN/WSL DNS. On Windows, try `wsl --shutdown` and reopen WSL.");
    hints.push("Open Neon dashboard to make sure the project/branch is not suspended and the pooler endpoint is reachable.");
  }

  if (message.includes("authentication") || message.includes("password")) {
    hints.push("Regenerate or copy a fresh Neon connection string because the password may be wrong or expired.");
  }

  return hints;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Database health check timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getDatabaseHealth(timeoutMs = Number(process.env.DB_HEALTH_TIMEOUT_MS || 5_000)): Promise<DatabaseHealth> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const target = getDatabaseTarget();

  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      status: "unreachable",
      checkedAt,
      latencyMs: null,
      target,
      error: { message: "DATABASE_URL is not configured." },
      hints: ["Add DATABASE_URL to .env before starting the server."],
    };
  }

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs);
    return {
      ok: true,
      status: "ok",
      checkedAt,
      latencyMs: Date.now() - started,
      target,
    };
  } catch (error) {
    return {
      ok: false,
      status: "unreachable",
      checkedAt,
      latencyMs: Date.now() - started,
      target,
      error: {
        name: errorName(error),
        code: errorCode(error),
        message: cleanErrorMessage(error),
      },
      hints: buildDbHints(error),
    };
  }
}

export function getStartupHealthSnapshot() {
  return {
    ...startupSeedState,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  };
}

export function getApplicationHealth(env: string) {
  return {
    ok: true,
    status: startupSeedState.databaseOk === false ? "degraded" : "ok",
    env,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    startedAt: new Date(startedAt).toISOString(),
    databaseTarget: getDatabaseTarget(),
    startupSeed: getStartupHealthSnapshot(),
  };
}

export async function runStartupDatabaseSeeds() {
  const checkedAt = new Date().toISOString();
  const skipSeeds = String(process.env.SKIP_STARTUP_SEEDS || "false").toLowerCase() === "true";

  if (skipSeeds) {
    startupSeedState = {
      attempted: false,
      completed: false,
      skipped: true,
      databaseOk: null,
      checkedAt,
      latencyMs: null,
      message: "Startup seed skipped because SKIP_STARTUP_SEEDS=true.",
    };
    console.warn(`[startup] ${startupSeedState.message}`);
    return startupSeedState;
  }

  const health = await getDatabaseHealth();
  startupSeedState = {
    attempted: true,
    completed: false,
    skipped: !health.ok,
    databaseOk: health.ok,
    checkedAt: health.checkedAt,
    latencyMs: health.latencyMs,
    message: health.ok
      ? "Database reachable. Running default engagement/tasks/achievements seed."
      : `Database unreachable. Startup seed skipped. ${health.error?.message || "Unknown database error"}`,
  };

  if (!health.ok) {
    const target = health.target.host ? `${health.target.host}:${health.target.port || "5432"}` : "unknown host";
    console.warn(`[startup] Database health check failed for ${target}.`);
    console.warn(`[startup] ${startupSeedState.message}`);
    for (const hint of health.hints || []) {
      console.warn(`[startup] hint: ${hint}`);
    }
    return startupSeedState;
  }

  try {
    await ensureEngagementConfig();
    await ensureDefaultAchievements();
    await ensureDefaultTasks();
    startupSeedState = {
      ...startupSeedState,
      completed: true,
      skipped: false,
      message: "Default engagement config, tasks, and achievements are ready.",
    };
  } catch (error) {
    startupSeedState = {
      ...startupSeedState,
      completed: false,
      skipped: false,
      message: `Startup seed failed after successful DB health check. ${cleanErrorMessage(error)}`,
    };
    console.error("[startup] Failed to run default seed:", error);
  }

  return startupSeedState;
}
