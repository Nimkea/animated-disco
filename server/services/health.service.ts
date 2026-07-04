import { pingDatabase, prisma, sanitizeErrorMessage, getPrismaErrorCode, isPrismaConnectivityError, isPrismaMissingSchemaError } from "../lib/db";
import { ensureDefaultAchievements, ensureDefaultTasks } from "./reward.service";
import { ensureEngagementConfig } from "./engagement.service";
import { ensureDefaultLessons } from "./learn-earn.service";

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

type RequiredSchemaColumn = {
  table: string;
  column: string;
  introducedBy: string;
};

type SchemaReadiness = {
  ok: boolean;
  status: "ok" | "missing_schema" | "unreachable";
  checkedAt: string;
  missing: RequiredSchemaColumn[];
  message: string;
  hints: string[];
  error?: {
    name?: string;
    code?: string;
    message: string;
  };
};

type StartupSeedStep = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  latencyMs: number;
  error?: string;
};

type StartupSeedState = {
  attempted: boolean;
  completed: boolean;
  skipped: boolean;
  databaseOk: boolean | null;
  schemaOk: boolean | null;
  checkedAt: string | null;
  message: string;
  latencyMs: number | null;
  steps: StartupSeedStep[];
};

const startedAt = Date.now();

// Required markers include Achievement.badgeTier and Patch 35 Lesson/LessonQuestion tables.
const REQUIRED_SCHEMA_COLUMNS: RequiredSchemaColumn[] = [
  { table: "Achievement", column: "badgeTier", introducedBy: "Patch 34" },
  { table: "Achievement", column: "badgeColor", introducedBy: "Patch 34" },
  { table: "UserAchievement", column: "isFeatured", introducedBy: "Patch 34" },
  { table: "UserAchievement", column: "featuredSlot", introducedBy: "Patch 34" },
  { table: "Lesson", column: "id", introducedBy: "Patch 35" },
  { table: "LessonQuestion", column: "id", introducedBy: "Patch 35" },
  { table: "UserLessonProgress", column: "id", introducedBy: "Patch 35" },
];

let startupSeedState: StartupSeedState = {
  attempted: false,
  completed: false,
  skipped: false,
  databaseOk: null,
  schemaOk: null,
  checkedAt: null,
  message: "Startup seed has not run yet.",
  latencyMs: null,
  steps: [],
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

function errorCode(error: unknown): string | undefined {
  return getPrismaErrorCode(error);
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function buildDbHints(error: unknown): string[] {
  const message = sanitizeErrorMessage(error).toLowerCase();
  const hints = [
    "Confirm DATABASE_URL in .env points to the active Neon branch/connection string.",
    "Run `pnpm db:push` to verify database connectivity outside the dev server.",
  ];

  if (isPrismaConnectivityError(error) || message.includes("connect") || message.includes("timeout")) {
    hints.push("Check internet/VPN/WSL DNS. On Windows, try `wsl --shutdown` and reopen WSL.");
    hints.push("Open Neon dashboard to make sure the project/branch is not suspended and the pooler endpoint is reachable.");
  }

  if (message.includes("authentication") || message.includes("password")) {
    hints.push("Regenerate or copy a fresh Neon connection string because the password may be wrong or expired.");
  }

  return hints;
}

function buildSchemaHints(missing: RequiredSchemaColumn[]) {
  const patches = Array.from(new Set(missing.map((item) => item.introducedBy))).join(", ");
  return [
    `Database schema is behind the code. Missing fields/tables are from ${patches || "recent patches"}.`,
    "Stop the dev server, run `pnpm db:push`, then run `pnpm prisma generate` and restart.",
    "If Prisma shows a data-loss warning for a new unique constraint, review duplicates before accepting on production data.",
  ];
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
    await pingDatabase(timeoutMs);
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
        message: sanitizeErrorMessage(error),
      },
      hints: buildDbHints(error),
    };
  }
}

export async function getSchemaReadiness(): Promise<SchemaReadiness> {
  const checkedAt = new Date().toISOString();
  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;
    const available = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = REQUIRED_SCHEMA_COLUMNS.filter((item) => !available.has(`${item.table}.${item.column}`));

    if (missing.length > 0) {
      return {
        ok: false,
        status: "missing_schema",
        checkedAt,
        missing,
        message: `Database schema is missing ${missing.length} required field/table marker(s).`,
        hints: buildSchemaHints(missing),
      };
    }

    return {
      ok: true,
      status: "ok",
      checkedAt,
      missing: [],
      message: "Database schema contains required Patch 34/35 engagement and learning tables/columns.",
      hints: [],
    };
  } catch (error) {
    return {
      ok: false,
      status: isPrismaMissingSchemaError(error) ? "missing_schema" : "unreachable",
      checkedAt,
      missing: [],
      message: sanitizeErrorMessage(error),
      hints: isPrismaConnectivityError(error) ? buildDbHints(error) : ["Run `pnpm db:push` and retry the health check."],
      error: {
        name: errorName(error),
        code: errorCode(error),
        message: sanitizeErrorMessage(error),
      },
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
  const seedIncomplete = startupSeedState.attempted && !startupSeedState.skipped && startupSeedState.completed === false;
  const degraded = startupSeedState.databaseOk === false || startupSeedState.schemaOk === false || seedIncomplete;
  return {
    ok: !degraded,
    status: degraded ? "degraded" : "ok",
    env,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    startedAt: new Date(startedAt).toISOString(),
    databaseTarget: getDatabaseTarget(),
    startupSeed: getStartupHealthSnapshot(),
  };
}

async function runSeedStep(name: string, fn: () => Promise<unknown>): Promise<StartupSeedStep> {
  const started = Date.now();
  try {
    await fn();
    const step = { name, ok: true, latencyMs: Date.now() - started };
    console.log(`[startup] ${name} ready in ${step.latencyMs}ms`);
    return step;
  } catch (error) {
    const step = { name, ok: false, latencyMs: Date.now() - started, error: sanitizeErrorMessage(error) };
    console.error(`[startup] ${name} failed: ${step.error}`);
    return step;
  }
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
      schemaOk: null,
      checkedAt,
      latencyMs: null,
      steps: [],
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
    schemaOk: null,
    checkedAt: health.checkedAt,
    latencyMs: health.latencyMs,
    steps: [],
    message: health.ok
      ? "Database reachable. Checking schema before default seed."
      : `Database unreachable. Startup seed skipped. ${health.error?.message || "Unknown database error"}`,
  };

  if (!health.ok) {
    const target = health.target.host ? `${health.target.host}:${health.target.port || "5432"}` : "unknown host";
    console.warn(`[startup] Database health check failed for ${target}.`);
    console.warn(`[startup] ${startupSeedState.message}`);
    for (const hint of health.hints || []) console.warn(`[startup] hint: ${hint}`);
    return startupSeedState;
  }

  const schema = await getSchemaReadiness();
  startupSeedState.schemaOk = schema.ok;
  if (!schema.ok) {
    startupSeedState = {
      ...startupSeedState,
      completed: false,
      skipped: true,
      message: `${schema.message} Startup seed skipped to avoid repeated Prisma P2021/P2022 errors.`,
    };
    console.warn(`[startup] ${startupSeedState.message}`);
    for (const item of schema.missing) {
      console.warn(`[startup] missing schema: ${item.table}.${item.column} (${item.introducedBy})`);
    }
    for (const hint of schema.hints) console.warn(`[startup] hint: ${hint}`);
    return startupSeedState;
  }

  const steps = [
    await runSeedStep("engagement_config", ensureEngagementConfig),
    await runSeedStep("default_achievements", ensureDefaultAchievements),
    await runSeedStep("default_tasks", ensureDefaultTasks),
    await runSeedStep("default_lessons", ensureDefaultLessons),
  ];
  const completed = steps.every((step) => step.ok);

  startupSeedState = {
    ...startupSeedState,
    completed,
    skipped: false,
    steps,
    message: completed
      ? "Default engagement config, tasks, achievements, and lessons are ready."
      : "One or more startup seed steps failed. Check startupSeed.steps for details.",
  };

  return startupSeedState;
}
