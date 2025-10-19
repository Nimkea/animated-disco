# XNRT Production Deployment Guide

This guide will help you deploy your XNRT platform to production with autoscale deployment.

## Prerequisites

Your autoscale deployment is already configured with:
- **Build Command**: `npm run build`
- **Run Command**: `node dist/index.js`
- **Deployment Type**: Autoscale

## Step 1: Database Setup

### Option A: Use Replit's Production Database (Recommended)
1. Open the **Database** tool from the left sidebar
2. Click **"Switch to Production"** at the top
3. Replit will automatically create and configure your production database
4. The `DATABASE_URL` will be automatically set in production

### Option B: Use External Database (Neon/Other)
If you prefer to use your own database:
1. Create a new production database in Neon (or your provider)
2. You'll add the connection string in the secrets section below

## Step 2: Configure Production Secrets

In the **Publishing** tool, go to the **Environment Variables** section and add these secrets:

### Required Secrets

#### 1. Database (if using external database)
```
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
```
**Note**: If using Replit's production database, skip this - it's automatic.

#### 2. Authentication & Security
```
SESSION_SECRET=[random-string-64-chars]
JWT_SECRET=[random-string-32-chars]
```
**Purpose**: These secure user sessions and JWT tokens. Use different values than development.

**Generate new secrets**:
```bash
# Generate SESSION_SECRET (64 characters)
openssl rand -base64 48

# Generate JWT_SECRET (32 characters)
openssl rand -base64 24
```

#### 3. Blockchain Configuration
```
MASTER_SEED=[your-master-wallet-seed-phrase]
RPC_BSC_URL=https://bsc-dataseed.binance.org/
USDT_BSC_ADDRESS=0x55d398326f99059fF775485246999027B3197955
```
**Purpose**: 
- `MASTER_SEED`: Generates unique deposit addresses for users (HD wallet)
- `RPC_BSC_URL`: Connects to Binance Smart Chain
- `USDT_BSC_ADDRESS`: USDT contract address on BSC

**⚠️ Security**: Your MASTER_SEED controls all user deposit addresses. Keep it secure!

#### 4. Push Notifications (VAPID)
```
VAPID_PUBLIC_KEY=[your-vapid-public-key]
VAPID_PRIVATE_KEY=[your-vapid-private-key]
```
**Purpose**: Enables web push notifications for users.

**Note**: You can reuse your development VAPID keys or generate new ones:
```bash
npx web-push generate-vapid-keys
```

#### 5. Email (Brevo SMTP)
```
SMTP_PASSWORD=[your-brevo-smtp-password]
```
**Purpose**: Sends verification emails, password resets, and notifications.

**Note**: The SMTP host, port, and user are hardcoded in the application:
- Host: `smtp-relay.brevo.com`
- Port: `587`
- User: `95624d002@smtp-brevo.com`

Get your SMTP password from your [Brevo account](https://app.brevo.com/).

## Step 3: Run Database Migrations

Once your production database is connected, you need to push your schema:

### If Using Replit Production Database:
1. In the terminal, run:
```bash
npm run db:push
```

### If Using External Database:
1. Temporarily set the DATABASE_URL in your terminal:
```bash
export DATABASE_URL="your-production-database-url"
npm run db:push
```

This creates all the necessary tables (users, deposits, withdrawals, stakes, etc.).

## Step 4: Verify Configuration

Before publishing, verify all secrets are set:

### Required Secrets Checklist
- [ ] `DATABASE_URL` (automatic with Replit DB, or manual)
- [ ] `SESSION_SECRET`
- [ ] `JWT_SECRET`
- [ ] `MASTER_SEED`
- [ ] `RPC_BSC_URL`
- [ ] `USDT_BSC_ADDRESS`
- [ ] `VAPID_PUBLIC_KEY`
- [ ] `VAPID_PRIVATE_KEY`
- [ ] `SMTP_PASSWORD`

## Step 5: Configure Autoscale Settings

In the Publishing tool:

1. **Machine Power**: 
   - Start with 0.5 vCPU / 1 GB RAM (should handle ~500-1000 concurrent users)
   - Increase if needed based on actual usage

2. **Max Number of Machines**:
   - Start with 2-3 machines
   - Autoscaling will create new instances during traffic spikes

3. **Cost Estimate**: 
   - The UI will show cost per compute unit
   - You only pay when the app is actively serving requests

## Step 6: Publish

1. Click **"Publish"** in the Publishing tool
2. Your app will build and deploy in 2-5 minutes
3. You'll get a production URL like `https://[your-repl].replit.app`

## Step 7: Post-Deployment Verification

Once deployed, verify these features:

### Test Checklist
- [ ] Homepage loads correctly
- [ ] User registration works
- [ ] Email verification sends
- [ ] Login works
- [ ] Database queries execute
- [ ] Deposit addresses generate
- [ ] Push notifications prompt (if enabled)
- [ ] Admin dashboard accessible

### Monitor Logs
Check deployment logs for:
- Database connection success
- DepositScanner initialization
- Push notification worker starting
- No critical errors

## Troubleshooting

### "Can't reach database server"
- Verify `DATABASE_URL` is set in production secrets
- If using Replit DB, make sure you switched to production database
- Check database is running (Neon status page if using Neon)

### "SMTP_PASSWORD environment variable is not set"
- Add `SMTP_PASSWORD` to production secrets
- Verify the password is correct in your Brevo account

### "Invalid VAPID keys"
- Ensure keys are in proper URL-safe Base64 format
- Regenerate with `npx web-push generate-vapid-keys` if needed

### DepositScanner not working
- Verify `RPC_BSC_URL` is set correctly
- Check `MASTER_SEED` is configured
- Ensure `USDT_BSC_ADDRESS` matches BSC mainnet USDT

### App not scaling
- Check autoscale max machines setting
- Verify deployment type is "Autoscale" (not VM or Scheduled)

## Production vs Development

### Differences
- **Database**: Separate production database (no test data)
- **Secrets**: Different SESSION_SECRET and JWT_SECRET for security
- **Monitoring**: Sentry and Web Vitals automatically enabled in production
- **Service Worker**: Active and caching assets for offline support
- **Domain**: Can add custom domain (xnrt.org) via deployment settings

### Security Best Practices
✅ Use strong, unique secrets for production  
✅ Keep MASTER_SEED extremely secure (controls all user funds)  
✅ Enable HTTPS only (automatic with Replit)  
✅ Monitor error logs regularly via Sentry  
✅ Regular database backups (Replit handles this automatically)  

## Custom Domain Setup

To use your own domain (e.g., xnrt.org):

1. Go to Publishing tool → **Domains**
2. Add your custom domain
3. Configure DNS records as shown in Replit UI
4. Wait for DNS propagation (5-30 minutes)
5. Replit automatically provisions SSL certificate

Your app already has 301 redirect configured to consolidate traffic on xnrt.org when in production mode.

## Support

If you encounter issues:
1. Check deployment logs for specific errors
2. Verify all secrets are configured correctly
3. Test database connectivity
4. Review this guide's troubleshooting section

---

**Ready to deploy?** Follow steps 1-6 above, then monitor your production deployment! 🚀
