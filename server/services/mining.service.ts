import {
  storage,
  MINING_SESSION_DURATION_MS,
  MINING_SESSION_XNRT_REWARD,
  MINING_SESSION_XP_REWARD,
} from "../storage";

export async function getCurrentMiningSessionForUser(userId: string) {
  await storage.processMiningRewards(userId);
  return storage.getCurrentMiningSession(userId);
}

export async function getMiningHistoryForUser(userId: string) {
  return storage.getMiningHistory(userId);
}

export async function processMiningRewardsForUser(userId: string) {
  return storage.processMiningRewards(userId);
}

export async function startMiningSessionForUser(userId: string) {
  await storage.processMiningRewards(userId);

  const currentSession = await storage.getCurrentMiningSession(userId);
  if (currentSession && currentSession.status === "active") {
    return {
      ok: false as const,
      status: 400,
      message: "You already have an active mining session",
    };
  }

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + MINING_SESSION_DURATION_MS);

  const session = await storage.createMiningSession({
    userId,
    baseReward: MINING_SESSION_XP_REWARD,
    adBoostCount: 0,
    boostPercentage: 0,
    finalReward: MINING_SESSION_XP_REWARD,
    startTime,
    endTime,
    nextAvailable: endTime,
    status: "active",
  });

  return {
    ok: true as const,
    session: {
      ...session,
      reward: {
        xp: MINING_SESSION_XP_REWARD,
        xnrt: MINING_SESSION_XNRT_REWARD,
        durationHours: 24,
      },
    },
  };
}
