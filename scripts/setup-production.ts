import { prisma } from '../server/db';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

async function setupProduction() {
  console.log('🚀 Setting up production database...\n');

  if (process.env.PROD_SETUP_I_UNDERSTAND !== '1') {
    throw new Error('Refusing to run: set PROD_SETUP_I_UNDERSTAND=1 to proceed.');
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'noahkeaneowen@hotmail.com';
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'noahkeane';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const RESET_ADMIN_PASSWORD = process.env.RESET_ADMIN_PASSWORD === 'true';
  const PRINT_USERS = process.env.PRINT_USERS === 'true';

  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD environment variable is required');
  }

  try {
    console.log('1️⃣ Ensuring admin user exists...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const referralCode = `ADMIN${nanoid(6).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: ADMIN_EMAIL } });

      if (!existing) {
        const admin = await tx.user.create({
          data: {
            email: ADMIN_EMAIL,
            username: ADMIN_USERNAME,
            passwordHash,
            referralCode,
            isAdmin: true,
            xp: 0,
            streak: 0,
            emailVerified: true,
          },
        });

        await tx.balance.upsert({
          where: { userId: admin.id },
          update: {},
          create: {
            userId: admin.id,
            xnrtBalance: 0,
            stakingBalance: 0,
            miningBalance: 0,
            referralBalance: 0,
            totalEarned: 0,
          },
        });

        console.log(`   ✅ Created admin ${ADMIN_EMAIL}`);
      } else {
        await tx.user.update({
          where: { email: ADMIN_EMAIL },
          data: {
            isAdmin: true,
            ...(RESET_ADMIN_PASSWORD ? { passwordHash } : {}),
          },
        });
        console.log(
          `   ✅ Ensured admin privileges for ${ADMIN_EMAIL}${RESET_ADMIN_PASSWORD ? ' (password reset)' : ''}`,
        );

        await tx.balance.upsert({
          where: { userId: existing.id },
          update: {},
          create: {
            userId: existing.id,
            xnrtBalance: 0,
            stakingBalance: 0,
            miningBalance: 0,
            referralBalance: 0,
            totalEarned: 0,
          },
        });
      }
    });

    console.log('\n2️⃣ Seeding achievements (idempotent upserts)...');
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

    for (const a of achievements) {
      await prisma.achievement.upsert({
        where: { title: a.title },
        update: { ...a },
        create: { ...a },
      });
    }
    console.log(`   ✅ Upserted ${achievements.length} achievements`);

    console.log('\n3️⃣ Seeding tasks (idempotent upserts)...');
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

    for (const t of tasks) {
      await prisma.task.upsert({
        where: { title: t.title },
        update: { ...t },
        create: { ...t },
      });
    }
    console.log(`   ✅ Upserted ${tasks.length} tasks`);

    if (PRINT_USERS) {
      console.log('\n👥 Current users (privacy-guarded output enabled):');
      const users = await prisma.user.findMany({
        select: { email: true, username: true, isAdmin: true, referralCode: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      users.forEach((u, i) =>
        console.log(`   ${i + 1}. ${u.isAdmin ? '👑 ADMIN' : '👤 USER'} - ${u.email} (@${u.username}) | ${u.referralCode} | ${u.createdAt.toISOString()}`),
      );
      console.log(`   📊 Total users: ${users.length}`);
    }

    console.log('\n✨ Production setup complete.\n');
    console.log('💡 Next Steps:');
    console.log('   1. Visit https://xnrt.replit.app');
    console.log('   2. Login with your admin credentials');
    console.log('   3. Access the admin dashboard to manage users');
  } catch (error) {
    console.error('❌ Error setting up production:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupProduction();
