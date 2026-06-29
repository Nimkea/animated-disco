import { prisma } from "../lib/db";
import { deriveDepositAddress } from "./hdWallet";

const BSC_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function normalizeBscAddress(address: unknown): string | null {
  const value = String(address || "").trim();
  return BSC_ADDRESS_RE.test(value) ? value.toLowerCase() : null;
}

export function getWalletRates() {
  const xnrtPerUsdt = Number(process.env.XNRT_RATE_USDT || "100");
  const withdrawalFeePercent = Number(process.env.WITHDRAWAL_FEE_PERCENT || "2");
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || "0");
  const confirmations = Number(process.env.BSC_CONFIRMATIONS || "12");

  return {
    xnrtPerUsdt: Number.isFinite(xnrtPerUsdt) && xnrtPerUsdt > 0 ? xnrtPerUsdt : 100,
    usdtPerXnrt: Number.isFinite(xnrtPerUsdt) && xnrtPerUsdt > 0 ? 1 / xnrtPerUsdt : 0.01,
    withdrawalFeePercent:
      Number.isFinite(withdrawalFeePercent) && withdrawalFeePercent >= 0
        ? withdrawalFeePercent
        : 2,
    platformFeeBps: Number.isFinite(platformFeeBps) && platformFeeBps >= 0 ? platformFeeBps : 0,
    confirmations: Number.isFinite(confirmations) && confirmations > 0 ? confirmations : 12,
    network: "BSC (BEP-20)",
    depositToken: "USDT",
    withdrawalToken: "XNRT",
    withdrawalMode: "xnrt_token",
    minReferralWithdrawal: 5000,
    minMiningWithdrawal: 5000,
  };
}

export function getBalanceSourceKey(source: string | null | undefined) {
  switch (source) {
    case "staking":
      return "stakingBalance" as const;
    case "mining":
      return "miningBalance" as const;
    case "referral":
      return "referralBalance" as const;
    case "main":
    default:
      return "xnrtBalance" as const;
  }
}

export async function getOrCreateUserDepositAddress(userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { depositAddress: true, derivationIndex: true },
  });

  if (user?.depositAddress && user.derivationIndex !== null) {
    return user.depositAddress;
  }

  // Best-effort allocator within the current schema. The unique derivationIndex
  // constraint protects against duplicates if two requests race.
  for (let attempt = 0; attempt < 5; attempt++) {
    const maxIndexUser = await prisma.user.findFirst({
      where: { derivationIndex: { not: null } },
      orderBy: { derivationIndex: "desc" },
      select: { derivationIndex: true },
    });

    const nextIndex = (maxIndexUser?.derivationIndex ?? -1) + 1 + attempt;
    const address = deriveDepositAddress(nextIndex);

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { depositAddress: address, derivationIndex: nextIndex },
      });
      return address;
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
  }

  user = await prisma.user.findUnique({
    where: { id: userId },
    select: { depositAddress: true, derivationIndex: true },
  });
  if (user?.depositAddress) return user.depositAddress;
  throw new Error("Failed to allocate deposit address");
}
