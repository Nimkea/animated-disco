# Deployment Guide

This project builds a Vite React frontend and an Express backend.

## Build and start

```bash
pnpm install
pnpm prisma generate
pnpm check
pnpm test
pnpm build
pnpm start
```

Build output:

```txt
dist/public/   frontend + PWA assets
dist/index.js  bundled Express server
```

## Environment

Create `.env` from `.env.example` and set production secrets.

Minimum production secrets:

```env
NODE_ENV=production
DATABASE_URL=
JWT_SECRET=
APP_URL=https://your-domain.com
CLIENT_URL=https://your-domain.com
```

If using wallet/deposit features, also configure:

```env
RPC_BSC_URL=
USDT_BSC_ADDRESS=
XNRT_WALLET=
MASTER_SEED=
BSC_CONFIRMATIONS=12
XNRT_RATE_USDT=100
WITHDRAWAL_FEE_PERCENT=2
```

If using push notifications:

```env
ENABLE_PUSH_NOTIFICATIONS=true
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@your-domain.com
```

## Database setup

```bash
pnpm prisma generate
pnpm db:push
```

For production, use a dedicated production database and review schema changes before applying.

## Health checks

After deploy:

```bash
curl https://your-domain.com/api/health
curl https://your-domain.com/api/health/db
curl https://your-domain.com/readyz
```

## Scanner deployment note

The blockchain scanner runs inside the main Node process when enabled. This is simple but means only one production instance should run scanner writes unless the scanner is made distributed-lock-safe.

Recommended initial production settings:

```env
ENABLE_SCANNER=false
AUTO_DEPOSIT=false
```

Enable scanner only after manual deposit/report flows and RPC connectivity are verified.

## Upload storage note

Deposit proof screenshots are stored under `uploads/deposit-proofs` by default. If your hosting platform has an ephemeral filesystem, configure persistent disk or migrate proofs to object storage.

## Authentication note

Active auth is custom JWT email/password. Replit OIDC/Passport auth is not active.

## Common troubleshooting

### Prisma cannot reach Neon

Try:

```bash
pnpm prisma db push
nslookup your-neon-host
```

On WSL, restart networking from Windows PowerShell:

```powershell
wsl --shutdown
```

Then reopen WSL and retry.

### Prisma Client missing after install

If pnpm blocks Prisma build scripts:

```bash
pnpm approve-builds
pnpm prisma generate
```

Select `@prisma/client` and `prisma` if prompted.
