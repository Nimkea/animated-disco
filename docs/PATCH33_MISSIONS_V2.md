# Patch 33 — Missions v2 + Weekly Quests

Patch 33 upgrades the old one-time task list into a repeatable missions system.

## Added

- Daily missions with period-scoped progress.
- Weekly quests with period-scoped progress.
- Separate progress tracking and reward claiming.
- Claim reward button after progress reaches the configured target.
- Admin controls for mission type, progress trigger, target count, sort order, rewards, category, and active status.
- Mission event tracking API for page visits and backend actions.
- Contract test coverage for schema, APIs, services, and UI.

## Mission types

```txt
one_time  = all-time task, claim once
daily     = resets each UTC day
weekly    = resets each UTC week, Monday 00:00 UTC
```

## Default daily missions

```txt
Daily Check-In
Start Mining
Open Wallet Page
Check Staking Rewards
Read Safety Tip
```

## Default weekly quests

```txt
Weekly Mining Quest — complete 5 mining sessions
Weekly Check-in Quest — check in 5 days this week
Weekly Staking Quest — create 1 stake this week
Weekly Referral Quest — invite 2 users this week
```

## Progress triggers

```txt
manual
safety_tip_read
daily_checkin_claimed
mining_started
mining_completed
wallet_opened
staking_rewards_viewed
stake_created
referral_created
```

## APIs

```txt
GET  /api/tasks/user
POST /api/tasks/track
POST /api/tasks/:taskId/progress
POST /api/tasks/:taskId/claim
POST /api/tasks/:taskId/complete  # compatibility alias for claim
```

## Database changes

```txt
Task.missionType
Task.triggerKey
Task.targetCount
Task.sortOrder
Task.updatedAt
UserTask.periodKey
UserTask.claimed
UserTask.claimedAt
UserTask.progressSource
UserTask.lastProgressAt
UserTask.expiresAt
@@unique([userId, taskId, periodKey])
```

## Test checklist

```bash
pnpm db:push
pnpm prisma generate
pnpm check
pnpm test
pnpm build
```

Manual checks:

```txt
1. Open /tasks and confirm Daily / Weekly missions display progress bars.
2. Open /wallet, then return to /tasks; Open Wallet Page should be 1/1 and claimable.
3. Open /staking, then return to /tasks; Check Staking Rewards should be 1/1 and claimable.
4. Start mining; Start Mining should become claimable.
5. Claim a reward; it should update XP, XNRT, activity, notifications, and caps.
6. Admin → Tasks: create/edit/toggle/delete mission controls should show mission type, trigger key, target count, and sort order.
```
