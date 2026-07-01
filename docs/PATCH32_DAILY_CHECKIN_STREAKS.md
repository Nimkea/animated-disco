# Patch 32 — Daily Check-in + Streaks v2

This patch upgrades the existing check-in flow from a `User.lastCheckIn`-only system to a durable daily check-in ledger.

## Added

- `DailyCheckin` Prisma model with `@@unique([userId, checkinDate])`.
- UTC date-key helpers for consistent server-side day boundaries.
- `/api/checkin/status` endpoint for current streak, next claim, and next reward preview.
- `/api/checkin/history` now returns ledger entries, month totals, reward caps, and backward-compatible `dates`.
- Daily check-in now records:
  - check-in date
  - streak day
  - XP reward
  - requested XNRT reward
  - actual XNRT reward after caps
  - whether a cap was applied
- Daily check-in creates a reward transaction when XNRT is credited.
- Rewards page now has a claim button and shows live next reward values from admin config.
- Check-in calendar now shows monthly totals and cap-applied markers.
- Admin engagement summary now includes unique daily check-ins today.

## Why

The previous flow worked for MVP but was vulnerable to edge cases:

- duplicate claim race conditions
- timezone confusion from local day checks
- no durable per-day claim record
- calendar depended on activity logs only
- Rewards page showed milestone values that were not actually credited by the backend

## Apply / DB commands

After unzipping this patch, run:

```bash
pnpm db:generate
pnpm db:push
pnpm check
```

## Test checklist

1. Open `/rewards` and claim daily reward.
2. Claim again on the same day; it should reject with “Already checked in today”.
3. Check `/api/checkin/history`; it should include the date in `dates` and a detailed `entries` item.
4. Open Admin → Engagement Config; “Check-ins Today” should increase.
5. Confirm balance, XP, user streak, activity log, notification, and transaction are created.
