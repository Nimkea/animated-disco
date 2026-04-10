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

const XNRT_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Minted(address indexed to, uint256 amount)",
];

function isConfigured(): boolean {
  return !!(TOKEN_ADDRESS && DEPLOYER_PRIVATE_KEY);
}

function getContract(): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  return new ethers.Contract(TOKEN_ADDRESS, XNRT_ABI, wallet);
}

/**
 * Mint XNRT tokens to a recipient's BSC wallet address.
 *
 * @param toAddress  Recipient's BSC address (0x...)
 * @param amount     Amount in XNRT (human-readable, e.g. "1000" = 1 000 XNRT)
 * @returns          On-chain transaction hash
 */
export async function mintXNRT(toAddress: string, amount: string): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      "XNRT token service not configured: XNRT_TOKEN_ADDRESS and DEPLOYER_PRIVATE_KEY must be set"
    );
  }

  const amountWei = ethers.parseUnits(amount, 18);

  console.log(
    `[TokenService] Minting ${amount} XNRT (${amountWei} wei) → ${toAddress}`
  );

  const contract = getContract();
  const tx = await contract.mint(toAddress, amountWei);
  const receipt = await tx.wait(1);

  console.log(`[TokenService] Minted OK – tx: ${receipt?.hash}`);
  return receipt?.hash as string;
}

/**
 * Returns true if the token service is configured and ready to mint.
 * Used by the withdrawal route to decide whether to trigger on-chain minting.
 */
export function isTokenServiceReady(): boolean {
  return isConfigured();
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
