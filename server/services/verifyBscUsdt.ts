import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_BSC_URL);
const USDT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const usdt = new ethers.Contract(
  process.env.USDT_BSC_ADDRESS!,
  USDT_ABI,
  provider
);

export type VerifyResult = {
  verified: boolean;
  confirmations: number;
  amountOnChain?: number;
  reason?: string;
};

export async function verifyBscUsdtDeposit(params: {
  txHash: string;
  expectedTo: string;
  minAmount?: number;
  requiredConf?: number;
}): Promise<VerifyResult> {
  try {
    const { txHash, expectedTo } = params;
    const need = params.requiredConf ?? Number(process.env.BSC_CONFIRMATIONS ?? 12);

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { verified: false, confirmations: 0, reason: "Transaction not found" };
    }
    
    if (receipt.status !== 1) {
      const conf = (await provider.getBlockNumber()) - (receipt.blockNumber ?? 0);
      return { verified: false, confirmations: conf, reason: "Transaction failed" };
    }

    let totalToExpected = 0n;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== process.env.USDT_BSC_ADDRESS!.toLowerCase()) continue;
      try {
        const parsed = usdt.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name !== "Transfer") continue;
        const to: string = (parsed.args as any).to;
        const value: bigint = (parsed.args as any).value;
        if (to.toLowerCase() === expectedTo.toLowerCase()) {
          totalToExpected += value;
        }
      } catch {
        // ignore non-transfer logs
      }
    }

    const conf = (await provider.getBlockNumber()) - (receipt.blockNumber ?? 0);
    if (totalToExpected === 0n) {
      return { 
        verified: false, 
        confirmations: conf, 
        reason: "No USDT transfer to expected address" 
      };
    }

    // USDT (BSC) has 18 decimals
    const amountFloat = Number(ethers.formatUnits(totalToExpected, 18));
    if (typeof params.minAmount === "number" && amountFloat + 1e-10 < params.minAmount) {
      return { 
        verified: false, 
        confirmations: conf, 
        reason: `On-chain ${amountFloat} USDT < claimed ${params.minAmount} USDT` 
      };
    }

    if (conf < need) {
      return { 
        verified: false, 
        confirmations: conf, 
        amountOnChain: amountFloat, 
        reason: `Only ${conf}/${need} confirmations` 
      };
    }

    return { verified: true, confirmations: conf, amountOnChain: amountFloat };
  } catch (e: any) {
    return { 
      verified: false, 
      confirmations: 0, 
      reason: e?.message ?? "Verify error" 
    };
  }
}
