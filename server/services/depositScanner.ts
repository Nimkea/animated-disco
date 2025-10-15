import { ethers } from "ethers";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const RPC_URL = process.env.RPC_BSC_URL || "";
const USDT_ADDRESS = (process.env.USDT_BSC_ADDRESS || "").toLowerCase();
const TREASURY_ADDRESS = (process.env.XNRT_WALLET || "").toLowerCase();
const REQUIRED_CONFIRMATIONS = Number(process.env.BSC_CONFIRMATIONS || 12);
const XNRT_RATE = Number(process.env.XNRT_RATE_USDT || 100);
const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 0);
const SCAN_BATCH = Number(process.env.BSC_SCAN_BATCH || 300);
const AUTO_DEPOSIT_ENABLED = process.env.AUTO_DEPOSIT === 'true';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const USDT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);

let isScanning = false;

export async function startDepositScanner() {
  if (!AUTO_DEPOSIT_ENABLED) {
    console.log("[DepositScanner] AUTO_DEPOSIT not enabled, scanner disabled");
    return;
  }

  const scanInterval = 60 * 1000; // 1 minute

  console.log("[DepositScanner] Starting scanner service...");
  console.log(`[DepositScanner] Treasury: ${TREASURY_ADDRESS}`);
  console.log(`[DepositScanner] USDT: ${USDT_ADDRESS}`);
  console.log(`[DepositScanner] Required confirmations: ${REQUIRED_CONFIRMATIONS}`);
  console.log(`[DepositScanner] Scan batch size: ${SCAN_BATCH}`);

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
    const currentBlock = await provider.getBlockNumber();
    
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

    // Query USDT Transfer events to treasury
    const filter = usdtContract.filters.Transfer(null, TREASURY_ADDRESS);
    const events = await usdtContract.queryFilter(filter, fromBlock, toBlock);

    console.log(`[DepositScanner] Found ${events.length} transfer events`);

    for (const event of events) {
      if (event instanceof ethers.EventLog) {
        await processDepositEvent(event, currentBlock);
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
    console.error("[DepositScanner] Scan failed:", error);
    
    // Update error state
    const state = await prisma.scannerState.findFirst();
    if (state) {
      await prisma.scannerState.update({
        where: { id: state.id },
        data: {
          isScanning: false,
          errorCount: state.errorCount + 1,
          lastError: error.message,
          lastScanAt: new Date(),
        }
      });
    }
  } finally {
    isScanning = false;
  }
}

async function processDepositEvent(event: ethers.EventLog, currentBlock: number) {
  try {
    const txHash = event.transactionHash.toLowerCase();
    const from = ((event.args as any).from as string).toLowerCase();
    const value = (event.args as any).value as bigint;
    const blockNumber = event.blockNumber;
    const confirmations = currentBlock - blockNumber;

    // USDT has 18 decimals on BSC
    const usdtAmount = Number(ethers.formatUnits(value, 18));

    // Skip if already processed
    const existingTx = await prisma.transaction.findFirst({
      where: { transactionHash: txHash }
    });

    const existingUnmatched = await prisma.unmatchedDeposit.findFirst({
      where: { transactionHash: txHash }
    });

    if (existingTx || existingUnmatched) {
      return; // Already processed
    }

    console.log(`[DepositScanner] New deposit: ${usdtAmount} USDT from ${from}`);

    // Check if sender has a linked wallet
    const linkedWallet = await prisma.linkedWallet.findFirst({
      where: { address: from, active: true }
    });

    if (linkedWallet) {
      // User found - process deposit
      await processLinkedDeposit(
        linkedWallet.userId,
        from,
        usdtAmount,
        txHash,
        blockNumber,
        confirmations
      );
    } else {
      // No linked wallet - store as unmatched
      await prisma.unmatchedDeposit.create({
        data: {
          fromAddress: from,
          toAddress: TREASURY_ADDRESS,
          amount: new Prisma.Decimal(usdtAmount),
          transactionHash: txHash,
          blockNumber,
          confirmations,
          matched: false,
        }
      });
      
      console.log(`[DepositScanner] Unmatched deposit from ${from}`);
    }
  } catch (error) {
    console.error("[DepositScanner] Event processing error:", error);
  }
}

async function processLinkedDeposit(
  userId: string,
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
            walletAddress: fromAddress,
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
          walletAddress: fromAddress,
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
export { scanForDeposits };
