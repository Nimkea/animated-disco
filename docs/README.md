# XNRT Documentation

This folder contains current documentation for the XNRT / Animated Disco project after the modular route, repository, wallet, staking, notification, theme, Trust Loan, admin, and testing patches.

## Project summary

XNRT is a mobile-first React PWA with an Express + Prisma backend. It is designed as an off-chain gamified earning platform with admin-controlled operations and blockchain-assisted deposit verification.

Core modules:

- Auth: custom email/password JWT auth, email verification, password reset, CSRF protection.
- Wallet: balance summary, deposit, withdrawal, proof storage, personal deposit addresses.
- Deposit scanner: BSC/USDT verification and optional automated crediting.
- Withdrawal: reserved balance, admin approval, audit trail, protected wallet address validation.
- Mining: 24-hour session, fixed reward rule of 10 XP + 5 XNRT.
- Staking: tiered simulated platform rewards, maturity countdowns, reward processing, risk UX.
- Referral: 3-level commission chain, referral tree, idempotent commission ledger.
- Engagement: admin-configured XP levels, reward caps, XP ledger, and gamification safety.
- Rewards/Tasks/Achievements: user progress and gamification rewards.
- Leaderboard: XP, mining, task, achievement, check-in, staking/referral earnings categories.
- Profile/Home: dashboard summaries and central user hub.
- Trust Loan: dedicated user page and admin-configurable program.
- Notifications: inbox, unread badge, push subscriptions, DB preferences, sound settings, admin broadcast.
- Admin: overview, users, deposits, withdrawals, stakes, tasks, achievements, engagement config, announcements, analytics, audit logs, scanner, Trust Loan config, broadcast.
- PWA: service worker, installability, offline shell, push notifications.
- Theme: light/dark/system mode.
- Tests: Vitest/Supertest with safe optional integration DB support.

## Commands

```bash
pnpm install
pnpm prisma generate
pnpm db:push
pnpm check
pnpm test
pnpm build
pnpm dev
```

## Current known warnings

These are non-blocking build warnings unless they become severe:

- PostCSS plugin `from` warning.
- Vite circular manual chunk warnings.
- Large React/vendor chunks.

Future optimization can split large admin/dashboard chunks further.

## Recommended next maintenance patches

1. Dependency stability pinning.
2. Additional admin user-management safeguards.
3. Wallet proof storage move from local filesystem to object storage if deploying on ephemeral hosting.
4. Realtime notification stream or websocket/SSE.
5. Full integration test DB pipeline in CI.

## Related docs

- [Engagement System](./ENGAGEMENT_SYSTEM.md)
- [Patch 34 — Achievements v2 + Badges](./PATCH34_ACHIEVEMENTS_V2_BADGES.md)
