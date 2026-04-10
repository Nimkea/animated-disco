# XNRT Token — BSC Testnet Deployment Guide

## Prerequisites

1. **Node.js** 18+, **pnpm** (or npm)
2. A BSC Testnet wallet with **at least 0.1 BNB** for gas
3. The deployer wallet's **private key** (0x-prefixed)

---

## Step 1 — Get Testnet BNB

Fund your deployer wallet using the official BNB Chain faucet:

- **Faucet**: https://testnet.binance.org/faucet-smart
- Enter your wallet address and request test BNB
- Wait ~30 seconds for the transaction to confirm

You can verify your balance on the testnet explorer:
https://testnet.bscscan.com/address/YOUR_WALLET_ADDRESS

---

## Step 2 — Install solc

The deploy script uses the `solc` npm package to compile the contract:

```bash
pnpm add -D solc
# or: npm install --save-dev solc
```

---

## Step 3 — Set environment variables

```bash
export DEPLOYER_PRIVATE_KEY=0xyour_private_key_here
# Optional: use a custom RPC (defaults to public BSC Testnet RPC)
export BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
```

> **Security**: Never commit your private key. For production, use a hardware wallet
> or KMS-managed key. The testnet key is only for testing.

---

## Step 4 — Run the deploy script

From the project root:

```bash
npx tsx contracts/deploy.ts
```

Expected output:

```
Connected to BSC Testnet (chainId: 97)
Deployer address: 0xYOUR_ADDRESS
Deployer BNB balance: 0.1 BNB
Compiling XNRTToken.sol ...
Compilation successful.
Deploying XNRTToken ...

✅ XNRTToken deployed!
   Address    : 0xABCDEF...
   Tx hash    : 0x123456...
   Block      : 45678901
   Explorer   : https://testnet.bscscan.com/token/0xABCDEF...

   Wrote 0xABCDEF... to contracts/.env.testnet
   Add this to your server's environment as XNRT_TOKEN_ADDRESS.
   ABI written to contracts/XNRTToken.abi.json
```

---

## Step 5 — Configure server secrets

Set these two secrets in your Replit project (Settings → Secrets):

| Secret | Value |
|--------|-------|
| `XNRT_TOKEN_ADDRESS` | The deployed contract address (from Step 4 output) |
| `DEPLOYER_PRIVATE_KEY` | The same private key used to deploy |

Then restart the application. On-chain withdrawals are now live.

---

## Verifying the contract

After deployment, verify on BSC Testnet explorer:

```
https://testnet.bscscan.com/token/YOUR_CONTRACT_ADDRESS
```

You can also test a manual mint using the explorer's Write Contract interface
(connect MetaMask, call `mint(address, amount)`).

---

## Recompiling (if you modify XNRTToken.sol)

The deploy script compiles fresh from `contracts/XNRTToken.sol` on each run.
No additional steps needed — just re-run `npx ts-node contracts/deploy.ts`.

Alternatively, use Remix IDE (https://remix.ethereum.org):
1. Paste the Solidity source into a new file
2. Compile with Solidity 0.8.20 + optimizer enabled (200 runs)
3. Deploy to "Injected Provider - MetaMask" using a testnet-connected wallet

---

## Architecture note

- The XNRT contract has **no fixed supply cap** — tokens are minted on demand
  as users earn and withdraw XNRT from the platform.
- The deployer wallet is the token's `owner`; ownership can be transferred via
  `transferOwnership(newOwner)` if the platform wallet changes.
- BSC Testnet ChainID: **97**
- BSC Mainnet ChainID: **56** (not targeted by this guide)
