# Test Report

This report reflects the current automated test strategy after the testing foundation and integration database setup patches.

## Required quality gate

Before commit/deploy:

```bash
pnpm check
pnpm test
pnpm build
```

Passing status means:

- TypeScript compiles.
- Non-DB tests pass.
- Integration tests are skipped if `TEST_DATABASE_URL` is not set.
- Production build compiles frontend, backend, and service worker.

## Recent expected successful output

```txt
pnpm check ✅
pnpm test ✅
5 test files passed, 3 integration files skipped when TEST_DATABASE_URL is not configured
pnpm build ✅
```

## Known non-blocking build warnings

```txt
PostCSS plugin did not pass the from option
Circular chunk: vendor -> react-vendor -> vendor
Some chunks are larger than 600 kB after minification
```

These warnings do not currently block production build. Future bundle optimization can address manual chunks and lazy loading for large admin/dashboard areas.

## Integration test safety

The integration tests must never run against production. The helper guards are designed to reject unsafe URLs unless an explicitly safe test database is configured.

Use a database name or branch containing `test`, for example:

```txt
animated_disco_test
neon-test-branch
```

## Manual smoke checklist

After a successful build, manually check:

- Register/login/logout.
- Home summary loads.
- Wallet summary loads.
- Deposit address loads.
- Withdrawal validation rejects invalid address.
- Mining current/start/history work.
- Staking summary and create stake dialog load.
- Trust Loan page loads and displays current config.
- Notifications page loads and sound test works in foreground.
- Admin dashboard loads.
- Admin audit logs load.
- Admin scanner status loads.
- Admin users detail drawer opens.
- Health endpoints return expected status.
