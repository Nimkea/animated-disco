# 🔐 XNRT Production Secrets Guide

This document lists all environment variables needed for production deployment.

---

## 🚨 Critical Secrets (REQUIRED)

These **must** be configured in production or the app will fail:

### **1. DATABASE_URL**
**Purpose:** PostgreSQL database connection string  
**Format:** `postgresql://user:password@host:port/database?sslmode=require`  
**Where to get it:**
- Development: Already in your Secrets tab
- Production: Use Neon production database URL or create a new database

**Example:**
```
postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/xnrt_production?sslmode=require
```

---

### **2. MASTER_SEED**
**Purpose:** BIP39 mnemonic for generating unique user deposit addresses  
**Format:** 12-24 word mnemonic phrase  
**Security:** 🔴 **EXTREMELY CRITICAL** - Controls all user deposit addresses!

**⚠️ PRODUCTION WARNING:**
- **DO NOT** reuse development seed in production
- **MUST** generate a new cryptographically secure seed for production
- If compromised, all user deposits are at risk
- Store securely and never commit to Git

**Development seed (DO NOT USE IN PRODUCTION):**
```
urban base bundle stock sport cruise gadget lemon stick cluster mix squeeze
```

**Generate new production seed:**
```bash
# Use a BIP39 generator or wallet software
# Examples: Ian Coleman's BIP39 tool, hardware wallet, or:
node -e "const bip39 = require('bip39'); console.log(bip39.generateMnemonic());"
```

---

### **3. RPC_BSC_URL**
**Purpose:** Binance Smart Chain RPC endpoint for deposit scanner  
**Format:** HTTPS URL  

**Options:**

**Free Public RPCs (May have rate limits):**
```
https://bsc-dataseed.binance.org/
https://bsc-dataseed1.binance.org/
https://bsc-dataseed2.binance.org/
```

**Production-Grade Services (Recommended):**
- **QuickNode:** https://www.quicknode.com/chains/bsc (Free tier: 5M req/month)
- **Ankr:** https://www.ankr.com/rpc/bsc/ (Free tier available)
- **GetBlock:** https://getblock.io/nodes/bsc/ (Paid plans)

**Why paid RPC matters:**
- ✅ Higher rate limits
- ✅ Better uptime (99.9%+)
- ✅ Faster response times
- ✅ Archive node access

---

### **4. USDT_BSC_ADDRESS**
**Purpose:** USDT (BEP-20) contract address on BSC  
**Default:** `0x55d398326f99059fF775485246999027B3197955`

**⚠️ Use official USDT BSC contract only!**
Verify on BSCScan: https://bscscan.com/token/0x55d398326f99059ff775485246999027b3197955

---

### **5. SESSION_SECRET**
**Purpose:** Express session encryption key  
**Format:** Random string (min 32 characters)  
**Security:** 🔴 Critical - Used to encrypt user sessions

**Generate new production secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a3f8d9c2e1b4a7f6e9d2c5b8a1f4d7c0e3b6a9f2d5c8b1e4a7d0c3b6f9e2
```

---

### **6. ADMIN_PASSWORD**
**Purpose:** Admin dashboard access password  
**Format:** Strong password (min 12 characters)  
**Security:** 🟡 Important - Protects admin features

**Requirements:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Not dictionary word or common password

**Generate strong password:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

---

## ⚙️ Optional Secrets (With Defaults)

These have default values but should be customized for production:

### **7. JWT_SECRET**
**Purpose:** JWT token signing key  
**Default:** `your-secret-key-change-in-production` (⚠️ Change this!)  
**Recommended:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### **8. XNRT_WALLET**
**Purpose:** Treasury wallet address for receiving deposits  
**Format:** BSC wallet address (0x...)  
**Default:** None (optional)

If set, deposits can be forwarded to this central treasury wallet.

---

### **9. BSC_CONFIRMATIONS**
**Purpose:** Required block confirmations before crediting deposits  
**Default:** `12`  
**Recommended:** Keep at 12 for security (prevents double-spend attacks)

---

### **10. XNRT_RATE_USDT**
**Purpose:** XNRT to USDT conversion rate  
**Default:** `100` (1 USDT = 100 XNRT)  
**Format:** Number

Adjust based on your tokenomics.

---

### **11. PLATFORM_FEE_BPS**
**Purpose:** Platform fee in basis points (100 bps = 1%)  
**Default:** `0` (no fees)  
**Format:** Number (e.g., `250` = 2.5% fee)

---

### **12. APP_URL**
**Purpose:** Base URL for email links and callbacks  
**Default:** `https://xnrt.org`  
**Production:** Your actual deployment URL

**Examples:**
```
https://xnrt-production.repl.co
https://app.xnrt.com
```

---

### **13. CLIENT_URL**
**Purpose:** Frontend URL for CORS  
**Default:** `http://localhost:5000`  
**Production:** Same as APP_URL typically

---

### **14. AUTO_DEPOSIT**
**Purpose:** Enable automated deposit scanning  
**Default:** `false`  
**Production:** Set to `true` to enable deposit scanner

```
AUTO_DEPOSIT=true
```

---

### **15. BSC_SCAN_BATCH**
**Purpose:** Number of blocks to scan per batch  
**Default:** `300`  
**Adjust if scanner is slow or hitting RPC rate limits**

---

## 📧 Email Configuration (Optional)

For password reset and verification emails:

### **16. SMTP_PASSWORD**
**Purpose:** SMTP email service password  
**Service:** Brevo (formerly Sendinblue) or any SMTP provider

Configure your SMTP service and add credentials if you want email features.

---

## 🔔 Push Notifications (Optional)

For web push notifications:

### **17. VAPID_PUBLIC_KEY**
**Purpose:** VAPID public key for web push  
**Generate with:**
```bash
npx web-push generate-vapid-keys
```

### **18. VAPID_PRIVATE_KEY**
**Purpose:** VAPID private key for web push

### **19. VAPID_SUBJECT**
**Purpose:** Contact email for push notifications  
**Default:** `mailto:support@xnrt.org`  
**Format:** `mailto:your-email@domain.com`

### **20. ENABLE_PUSH_NOTIFICATIONS**
**Purpose:** Toggle push notification system  
**Default:** `true`  
**To disable:** Set to `false`

---

## 📝 Quick Deployment Checklist

When deploying to production, copy these secrets:

**Minimum Required (App won't start without these):**
- ✅ DATABASE_URL
- ✅ MASTER_SEED (generate new one!)
- ✅ RPC_BSC_URL
- ✅ USDT_BSC_ADDRESS
- ✅ SESSION_SECRET (generate new one!)
- ✅ ADMIN_PASSWORD

**Highly Recommended:**
- ✅ JWT_SECRET (generate new one!)
- ✅ APP_URL (your deployment URL)
- ✅ AUTO_DEPOSIT=true (enable scanner)
- ✅ XNRT_RATE_USDT (your token rate)

**Optional Enhancements:**
- 🔔 VAPID keys (for push notifications)
- 📧 SMTP_PASSWORD (for emails)
- 💰 PLATFORM_FEE_BPS (if charging fees)
- 🏦 XNRT_WALLET (if using treasury)

---

## 🚀 Adding Secrets to Replit Deployment

1. Click **Deploy** button (top right)
2. Go to **Manage** tab
3. Find **Environment Variables** section
4. Click **+ Add Variable** for each secret
5. Enter **Key** (e.g., `DATABASE_URL`) and **Value**
6. Click **Save**

**⚠️ Important:** Development secrets don't auto-transfer to production!

---

## 🔒 Security Best Practices

1. **Never commit secrets** to Git or share publicly
2. **Generate new secrets** for production (don't reuse dev)
3. **Use strong passwords** (min 32 chars for keys, 12+ for admin)
4. **Rotate secrets** periodically (every 90 days recommended)
5. **Limit access** to production secrets (team leads only)
6. **Backup MASTER_SEED** securely (without it, you lose deposit addresses)
7. **Use paid RPC** for production (free RPCs may be unreliable)

---

## ✅ Verification After Deployment

Test these after adding secrets:

```bash
# Check database connection
curl https://your-app.repl.co/api/health

# Verify deposit scanner started
# Check logs for: "Deposit scanner initialized successfully"

# Test user registration
# Should create account and generate deposit address

# Verify blockchain connectivity
# Scanner should not show "RPC_BSC_URL is not defined" errors
```

---

## 🆘 Troubleshooting

**"DATABASE_URL is not defined"**
→ Add DATABASE_URL to production environment variables

**"RPC_BSC_URL is not defined"**
→ Add RPC_BSC_URL secret (e.g., `https://bsc-dataseed.binance.org/`)

**"Deposit scanner not running"**
→ Check AUTO_DEPOSIT is set to `true` and RPC_BSC_URL is valid

**"Failed to generate deposit address"**
→ Verify MASTER_SEED is correctly set (12-24 word mnemonic)

**"Session errors / login not persisting"**
→ Ensure SESSION_SECRET is set and at least 32 characters

---

## 📌 Summary

Your XNRT deployment needs **6 critical secrets** to function:
1. DATABASE_URL
2. MASTER_SEED (⚠️ generate new for production!)
3. RPC_BSC_URL
4. USDT_BSC_ADDRESS
5. SESSION_SECRET (⚠️ generate new for production!)
6. ADMIN_PASSWORD

Everything else has defaults and can be configured later! 🎉
