# XNRT / Animated Disco Project Context

## Overview

XNRT is a React PWA + Express API gamified earning platform. Users interact with in-app XNRT balances through wallet, deposits, withdrawals, mining, staking, referrals, rewards, tasks, achievements, leaderboard, profile, Trust Loan, notifications, and admin-managed platform operations.

## Current architecture

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Radix UI, Wouter, TanStack Query.
- Backend: Express.js with TypeScript.
- Database: PostgreSQL / Neon with Prisma ORM.
- Auth: custom JWT email/password authentication under `/auth/*`.
- PWA: Vite PWA plugin with custom service worker.
- Blockchain: BSC/BEP-20 USDT verification with ethers.js.
- Testing: Vitest + Supertest with guarded optional integration DB tests.

## Auth status

Legacy Replit OIDC/Passport authentication has been removed/disabled. The active auth system is custom JWT auth:

```txt
/auth/register
/auth/login
/auth/me
/auth/logout
/auth/forgot-password
/auth/reset-password
/auth/csrf
```

Do not describe the active app as using Replit OIDC unless a future patch explicitly reintroduces it.

## Current modules

- Wallet v4: balances, deposit proof storage, withdrawal reserve/audit UI.
- Deposit scanner: optional BSC scanner, scanner status dashboard, unmatched deposits and reports.
- Withdrawal: reserved balance, admin approval/rejection, audit trail.
- Mining v2: 24h mining gives exactly 10 XP + 5 XNRT.
- Staking v3: componentized UI, simulated reward risk UX, service-backed summary.
- Referral v2: 3-level referral network and idempotent commission ledger.
- Rewards/Tasks/Achievements: user progress and claim/completion flows.
- Leaderboard v2: XP and category-based leaderboard rankings.
- Profile v2/Home v2: dashboard summaries and user hub.
- Trust Loan v2: dedicated page and admin-configurable program.
- Notification v3: DB preferences, sound settings, push status, admin broadcast.
- Admin v2: overview, users, deposits, withdrawals, stakes, tasks, achievements, announcements, analytics, audit logs, scanner, broadcast, Trust Loan config.
- Theme v2: light/dark/system modes.

## Developer preferences

- Use `pnpm` commands.
- Use Prisma 6.x for now; do not upgrade to Prisma 7 in the middle of feature patches.
- Patches should be direct-apply ZIPs with project-relative paths.
- Keep API URLs backward-compatible unless the user explicitly approves a breaking change.
- Run or ask the user to run:

```bash
pnpm check
pnpm test
pnpm build
```

- If a patch changes Prisma schema, also run:

```bash
pnpm db:push
pnpm prisma generate
```

## Important commands

```bash
pnpm install
pnpm prisma generate
pnpm db:push
pnpm check
pnpm test
pnpm build
pnpm dev
```

## Environment docs

See:

```txt
.env.example
docs/ENVIRONMENT.md
docs/DEPLOYMENT_CHECKLIST.md
docs/ARCHITECTURE.md
docs/REFACTOR_LOG.md
```

## Known warnings

Non-blocking build warnings may include large chunks and circular manual chunk warnings. The app can still build successfully. Future optimization should focus on code-splitting admin/dashboard-heavy bundles.
