# Environment Variables

Copy `.env.example` to `.env` for local development.

```bash
cp .env.example .env
```

Never commit `.env`.

## Required variables

### `DATABASE_URL`
PostgreSQL connection URL used by Prisma.

For Neon, use the pooler URL in production/serverless environments.

Example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

### `JWT_SECRET`
Required for custom JWT auth. Must be at least 32 characters.

Generate:

```bash
openssl rand -base64 64
```

### `APP_URL`
Canonical backend/public app URL. Used for email links and production redirects.

Examples:

```env
APP_URL=http://localhost:5000
APP_URL=https://your-domain.com
```

### `CLIENT_URL`
Frontend URL allowed by CORS/origin logic.

For same-origin production, it can match `APP_URL`.

## Database and startup

### `SKIP_STARTUP_SEEDS`
When `true`, startup skips default task/achievement seeding.

Useful during DB outage troubleshooting:

```env
SKIP_STARTUP_SEEDS=true
```

## Email

Current email service reads `SMTP_PASSWORD`. Some SMTP host/user values may be hardcoded in the existing mail service; `.env.example` also includes future-compatible SMTP fields.

```env
SMTP_PASSWORD=secret
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
EMAIL_FROM=no-reply@xnrt.org
```

## Wallet rates

```env
XNRT_RATE_USDT=100
WITHDRAWAL_FEE_PERCENT=2
PLATFORM_FEE_BPS=0
```

Meaning:

- `XNRT_RATE_USDT=100`: 1 USDT = 100 XNRT.
- `WITHDRAWAL_FEE_PERCENT=2`: 2% withdrawal fee.
- `PLATFORM_FEE_BPS=0`: deposit platform fee in basis points.

## BSC / blockchain verification

```env
RPC_BSC_URL=https://bsc-dataseed.binance.org/
USDT_BSC_ADDRESS=0x55d398326f99059fF775485246999027B3197955
XNRT_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
XNRT_WALLET=0x0000000000000000000000000000000000000000
BSC_CONFIRMATIONS=12
BSC_SCAN_BATCH=300
BSC_START_FROM=latest
```

### Scanner controls

```env
ENABLE_SCANNER=false
AUTO_DEPOSIT=false
```

Recommended:

- Local dev: `false`
- Production: enable only after RPC, treasury, HD seed, and monitoring are verified.

## HD wallet seed

```env
MASTER_SEED=replace-with-secure-production-seed-or-mnemonic
```

This controls personal deposit address generation. Treat it like a private key.

## Token minting

```env
DEPLOYER_PRIVATE_KEY=
```

Only set when the token service must sign on-chain transactions. Never expose it to client-side code.

## Deposit proof storage

```env
DEPOSIT_PROOF_UPLOAD_DIR=uploads/deposit-proofs
DEPOSIT_PROOF_MAX_BYTES=2097152
```

Local filesystem storage is suitable for local/dev and persistent servers. For ephemeral hosting, migrate this to S3/Supabase Storage/R2 or another object store.

## Push notifications

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Then set:

```env
ENABLE_PUSH_NOTIFICATIONS=true
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@xnrt.org
```

## Referral/company fallback

```env
REFERRAL_COMPANY_EMAIL=
COMPANY_ADMIN_EMAIL=
```

Used when referral commission fallback/company handling is required.

## Monitoring

```env
VITE_SENTRY_DSN=
```

Optional.

## Feature flags

```env
VITE_FEATURE_FLAGS={"pwa":{"offline":true,"push":true,"realtime":false},"ux":{"animations":true,"haptics":false,"sounds":true},"admin":{"analytics":true,"advancedFeatures":true}}
```

Leave empty to use defaults.

## Test database

Use a disposable test database only:

```env
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/animated_disco_test?schema=public
ALLOW_TEST_DB_RESET=false
```

Run integration DB tests:

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/animated_disco_test?schema=public"
pnpm test:integration:db:push
pnpm test:integration
```
