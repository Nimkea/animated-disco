/**
 * XNRT Token Service
 * ──────────────────
 * Connects to the deployed XNRT BEP-20 contract on BSC Testnet and exposes
 * a `mintXNRT` helper that the withdrawal approval route calls to send real
 * on-chain tokens to a user's wallet.
 *
 * Required environment variables:
 *   XNRT_TOKEN_ADDRESS  – deployed contract address on BSC Testnet
 *   DEPLOYER_PRIVATE_KEY – private key of the contract owner wallet
 *   RPC_BSC_URL         – BSC node RPC (defaults to public BSC Testnet RPC)
 */

import { ethers } from "ethers";

const BSC_TESTNET_RPC =
  process.env.RPC_BSC_URL ||
  "https://data-seed-prebsc-1-s1.binance.org:8545";

const TOKEN_ADDRESS = process.env.XNRT_TOKEN_ADDRESS || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

const EXPECTED_CHAIN_ID = 97; // BSC Testnet

const XNRT_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Minted(address indexed to, uint256 amount)",
];

function getProviderAndWallet(): { provider: ethers.JsonRpcProvider; wallet: ethers.Wallet } {
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      "XNRT token service not configured: DEPLOYER_PRIVATE_KEY must be set"
    );
  }
  const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  return { provider, wallet };
}

/**
 * Mint XNRT tokens to a recipient's BSC wallet address.
 *
 * Validates the connected chain is BSC Testnet (chainId 97) before sending
 * any transaction, preventing accidental wrong-network minting.
 *
 * @param toAddress  Recipient's BSC address (0x...)
 * @param amount     Canonical decimal string (e.g. "1000.5") — no float conversion
 * @returns          On-chain transaction hash
 */
export async function mintXNRT(toAddress: string, amount: string): Promise<string> {
  if (!TOKEN_ADDRESS) {
    throw new Error(
      "XNRT token service not configured: XNRT_TOKEN_ADDRESS must be set"
    );
  }

  const { provider, wallet } = getProviderAndWallet();

  // Enforce correct network before any transaction
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Wrong network: expected BSC Testnet (chainId ${EXPECTED_CHAIN_ID}), got chainId ${chainId}. ` +
      `Check RPC_BSC_URL.`
    );
  }

  const amountWei = ethers.parseUnits(amount, 18);
  console.log(
    `[TokenService] Minting ${amount} XNRT (${amountWei} wei) → ${toAddress} on chainId ${chainId}`
  );

  const contract = new ethers.Contract(TOKEN_ADDRESS, XNRT_ABI, wallet);
  const tx = await contract.mint(toAddress, amountWei);
  const receipt: ethers.TransactionReceipt = await tx.wait(1);

  console.log(`[TokenService] Minted OK – tx: ${receipt.hash}`);
  return receipt.hash;
}

/**
 * Returns true if XNRT_TOKEN_ADDRESS is set, meaning on-chain minting is
 * expected for withdrawals. When true the full mint configuration must also
 * be present (DEPLOYER_PRIVATE_KEY); otherwise `mintXNRT` will throw and the
 * approval will be rejected — this is the intended fail-closed behaviour.
 */
export function isTokenServiceReady(): boolean {
  return !!TOKEN_ADDRESS;
}

/**
 * Returns the BSC Testnet explorer URL for the XNRT token contract.
 */
export function getTokenExplorerUrl(): string {
  if (!TOKEN_ADDRESS) return "";
  return `https://testnet.bscscan.com/token/${TOKEN_ADDRESS}`;
}

/**
 * Returns the BSC Testnet explorer URL for a transaction hash.
 */
export function getTxExplorerUrl(txHash: string): string {
  if (!txHash) return "";
  return `https://testnet.bscscan.com/tx/${txHash}`;
}
