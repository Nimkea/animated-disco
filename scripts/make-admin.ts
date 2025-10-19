import { prisma } from '../server/db';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

async function makeAdmin() {
  const email = 'noahkeaneowen@hotmail.com';
  
  try {
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // User exists, update to admin and reset password
      const defaultPassword = await bcrypt.hash('admin123', 12);
      user = await prisma.user.update({
        where: { email },
        data: { 
          isAdmin: true,
          passwordHash: defaultPassword,
        },
      });
      console.log(`✅ Updated ${email} to admin status`);
      console.log(`   Password reset to: admin123`);
    } else {
      // User doesn't exist, create new admin user
      const defaultPassword = await bcrypt.hash('admin123', 12);
      const username = 'noahkeane';
      const referralCode = `NOAH${nanoid(6).toUpperCase()}`;

      user = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash: defaultPassword,
          referralCode,
          isAdmin: true,
          xp: 0,
          streak: 0,
          balance: {
            create: {
              xnrtBalance: 0,
              stakingBalance: 0,
              miningBalance: 0,
              referralBalance: 0,
              totalEarned: 0,
            },
          },
        },
      });
      
      console.log(`✅ Created new admin user: ${email}`);
      console.log(`   Username: ${username}`);
      console.log(`   Password: admin123 (please change this after first login)`);
      console.log(`   Referral Code: ${referralCode}`);
    }

    console.log('\n🎉 Admin setup complete!');
    console.log(`   Email: ${user.email}`);
    console.log(`   Admin Status: ${user.isAdmin}`);
    
  } catch (error) {
    console.error('❌ Error making user admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
