import { db } from "./db";
import { tasks, achievements } from "@shared/schema";

async function seed() {
  try {
    console.log("Seeding database...");

    // Seed tasks
    const existingTasks = await db.select().from(tasks);
    if (existingTasks.length === 0) {
      const taskData = [
        {
          title: "Complete Your Profile",
          description: "Fill out your profile information",
          category: "onboarding",
          xpReward: 50,
          xnrtReward: "10",
          maxProgress: 1,
          isActive: true,
        },
        {
          title: "First Stake",
          description: "Create your first staking position",
          category: "staking",
          xpReward: 100,
          xnrtReward: "25",
          maxProgress: 1,
          isActive: true,
        },
        {
          title: "Mining Master",
          description: "Complete 10 mining sessions",
          category: "mining",
          xpReward: 200,
          xnrtReward: "50",
          maxProgress: 10,
          isActive: true,
        },
        {
          title: "Referral Champion",
          description: "Refer 5 new users",
          category: "referrals",
          xpReward: 300,
          xnrtReward: "100",
          maxProgress: 5,
          isActive: true,
        },
        {
          title: "Daily Streak 7",
          description: "Maintain a 7-day login streak",
          category: "engagement",
          xpReward: 150,
          xnrtReward: "30",
          maxProgress: 7,
          isActive: true,
        },
      ] as const;
      await db.insert(tasks).values(taskData as any);
      console.log("Tasks seeded successfully");
    }

    // Seed achievements
    const existingAchievements = await db.select().from(achievements);
    if (existingAchievements.length === 0) {
      await db.insert(achievements).values([
        // Earnings achievements
        {
          title: "First Earnings",
          description: "Earn your first 100 XNRT",
          icon: "TrendingUp",
          category: "earnings",
          requirement: 100,
          xpReward: 50,
        },
        {
          title: "Wealth Builder",
          description: "Accumulate 1,000 XNRT",
          icon: "Wallet",
          category: "earnings",
          requirement: 1000,
          xpReward: 200,
        },
        {
          title: "Crypto Whale",
          description: "Earn 10,000 XNRT in total",
          icon: "Crown",
          category: "earnings",
          requirement: 10000,
          xpReward: 500,
        },
        // Referral achievements
        {
          title: "Networker",
          description: "Refer your first user",
          icon: "Users",
          category: "referrals",
          requirement: 1,
          xpReward: 100,
        },
        {
          title: "Community Builder",
          description: "Build a network of 10 users",
          icon: "Network",
          category: "referrals",
          requirement: 10,
          xpReward: 300,
        },
        {
          title: "Ambassador",
          description: "Grow your network to 50 users",
          icon: "Award",
          category: "referrals",
          requirement: 50,
          xpReward: 1000,
        },
        // Streak achievements
        {
          title: "Committed",
          description: "Maintain a 7-day streak",
          icon: "Flame",
          category: "streaks",
          requirement: 7,
          xpReward: 100,
        },
        {
          title: "Dedicated",
          description: "Maintain a 30-day streak",
          icon: "Zap",
          category: "streaks",
          requirement: 30,
          xpReward: 500,
        },
        {
          title: "Unstoppable",
          description: "Achieve a 100-day streak",
          icon: "Star",
          category: "streaks",
          requirement: 100,
          xpReward: 2000,
        },
        // Mining achievements
        {
          title: "Miner",
          description: "Complete your first mining session",
          icon: "Pickaxe",
          category: "mining",
          requirement: 1,
          xpReward: 50,
        },
        {
          title: "Professional Miner",
          description: "Complete 50 mining sessions",
          icon: "Gem",
          category: "mining",
          requirement: 50,
          xpReward: 300,
        },
        {
          title: "Mining Legend",
          description: "Complete 200 mining sessions",
          icon: "Trophy",
          category: "mining",
          requirement: 200,
          xpReward: 1000,
        },
      ]);
      console.log("Achievements seeded successfully");
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed().catch(console.error);
