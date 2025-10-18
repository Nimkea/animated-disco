# Production Environment Variables

This document lists all environment variables required for deploying XNRT to production.

## Critical Variables (Required)

These **MUST** be set in production secrets before deployment:

### Database & Session
- **`DATABASE_URL`**: PostgreSQL connection string
  - Example: `postgresql://user:password@host:5432/database`
  - Used by: Prisma, Drizzle, session store
  
- **`SESSION_SECRET`**: Secret key for session cookies (min 32 characters)
  - Example: `a-long-random-string-min-32-chars-for-security`
  - Generate with: `openssl rand -hex 32`

### Blockchain Integration
- **`MASTER_SEED`**: BIP39 mnemonic phrase for HD wallet (12-24 words)
  - Example: `word1 word2 word3 ... word12`
  - ⚠️ **CRITICAL**: Never lose this! It's used to derive all user deposit addresses
  - Generate with: Any BIP39 mnemonic generator (MetaMask, hardware wallet, etc.)
  
- **`RPC_BSC_URL`**: Binance Smart Chain RPC endpoint
  - Example: `https://bsc-dataseed.binance.org/`
  - Providers: Binance, Ankr, Infura, QuickNode
  
- **`USDT_BSC_ADDRESS`**: USDT contract address on BSC
  - Mainnet: `0x55d398326f99059ff775485246999027b3197955`
  - Testnet: `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd`

## Important Variables (Recommended)

These should be set for full functionality:

### Email Service (for verification/password reset)
- **`SMTP_PASSWORD`**: Brevo/SendinBlue SMTP password
  - Without this, email verification and password resets won't work

### Blockchain Configuration
- **`XNRT_WALLET`**: Treasury wallet address for receiving deposits
  - Example: `0x715c32dec9534d2fb34e0b567288af8d895efb59`
  
- **`AUTO_DEPOSIT`**: Enable automated deposit scanner
  - Set to: `true` (must be exactly 'true' to enable)
  - Default: `false` (scanner disabled)

### Push Notifications (optional)
- **`VAPID_PUBLIC_KEY`**: VAPID public key for web push
- **`VAPID_PRIVATE_KEY`**: VAPID private key for web push
- **`VAPID_SUBJECT`**: Contact email for push service
  - Default: `mailto:support@xnrt.org`

## Optional Configuration

These have sensible defaults but can be customized:

### Application URLs
- **`APP_URL`**: Base URL of your application
  - Default: `https://xnrt.org`
  - Used in: Email links, QR codes
  
- **`NODE_ENV`**: Environment mode
  - Set to: `production`
  - Auto-set by Replit deployment

### Blockchain Parameters
- **`BSC_CONFIRMATIONS`**: Required confirmations before crediting deposits
  - Default: `12` (~36 seconds on BSC)
  
- **`XNRT_RATE_USDT`**: How many XNRT per 1 USDT
  - Default: `100` (1 USDT = 100 XNRT)
  
- **`PLATFORM_FEE_BPS`**: Platform fee in basis points
  - Default: `0` (no fee)
  - Example: `250` = 2.5% fee
  
- **`BSC_SCAN_BATCH`**: Number of blocks to scan per batch
  - Default: `300`
  
- **`BSC_START_FROM`**: Starting block for scanner
  - Default: Latest block minus 500
  - Set to `latest` to start from current block

### Monitoring
- **`VITE_SENTRY_DSN`**: Sentry error tracking DSN (frontend)
  - Optional: Only if using Sentry

### Feature Flags
- **`ENABLE_PUSH_NOTIFICATIONS`**: Enable/disable push notifications
  - Default: `true`
  - Set to `false` to disable

## Setting Secrets in Replit

### For Development:
1. Click the "Tools" menu
2. Select "Secrets"
3. Add each variable as a key-value pair

### For Production:
⚠️ **IMPORTANT**: Secrets do NOT automatically transfer from development to production!

1. After publishing your Repl:
2. Go to your deployment dashboard
3. Navigate to "Environment Variables" or "Secrets"
4. Manually add ALL critical and important variables
5. Restart the deployment

## Verification Checklist

Before deploying to production, verify:

- [ ] `DATABASE_URL` points to production database (not development)
- [ ] `SESSION_SECRET` is strong and unique (not reused from dev)
- [ ] `MASTER_SEED` is backed up securely offline
- [ ] `RPC_BSC_URL` is reliable (consider paid provider for production)
- [ ] `USDT_BSC_ADDRESS` matches the network (mainnet vs testnet)
- [ ] `SMTP_PASSWORD` is set for email functionality
- [ ] `AUTO_DEPOSIT` is set to `true` to enable deposit scanner
- [ ] `APP_URL` matches your production domain

## Security Best Practices

1. **Never commit secrets** to git repository
2. **Backup `MASTER_SEED`** - losing it means losing access to all deposit addresses
3. **Use strong `SESSION_SECRET`** - minimum 32 random characters
4. **Separate dev/prod databases** - never use production DB in development
5. **Monitor `RPC_BSC_URL` uptime** - blockchain scanning depends on it
6. **Rotate secrets periodically** - especially after team changes

## Troubleshooting

### White screen in production?
- Check that `DATABASE_URL` is set and accessible
- Verify `SESSION_SECRET` is configured
- Ensure all critical variables are set

### Deposits not being credited?
- Verify `AUTO_DEPOSIT=true`
- Check `RPC_BSC_URL` is responding
- Confirm `USDT_BSC_ADDRESS` is correct
- Review `MASTER_SEED` is valid BIP39 mnemonic

### Email not sending?
- Ensure `SMTP_PASSWORD` is set
- Check `APP_URL` matches your domain

## Need Help?

If you encounter issues:
1. Check server logs for missing environment variable errors
2. Verify secrets are set in **production** environment (not just dev)
3. Test each critical service individually (database, blockchain RPC, email)
