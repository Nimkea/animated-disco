# Security Fixes & HD Wallet Migration Summary

## Date: October 19, 2025

This document summarizes the critical security fixes and HD wallet architecture upgrade deployed to the XNRT platform.

---

## 🔒 Security Fixes

### 1. JWT Authentication Hardening
**Issue**: Hardcoded fallback secret `'your-secret-key-change-in-production'` in `server/auth/jwt.ts`  
**Fix**: Removed fallback and added JWT_SECRET to mandatory environment validation  
**Impact**: Prevents production deployments with insecure JWT signing  
**Files Modified**:
- `server/auth/jwt.ts` - Removed fallback secret
- `server/validateEnv.ts` - Added JWT_SECRET validation (min 32 characters)

### 2. Database Connection Pool Management
**Issue**: Multiple `new PrismaClient()` instances causing connection exhaustion  
**Fix**: Implemented singleton Prisma client pattern  
**Impact**: Prevents database connection leaks and improves stability  
**Files Modified**:
- `server/db.ts` - Created singleton pattern with global caching
- Replaced 11 instances across:
  - `server/routes.ts`
  - `server/storage.ts` 
  - `server/scripts/*.ts`
  - `prisma/seed.ts`

### 3. Environment Variable Validation
**Added Required Variables**:
- `JWT_SECRET` - JWT token signing (min 32 chars)
- `VAPID_PUBLIC_KEY` - Web Push notifications public key
- `VAPID_PRIVATE_KEY` - Web Push notifications private key  
- `SMTP_PASSWORD` - Email service authentication

**Validation Features**:
- Server aborts startup if any critical variable is missing
- Clear error messages guide users to fix configuration
- BIP39 mnemonic validation for MASTER_SEED (12/15/18/21/24 words)

---

## 🔐 HD Wallet Architecture Upgrade

### Background
The platform previously used BIP44 derivation path `m/44'/714'/0'/0/{index}` (BNB Beacon Chain coin type). This caused compatibility issues with MetaMask and standard EVM wallets, which expect coin type 60 (Ethereum/EVM standard).

### Solution: Multi-Path Address Support

#### 1. New Derivation Standard
**Changed**: `m/44'/714'/0'/0/{index}` → `m/44'/60'/0'/0/{index}`  
**Reason**: Coin type 60 is the EVM standard used by MetaMask, Trust Wallet, and all major EVM wallets  
**Compatibility**: Works with BSC, Ethereum, Polygon, and all EVM-compatible chains

#### 2. DepositAddress Table
Created new table to support multiple deposit addresses per user:

```sql
CREATE TABLE "DepositAddress" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES "User"(id),
  address TEXT NOT NULL,
  coinType INTEGER NOT NULL,       -- 714 (legacy) or 60 (EVM)
  derivationIndex INTEGER NOT NULL,
  derivationPath TEXT NOT NULL,
  version INTEGER NOT NULL,         -- 1 (legacy) or 2 (EVM)
  active BOOLEAN NOT NULL,
  createdAt TIMESTAMP NOT NULL,
  UNIQUE(userId, address),
  UNIQUE(userId, coinType)
);
```

#### 3. Backward Compatibility Strategy

**Migration Approach**:
1. Existing users keep their legacy (714) addresses **active**
2. New EVM (60) addresses generated for all users
3. Scanner monitors **both** address types simultaneously
4. No deposits are lost during transition

**Address Distribution After Migration**:
- Total addresses: 20 (10 users × 2 addresses each)
- Legacy (714): 10 addresses - remain active for incoming deposits
- EVM (60): 10 addresses - shown to users for new deposits
- Active monitoring: All 20 addresses

**Example User State**:
```
User: NextGen
├─ Legacy Address (714): 0xf90346ff5f9ff0f1aa403b99eff8bff37da95a18 (active)
└─ EVM Address (60):     0x44fa0aa526f27e2cca87f6b756d8307ec0d22069 (active, shown to user)
```

#### 4. Scanner Updates
**File**: `server/services/depositScanner.ts`

**Before**:
```typescript
const users = await prisma.user.findMany({
  where: { depositAddress: { not: null } },
  select: { id: true, depositAddress: true }
});
```

**After**:
```typescript
const depositAddresses = await prisma.depositAddress.findMany({
  where: { active: true },
  select: { userId: true, address: true, coinType: true, version: true }
});
```

**Scanner Output**:
```
[DepositScanner] Watching 20 deposit addresses (10 legacy, 10 EVM)
```

#### 5. HD Wallet Service Updates
**File**: `server/services/hdWallet.ts`

**New Functions**:
- `getCurrentDerivationInfo()` - Returns current standard (60, v2)
- `deriveAddressWithCoinType(index, coinType)` - Derive address with custom coin type
- `getDerivedPrivateKey(index, coinType = 60)` - Support legacy sweeping

**Example Usage**:
```typescript
// New EVM address (default)
const newAddr = deriveDepositAddress(0);
// Result: 0x44fa0aa526f27e2cca87f6b756d8307ec0d22069

// Legacy address (for verification)
const legacyAddr = deriveAddressWithCoinType(0, 714);
// Result: 0xf90346ff5f9ff0f1aa403b99eff8bff37da95a18

// Private keys (for sweeper)
const pkNew = getDerivedPrivateKey(0, 60);      // EVM
const pkLegacy = getDerivedPrivateKey(0, 714);  // Legacy
```

---

## 🛡️ Transaction Idempotency

### Issue
Single-column unique constraint on `transactionHash` could miss edge case where one blockchain transaction sends USDT to multiple user addresses.

### Fix
**Changed**: `@@unique([transactionHash])` → `@@unique([transactionHash, walletAddress])`

**Impact**:
- Prevents double-crediting if one TX sends to multiple users
- Each (transaction, recipient) pair is tracked separately
- Maintains idempotency for normal single-recipient deposits

**Database Constraint**:
```sql
CREATE UNIQUE INDEX "Transaction_transactionHash_walletAddress_key" 
ON "Transaction" (transactionHash, walletAddress);
```

---

## 📊 Migration Results

### Database Migration
```bash
✅ Prisma schema pushed successfully
✅ DepositAddress table created
✅ Composite unique constraint added to Transaction table
```

### Address Backfill
```
📊 Found 10 users with deposit addresses
✅ Migrated: 10 users
⏭️  Skipped: 0 users (already migrated)
❌ Errors: 0 users
🎉 Migration completed successfully!
```

### Verification Checks
- ✅ 20 deposit addresses created (10 legacy + 10 EVM)
- ✅ All addresses marked as `active = true`
- ✅ Scanner monitoring both coin types
- ✅ User.depositAddress updated to show new EVM addresses
- ✅ HD wallet functions tested for both coin types
- ✅ Private key derivation works for legacy sweeping

---

## 🚀 Production Deployment Checklist

### Required Environment Variables
Ensure all these are set before deployment:

```bash
# Authentication & Sessions
JWT_SECRET=<64-char random string>
SESSION_SECRET=<existing>

# HD Wallet (BIP39 Mnemonic)
MASTER_SEED=<12 or 24 word mnemonic>

# Blockchain
RPC_BSC_URL=<BSC RPC endpoint>
USDT_BSC_ADDRESS=0x55d398326f99059fF775485246999027B3197955

# Email Service
SMTP_PASSWORD=<Brevo API key>

# Push Notifications
VAPID_PUBLIC_KEY=<existing>
VAPID_PRIVATE_KEY=<existing>

# Database (auto-configured by Replit)
DATABASE_URL=<auto>
```

### Migration Steps (Already Completed in Dev)
1. ✅ Deploy schema changes via `npm run db:push`
2. ✅ Run migration script: `npx tsx server/scripts/migrateDepositAddresses.ts`
3. ✅ Verify scanner picks up both address types
4. ✅ Test HD wallet derivation for both coin types

### For Production Deployment:
1. Set all required environment variables in Replit Secrets
2. Deploy schema changes (already done in dev)
3. Run migration script to backfill existing addresses
4. Monitor scanner logs to confirm both coin types are being watched
5. No user action required - deposits to legacy addresses continue working

---

## 📖 Technical References

### BIP44 Derivation Paths
- **EVM Standard (new)**: `m/44'/60'/0'/0/{index}` - Ethereum, BSC, Polygon
- **Legacy BNB (old)**: `m/44'/714'/0'/0/{index}` - BNB Beacon Chain

### Coin Type Standards
- `60` - Ethereum and all EVM-compatible chains (BSC, Polygon, Avalanche, etc.)
- `714` - BNB Beacon Chain (legacy, non-EVM)

### Resources
- [BIP44 Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [Registered Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [MetaMask HD Wallet Derivation](https://docs.metamask.io/wallet/concepts/accounts-and-addresses/)

---

## 🎯 Impact Summary

### Security Improvements
- ✅ No more hardcoded JWT secrets in production
- ✅ Database connection pool properly managed
- ✅ All critical environment variables validated at startup
- ✅ Transaction idempotency guaranteed

### User Experience
- ✅ New deposits use MetaMask-compatible addresses (coin type 60)
- ✅ Legacy deposits continue working (both coin types monitored)
- ✅ No user intervention required during migration
- ✅ No deposits lost or missed during transition

### System Reliability
- ✅ Scanner monitors both address types simultaneously
- ✅ HD wallet functions support both legacy and new addresses
- ✅ Sweeper can derive private keys for all address types
- ✅ Zero downtime migration

---

**Status**: ✅ All fixes deployed and tested in development  
**Next Step**: Production deployment when ready
