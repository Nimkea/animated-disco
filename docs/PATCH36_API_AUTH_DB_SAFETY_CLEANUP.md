# Patch 36 — API/Auth/DB Safety Cleanup

## Goal

Patch 36 hardens the backend after the engagement, missions, achievements, and Learn & Earn patches. The focus is not a new user-facing feature; it is safer runtime behavior when Neon/Postgres is temporarily unreachable or when the database schema has not yet been pushed after a patch.

## What changed

### 1. Central API error helper

Added `server/lib/api-response.ts` with reusable helpers:

- `sendUnauthorized`
- `sendForbidden`
- `sendDbUnavailable`
- `handleApiError`
- `HttpError`
- `asyncRoute`

These helpers keep API errors consistent and prevent internal Prisma messages from leaking to users.

### 2. Prisma/DB error classification

Enhanced `server/lib/db.ts` with:

- `pingDatabase()`
- `getPrismaErrorCode()`
- `sanitizeErrorMessage()`
- `isPrismaConnectivityError()`
- `isPrismaMissingSchemaError()`
- `isUniqueConstraintError()`

Important Prisma cases now have clear classification:

- `P1001`, `P1002`, `P1008`, `P1017`, `P2024` → temporary DB connectivity/pool issue.
- `P2021`, `P2022` → database schema behind current code.
- `P2002` → unique constraint conflict.

### 3. Auth middleware hardening

Updated `server/auth/middleware.ts`:

- Missing token returns a consistent `401`.
- Invalid/expired token clears auth cookies and returns `401`.
- Revoked/missing session clears auth cookies and returns `401`.
- Neon/Prisma outage during session/admin check returns `503` with `retryable: true`, instead of generic `500`.
- Admin guard returns consistent `403` for non-admin users.
- Login rate-limit response is JSON-shaped.

### 4. Startup DB/schema safety

Updated `server/services/health.service.ts`:

- Startup seed now checks DB reachability first.
- Startup seed checks required Patch 34/35 schema markers before running default seed.
- If fields/tables like `Achievement.badgeTier` or `Lesson` are missing, startup seed is skipped with clear instructions instead of repeatedly logging Prisma `P2021/P2022` errors.
- Default seed steps now run with named step reporting:
  - `engagement_config`
  - `default_achievements`
  - `default_tasks`
  - `default_lessons`

### 5. Health endpoints

Updated health/readiness coverage:

- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/schema`
- `GET /readyz`

`/readyz` now considers schema readiness, not only DB connectivity.

## Why this patch matters

Patch 34/35 introduced new tables and columns. If the app starts before `pnpm db:push` completes, runtime can show errors like:

```txt
The column `badgeTier` does not exist in the current database.
The table `public.Lesson` does not exist in the current database.
Can't reach database server...
Timed out fetching a new connection from the connection pool...
```

Patch 36 makes those cases easier to diagnose and safer for users/admins.

## Validation

Run:

```bash
pnpm db:push
pnpm prisma generate
pnpm check
pnpm test
pnpm build
```

Optional health checks while dev server is running:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/db
curl http://localhost:5000/api/health/schema
curl http://localhost:5000/readyz
```

## Notes

This patch does not require a new Prisma model. It only improves backend runtime safety and health diagnostics.
