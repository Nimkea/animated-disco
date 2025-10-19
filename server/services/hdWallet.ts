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

  // Validate seed format (should be 12 or 24 word mnemonic)
  let mnemonic: ethers.Mnemonic;
  
  try {
    if (masterSeed.split(' ').length >= 12) {
      mnemonic = ethers.Mnemonic.fromPhrase(masterSeed);
    } else {
      throw new Error('MASTER_SEED must be a 12 or 24 word mnemonic phrase');
    }
  } catch (error) {
    throw new Error('Invalid MASTER_SEED format. Must be 12/24 word mnemonic');
  }

  // Create HD wallet from mnemonic and derive child address
  const derivationPath = `${BSC_DERIVATION_PATH}/${derivationIndex}`;
  const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);

  return hdNode.address.toLowerCase();
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

  let mnemonic: ethers.Mnemonic;
  
  if (masterSeed.split(' ').length >= 12) {
    mnemonic = ethers.Mnemonic.fromPhrase(masterSeed);
  } else {
    throw new Error('MASTER_SEED must be a 12 or 24 word mnemonic phrase');
  }

  const derivationPath = `${BSC_DERIVATION_PATH}/${derivationIndex}`;
  const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);

  return hdNode.privateKey;
}
