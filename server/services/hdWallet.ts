import { ethers } from 'ethers';

/**
 * HD Wallet Service for generating unique deposit addresses per user
 * Uses BIP44 derivation path for BSC: m/44'/714'/0'/0/{index}
 */

const MASTER_SEED_ENV = 'MASTER_SEED';
const BSC_DERIVATION_PATH = "m/44'/714'/0'/0"; // BSC path (BNB Chain)

/**
 * Derives a unique BSC deposit address for a user
 * @param derivationIndex - Unique index for this user (e.g., user's sequential ID)
 * @returns Ethereum-compatible address (0x...)
 */
export function deriveDepositAddress(derivationIndex: number): string {
  const masterSeed = process.env[MASTER_SEED_ENV];
  
  if (!masterSeed) {
    throw new Error('MASTER_SEED environment variable not set');
  }

  // Validate seed format (should be 12 or 24 word mnemonic OR hex seed)
  let hdNode: ethers.HDNodeWallet;
  
  try {
    // Try as mnemonic first
    if (masterSeed.split(' ').length >= 12) {
      hdNode = ethers.HDNodeWallet.fromPhrase(masterSeed);
    } else {
      // Try as hex seed
      hdNode = ethers.HDNodeWallet.fromSeed(masterSeed);
    }
  } catch (error) {
    throw new Error('Invalid MASTER_SEED format. Must be 12/24 word mnemonic or hex seed');
  }

  // Derive child address at index
  const derivationPath = `${BSC_DERIVATION_PATH}/${derivationIndex}`;
  const childWallet = hdNode.derivePath(derivationPath);

  return childWallet.address.toLowerCase();
}

/**
 * Generates a new master seed mnemonic (for initial setup)
 * WARNING: Only call this once during initial setup!
 * @returns 12-word mnemonic phrase
 */
export function generateMasterSeed(): string {
  const wallet = ethers.Wallet.createRandom();
  return wallet.mnemonic!.phrase;
}

/**
 * Validates that a master seed is properly formatted
 * @param seed - Seed to validate
 * @returns boolean
 */
export function validateMasterSeed(seed: string): boolean {
  try {
    if (seed.split(' ').length >= 12) {
      ethers.Mnemonic.fromPhrase(seed);
      return true;
    } else {
      // Validate hex
      if (!/^0x[a-fA-F0-9]{64,}$/.test(seed)) {
        return false;
      }
      ethers.HDNodeWallet.fromSeed(seed);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Get the private key for a derived address (for sweeper functionality)
 * SECURITY: Only use this for automated sweeping, never expose to users
 * @param derivationIndex - User's derivation index
 * @returns Private key (0x...)
 */
export function getDerivedPrivateKey(derivationIndex: number): string {
  const masterSeed = process.env[MASTER_SEED_ENV];
  
  if (!masterSeed) {
    throw new Error('MASTER_SEED not set');
  }

  let hdNode: ethers.HDNodeWallet;
  
  if (masterSeed.split(' ').length >= 12) {
    hdNode = ethers.HDNodeWallet.fromPhrase(masterSeed);
  } else {
    hdNode = ethers.HDNodeWallet.fromSeed(masterSeed);
  }

  const derivationPath = `${BSC_DERIVATION_PATH}/${derivationIndex}`;
  const childWallet = hdNode.derivePath(derivationPath);

  return childWallet.privateKey;
}
