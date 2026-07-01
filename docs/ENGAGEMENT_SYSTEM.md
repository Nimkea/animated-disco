# Engagement Config + XP Level System

Patch 31 adds the first engagement foundation for XNRT.

## What exists now

- `EngagementConfig` singleton table for XP and reward-cap settings.
- `XpLedger` table for server-side XP history.
- `RewardCapLedger` table for capped XNRT engagement reward tracking.
- User API: `GET /api/engagement/summary`.
- Admin APIs:
  - `GET /api/admin/engagement/config`
  - `PATCH /api/admin/engagement/config`
  - `GET /api/admin/engagement/summary`
- Admin UI tab: `Admin -> Engagement`.

## Reward cap behavior

Task and daily check-in XNRT rewards now pass through the engagement cap service.

Default caps:

| Setting | Default |
| --- | ---: |
| Daily total XNRT cap | 200 XNRT |
| Weekly total XNRT cap | 1,000 XNRT |
| Daily task XNRT cap | 100 XNRT |
| Weekly task XNRT cap | 500 XNRT |

If a reward would exceed a cap, the server awards the remaining allowed amount and records the cap result.

## XP levels

Default formula:

```txt
level = floor(total XP / levelXpStep) + 1
```

Default `levelXpStep` is `1000`.

## Why this matters

This patch prepares the app for:

- Daily check-in v2
- Missions v2
- Achievements v2
- Learn & Earn quizzes
- seasonal campaigns
- anti-abuse review queues

## Apply requirements

This patch adds Prisma models, so run:

```bash
pnpm db:push
pnpm prisma generate
```

before `pnpm check`.
