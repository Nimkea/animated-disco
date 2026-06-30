# Deployment Checklist

Use this checklist before deploying XNRT to staging or production.

## 1. Local verification

```bash
pnpm install
pnpm prisma generate
pnpm check
pnpm test
pnpm build
```

Optional with a safe test DB:

```bash
pnpm test:integration:db:check
pnpm test:integration:db:push
pnpm test:integration
```

## 2. Database

- [ ] Production database is separate from development.
- [ ] `DATABASE_URL` points to the correct database.
- [ ] `pnpm db:push` or migrations have been applied.
- [ ] Prisma client generated with `pnpm prisma generate`.
- [ ] Neon/project is active and pooler endpoint is reachable.

Health checks after deploy:

```bash
curl https://your-domain.com/api/health
curl https://your-domain.com/api/health/db
curl https://your-domain.com/readyz
```

## 3. Required secrets

- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `APP_URL`
- [ ] `CLIENT_URL`
- [ ] `SMTP_PASSWORD` if email verification/reset is enabled

## 4. Blockchain / wallet secrets

- [ ] `RPC_BSC_URL`
- [ ] `USDT_BSC_ADDRESS`
- [ ] `XNRT_WALLET`
- [ ] `MASTER_SEED`
- [ ] `BSC_CONFIRMATIONS`
- [ ] `XNRT_RATE_USDT`
- [ ] `WITHDRAWAL_FEE_PERCENT`
- [ ] `DEPLOYER_PRIVATE_KEY` only if on-chain minting is enabled

## 5. Scanner rollout

Before enabling scanner:

- [ ] Test manual deposit report flow.
- [ ] Verify personal deposit address generation.
- [ ] Verify scanner status admin tab.
- [ ] Confirm RPC rate limits.
- [ ] Confirm unmatched deposits flow.
- [ ] Confirm admin audit logs are recording scanner events.

Then enable:

```env
ENABLE_SCANNER=true
AUTO_DEPOSIT=true
```

## 6. Push notifications

- [ ] Generate VAPID keys.
- [ ] Set `VAPID_PUBLIC_KEY`.
- [ ] Set `VAPID_PRIVATE_KEY`.
- [ ] Set `VAPID_SUBJECT`.
- [ ] Confirm `/api/notifications/status` reports configured/enabled.
- [ ] Test admin broadcast to one user before all users.

## 7. Deposit proof storage

Local storage writes to `uploads/deposit-proofs` by default.

For ephemeral platforms such as many serverless deployments:

- [ ] Use persistent disk or object storage.
- [ ] Back up uploads.
- [ ] Protect proof files from public direct listing.

## 8. Admin safety

- [ ] At least one admin account exists.
- [ ] Admin user actions are audited.
- [ ] Deposit force approval requires confirmation/reason.
- [ ] Withdrawal approval records admin notes/tx hash where applicable.
- [ ] Manual balance adjustments require a reason.

## 9. PWA checks

- [ ] Manifest loads.
- [ ] Service worker registers in production.
- [ ] Offline fallback works.
- [ ] Push subscription flow works.
- [ ] Install prompt works on mobile/desktop.

## 10. Production smoke test

After deploy:

- [ ] Register/login.
- [ ] `/auth/me` returns current user.
- [ ] Home dashboard loads.
- [ ] Wallet summary loads.
- [ ] Deposit address loads.
- [ ] Mining start/current/history work.
- [ ] Staking summary loads.
- [ ] Referrals page loads.
- [ ] Notifications page loads.
- [ ] Admin dashboard loads.
- [ ] Audit logs load.
- [ ] Health endpoints return expected status.
