import { ethers } from "ethers";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";

const RPC_URL = process.env.RPC_BSC_URL || "";
const USDT_ADDRESS = (process.env.USDT_BSC_ADDRESS || "").toLowerCase();
const TREASURY_ADDRESS = (process.env.XNRT_WALLET || "").toLowerCase();
const REQUIRED_CONFIRMATIONS = Number(process.env.BSC_CONFIRMATIONS || 12);
const XNRT_RATE = Number(process.env.XNRT_RATE_USDT || 100);
const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 0);
const SCAN_BATCH = Number(process.env.BSC_SCAN_BATCH || 1000);
const AUTO_DEPOSIT_ENABLED = process.env.AUTO_DEPOSIT === 'true';

// Validate RPC URL
if (!RPC_URL) {
  throw new Error("Missing RPC_BSC_URL environment variable");
}

try {
  const url = new URL(RPC_URL);
  console.log(`[DepositScanner] RPC endpoint: ${url.host}`);
} catch (e) {
  throw new Error(`Invalid RPC_BSC_URL: ${RPC_URL}`);
}

// Create provider with extended timeout and throttling for public nodes
// ethers v6 FetchRequest timeout - increase to 60s for heavy getLogs queries
const fetchReq = new ethers.FetchRequest(RPC_URL);
fetchReq.timeout = 60000; // 60 second timeout for RPC requests

const provider = new ethers.JsonRpcProvider(fetchReq, undefined, {
  staticNetwork: true,     // Disable automatic network detection for faster startup
  batchMaxCount: 1,        // Disable batching for better timeout handling  
  polling: false,          // Disable polling, we explicitly call methods
});
const USDT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);

let isScanning = false;

/**
 * Retry helper with exponential backoff for RPC calls
 * Handles transient errors like TIMEOUT, SERVER_ERROR, NETWORK_ERROR
 */
async function withRetry<T>(
  fn: () => Promise<T>, 
  label: string, 
  retries = 3
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      
      // Check if error is transient (retriable)
      const isTransient = 
        e?.code === "TIMEOUT" || 
        e?.code === "SERVER_ERROR" || 
        e?.code === "NETWORK_ERROR" ||
        e?.code === "ETIMEDOUT" ||
        e?.message?.includes("timeout") ||
        e?.message?.includes("ETIMEDOUT");
      
      // If not transient or last retry, throw immediately
      if (!isTransient || i === retries - 1) {
        throw e;
      }
      
      // Exponential backoff: 2s, 4s, 8s
      const delayMs = 1000 * Math.pow(2, i + 1);
      console.warn(
        `[DepositScanner] ${label} failed (${e?.code || e?.shortMessage || 'unknown error'}); ` +
        `retrying in ${delayMs}ms (attempt ${i + 1}/${retries})`
      );
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

export async function startDepositScanner() {
  if (!AUTO_DEPOSIT_ENABLED) {
    console.log("[DepositScanner] AUTO_DEPOSIT not enabled, scanner disabled");
    return;
  }

  const scanInterval = 60 * 1000; // 1 minute

  console.log("[DepositScanner] Starting scanner service...");
  console.log(`[DepositScanner] Treasury (legacy): ${TREASURY_ADDRESS}`);
  console.log(`[DepositScanner] USDT: ${USDT_ADDRESS}`);
  console.log(`[DepositScanner] Required confirmations: ${REQUIRED_CONFIRMATIONS}`);
  console.log(`[DepositScanner] Scan batch size: ${SCAN_BATCH}`);
  console.log(`[DepositScanner] Watching user deposit addresses...`);

  // Run immediately
  await scanForDeposits().catch(err => {
    console.error("[DepositScanner] Initial scan error:", err);
  });

  // Then run every minute
  setInterval(async () => {
    if (!isScanning) {
      await scanForDeposits().catch(err => {
        console.error("[DepositScanner] Scan error:", err);
      });
    }
  }, scanInterval);
}

async function scanForDeposits() {
  if (isScanning) return;
  
  isScanning = true;
  const startTime = Date.now();

  try {
    // Get or create scanner state
    let state = await prisma.scannerState.findFirst();
    
    // Get current block with retry logic
    const currentBlock = await withRetry(
      () => provider.getBlockNumber(),
      "getBlockNumber"
    );
    
    if (!state) {
      // Initialize scanner state
      let startBlock = currentBlock - 100; // Default: 100 blocks ago
      
      // Support BSC_START_FROM='latest' to start near tip
      if (process.env.BSC_START_FROM === 'latest') {
        startBlock = Math.max(0, currentBlock - REQUIRED_CONFIRMATIONS - 3);
        console.log(`[DepositScanner] Starting from latest (block ${startBlock})`);
      }
      
      state = await prisma.scannerState.create({
        data: {
          lastBlock: Math.max(0, startBlock),
          lastScanAt: new Date(),
          isScanning: true,
        }
      });
    }

    const fromBlock = state.lastBlock + 1;
    const toBlock = Math.min(currentBlock - REQUIRED_CONFIRMATIONS, fromBlock + SCAN_BATCH - 1);

    if (fromBlock > toBlock) {
      console.log(`[DepositScanner] No new blocks to scan`);
      await prisma.scannerState.update({
        where: { id: state.id },
        data: { isScanning: false, lastScanAt: new Date() }
      });
      return;
    }

    console.log(`[DepositScanner] Scanning blocks ${fromBlock} to ${toBlock}...`);

    // Get all active deposit addresses (supports both legacy 714 and new 60 coin types)
    const depositAddresses = await prisma.depositAddress.findMany({
      where: { active: true },
      select: { userId: true, address: true, coinType: true, version: true }
    });

    // Create address-to-userId mapping
    const addressToUserId = new Map<string, string>();
    depositAddresses.forEach(addr => {
      addressToUserId.set(addr.address.toLowerCase(), addr.userId);
    });

    console.log(`[DepositScanner] Watching ${depositAddresses.length} deposit addresses (${depositAddresses.filter(a => a.coinType === 714).length} legacy, ${depositAddresses.filter(a => a.coinType === 60).length} EVM)`);

    // Query USDT Transfer events to any address (we'll filter by user addresses)
    const filter = usdtContract.filters.Transfer();
    const events = await withRetry(
      () => usdtContract.queryFilter(filter, fromBlock, toBlock),
      `queryFilter blocks ${fromBlock}-${toBlock}`
    );

    console.log(`[DepositScanner] Found ${events.length} transfer events`);

    for (const event of events) {
      if (event instanceof ethers.EventLog) {
        await processDepositEvent(event, currentBlock, addressToUserId);
      }
    }

    // Update scanner state
    await prisma.scannerState.update({
      where: { id: state.id },
      data: {
        lastBlock: toBlock,
        lastScanAt: new Date(),
        isScanning: false,
        errorCount: 0,
        lastError: null,
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[DepositScanner] Scan completed in ${duration}ms`);

  } catch (error: any) {
    // Determine if error is critical or transient
    const isRpcError = 
      error?.code === "TIMEOUT" || 
      error?.code === "SERVER_ERROR" ||
      error?.code === "NETWORK_ERROR" ||
      error?.message?.includes("timeout") ||
      error?.message?.includes("connect");
    
    if (isRpcError) {
      console.warn(
        `[DepositScanner] RPC temporarily unavailable: ${error?.code || error?.message}. ` +
        `Will retry on next scan cycle.`
      );
    } else {
      console.error("[DepositScanner] Scan failed with unexpected error:", error);
    }
    
    // Update error state gracefully
    try {
      const state = await prisma.scannerState.findFirst();
      if (state) {
        await prisma.scannerState.update({
          where: { id: state.id },
          data: {
            isScanning: false,
            errorCount: state.errorCount + 1,
            lastError: `${error?.code || 'ERROR'}: ${error?.message || 'Unknown'}`,
            lastScanAt: new Date(),
          }
        });
      }
    } catch (dbError) {
      console.error("[DepositScanner] Failed to update error state:", dbError);
    }
  } finally {
    isScanning = false;
  }
}

async function processDepositEvent(
  event: ethers.EventLog, 
  currentBlock: number,
  addressToUserId: Map<string, string>
) {
  try {
    const txHash = event.transactionHash.toLowerCase();
    const from = ((event.args as any).from as string).toLowerCase();
    const to = ((event.args as any).to as string).toLowerCase();
    const value = (event.args as any).value as bigint;
    const blockNumber = event.blockNumber;
    const confirmations = currentBlock - blockNumber;

    // USDT has 18 decimals on BSC
    const usdtAmount = Number(ethers.formatUnits(value, 18));

    // Check if this transfer is to a user's deposit address
    const userId = addressToUserId.get(to);
    
    if (!userId) {
      // Not sent to a user deposit address, check if it's to treasury (legacy)
      if (to === TREASURY_ADDRESS) {
        // Legacy treasury deposit - check for linked wallet
        const linkedWallet = await prisma.linkedWallet.findFirst({
          where: { address: from, active: true }
        });

        if (linkedWallet) {
          // Skip if already processed
          const existing = await prisma.transaction.findFirst({
            where: { transactionHash: txHash }
          });
          if (existing) return;

          await processUserDeposit(
            linkedWallet.userId,
            to,
            from,
            usdtAmount,
            txHash,
            blockNumber,
            confirmations
          );
        }
      }
      return; // Not a user deposit
    }

    // Skip if already processed
    const existingTx = await prisma.transaction.findFirst({
      where: { transactionHash: txHash }
    });

    if (existingTx) {
      return; // Already processed
    }

    console.log(`[DepositScanner] New deposit: ${usdtAmount} USDT to user deposit address ${to}`);

    // Process user deposit
    await processUserDeposit(
      userId,
      to,
      from,
      usdtAmount,
      txHash,
      blockNumber,
      confirmations
    );
  } catch (error) {
    console.error("[DepositScanner] Event processing error:", error);
  }
}

async function processUserDeposit(
  userId: string,
  toAddress: string,
  fromAddress: string,
  usdtAmount: number,
  txHash: string,
  blockNumber: number,
  confirmations: number
) {
  try {
    // Calculate XNRT amount
    const netUsdt = usdtAmount * (1 - PLATFORM_FEE_BPS / 10_000);
    const xnrtAmount = netUsdt * XNRT_RATE;

    if (confirmations >= REQUIRED_CONFIRMATIONS) {
      // Enough confirmations - auto-credit
      await prisma.$transaction(async (tx) => {
        // Create approved transaction
        await tx.transaction.create({
          data: {
            userId,
            type: "deposit",
            amount: new Prisma.Decimal(xnrtAmount),
            usdtAmount: new Prisma.Decimal(usdtAmount),
            transactionHash: txHash,
            walletAddress: toAddress, // User's deposit address
            status: "approved",
            verified: true,
            confirmations,
            verificationData: {
              autoDeposit: true,
              blockNumber,
              scannedAt: new Date().toISOString(),
            } as any,
          }
        });

        // Credit balance atomically
        await tx.balance.upsert({
          where: { userId },
          create: {
            userId,
            xnrtBalance: new Prisma.Decimal(xnrtAmount),
            totalEarned: new Prisma.Decimal(xnrtAmount),
          },
          update: {
            xnrtBalance: { increment: new Prisma.Decimal(xnrtAmount) },
            totalEarned: { increment: new Prisma.Decimal(xnrtAmount) },
          },
        });
      });

      console.log(`[DepositScanner] Auto-credited ${xnrtAmount} XNRT to user ${userId}`);

      // Send notification (non-blocking)
      void sendDepositNotification(userId, xnrtAmount, txHash).catch(err => {
        console.error("[DepositScanner] Notification error:", err);
      });

    } else {
      // Not enough confirmations - create pending transaction
      await prisma.transaction.create({
        data: {
          userId,
          type: "deposit",
          amount: new Prisma.Decimal(xnrtAmount),
          usdtAmount: new Prisma.Decimal(usdtAmount),
          transactionHash: txHash,
          walletAddress: toAddress, // User's deposit address
          status: "pending",
          verified: true,
          confirmations,
          verificationData: {
            autoDeposit: true,
            blockNumber,
            scannedAt: new Date().toISOString(),
          } as any,
        }
      });

      console.log(`[DepositScanner] Pending deposit (${confirmations}/${REQUIRED_CONFIRMATIONS} confirmations)`);
    }
  } catch (error) {
    console.error("[DepositScanner] Linked deposit processing error:", error);
  }
}

async function sendDepositNotification(userId: string, amount: number, txHash: string) {
  // Import dynamically to avoid circular dependency
  const { notifyUser } = await import("../notifications");
  
  await notifyUser(userId, {
    type: "deposit_approved",
    title: "💰 Deposit Auto-Credited!",
    message: `Your deposit of ${amount.toLocaleString()} XNRT has been automatically credited to your account`,
    url: "/wallet",
    metadata: {
      amount: amount.toString(),
      transactionHash: txHash,
      autoDeposit: true,
    },
  });
}

// Export for manual trigger if needed
export { scanForDeposits, sendDepositNotification };
