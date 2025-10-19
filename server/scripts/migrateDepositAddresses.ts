import { prisma } from '../db';
import { deriveAddressWithCoinType, getCurrentDerivationInfo } from '../services/hdWallet';

/**
 * Migration script to backfill existing User.depositAddress into DepositAddress table
 * 
 * This migrates from single depositAddress per user to multiple addresses:
 * - Legacy addresses (coin type 714) get version=1, active=false (still scanned for incoming deposits)
 * - New addresses (coin type 60) get version=2, active=true (shown to users)
 */
async function migrateDepositAddresses() {
  console.log('🔄 Starting deposit address migration...\n');

  try {
    // Get all users with existing deposit addresses
    const usersWithAddresses = await prisma.user.findMany({
      where: {
        AND: [
          { depositAddress: { not: null } },
          { derivationIndex: { not: null } }
        ]
      },
      select: {
        id: true,
        email: true,
        username: true,
        depositAddress: true,
        derivationIndex: true
      },
      orderBy: { createdAt: 'asc' }
    });

    if (usersWithAddresses.length === 0) {
      console.log('✅ No existing deposit addresses to migrate\n');
      return;
    }

    console.log(`📊 Found ${usersWithAddresses.length} users with deposit addresses\n`);

    const { coinType: newCoinType, path, version: newVersion } = getCurrentDerivationInfo();
    let migrated = 0;
    let created = 0;
    let errors = 0;

    for (const user of usersWithAddresses) {
      try {
        const derivationIndex = user.derivationIndex!;
        
        // Check if this user already has DepositAddress records
        const existing = await prisma.depositAddress.findMany({
          where: { userId: user.id }
        });

        if (existing.length > 0) {
          console.log(`⏭️  User ${user.username} (${user.email}) already has ${existing.length} deposit address(es), skipping`);
          migrated++;
          continue;
        }

        // Create legacy address record (coin type 714, version 1)
        // Keep it active=true so scanner monitors for incoming deposits
        await prisma.depositAddress.create({
          data: {
            userId: user.id,
            address: user.depositAddress!.toLowerCase(),
            coinType: 714,
            derivationIndex,
            derivationPath: `m/44'/714'/0'/0/${derivationIndex}`,
            version: 1,
            active: true, // Must be active for scanner to monitor incoming deposits
          }
        });

        // Create new EVM address (coin type 60, version 2)
        const newAddress = deriveAddressWithCoinType(derivationIndex, newCoinType);
        await prisma.depositAddress.create({
          data: {
            userId: user.id,
            address: newAddress.toLowerCase(),
            coinType: newCoinType,
            derivationIndex,
            derivationPath: `${path}/${derivationIndex}`,
            version: newVersion,
            active: true, // This is the address users will see
          }
        });

        // Update User.depositAddress to show the new address (for backward compatibility)
        await prisma.user.update({
          where: { id: user.id },
          data: { depositAddress: newAddress.toLowerCase() }
        });

        console.log(`✅ Migrated ${user.username} (${user.email})`);
        console.log(`   Legacy (714): ${user.depositAddress}`);
        console.log(`   New (60):     ${newAddress}\n`);
        
        created++;
      } catch (error: any) {
        console.error(`❌ Error migrating user ${user.username}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Migrated: ${created} users`);
    console.log(`   ⏭️  Skipped: ${migrated} users (already migrated)`);
    console.log(`   ❌ Errors: ${errors} users\n`);

    if (errors === 0) {
      console.log('🎉 Migration completed successfully!\n');
    } else {
      console.log('⚠️  Migration completed with errors. Please review the logs above.\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateDepositAddresses().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
