import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function setupProduction() {
  console.log('🚀 Setting up production database...\n');

  try {
    // 1. Create/Update Admin User
    console.log('1️⃣ Setting up admin user...');
    const adminEmail = 'noahkeaneowen@hotmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD environment variable is required');
    }
    
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

    let adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (adminUser) {
      // Update existing user to admin
      adminUser = await prisma.user.update({
        where: { email: adminEmail },
        data: {
          isAdmin: true,
          passwordHash: adminPasswordHash,
        },
      });
      console.log(`   ✅ Updated ${adminEmail} to admin`);
    } else {
      // Create new admin user
      const referralCode = `NOAH${nanoid(6).toUpperCase()}`;
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          username: 'noahkeane',
          passwordHash: adminPasswordHash,
          referralCode,
          isAdmin: true,
          xp: 0,
          streak: 0,
        },
      });

      // Create balance for admin
      await prisma.balance.create({
        data: {
          userId: adminUser.id,
          xnrtBalance: 0,
          stakingBalance: 0,
          miningBalance: 0,
          referralBalance: 0,
          totalEarned: 0,
        },
      });

      console.log(`   ✅ Created admin user: ${adminEmail}`);
      console.log(`   📝 Referral Code: ${referralCode}`);
    }

    // 2. Check for wife's account
    console.log('\n2️⃣ Checking for alishunoman@gmail.com...');
    const wifeAccount = await prisma.user.findUnique({
      where: { email: 'alishunoman@gmail.com' },
      include: {
        balance: true,
      },
    });

    if (wifeAccount) {
      console.log(`   ✅ Found account: alishunoman@gmail.com`);
      console.log(`   📧 Email: ${wifeAccount.email}`);
      console.log(`   👤 Username: ${wifeAccount.username}`);
      console.log(`   🔗 Referral Code: ${wifeAccount.referralCode}`);
      console.log(`   💰 Balance: ${wifeAccount.balance?.xnrtBalance || 0} XNRT`);
      console.log(`   📊 XP: ${wifeAccount.xp}`);
    } else {
      console.log(`   ⚠️ Account not found: alishunoman@gmail.com`);
      console.log(`   💡 They may need to register on the app`);
    }

    // 3. Display all production users
    console.log('\n3️⃣ All production users:');
    const allUsers = await prisma.user.findMany({
      select: {
        email: true,
        username: true,
        isAdmin: true,
        referralCode: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (allUsers.length > 0) {
      allUsers.forEach((user, index) => {
        const adminBadge = user.isAdmin ? '👑 ADMIN' : '👤 USER';
        console.log(`   ${index + 1}. ${adminBadge} - ${user.email} (@${user.username})`);
        console.log(`      Code: ${user.referralCode} | Joined: ${user.createdAt.toLocaleDateString()}`);
      });
      console.log(`   📊 Total users: ${allUsers.length}`);
    } else {
      console.log('   ⚠️ No users found in production database');
    }

    // 4. Seed essential achievements if missing
    console.log('\n4️⃣ Checking achievements...');
    const achievementCount = await prisma.achievement.count();
    
    if (achievementCount === 0) {
      console.log('   📝 Seeding achievements...');
      const achievements = [
        {
          title: 'First Steps',
          description: 'Earn your first 100 XNRT',
          icon: 'TrendingUp',
          category: 'earnings',
          requirement: 100,
          xpReward: 50,
        },
        {
          title: 'Token Collector',
          description: 'Earn 10,000 XNRT',
          icon: 'Coins',
          category: 'earnings',
          requirement: 10000,
          xpReward: 200,
        },
        {
          title: 'Wealth Builder',
          description: 'Earn 100,000 XNRT',
          icon: 'Trophy',
          category: 'earnings',
          requirement: 100000,
          xpReward: 500,
        },
        {
          title: 'Referral Starter',
          description: 'Refer your first friend',
          icon: 'UserPlus',
          category: 'referrals',
          requirement: 1,
          xpReward: 100,
        },
        {
          title: 'Network Builder',
          description: 'Refer 10 friends',
          icon: 'Users',
          category: 'referrals',
          requirement: 10,
          xpReward: 500,
        },
        {
          title: 'Streak Beginner',
          description: 'Maintain a 7-day streak',
          icon: 'Flame',
          category: 'streaks',
          requirement: 7,
          xpReward: 100,
        },
        {
          title: 'Dedicated Member',
          description: 'Maintain a 30-day streak',
          icon: 'Award',
          category: 'streaks',
          requirement: 30,
          xpReward: 500,
        },
      ];

      for (const achievement of achievements) {
        await prisma.achievement.create({
          data: achievement,
        });
      }
      console.log(`   ✅ Created ${achievements.length} achievements`);
    } else {
      console.log(`   ✅ Found ${achievementCount} achievements already exist`);
    }

    // 5. Seed essential tasks if missing
    console.log('\n5️⃣ Checking tasks...');
    const taskCount = await prisma.task.count();
    
    if (taskCount === 0) {
      console.log('   📝 Seeding tasks...');
      const tasks = [
        {
          title: 'Daily Login Bonus',
          description: 'Log in to the platform',
          category: 'daily',
          xnrtReward: 10,
          xpReward: 5,
        },
        {
          title: 'Share on Social Media',
          description: 'Share XNRT on your favorite social platform',
          category: 'social',
          xnrtReward: 50,
          xpReward: 25,
        },
        {
          title: 'Complete Your Profile',
          description: 'Add your profile information',
          category: 'profile',
          xnrtReward: 100,
          xpReward: 50,
        },
        {
          title: 'First Stake',
          description: 'Make your first stake',
          category: 'staking',
          xnrtReward: 200,
          xpReward: 100,
        },
        {
          title: 'Mining Session',
          description: 'Complete a mining session',
          category: 'mining',
          xnrtReward: 50,
          xpReward: 25,
        },
      ];

      for (const task of tasks) {
        await prisma.task.create({
          data: task,
        });
      }
      console.log(`   ✅ Created ${tasks.length} tasks`);
    } else {
      console.log(`   ✅ Found ${taskCount} tasks already exist`);
    }

    console.log('\n✨ Production setup complete!\n');
    console.log('📋 Admin Login Credentials:');
    console.log('   🌐 URL: https://xnrt.replit.app');
    console.log(`   📧 Email: ${adminEmail}`);
    console.log(`   🔑 Password: ${adminPassword}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Visit https://xnrt.replit.app');
    console.log('   2. Login with the admin credentials above');
    console.log('   3. Access the admin dashboard to manage users');
    
  } catch (error) {
    console.error('❌ Error setting up production:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupProduction();
