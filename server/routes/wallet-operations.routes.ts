import type { Express } from "express";
import type { RouteContext } from "../routes";

export function registerWalletOperationRoutes(app: Express, ctx: RouteContext) {
  const {
    storage,
    prisma,
    requireAuth,
    requireAdmin,
    validateCSRF,
    STAKING_TIERS,
    Prisma,
    notifyUser,
    sendPushNotification,
    verifyBscUsdtDeposit,
    ethers,
    mintXNRT,
    isTokenServiceReady,
    getTxExplorerUrl,
    generateAnonymizedHandle,
    MINING_SESSION_DURATION_MS,
    MINING_SESSION_XNRT_REWARD,
    MINING_SESSION_XP_REWARD,
    getWalletRates,
    decimalValueToNumber,
    isSameLocalDay,
    normalizeBscAddress,
    getBalanceSourceKey,
    getOrCreateUserDepositAddress,
    normalizeLeaderboardPeriodParam,
    getLeaderboardDateFilter,
    clampLeaderboardLimit,
    toLeaderboardNumber,
    syncUserTasksForActiveTasks,
    serializeTask,
    serializeUserTaskWithTask,
    parseTaskPayload,
    awardUserXp,
    parseAchievementPayload,
    profileUpdateSchema,
    pushSubscriptionLimiter,
    VAPID_PUBLIC_KEY,
    TRUST_LOAN_CONFIG,
    getDirectReferralStats,
    insertAnnouncementSchema,
    z,
  } = ctx;
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const transactions = await storage.getTransactionsByUser(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/deposits", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const deposits = await storage.getTransactionsByUser(userId, "deposit");
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  app.get("/api/transactions/withdrawals", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const withdrawals = await storage.getTransactionsByUser(
        userId,
        "withdrawal"
      );
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Wallet Linking API
  app.get("/api/wallet/me", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const wallets = await prisma.linkedWallet.findMany({
        where: { userId, active: true },
        select: { address: true, linkedAt: true },
        orderBy: { linkedAt: "desc" },
      });
      res.json(wallets.map((w) => w.address));
    } catch (error) {
      console.error("Error fetching linked wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.get("/api/wallet/link/challenge", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const address = String(req.query.address || "").toLowerCase();

      if (!/^0x[a-f0-9]{40}$/.test(address)) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      // 6-digit numeric nonce; avoids NaN issues and is easy for users to verify
      const nonce = Math.floor(100000 + Math.random() * 900000);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const issuedAt = new Date();

      await prisma.walletNonce.upsert({
        where: { userId_address: { userId, address } },
        update: { nonce: String(nonce), expiresAt },
        create: { userId, address, nonce: String(nonce), expiresAt },
      });

      const message = `XNRT Wallet Link

Address: ${address}
Nonce: ${nonce}
Issued: ${issuedAt.toISOString()}`;

      res.json({
        message,
        nonce: String(nonce),
        issuedAt: issuedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).json({ message: "Failed to generate challenge" });
    }
  });

  app.post(
    "/api/wallet/link/confirm",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { address, signature, nonce, issuedAt } = req.body;
        const normalized = String(address || "").toLowerCase();

        if (!address || !signature || !nonce || !issuedAt) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const rec = await prisma.walletNonce.findUnique({
          where: {
            userId_address: { userId, address: normalized },
          },
        });

        if (
          !rec ||
          String(rec.nonce) !== String(nonce) ||
          !rec.expiresAt ||
          rec.expiresAt < new Date()
        ) {
          return res.status(400).json({ message: "Invalid or expired challenge" });
        }

        const message = `XNRT Wallet Link

Address: ${normalized}
Nonce: ${nonce}
Issued: ${issuedAt}`;

        let recoveredAddress: string;
        try {
          recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
        } catch {
          return res.status(400).json({ message: "Invalid signature" });
        }

        if (recoveredAddress !== normalized) {
          return res
            .status(400)
            .json({ message: "Signature does not match address" });
        }

        const existing = await prisma.linkedWallet.findFirst({
          where: { address: normalized, active: true },
        });

        if (existing && existing.userId !== userId) {
          return res
            .status(409)
            .json({ message: "This wallet is already linked to another account" });
        }

        if (existing && existing.userId === userId) {
          return res.json({ address: existing.address, alreadyLinked: true });
        }

        await prisma.$transaction([
          prisma.walletNonce.delete({ where: { id: rec.id } }),
          prisma.linkedWallet.create({
            data: {
              userId,
              address: normalized,
              signature,
              nonce: rec.nonce,
            },
          }),
        ]);

        res.json({ address: normalized });
      } catch (error) {
        console.error("Error linking wallet:", error);
        res.status(500).json({ message: "Failed to link wallet" });
      }
    }
  );

  // User Deposit Address API
  app.get("/api/wallet/deposit-address", requireAuth, async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const address = await getOrCreateUserDepositAddress(userId);
      const rates = getWalletRates();

      res.json({
        address,
        network: rates.network,
        token: rates.depositToken,
        instructions: [
          "Send USDT (BEP-20) from your exchange to this personal deposit address",
          "Auto-detection credits deposits after the required confirmations",
          "Report the transaction hash only if auto-credit does not appear",
          `Required confirmations: ${rates.confirmations}`,
        ],
      });
    } catch (error) {
      console.error("Error getting deposit address:", error);
      res.status(500).json({ message: "Failed to get deposit address" });
    }
  });

  app.post(
    "/api/wallet/report-deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        let { transactionHash, amount, description } = req.body;

        if (!transactionHash || amount === undefined || amount === null) {
          return res
            .status(400)
            .json({ message: "Transaction hash and amount required" });
        }

        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return res.status(400).json({ message: "Invalid amount" });
        }

        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res
            .status(400)
            .json({ message: "Invalid transaction hash format" });
        }

        const existingTx = await prisma.transaction.findFirst({
          where: { transactionHash },
        });
        if (existingTx) {
          return res.status(409).json({
            message: "This deposit has already been credited",
            alreadyProcessed: true,
          });
        }

        const existingReport = await prisma.depositReport.findFirst({
          where: { txHash: transactionHash },
        });
        if (existingReport) {
          return res
            .status(409)
            .json({ message: "This deposit has already been reported" });
        }

        const userDepositAddress = (await getOrCreateUserDepositAddress(userId)).toLowerCase();
        const treasuryAddress = (process.env.XNRT_WALLET || "").toLowerCase();
        const rates = getWalletRates();

        let verification = await verifyBscUsdtDeposit({
          txHash: transactionHash,
          expectedTo: userDepositAddress,
          minAmount: amountNum,
          requiredConf: rates.confirmations,
        });
        let expectedTo = userDepositAddress;
        let verifiedToPersonalAddress = !!verification.verified;

        if (!verification.verified && treasuryAddress) {
          const treasuryVerification = await verifyBscUsdtDeposit({
            txHash: transactionHash,
            expectedTo: treasuryAddress,
            minAmount: amountNum,
            requiredConf: rates.confirmations,
          });
          if (treasuryVerification.verified) {
            verification = treasuryVerification;
            expectedTo = treasuryAddress;
            verifiedToPersonalAddress = false;
          }
        }

        if (!verification.verified) {
          const report = await prisma.depositReport.create({
            data: {
              userId,
              txHash: transactionHash,
              amount: new Prisma.Decimal(amountNum),
              notes:
                description ||
                `Verification failed. Checked personal address ${userDepositAddress}${treasuryAddress ? ` and treasury ${treasuryAddress}` : ""}. Reason: ${verification.reason}`,
              status: "pending",
            },
          });

          return res.json({
            message: "Report submitted for admin review",
            reportId: report.id,
            reason: verification.reason,
          });
        }

        const provider = new ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
        const receipt = await provider.getTransactionReceipt(transactionHash);
        const transaction = await provider.getTransaction(transactionHash);
        const fromAddress = transaction?.from?.toLowerCase() || "";

        const usdtAmount = verification.amountOnChain ?? amountNum;
        const netUsdt = usdtAmount * (1 - rates.platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * rates.xnrtPerUsdt;

        // Personal deposit addresses are unique per user, so linked-wallet proof is not required.
        const shouldAutoCredit = verifiedToPersonalAddress;
        const linkedWallet = !shouldAutoCredit
          ? await prisma.linkedWallet.findFirst({
              where: { userId, address: fromAddress, active: true },
            })
          : null;

        if (shouldAutoCredit || linkedWallet) {
          const createdDeposit = await prisma.$transaction(async (tx) => {
            const txRecord = await tx.transaction.create({
              data: {
                userId,
                type: "deposit",
                amount: new Prisma.Decimal(xnrtAmount),
                usdtAmount: new Prisma.Decimal(usdtAmount),
                transactionHash,
                walletAddress: expectedTo,
                status: "approved",
                verified: true,
                confirmations: verification.confirmations,
                verificationData: {
                  autoVerified: true,
                  reportSubmitted: true,
                  verifiedTo: expectedTo,
                  verifiedAt: new Date().toISOString(),
                  blockNumber: receipt?.blockNumber,
                  fromAddress,
                } as any,
              },
            });

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
            return txRecord;
          });

          const { sendDepositNotification } = await import(
            "../services/depositScanner"
          );
          void sendDepositNotification(userId, xnrtAmount, transactionHash).catch((err) => {
            console.error("[ReportDeposit] Notification error:", err);
          });

          await storage.distributeReferralCommissions(
            userId,
            xnrtAmount,
            `tx:${createdDeposit.id}`
          );
          await storage.createActivity({
            userId,
            type: "deposit_approved",
            description: `Deposit of ${xnrtAmount.toLocaleString()} XNRT approved via verified deposit report`,
          });

          return res.json({
            message: "Deposit verified and credited automatically!",
            credited: true,
            amount: xnrtAmount,
          });
        }

        await prisma.unmatchedDeposit.create({
          data: {
            fromAddress,
            toAddress: expectedTo,
            amount: new Prisma.Decimal(usdtAmount),
            transactionHash,
            blockNumber: receipt?.blockNumber ?? 0,
            confirmations: verification.confirmations ?? 0,
            matched: false,
          },
        });

        return res.json({
          message:
            "Deposit verified on blockchain. Admin will credit your account shortly.",
          verified: true,
          pendingAdminReview: true,
        });
      } catch (error: any) {
        console.error("Error reporting deposit:", error);
        if (String(error?.message || "").includes("unique")) {
          return res.status(409).json({ message: "This deposit has already been processed" });
        }
        res.status(500).json({ message: "Failed to process deposit report" });
      }
    }
  );

  app.post(
    "/api/transactions/deposit",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        let { usdtAmount, transactionHash, proofImageUrl } = req.body;

        if (!usdtAmount || !transactionHash) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const usdt = Number(usdtAmount);
        if (!Number.isFinite(usdt) || usdt <= 0) {
          return res.status(400).json({ message: "Invalid USDT amount" });
        }

        transactionHash = String(transactionHash).trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(transactionHash)) {
          return res
            .status(400)
            .json({ message: "Invalid transaction hash format" });
        }

        const existing = await prisma.transaction.findFirst({
          where: { transactionHash },
        });
        if (existing) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit.",
          });
        }

        if (proofImageUrl) {
          const isBase64DataUrl = proofImageUrl.startsWith("data:image/");
          const isValidUrl = /^https?:\/\//.test(proofImageUrl);
          if (!isBase64DataUrl && !isValidUrl) {
            return res
              .status(400)
              .json({ message: "Invalid proof image URL format" });
          }
        }

        const rates = getWalletRates();
        const netUsdt = usdt * (1 - rates.platformFeeBps / 10_000);
        const xnrtAmount = netUsdt * rates.xnrtPerUsdt;
        const depositAddress = await getOrCreateUserDepositAddress(userId);

        const transaction = await storage.createTransaction({
          userId,
          type: "deposit",
          amount: xnrtAmount.toString(),
          usdtAmount: usdt.toString(),
          transactionHash,
          walletAddress: depositAddress,
          ...(proofImageUrl && { proofImageUrl }),
          status: "pending",
          verified: false,
          confirmations: 0,
        });

        res.json(transaction);
      } catch (error: any) {
        if (error.code === "P2002" && error.meta?.target?.includes("transactionHash")) {
          return res.status(409).json({
            message: "This transaction hash was already used for a deposit.",
          });
        }
        console.error("Error creating deposit:", error);
        res.status(500).json({ message: "Failed to create deposit" });
      }
    }
  );

  app.post(
    "/api/transactions/withdrawal",
    requireAuth,
    validateCSRF,
    async (req, res) => {
      try {
        const userId = req.authUser!.id;
        const { source, amount, walletAddress } = req.body;

        if (!source || amount === undefined || amount === null || !walletAddress) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const normalizedWallet = normalizeBscAddress(walletAddress);
        if (!normalizedWallet) {
          return res.status(400).json({
            message: "Enter a valid BEP-20 wallet address starting with 0x",
          });
        }

        if (!["main", "staking", "mining", "referral"].includes(String(source))) {
          return res.status(400).json({ message: "Invalid withdrawal source" });
        }

        const withdrawAmount = Number(amount);
        if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
          return res
            .status(400)
            .json({ message: "Withdrawal amount must be a positive number" });
        }

        const rates = getWalletRates();
        const fee = (withdrawAmount * rates.withdrawalFeePercent) / 100;
        const netAmount = withdrawAmount - fee;
        const usdtAmount = netAmount * rates.usdtPerXnrt;

        if (source === "referral" && withdrawAmount < rates.minReferralWithdrawal) {
          return res.status(400).json({
            message: `Minimum withdrawal from referral balance is ${rates.minReferralWithdrawal.toLocaleString()} XNRT`,
          });
        }

        if (source === "mining" && withdrawAmount < rates.minMiningWithdrawal) {
          return res.status(400).json({
            message: `Minimum withdrawal from mining balance is ${rates.minMiningWithdrawal.toLocaleString()} XNRT`,
          });
        }

        const sourceBalanceKey = getBalanceSourceKey(source);

        const transaction = await prisma.$transaction(async (tx) => {
          const balance = await tx.balance.findUnique({ where: { userId } });
          if (!balance) throw new Error("Balance not found");

          const availableBalance = decimalValueToNumber((balance as any)[sourceBalanceKey]);
          if (withdrawAmount > availableBalance) {
            throw new Error("Insufficient balance for this withdrawal");
          }

          await tx.balance.update({
            where: { userId },
            data: {
              [sourceBalanceKey]: new Prisma.Decimal(availableBalance - withdrawAmount),
            },
          });

          return await tx.transaction.create({
            data: {
              userId,
              type: "withdrawal",
              amount: new Prisma.Decimal(withdrawAmount),
              usdtAmount: new Prisma.Decimal(usdtAmount),
              source,
              walletAddress: normalizedWallet,
              status: "pending",
              fee: new Prisma.Decimal(fee),
              netAmount: new Prisma.Decimal(netAmount),
              verificationData: {
                withdrawalMode: rates.withdrawalMode,
                withdrawalToken: rates.withdrawalToken,
                reservedBalance: true,
                reservedAt: new Date().toISOString(),
                sourceBalanceKey,
                feePercent: rates.withdrawalFeePercent,
              } as any,
            },
          });
        });

        await storage.createActivity({
          userId,
          type: "withdrawal_requested",
          description: `Withdrawal request reserved ${withdrawAmount.toLocaleString()} XNRT from ${source} balance`,
        });

        res.json(transaction);
      } catch (error: any) {
        console.error("Error creating withdrawal:", error);
        const message = error?.message || "Failed to create withdrawal";
        const status = /insufficient|balance not found|invalid/i.test(message) ? 400 : 500;
        res.status(status).json({ message });
      }
    }
  );

}
