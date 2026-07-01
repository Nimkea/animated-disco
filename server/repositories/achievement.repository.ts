import type { Achievement, InsertUserAchievement, UserAchievement } from "@shared/schema";
import { prisma } from "../lib/db";

export class AchievementRepository {
  async findAll(): Promise<Achievement[]> {
    return prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { requirement: "asc" }, { createdAt: "asc" }],
    }) as Promise<Achievement[]>;
  }

  async findUserAchievements(userId: string): Promise<UserAchievement[]> {
    return prisma.userAchievement.findMany({ where: { userId } }) as Promise<UserAchievement[]>;
  }

  async createUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement> {
    return prisma.userAchievement.create({
      data: {
        userId: userAchievement.userId,
        achievementId: userAchievement.achievementId,
        unlockedAt: userAchievement.unlockedAt,
        isFeatured: Boolean(userAchievement.isFeatured),
        featuredSlot: userAchievement.featuredSlot ?? null,
      },
    }) as Promise<UserAchievement>;
  }

  async findWithUnlockCount(): Promise<(Achievement & { unlockCount: number })[]> {
    const achievements = await prisma.achievement.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { requirement: "asc" }],
    });
    const counts = await Promise.all(
      achievements.map((achievement) =>
        prisma.userAchievement.count({ where: { achievementId: achievement.id } })
      )
    );

    return achievements.map((achievement, index) => ({
      ...(achievement as any),
      unlockCount: counts[index] ?? 0,
    })) as (Achievement & { unlockCount: number })[];
  }
}

export const achievementRepository = new AchievementRepository();
