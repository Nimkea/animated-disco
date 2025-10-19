import { prisma } from '../server/db';
import bcrypt from 'bcrypt';

async function main() {
  console.log('Starting database seed...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  // Create admin user with balance
  const admin = await prisma.user.upsert({
    where: { email: 'admin@xnrt.org' },
    update: {},
    create: {
      email: 'admin@xnrt.org',
      username: 'admin',
      passwordHash: adminPassword,
      referralCode: 'ADMIN2025',
      isAdmin: true,
      xp: 1000,
      streak: 10,
      balance: {
        create: {
          xnrtBalance: 1000000,
          stakingBalance: 0,
          miningBalance: 0,
          referralBalance: 0,
          totalEarned: 1000000,
        },
      },
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create test user 1
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@test.com' },
    update: {},
    create: {
      email: 'alice@test.com',
      username: 'alice',
      passwordHash: userPassword,
      referralCode: 'ALICE2025',
      isAdmin: false,
      xp: 500,
      streak: 5,
      balance: {
        create: {
          xnrtBalance: 50000,
          stakingBalance: 20000,
          miningBalance: 5000,
          referralBalance: 3000,
          totalEarned: 78000,
        },
      },
    },
  });

  console.log('✅ Created test user:', user1.email);

  // Create test user 2 (referred by alice)
  const user2 = await prisma.user.upsert({
    where: { email: 'bob@test.com' },
    update: {},
    create: {
      email: 'bob@test.com',
      username: 'bob',
      passwordHash: userPassword,
      referralCode: 'BOB2025',
      isAdmin: false,
      referredBy: user1.id,
      xp: 250,
      streak: 3,
      balance: {
        create: {
          xnrtBalance: 25000,
          stakingBalance: 10000,
          miningBalance: 2000,
          referralBalance: 1000,
          totalEarned: 38000,
        },
      },
    },
  });

  console.log('✅ Created test user (referred by alice):', user2.email);

  // Create sample achievements
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
    await prisma.achievement.upsert({
      where: { id: achievement.title }, // Use title as temporary unique identifier
      update: achievement,
      create: achievement,
    });
  }

  console.log('✅ Created achievements');

  // Create sample tasks
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

  let taskCount = 0;
  for (const task of tasks) {
    const existing = await prisma.task.findFirst({
      where: { title: task.title },
    });

    if (!existing) {
      await prisma.task.create({
        data: task,
      });
      taskCount++;
    }
  }

  console.log(`✅ Created ${taskCount} tasks`);

  // Create sample deposit transaction for alice
  const deposit = await prisma.transaction.create({
    data: {
      userId: user1.id,
      type: 'deposit',
      amount: 500,
      usdtAmount: 5,
      status: 'approved',
      transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
  });

  console.log('✅ Created sample deposit:', deposit.id);

  // Create sample withdrawal transaction (pending)
  const withdrawal = await prisma.transaction.create({
    data: {
      userId: user1.id,
      type: 'withdrawal',
      amount: 10000,
      usdtAmount: 98, // 10000 XNRT - 2% fee = 9800 XNRT = 98 USDT
      fee: 200, // 2% fee
      status: 'pending',
      walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      source: 'main',
    },
  });

  console.log('✅ Created sample withdrawal:', withdrawal.id);

  // Create sample stake for alice
  const stake = await prisma.stake.create({
    data: {
      userId: user1.id,
      amount: 20000,
      tier: 'Legendary Emerald',
      dailyRate: 8,
      duration: 60,
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      status: 'active',
    },
  });

  console.log('✅ Created sample stake:', stake.id);

  // Create sample mining session for alice
  const miningSession = await prisma.miningSession.create({
    data: {
      userId: user1.id,
      startTime: new Date(Date.now() - 10 * 60 * 60 * 1000), // Started 10 hours ago
      endTime: new Date(Date.now() + 14 * 60 * 60 * 1000), // Ends in 14 hours
      nextAvailable: new Date(Date.now() + 14 * 60 * 60 * 1000),
      baseReward: 10,
      boostPercentage: 50,
      adBoostCount: 5,
      finalReward: 15,
      status: 'active',
    },
  });

  console.log('✅ Created sample mining session:', miningSession.id);

  // Create sample activity log
  await prisma.activity.create({
    data: {
      userId: user1.id,
      type: 'achievement_unlock',
      description: 'Unlocked achievement: First Steps',
    },
  });

  console.log('✅ Created sample activity log');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
