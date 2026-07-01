# Patch 34 — Achievements v2 + Badges

## Added

- Tiered achievement badges: bronze, silver, gold, diamond.
- Badge metadata in Prisma: `badgeTier`, `badgeColor`, `sortOrder`, `isActive`.
- User trophy-case fields: `isFeatured`, `featuredSlot`.
- Profile trophy case showing up to 4 unlocked badges.
- Achievement unlock notification with badge tier metadata.
- User control to add/remove unlocked badges from trophy case.
- Admin achievement controls for tier, color, sort order, and active/hidden status.
- Extra milestone categories: onboarding, wallet, tasks, staking, trust loan.

## New/updated APIs

```txt
GET  /api/achievements
POST /api/achievements/:id/claim
POST /api/achievements/:id/feature
GET  /api/profile/summary  # now includes achievements.trophyCase
```

## Badge tiers

```txt
Bronze  — starter milestones
Silver  — consistent participation
Gold    — strong contribution
Diamond — elite long-term milestones
```

## Notes

`UserAchievement` now has a unique user/achievement pair, so duplicate unlocks are blocked server-side.
