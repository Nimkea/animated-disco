import { PrismaClient } from '@prisma/client';
import { deriveDepositAddress } from '../services/hdWallet';

const prisma = new PrismaClient();

/**
 * Migration script to generate unique deposit addresses for all existing users
 * who don't have one yet
 */
async function generateDepositAddresses() {
  console.log('🔑 Starting deposit address generation for existing users...\n');

  try {
    // Get all users without deposit addresses
    const usersWithoutAddress = await prisma.user.findMany({
      where: {
        OR: [
          { depositAddress: null },
          { derivationIndex: null }
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

    if (usersWithoutAddress.length === 0) {
      console.log('✅ All users already have deposit addresses!\n');
      return;
    }

    console.log(`📊 Found ${usersWithoutAddress.length} users without deposit addresses\n`);

    // Get the highest existing derivation index
    const maxIndexUser = await prisma.user.findFirst({
      where: { derivationIndex: { not: null } },
      orderBy: { derivationIndex: 'desc' },
      select: { derivationIndex: true }
    });

    let nextIndex = (maxIndexUser?.derivationIndex ?? -1) + 1;
    
    console.log(`🔢 Starting from derivation index: ${nextIndex}\n`);

    // Generate addresses for each user
    for (const user of usersWithoutAddress) {
      try {
        const address = deriveDepositAddress(nextIndex);
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            depositAddress: address,
            derivationIndex: nextIndex
          }
        });

        console.log(`✅ ${user.username} (${user.email})`);
        console.log(`   Address: ${address}`);
        console.log(`   Index: ${nextIndex}\n`);

        nextIndex++;
      } catch (error) {
        console.error(`❌ Failed to generate address for ${user.username}:`, error);
      }
    }

    console.log('✨ Deposit address generation completed!\n');
    console.log(`📈 Total addresses generated: ${usersWithoutAddress.length}`);
    console.log(`🔢 Next available index: ${nextIndex}\n`);

  } catch (error) {
    console.error('❌ Error during address generation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateDepositAddresses()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
