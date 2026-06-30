# Testing Summary

Current test stack:

- Vitest
- Supertest
- TypeScript compile checks
- Contract tests
- Service tests
- Optional guarded integration database tests

## Standard verification

Run before each commit:

```bash
pnpm check
pnpm test
pnpm build
```

Expected normal result:

- Unit/service/contract/API smoke tests pass.
- Integration tests skip unless `TEST_DATABASE_URL` is set.

## Test scripts

```bash
pnpm test              # all non-DB tests, integration skipped without TEST_DATABASE_URL
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage run
pnpm test:services     # service tests
pnpm test:contracts    # schema/route contract tests
pnpm test:api          # API smoke harness
pnpm test:integration  # DB integration tests, requires TEST_DATABASE_URL
```

## Integration database tests

Use a disposable database only.

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/animated_disco_test?schema=public"
pnpm test:integration:db:check
pnpm test:integration:db:push
pnpm test:integration
```

Reset only disposable DBs:

```bash
ALLOW_TEST_DB_RESET=true pnpm test:integration:db:reset
```

## Current covered areas

- Wallet service helpers and BEP-20 address validation.
- Mining service constants and active-session contract.
- Prisma schema safety contracts for referral commission idempotency and audit log availability.
- Wallet route safety contracts for withdrawal validation, force approval, and audit logging.
- API smoke harness sanity checks.
- Optional DB integration fixtures for referral commission and withdrawal reservation patterns.

## Recommended future coverage

- Auth register/login/logout integration tests.
- Deposit report and admin force approval integration tests.
- Withdrawal approve/reject/refund real DB tests.
- Notification preference and admin broadcast tests.
- Trust Loan config and claim eligibility tests.
- Admin user management audit-log tests.
