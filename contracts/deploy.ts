/**
 * XNRT BEP-20 Deployment Script
 * ──────────────────────────────
 * Compiles XNRTToken.sol using the solc npm package and deploys it to
 * BSC Testnet (ChainID 97) using a deployer wallet funded with test BNB.
 *
 * Usage:
 *   npx ts-node contracts/deploy.ts
 *
 * Required env vars (set in .env or shell):
 *   DEPLOYER_PRIVATE_KEY  – 0x-prefixed private key of the deployer wallet
 *   BSC_TESTNET_RPC       – optional, defaults to the public BSC Testnet RPC
 *
 * See contracts/DEPLOY.md for full setup instructions.
 */

import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import solc from "solc";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL =
  process.env.BSC_TESTNET_RPC ||
  "https://data-seed-prebsc-1-s1.binance.org:8545";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

if (!PRIVATE_KEY) {
  console.error("ERROR: DEPLOYER_PRIVATE_KEY env var is required");
  process.exit(1);
}

// ─── Compile ─────────────────────────────────────────────────────────────────

function resolveImport(importPath: string): { contents: string } | { error: string } {
  // Resolve @openzeppelin/... from node_modules
  if (importPath.startsWith("@openzeppelin/")) {
    const resolved = path.join(__dirname, "..", "node_modules", importPath);
    if (fs.existsSync(resolved)) {
      return { contents: fs.readFileSync(resolved, "utf8") };
    }
    return { error: `@openzeppelin import not found: ${resolved}` };
  }
  // Resolve relative imports
  const resolved = path.join(__dirname, importPath);
  if (fs.existsSync(resolved)) {
    return { contents: fs.readFileSync(resolved, "utf8") };
  }
  return { error: `Import not found: ${importPath}` };
}

function compileContract(): { abi: any[]; bytecode: string } {
  const contractPath = path.join(__dirname, "XNRTToken.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "XNRTToken.sol": { content: source },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  console.log("Compiling XNRTToken.sol ...");
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: resolveImport })
  );

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:");
      errors.forEach((e: any) => console.error(e.formattedMessage));
      process.exit(1);
    }
    // Print warnings
    output.errors.forEach((e: any) => console.warn("Warning:", e.formattedMessage));
  }

  const contract = output.contracts["XNRTToken.sol"]["XNRTToken"];
  return {
    abi: contract.abi,
    bytecode: "0x" + contract.evm.bytecode.object,
  };
}

// ─── Deploy ──────────────────────────────────────────────────────────────────

async function deploy() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Verify we're on BSC Testnet
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 97) {
    console.error(`ERROR: Expected BSC Testnet (chainId 97), got ${chainId}`);
    process.exit(1);
  }
  console.log(`Connected to BSC Testnet (chainId: ${chainId})`);

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`Deployer address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer BNB balance: ${ethers.formatEther(balance)} BNB`);
  if (balance === 0n) {
    console.error("ERROR: Deployer wallet has no BNB. Fund it from the testnet faucet first.");
    process.exit(1);
  }

  const { abi, bytecode } = compileContract();
  console.log("Compilation successful.");

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log("Deploying XNRTToken ...");

  // Pass deployer address as initialOwner (required by OZ Ownable 5.x)
  const contract = await factory.deploy(wallet.address);
  const receipt = await contract.deploymentTransaction()!.wait(1);

  const address = await contract.getAddress();
  console.log(`\n✅ XNRTToken deployed!`);
  console.log(`   Address    : ${address}`);
  console.log(`   Tx hash    : ${receipt?.hash}`);
  console.log(`   Block      : ${receipt?.blockNumber}`);
  console.log(`   Explorer   : https://testnet.bscscan.com/token/${address}`);

  // Write address to .env.testnet for reference
  const envLine = `XNRT_TOKEN_ADDRESS=${address}\n`;
  fs.writeFileSync(path.join(__dirname, ".env.testnet"), envLine, "utf8");
  console.log(`\n   Wrote ${address} to contracts/.env.testnet`);
  console.log(`   Add this to your server's environment as XNRT_TOKEN_ADDRESS.`);

  // Write ABI for reference
  const abiPath = path.join(__dirname, "XNRTToken.abi.json");
  fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2), "utf8");
  console.log(`   ABI written to contracts/XNRTToken.abi.json`);

  console.log(`\nNext steps:`);
  console.log(`  1. Set XNRT_TOKEN_ADDRESS=${address} in your server secrets`);
  console.log(`  2. Set DEPLOYER_PRIVATE_KEY=<your key> in server secrets`);
  console.log(`  3. Restart the server — on-chain withdrawals are now live.`);
}

deploy().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
