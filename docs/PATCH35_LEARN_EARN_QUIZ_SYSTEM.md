# Patch 35 — Learn & Earn Quiz System

Patch 35 adds a Learn & Earn education layer on top of the engagement foundation.

## Added

- Lessons with content, category, sort order, active state, and responsible usage flag.
- MCQ quiz questions per lesson.
- User lesson progress with score, pass/fail status, one-time reward state, cap result, and answer summary.
- User-facing `/learn` page.
- Admin Quiz Manager under Admin → Learn.
- Startup seed for default lessons.
- Responsible Usage & Safety lesson.
- Quiz reward notification.
- Capped XP/XNRT reward claiming.
- Contract tests.

## User APIs

```txt
GET  /api/learn/lessons
GET  /api/learn/lessons/:slug
POST /api/learn/lessons/:slug/submit
```

## Admin APIs

```txt
GET    /api/admin/learn/lessons
POST   /api/admin/learn/lessons
PATCH  /api/admin/learn/lessons/:id
POST   /api/admin/learn/lessons/:id/questions
PATCH  /api/admin/learn/questions/:id
DELETE /api/admin/learn/questions/:id
```

## Default lessons

- Responsible Usage & Safety
- What is XNRT?
- Wallet & Deposits Basics
- Staking & Trust Loan Readiness

## Reward rules

- User may retry failed quizzes.
- User receives reward only once per lesson.
- XP is credited via XP ledger.
- XNRT reward goes through daily/weekly cap ledger.
- Successful quiz sends an in-app notification.
- Successful quiz records `lesson_completed` activity.

## Validation

```bash
pnpm db:push
pnpm prisma generate
pnpm check
pnpm test
pnpm build
```
