# XNRT / Animated Disco

XNRT is a React + Express + Prisma PWA for an off-chain gamified earning platform. It includes custom email/password authentication, wallet/deposit/withdrawal flows, mining, staking, referrals, rewards, tasks, achievements, leaderboard, profile, Trust Loan, notifications with sound preferences, and a modular admin dashboard.

## Current stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Radix UI, Wouter, TanStack Query
- Backend: Express.js, TypeScript, Prisma ORM
- Database: PostgreSQL / Neon
- PWA: `vite-plugin-pwa`, custom service worker, push notifications
- Blockchain verification: ethers.js on BSC/BEP-20 USDT
- Tests: Vitest, Supertest, guarded integration test support

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm prisma generate
pnpm db:push
pnpm check
pnpm test
pnpm dev
```

Production build:

```bash
pnpm check
pnpm test
pnpm build
pnpm start
```

## Important docs

- `docs/ENVIRONMENT.md` — all environment variables and secrets
- `docs/DEPLOYMENT_CHECKLIST.md` — local, staging, and production deployment checks
- `docs/ARCHITECTURE.md` — current frontend/backend/module architecture
- `docs/REFACTOR_LOG.md` — patch history and refactor decisions
- `docs/README.md` — feature overview and developer notes

## Authentication status

The active auth system is custom JWT + email/password under `/auth/*`. Legacy Replit Auth/OIDC has been removed/disabled. Replit Vite dev plugins may still exist for Replit development tooling, but they are not authentication dependencies.

## Safety notes

Never commit real values for:

- `DATABASE_URL`
- `JWT_SECRET`
- `MASTER_SEED`
- `DEPLOYER_PRIVATE_KEY`
- `SMTP_PASSWORD`
- `VAPID_PRIVATE_KEY`

Use a separate test database for `TEST_DATABASE_URL`.
