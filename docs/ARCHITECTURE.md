# Architecture

## Overview

XNRT is a full-stack TypeScript PWA.

```txt
client/  React PWA frontend
server/  Express API backend
shared/  shared schemas/types
prisma/  Prisma schema
scripts/ utility scripts
tests/   Vitest/Supertest tests
```

## Frontend

Main technologies:

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Radix UI components
- Wouter routing
- TanStack Query
- PWA service worker

Important frontend areas:

```txt
client/src/pages/                 route pages
client/src/pages/admin/           admin dashboard and tabs
client/src/components/            shared UI components
client/src/hooks/                 React hooks
client/src/lib/                   frontend utilities
client/src/contexts/              theme/auth context utilities
client/src/config/features.ts     feature flags
client/src/sw.ts                  custom service worker
```

## Backend

Main technologies:

- Express
- TypeScript
- Prisma ORM
- PostgreSQL / Neon
- JWT auth
- CSRF middleware
- Rate limiting
- Web Push
- ethers.js for BSC verification

Important backend areas:

```txt
server/index.ts                   app/server startup
server/routes.ts                  route registrar and shared route context
server/routes/                    public/user route modules
server/routes/admin/              admin route modules
server/services/                  business services
server/repositories/              database repositories
server/auth/                      custom JWT auth
server/lib/db.ts                  Prisma singleton
server/notifications.ts           notification creation/delivery
```

## Route structure

`server/routes.ts` is intentionally small and delegates to modular route registrars.

Examples:

```txt
server/routes/home-wallet.routes.ts
server/routes/wallet-operations.routes.ts
server/routes/earning.routes.ts
server/routes/community.routes.ts
server/routes/progress-profile.routes.ts
server/routes/trust-loan.routes.ts
server/routes/admin.routes.ts
```

Admin routes are split further:

```txt
server/routes/admin/overview.routes.ts
server/routes/admin/deposits.routes.ts
server/routes/admin/deposits/*.routes.ts
server/routes/admin/withdrawals.routes.ts
server/routes/admin/stakes.routes.ts
server/routes/admin/analytics.routes.ts
server/routes/admin/announcements.routes.ts
server/routes/admin/notifications.routes.ts
server/routes/admin/trust-loan.routes.ts
```

## Services

Business logic has moved out of giant route files into services.

Current important services:

```txt
server/services/mining.service.ts
server/services/referral.service.ts
server/services/reward.service.ts
server/services/staking.service.ts
server/services/trustLoan.service.ts
server/services/wallet.service.ts
server/services/audit.service.ts
server/services/notificationPreference.service.ts
server/services/proofStorage.service.ts
server/services/health.service.ts
server/services/depositScanner.ts
server/services/verifyBscUsdt.ts
server/services/tokenService.ts
```

## Repositories

Repositories wrap Prisma data access while `storage.ts` keeps backward-compatible public methods.

```txt
server/repositories/user.repository.ts
server/repositories/balance.repository.ts
server/repositories/transaction.repository.ts
server/repositories/activity.repository.ts
server/repositories/notification.repository.ts
server/repositories/staking.repository.ts
server/repositories/mining.repository.ts
server/repositories/referral.repository.ts
server/repositories/task.repository.ts
server/repositories/achievement.repository.ts
server/repositories/leaderboard.repository.ts
server/repositories/converters.ts
```

## Auth architecture

Active auth is custom email/password JWT:

```txt
POST /auth/register
POST /auth/login
GET  /auth/me
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/csrf
```

Legacy Replit OIDC/Passport auth is removed/disabled and should not be reintroduced unless a new explicit decision is made.

## Wallet/deposit architecture

- Each user can have a personal deposit address.
- Deposits are reported by tx hash or detected by scanner.
- Blockchain verification uses BSC/BEP-20 USDT.
- Approved deposits credit XNRT balance and trigger referral commissions.
- Admin can review unmatched deposits and deposit reports.
- Force approval requires explicit confirmation and audit logging.

## Withdrawal architecture

- User withdrawal reserves balance immediately.
- Admin approval finalizes withdrawal and records notes/tx hash/audit metadata.
- Rejection refunds reserved balance.
- Wallet address must be a valid `0x` BEP-20-style address.

## Notification architecture

- Notifications are stored in DB.
- Push subscriptions are stored per user/device.
- User preferences can disable categories, push, in-app notifications, and sound.
- Foreground sound uses WebAudio; background push sounds are browser/OS controlled.
- Admin broadcast creates notifications and audit logs.

## Testing architecture

Normal tests do not touch a database unless `TEST_DATABASE_URL` is configured.

```bash
pnpm test
pnpm test:services
pnpm test:contracts
pnpm test:api
pnpm test:integration
```

Integration DB tests are guarded to avoid accidentally touching production databases.
