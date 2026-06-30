import { describe, expect, it } from "vitest";
import {
  getBalanceSourceKey,
  getWalletRates,
  normalizeBscAddress,
} from "../../server/services/wallet.service";

describe("wallet service helpers", () => {
  it("normalizes valid BEP-20/EVM addresses to lowercase", () => {
    expect(normalizeBscAddress(" 0xAABBCCDDEEFF0011223344556677889900AABBCC ")).toBe(
      "0xaabbccddeeff0011223344556677889900aabbcc"
    );
  });

  it("rejects invalid wallet addresses", () => {
    expect(normalizeBscAddress("0x123")).toBeNull();
    expect(normalizeBscAddress("not-a-wallet")).toBeNull();
    expect(normalizeBscAddress("")).toBeNull();
  });

  it("maps withdrawal balance sources safely", () => {
    expect(getBalanceSourceKey("main")).toBe("xnrtBalance");
    expect(getBalanceSourceKey("staking")).toBe("stakingBalance");
    expect(getBalanceSourceKey("mining")).toBe("miningBalance");
    expect(getBalanceSourceKey("referral")).toBe("referralBalance");
    expect(getBalanceSourceKey("unknown")).toBe("xnrtBalance");
    expect(getBalanceSourceKey(undefined)).toBe("xnrtBalance");
  });

  it("returns sane wallet rates from environment", () => {
    process.env.XNRT_RATE_USDT = "100";
    process.env.WITHDRAWAL_FEE_PERCENT = "2";
    process.env.BSC_CONFIRMATIONS = "12";

    const rates = getWalletRates();

    expect(rates.xnrtPerUsdt).toBe(100);
    expect(rates.usdtPerXnrt).toBe(0.01);
    expect(rates.withdrawalFeePercent).toBe(2);
    expect(rates.confirmations).toBe(12);
    expect(rates.depositToken).toBe("USDT");
    expect(rates.withdrawalToken).toBe("XNRT");
  });
});
