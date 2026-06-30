# Testing Foundation

This folder contains the first automated test layer for the XNRT app.

## Commands

```bash
pnpm test
pnpm test:services
pnpm test:contracts
pnpm test:api
pnpm test:coverage
```

## Current scope

- Service/helper tests for wallet and mining behavior.
- Contract tests for Prisma schema safety rules.
- Contract tests for high-risk wallet/deposit/withdraw route safeguards.
- Supertest smoke harness using an isolated Express app.

## Next testing phase

Once a safe test database is configured, add real integration tests for:

1. Mining session payout: exactly 10 XP + 5 XNRT after 24 hours.
2. Mining session idempotency: same completed session cannot pay twice.
3. Referral commission idempotency: same deposit cannot pay duplicate commissions.
4. Withdrawal reservation: pending withdrawal reserves balance.
5. Withdrawal rejection: rejected withdrawal refunds balance.
6. Deposit approval: verified deposits credit balance and trigger referral commission.

Do not point integration tests at the production Neon database. Use a separate `TEST_DATABASE_URL`.
