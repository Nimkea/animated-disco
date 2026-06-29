import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { isSameLocalDay } from "../lib/dates";
import { notifyUser } from "../notifications";
import { storage } from "../storage";

const DEFAULT_ACHIEVEMENTS = [
  { title: "Sign-in Bonus", description: "Claim your first daily check-in reward", icon: "✅", category: "streaks", requirement: 1, xpReward: 5 },
  { title: "First Earnings", description: "Earn a total of 1,000 XNRT from any source", icon: "💰", category: "earnings", requirement: 1000, xpReward: 25 },
  { title: "Rising Earner", description: "Earn a total of 5,000 XNRT", icon: "📈", category: "earnings", requirement: 5000, xpReward: 75 },
  { title: "Pro Earner", description: "Earn a total of 25,000 XNRT", icon: "🏅", category: "earnings", requirement: 25000, xpReward: 150 },
  { title: "First Referral", description: "Invite your first friend to XNRT", icon: "👥", category: "referrals", requirement: 1, xpReward: 25 },
  { title: "Team Builder", description: "Refer 5 direct users", icon: "🧱", category: "referrals", requirement: 5, xpReward: 75 },
  { title: "Community Leader", description: "Refer 25 direct users", icon: "👑", category: "referrals", requirement: 25, xpReward: 200 },
  { title: "3-Day Streak", description: "Check in 3 days in a row", icon: "🔥", category: "streaks", requirement: 3, xpReward: 30 },
  { title: "Weekly Grinder", description: "Maintain a 7-day login streak", icon: "📆", category: "streaks", requirement: 7, xpReward: 70 },
  { title: "Monthly Legend", description: "Maintain a 30-day login streak", icon: "🏆", category: "streaks", requirement: 30, xpReward: 200 },
  { title: "First Mining Session", description: "Complete your first mining session", icon: "⛏️", category: "mining", requirement: 1, xpReward: 15 },
  { title: "Daily Miner", description: "Complete 10 mining sessions", icon: "🪙", category: "mining", requirement: 10, xpReward: 60 },
  { title: "Pro Miner", description: "Complete 50 mining sessions", icon: "⚙️", category: "mining", requirement: 50, xpReward: 200 },
] as const;

const DEFAULT_TASKS = [
  { title: "Complete Your Profile", description: "Review your profile and complete your account setup", category: "onboarding", xpReward: 50, xnrtReward: "10", requirements: "Open your profile and make sure your account details are ready", isActive: true },
  { title: "Daily Check-In", description: "Use the Rewards page daily and build your streak", category: "engagement", xpReward: 25, xnrtReward: "5", requirements: "Visit Rewards and complete your daily check-in", isActive: true },
  { title: "Start Mining", description: "Visit the mining page and start your earning routine", category: "mining", xpReward: 75, xnrtReward: "15", requirements: "Start or complete your first mining session", isActive: true },
  { title: "Create First Stake", description: "Create your first staking position", category: "staking", xpReward: 100, xnrtReward: "25", requirements: "Stake any eligible XNRT amount", isActive: true },
  { title: "Invite A Friend", description: "Share your referral code with a new user", category: "referrals", xpReward: 120, xnrtReward: "30", requirements: "Get at least one direct referral", isActive: true },
] as const;

export async function ensureDefaultTasks() {
  for (const def of DEFAULT_TASKS) {
    try {
      await prisma.task.upsert({
        where: { title: def.title },
        create: { ...def, xnrtReward: new Prisma.Decimal(def.xnrtReward) },
        update: {
          description: def.description,
          category: def.category,
          xpReward: def.xpReward,
          xnrtReward: new Prisma.Decimal(def.xnrtReward),
          requirements: def.requirements,
          isActive: def.isActive,
        },
      });
    } catch (err) {
      console.error("[Tasks] Failed to upsert default task", def.title, err);
    }
  }
}

export async function ensureDefaultAchievements() {
  for (const def of DEFAULT_ACHIEVEMENTS) {
    try {
      await prisma.achievement.upsert({
        where: { title: def.title },
        create: def,
        update: {
          description: def.description,
          icon: def.icon,
          category: def.category,
          requirement: def.requirement,
          xpReward: def.xpReward,
        },
      });
    } catch (err) {
      console.error("[Achievements] Failed to upsert default achievement", def.title, err);
    }
  }
}

export function serializeTask(task: any) {
  if (!task) return null;
  return {
    ...task,
    xnrtReward: task.xnrtReward?.toString?.() ?? String(task.xnrtReward ?? "0"),
  };
}

export function serializeUserTaskWithTask(userTask: any) {
  return {
    ...userTask,
    task: serializeTask(userTask.task),
  };
}

export async function syncUserTasksForActiveTasks(userId: string) {
  const activeTasks = await prisma.task.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (activeTasks.length === 0) return [];

  const taskIds = activeTasks.map((task) => task.id);
  const existingUserTasks = await prisma.userTask.findMany({
    where: { userId, taskId: { in: taskIds } },
    select: { taskId: true },
  });
  const existingTaskIds = new Set(existingUserTasks.map((task) => task.taskId));
  const missingTasks = activeTasks.filter((task) => !existingTaskIds.has(task.id));

  if (missingTasks.length > 0) {
    await prisma.userTask.createMany({
      data: missingTasks.map((task) => ({
        userId,
        taskId: task.id,
        progress: 0,
        maxProgress: 1,
        completed: false,
      })),
      skipDuplicates: true,
    });
  }

  return prisma.userTask.findMany({
    where: { userId, taskId: { in: taskIds } },
    include: { task: true },
    orderBy: { createdAt: "asc" },
  });
}

export function parseTaskPayload(body: any) {
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category =
    String(body?.category ?? "special")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 40) || "special";

  if (!title || !description) {
    throw new Error("Title and description are required");
  }

  const xpReward = Number(body?.xpReward ?? 0);
  const xnrtReward = Number(body?.xnrtReward ?? 0);

  if (!Number.isFinite(xpReward) || xpReward < 0) throw new Error("Invalid XP reward");
  if (!Number.isFinite(xnrtReward) || xnrtReward < 0) throw new Error("Invalid XNRT reward");

  const requirements = String(body?.requirements ?? "").trim();

  return {
    title,
    description,
    xpReward: Math.floor(xpReward),
    xnrtReward: new Prisma.Decimal(xnrtReward.toString()),
    category,
    requirements: requirements || null,
    isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
  };
}

export async function awardUserXp(userId: string, xpReward: number) {
  if (xpReward <= 0) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true } });
  if (!user) return null;
  const nextXp = (user.xp || 0) + xpReward;
  const nextLevel = Math.floor(nextXp / 1000) + 1;
  return prisma.user.update({ where: { id: userId }, data: { xp: nextXp, level: nextLevel } });
}

export function parseAchievementPayload(body: any) {
  const { title, description, icon = "🏆", category = "earnings", requirement, xpReward } = body || {};

  if (!title || !description) throw new Error("Title and description are required");

  const requirementNum = Number(requirement);
  const xpRewardNum = Number(xpReward);

  if (!Number.isFinite(requirementNum) || requirementNum < 0) throw new Error("Invalid requirement");
  if (!Number.isFinite(xpRewardNum) || xpRewardNum < 0) throw new Error("Invalid XP reward");

  const allowedCategories = new Set(["earnings", "referrals", "streaks", "mining"]);

  return {
    title: String(title),
    description: String(description),
    icon: String(icon || "🏆"),
    category: allowedCategories.has(category) ? category : "earnings",
    requirement: Math.floor(requirementNum),
    xpReward: Math.floor(xpRewardNum),
  };
}

export async function completeUserTask(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.isActive) {
    return { ok: false as const, status: 404, message: "Task not found" };
  }

  const userTask = await prisma.userTask.upsert({
    where: { userId_taskId: { userId, taskId } },
    create: { userId, taskId, progress: 0, maxProgress: 1, completed: false },
    update: {},
  });

  if (userTask.completed) {
    return { ok: false as const, status: 400, message: "Task already completed" };
  }

  const maxProgress = Math.max(userTask.maxProgress || 1, 1);
  if (maxProgress > 1 && userTask.progress < maxProgress) {
    return {
      ok: false as const,
      status: 400,
      message: `Task progress is incomplete (${userTask.progress}/${maxProgress})`,
    };
  }

  const completedUserTask = await prisma.userTask.update({
    where: { id: userTask.id },
    data: { completed: true, completedAt: new Date(), progress: maxProgress },
  });

  await awardUserXp(userId, task.xpReward);

  const xnrtAmount = Number(task.xnrtReward);
  if (Number.isFinite(xnrtAmount) && xnrtAmount > 0) {
    const balance = await storage.getBalance(userId);
    if (balance) {
      await storage.updateBalance(userId, {
        xnrtBalance: (parseFloat(balance.xnrtBalance) + xnrtAmount).toString(),
        totalEarned: (parseFloat(balance.totalEarned) + xnrtAmount).toString(),
      });
    }

    await storage.createTransaction({
      userId,
      type: "reward",
      amount: xnrtAmount.toString(),
      source: "task",
      status: "approved",
      approvedAt: new Date(),
      verified: true,
    });
  }

  await storage.createActivity({
    userId,
    type: "task_completed",
    description: `Completed task: ${task.title} (+${task.xpReward} XP, +${task.xnrtReward.toString()} XNRT)`,
  });

  void notifyUser(userId, {
    type: "task_completed",
    title: "✅ Task Completed",
    message: `You earned ${task.xpReward} XP and ${task.xnrtReward.toString()} XNRT from ${task.title}.`,
    url: "/tasks",
    metadata: {
      taskId: task.id,
      taskTitle: task.title,
      xpReward: task.xpReward,
      xnrtReward: task.xnrtReward.toString(),
    },
  }).catch((err: unknown) => {
    console.error("Error sending task completion notification:", err);
  });

  await storage.checkAndUnlockAchievements(userId);

  return {
    ok: true as const,
    userTask: completedUserTask,
    xpReward: task.xpReward,
    xnrtReward: task.xnrtReward.toString(),
  };
}

export async function getUserAchievementsWithStatus(userId: string) {
  const allAchievements = await storage.getAllAchievements();
  const userAchievements = await storage.getUserAchievements(userId);

  return allAchievements.map((achievement: any) => {
    const ua = (userAchievements as any[]).find((x) => x.achievementId === achievement.id);
    const unlocked = !!ua;
    const claimed = !!ua?.claimed;
    const claimedAt = ua?.claimedAt ?? null;

    return {
      ...achievement,
      unlocked,
      unlockedAt: ua?.unlockedAt ?? ua?.createdAt ?? null,
      claimed,
      claimedAt,
      claimable: unlocked && !claimed,
    };
  });
}

export async function claimUserAchievement(userId: string, achievementId: string) {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return { ok: false as const, status: 404, message: "Achievement not found" };

  const userAchievement = await prisma.userAchievement.findFirst({ where: { userId, achievementId } });
  if (!userAchievement) {
    return { ok: false as const, status: 400, message: "Achievement not unlocked yet" };
  }
  if (userAchievement.claimed) {
    return { ok: false as const, status: 400, message: "Achievement already claimed" };
  }

  const updated = await prisma.userAchievement.update({
    where: { id: userAchievement.id },
    data: { claimed: true, claimedAt: new Date() },
  });

  await storage.createActivity({
    userId,
    type: "achievement_claimed",
    description: `Claimed achievement: ${achievement.title}`,
  });

  return {
    ok: true as const,
    achievementId,
    claimed: updated.claimed,
    claimedAt: updated.claimedAt,
  };
}

export async function performDailyCheckIn(userId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const user = await storage.getUser(userId);
  if (!user) return { ok: false as const, status: 404, message: "User not found" };

  const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
  const lastCheckInDay = lastCheckIn
    ? new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate())
    : null;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastCheckIn && lastCheckInDay && lastCheckInDay.getTime() === today.getTime()) {
    return { ok: false as const, status: 400, message: "Already checked in today" };
  }

  let newStreak = 1;
  if (lastCheckInDay && lastCheckInDay.getTime() === yesterday.getTime()) {
    newStreak = (user.streak || 0) + 1;
  }

  const streakReward = Math.min(newStreak * 10, 100);
  const xpReward = Math.min(newStreak * 5, 50);
  const nextXp = (user.xp || 0) + xpReward;

  await storage.updateUser(userId, {
    lastCheckIn: now,
    streak: newStreak,
    xp: nextXp,
    level: Math.floor(nextXp / 1000) + 1,
  });

  const balance = await storage.getBalance(userId);
  if (balance) {
    await storage.updateBalance(userId, {
      xnrtBalance: (parseFloat(balance.xnrtBalance) + streakReward).toString(),
      totalEarned: (parseFloat(balance.totalEarned) + streakReward).toString(),
    });
  }

  await storage.createActivity({
    userId,
    type: "daily_checkin",
    description: `Day ${newStreak} streak! Earned ${streakReward} XNRT and ${xpReward} XP`,
  });

  await storage.checkAndUnlockAchievements(userId);

  return {
    ok: true as const,
    streak: newStreak,
    xnrtReward: streakReward,
    xpReward,
    message: `Day ${newStreak} check-in complete!`,
  };
}

export async function getCheckinHistory(userId: string, yearQuery: unknown, monthQuery: unknown) {
  const now = new Date();
  const targetYear = yearQuery ? parseInt(String(yearQuery), 10) : now.getFullYear();

  let targetMonth: number;
  if (typeof monthQuery !== "undefined") {
    const monthNum = parseInt(String(monthQuery), 10);
    const clamped = Math.min(Math.max(monthNum, 1), 12);
    targetMonth = clamped - 1;
  } else {
    targetMonth = now.getMonth();
  }

  const startDate = new Date(targetYear, targetMonth, 1);
  const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

  const checkinActivities = await prisma.activity.findMany({
    where: { userId, type: "daily_checkin", createdAt: { gte: startDate, lte: endDate } },
    orderBy: { createdAt: "asc" },
  });

  const checkinDates = checkinActivities.map((activity: { createdAt: Date | null }) =>
    new Date(activity.createdAt!).toISOString().split("T")[0]
  );

  return { dates: checkinDates, year: targetYear, month: targetMonth };
}

export function hasCheckedInToday(lastCheckIn?: Date | string | null) {
  return isSameLocalDay(lastCheckIn);
}
