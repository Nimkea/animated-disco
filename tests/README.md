# Testing Foundation

This folder contains the first automated test layer for the XNRT app.

## Commands

```bash
pnpm test
pnpm test:services
pnpm test:contracts
pnpm test:api
pnpm test:integration
pnpm test:coverage
```

## Integration test database

Integration tests are opt-in and require a dedicated test database. They are skipped automatically when `TEST_DATABASE_URL` is missing.

1. Copy `.env.test.example` values into your shell or CI secret store.
2. Create a separate local Postgres database or a separate Neon branch/database with `test` in the name.
3. Push the schema to the test database:

```bash
TEST_DATABASE_URL="postgresql://.../animated_disco_test" pnpm test:integration:db:push
```

4. Run integration tests:

```bash
TEST_DATABASE_URL="postgresql://.../animated_disco_test" pnpm test:integration
```

To intentionally reset a disposable test DB:

```bash
TEST_DATABASE_URL="postgresql://.../animated_disco_test" ALLOW_TEST_DB_RESET=true pnpm test:integration:db:reset
```

Safety guards refuse URLs that do not look like test databases unless `ALLOW_REMOTE_TEST_DATABASE_URL=true` is explicitly set.

## Current scope

- Service/helper tests for wallet and mining behavior.
- Contract tests for Prisma schema safety rules.
- Contract tests for high-risk wallet/deposit/withdraw route safeguards.
- Supertest smoke harness using an isolated Express app.

## Next testing phase

The first integration tests cover:

1. Test database health and core table availability.
2. Referral commission idempotency through the unique ledger key.
3. Withdrawal reservation ledger pattern.

Next integration tests to add:

1. Mining session payout: exactly 10 XP + 5 XNRT after 24 hours.
2. Mining session idempotency: same completed session cannot pay twice.
3. Withdrawal rejection: rejected withdrawal refunds balance.
4. Deposit approval: verified deposits credit balance and trigger referral commission.

Do not point integration tests at the production Neon database. Use a separate `TEST_DATABASE_URL`.
