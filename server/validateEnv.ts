/**
 * Validates required environment variables at startup
 * Provides clear error messages if critical variables are missing
 */

interface EnvValidation {
  name: string;
  required: boolean;
  description: string;
  validate?: (value: string) => boolean;
}

const ENV_VALIDATIONS: EnvValidation[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string'
  },
  {
    name: 'SESSION_SECRET',
    required: true,
    description: 'Secret key for session cookies (min 32 chars)',
    validate: (val) => val.length >= 32
  },
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT token signing (min 32 chars)',
    validate: (val) => val.length >= 32
  },
  {
    name: 'MASTER_SEED',
    required: true,
    description: 'BIP39 mnemonic for HD wallet (12/15/18/21/24 words)',
    validate: (val) => {
      const words = val.trim().split(/\s+/);
      return [12, 15, 18, 21, 24].includes(words.length);
    }
  },
  {
    name: 'RPC_BSC_URL',
    required: true,
    description: 'Binance Smart Chain RPC endpoint'
  },
  {
    name: 'USDT_BSC_ADDRESS',
    required: true,
    description: 'USDT contract address on BSC',
    validate: (val) => /^0x[a-fA-F0-9]{40}$/.test(val)
  },
  {
    name: 'VAPID_PUBLIC_KEY',
    required: true,
    description: 'VAPID public key for Web Push notifications'
  },
  {
    name: 'VAPID_PRIVATE_KEY',
    required: true,
    description: 'VAPID private key for Web Push notifications'
  },
  {
    name: 'SMTP_PASSWORD',
    required: true,
    description: 'SMTP password for sending emails (verification, password reset)'
  },
];

export function validateEnvironment() {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('[Environment] Validating configuration...');
  
  for (const { name, required, description, validate } of ENV_VALIDATIONS) {
    const value = process.env[name];
    
    if (!value) {
      if (required) {
        errors.push(`❌ ${name} is required - ${description}`);
      } else {
        warnings.push(`⚠️  ${name} not set - ${description}`);
      }
      continue;
    }
    
    if (validate && !validate(value)) {
      errors.push(`❌ ${name} is invalid - ${description}`);
    } else {
      console.log(`[Environment] ✓ ${name} is set`);
    }
  }
  
  // Check optional but important variables
  if (!process.env.XNRT_WALLET) {
    warnings.push('⚠️  XNRT_WALLET not set - Using default treasury address');
  }
  
  if (process.env.AUTO_DEPOSIT !== 'true') {
    warnings.push('⚠️  AUTO_DEPOSIT is not enabled - Automated deposit scanner is disabled');
  }
  
  // Log warnings
  if (warnings.length > 0) {
    console.log('\n[Environment] Warnings:');
    warnings.forEach(w => console.log(`  ${w}`));
  }
  
  // If there are errors, throw to prevent startup
  if (errors.length > 0) {
    console.error('\n❌ CRITICAL: Missing required environment variables!\n');
    errors.forEach(e => console.error(`  ${e}`));
    console.error('\n📖 See docs/PRODUCTION_ENV.md for setup instructions\n');
    throw new Error('Environment validation failed - see logs above');
  }
  
  console.log('[Environment] ✓ All critical variables validated\n');
}
