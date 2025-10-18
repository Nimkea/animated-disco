# 🚀 XNRT Deployment - Step-by-Step Instructions

Follow these steps to deploy your XNRT platform to production.

---

## ⏱️ Estimated Time: 10-15 minutes

---

## 📋 Step 1: Prepare Production Secrets

You'll need to generate **new production secrets** (never reuse development secrets in production!).

### Generate These Now:

**1. SESSION_SECRET** (32+ character random string)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output ✅

**2. JWT_SECRET** (32+ character random string)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output ✅

**3. MASTER_SEED** (New BIP39 mnemonic - DO NOT use development seed!)
```bash
# Option A: Use online BIP39 generator (offline recommended)
# Visit: https://iancoleman.io/bip39/ → Generate → Copy 12 words

# Option B: Use Node.js
node -e "const bip39 = require('bip39'); console.log(bip39.generateMnemonic());"
```
Copy the 12-word phrase ✅  
⚠️ **CRITICAL:** Store this securely - it controls all deposit addresses!

**4. ADMIN_PASSWORD** (Strong password for admin access)
```bash
# Create a strong password (12+ characters)
# Mix uppercase, lowercase, numbers, symbols
# Example generator:
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```
Copy the password ✅

### Get These From Your Replit Secrets Tab:

1. Open **Secrets** (lock icon in sidebar)
2. Copy these values to your clipboard:
   - `DATABASE_URL` ✅
   - `RPC_BSC_URL` ✅
   - `USDT_BSC_ADDRESS` ✅

---

## 🎯 Step 2: Change Deployment Type to VM

**Why VM?** Your deposit scanner needs to run 24/7 to monitor blockchain. Autoscale spins down when idle, which would stop the scanner.

1. Click **"Cancel"** on the current "Change Deployment Type" dialog (if still open)
2. Click the **Deploy** button (top-right corner, next to "Republish")
3. In the Publishing interface, go to **"Manage"** tab
4. Find **"Change deployment type"** option
5. Select **"Reserved VM"** (instead of Autoscale)
6. Choose a plan:
   - **Shared vCPU** ($20/month) - Recommended for start
   - **Dedicated 1 vCPU** ($40/month) - Better performance
7. Click **Confirm**

---

## 🔧 Step 3: Add Production Environment Variables

Still in the Publishing tool:

1. Find the **"Environment Variables"** section
2. Click **"+ Add Variable"** for each secret below:

### Critical Secrets (Required):

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | (from Secrets tab) | PostgreSQL connection string |
| `MASTER_SEED` | (generated in Step 1) | ⚠️ NEW seed, not dev seed! |
| `RPC_BSC_URL` | (from Secrets tab) | BSC RPC endpoint |
| `USDT_BSC_ADDRESS` | (from Secrets tab) | USDT contract address |
| `SESSION_SECRET` | (generated in Step 1) | Session encryption key |
| `ADMIN_PASSWORD` | (generated in Step 1) | Admin dashboard password |
| `JWT_SECRET` | (generated in Step 1) | JWT signing key |

### Recommended Settings:

| Key | Value | Notes |
|-----|-------|-------|
| `AUTO_DEPOSIT` | `true` | Enables deposit scanner |
| `XNRT_RATE_USDT` | `100` | 1 USDT = 100 XNRT (adjust as needed) |
| `APP_URL` | (will set after deploy) | Your production URL |
| `CLIENT_URL` | (will set after deploy) | Same as APP_URL |
| `BSC_CONFIRMATIONS` | `12` | Block confirmations (recommended) |
| `PLATFORM_FEE_BPS` | `0` | Platform fee (0 = no fees) |

### Optional (For Later):

| Key | Value | Notes |
|-----|-------|-------|
| `VAPID_PUBLIC_KEY` | (generate with web-push) | For push notifications |
| `VAPID_PRIVATE_KEY` | (generate with web-push) | For push notifications |
| `VAPID_SUBJECT` | `mailto:your-email@domain.com` | Contact email |
| `SMTP_PASSWORD` | (from email provider) | For password reset emails |
| `XNRT_WALLET` | (BSC wallet address) | Optional treasury wallet |

3. Click **"Save"** after adding all variables

---

## 🚀 Step 4: Deploy!

1. Still in Publishing tool, review your settings:
   - ✅ Deployment type: **Reserved VM**
   - ✅ All critical environment variables added
   - ✅ Build command: `npm run build`
   - ✅ Run command: `npm start`

2. Click **"Deploy"** (or "Republish" if updating existing deployment)

3. Wait for build process (~2-3 minutes):
   - ⏳ Building frontend (Vite)
   - ⏳ Building backend (esbuild)
   - ⏳ Generating service worker
   - ⏳ Starting production server

4. Build complete! You'll see your production URL:
   ```
   https://your-repl-name.repl.co
   ```

---

## 🔗 Step 5: Update APP_URL Environment Variables

Now that you have your production URL:

1. Go back to **Environment Variables**
2. Update these values:
   - `APP_URL` = `https://your-repl-name.repl.co`
   - `CLIENT_URL` = `https://your-repl-name.repl.co`
3. Click **Save**
4. **Redeploy** to apply changes

---

## ✅ Step 6: Verify Deployment

Open your production URL and test:

### 🎨 Visual Checks:
- [ ] Cosmic starfield background loads (black with golden stars)
- [ ] XNRT logo and branding visible
- [ ] No console errors (press F12)
- [ ] Icons load without 404 errors
- [ ] Responsive design works on mobile

### 🔐 Authentication Test:
1. Click **"Get Started"** or **"Register"**
2. Create a test account
3. Verify you can log in
4. Check you receive a unique deposit address in Deposit page

### 💰 Deposit System Test:
1. Go to **Deposit** page
2. Verify you see:
   - ✅ Your personal BSC deposit address (unique to your account)
   - ✅ QR code for the address
   - ✅ "Copy Address" button works
3. **Check deposit scanner in logs:**
   - Go to **Deployments** → **Logs**
   - Look for: `"Deposit scanner initialized successfully"`
   - Should see: `"Scanning blockchain..."`

### 🎮 Earning Features Test:
- [ ] Navigate to **Staking** page
- [ ] Navigate to **Mining** page
- [ ] Navigate to **Referrals** page
- [ ] All pages load without errors

### 🛡️ Admin Dashboard Test:
1. Log out (if logged in as regular user)
2. Visit `/admin` or click profile → Admin (if you have access)
3. Log in with `ADMIN_PASSWORD` from Step 1
4. Verify admin dashboard loads

### 📱 PWA Test:
1. On mobile or desktop Chrome:
2. Look for **"Install"** button or browser prompt
3. Install the PWA
4. Verify it opens as standalone app
5. Test offline mode (DevTools → Network → Offline)

---

## 🔍 Step 7: Monitor Logs

Watch your production logs for the first 5-10 minutes:

1. Go to **Deployments** → **Logs**
2. Look for:
   ```
   ✅ "Server listening on port 5000"
   ✅ "Database connected successfully"
   ✅ "Deposit scanner initialized successfully"
   ✅ "Scanning blockchain..."
   ```

3. **No errors** should appear about:
   - ❌ Missing environment variables
   - ❌ Database connection failures
   - ❌ RPC connection errors

If you see errors, check **Troubleshooting** section in `docs/PRODUCTION_SECRETS.md`

---

## 🎉 Success Indicators

Your deployment is successful if:

✅ **Landing page loads** with cosmic theme  
✅ **User registration works**  
✅ **Each user gets unique deposit address**  
✅ **Deposit scanner is running** (check logs)  
✅ **No console errors**  
✅ **All earning pages accessible**  
✅ **Admin dashboard accessible**  
✅ **PWA installable**  

---

## 📊 Step 8: Monitor Usage & Costs

1. Go to **Deployments** → **Usage**
2. Monitor:
   - Compute units consumed
   - Request counts
   - Monthly cost projection

**Expected costs:**
- **Base:** $20/month (Shared VM)
- **Traffic:** $1.20 per million requests
- **Compute:** $3.20 per million compute units

For low-moderate traffic, expect **$20-30/month total**.

---

## 🔄 Updating Your Deployment

When you make code changes:

1. **Automatic:** Changes are deployed when you push to Git
2. **Manual:** Go to Deployments → Click "Deploy" again
3. Users see update notification in browser
4. They click "Update Now" to get latest version

---

## 🆘 Troubleshooting

### Build Fails
- Check **Deployments** → **Logs** for errors
- Common issues:
  - TypeScript errors → Fix in code
  - Missing packages → Reinstall dependencies
  - Environment variable errors → Add missing secrets

### App Won't Start
- Check logs for "port already in use" → Stop old deployment
- Verify `DATABASE_URL` is correct
- Ensure all critical secrets are set

### Deposit Scanner Not Working
```
Error: "RPC_BSC_URL is not defined"
→ Add RPC_BSC_URL to environment variables

Error: "Failed to generate deposit address"  
→ Verify MASTER_SEED is correctly set (12-24 words)

No "Deposit scanner initialized" in logs
→ Check AUTO_DEPOSIT is set to "true"
```

### Database Errors
- Verify `DATABASE_URL` format is correct
- Check database allows external connections
- Ensure SSL mode is enabled (`?sslmode=require`)

---

## 🎯 Post-Deployment Checklist

After deployment is live:

**Security:**
- [ ] Backup MASTER_SEED securely (offline storage recommended)
- [ ] Store admin password in password manager
- [ ] Enable 2FA on Replit account
- [ ] Review environment variables (no exposed secrets)

**Monitoring:**
- [ ] Set up uptime monitoring (e.g., UptimeRobot)
- [ ] Configure Sentry for error tracking (optional)
- [ ] Set billing alerts on Replit
- [ ] Bookmark production logs page

**Documentation:**
- [ ] Share production URL with team
- [ ] Document admin access procedure
- [ ] Note XNRT_RATE_USDT setting
- [ ] Record deployment date

**User Communication:**
- [ ] Announce launch to community
- [ ] Share deposit instructions (use unique addresses)
- [ ] Provide support contact
- [ ] Monitor user feedback

---

## 🌐 Optional: Custom Domain Setup

Want to use your own domain (e.g., `app.xnrt.com`)?

### Option A: Buy Through Replit
1. **Deployments** → **Domains** → **Buy Domain**
2. Search and purchase
3. Replit auto-configures DNS
4. SSL certificate auto-issued

### Option B: Use Existing Domain
1. **Deployments** → **Domains** → **Add Custom Domain**
2. Replit provides DNS records:
   ```
   A Record: @ → [Replit IP]
   TXT Record: @ → [Verification code]
   ```
3. Add these to your domain registrar (GoDaddy, Namecheap, etc.)
4. Wait 5 mins - 48 hours for DNS propagation
5. SSL certificate auto-issued once verified

---

## 🎊 Congratulations!

Your XNRT earning platform is now **LIVE** with:

✅ Fully automated deposit system  
✅ Personal BSC deposit addresses for each user  
✅ 24/7 blockchain scanning  
✅ Automated earning mechanics  
✅ Secure authentication  
✅ Admin dashboard  
✅ PWA functionality  

**Next Steps:**
- Monitor logs for first 24 hours
- Test with small USDT deposits
- Gather user feedback
- Scale as needed

**Need Help?**
- Check logs: **Deployments** → **Logs**
- Review docs: `docs/PRODUCTION_SECRETS.md`
- Replit support: https://replit.com/support

**Good luck with your launch! 🚀✨**
