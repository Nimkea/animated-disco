# Refactor Log

This log records the main patch sequence and why each change was made.

## Major product patches

- Rewards/Achievements/Tasks: completed user task assignment, completion rewards, achievement checks, and dynamic categories.
- Leaderboard v2: fixed period filters, current-user rank, correct XP/XNRT units, and category rankings.
- Profile v2: editable profile, summary stats, balances, referrals, tasks/achievements, leaderboard ranks.
- Referral v2: normalized referral codes, idempotent commission ledger, safer company fallback, better referral dashboard.
- Mining v2: fixed 24h mining rule: 10 XP + 5 XNRT, added missing current/history/process APIs, professional UI.
- Home v2: central earning dashboard with balance, mining, tasks, achievements, referrals, leaderboard cards.
- Wallet v2/v3/v4: safe deposits, reserved withdrawals, audit logs, scanner status, force approval, proof storage, withdrawal audit UI.
- Staking v2/v3: professional staking UI, service extraction, reward/withdrawal safety, component split, risk UX.
- Trust Loan v1/v2: dedicated page, admin-configurable program, better user/admin UX.
- Notification v2/v3: inbox page, foreground sound system, DB preferences, admin broadcast.
- Theme v2 + polish: light/dark/system mode and core page theme cleanup.

## Server refactor phases

### Server Routes Split v1

Reduced `server/routes.ts` from a large monolithic route file into modular route registrars.

### Prisma Singleton

Introduced `server/lib/db.ts` to avoid multiple Prisma clients across runtime files.

### Service Helpers Extraction

Moved wallet, leaderboard, and Trust Loan helpers out of route registrar code.

### Mining / Referral / Reward Services

Moved domain business logic into service files.

### Admin Routes Cleanup

Split admin routes into overview, deposits, withdrawals, analytics, announcements, and later specialized admin modules.

### Storage Split v1/v2

Started repository extraction while keeping `storage.ts` public API backward compatible.

## Testing additions

- Vitest and Supertest foundation.
- Service and contract tests.
- Optional guarded integration database setup using `TEST_DATABASE_URL`.
- Integration tests are skipped unless a safe test DB is configured.

## Current maintainability notes

Still worth improving:

- Further split `server/storage.ts` until it becomes mostly a compatibility facade.
- Further split large admin UI modules.
- Move proof storage to object storage if production hosting uses ephemeral disks.
- Add realtime notifications with SSE/WebSocket if needed.
- Add CI pipeline for check/test/build.
