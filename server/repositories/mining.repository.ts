import type { InsertMiningSession, MiningSession } from "@shared/schema";
import { prisma } from "../lib/db";
const MINING_SESSION_XP_REWARD = 10;
const DEFAULT_MINING_BASE_REWARD = MINING_SESSION_XP_REWARD;
const MINING_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export class MiningRepository {
  async findCurrentActive(userId: string): Promise<MiningSession | undefined> {
    const session = await prisma.miningSession.findFirst({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
    return session || undefined;
  }

  async findDueActive(userId?: string, now = new Date()): Promise<MiningSession[]> {
    return prisma.miningSession.findMany({
      where: {
        status: "active",
        ...(userId ? { userId } : {}),
        endTime: { lte: now },
      },
      orderBy: { endTime: "asc" },
      take: 100,
    });
  }

  async findHistory(userId: string, take = 50): Promise<MiningSession[]> {
    return prisma.miningSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async create(session: InsertMiningSession): Promise<MiningSession> {
    const now = new Date();
    const startTime = session.startTime ?? now;
    const defaultEndTime = new Date(startTime.getTime() + MINING_SESSION_DURATION_MS);
    const defaultNextAvailable = defaultEndTime;

    return prisma.miningSession.create({
      data: {
        userId: session.userId,
        baseReward: session.baseReward ?? DEFAULT_MINING_BASE_REWARD,
        adBoostCount: session.adBoostCount ?? 0,
        boostPercentage: session.boostPercentage ?? 0,
        finalReward: session.finalReward ?? MINING_SESSION_XP_REWARD,
        startTime,
        endTime: session.endTime ?? defaultEndTime,
        nextAvailable: session.nextAvailable ?? defaultNextAvailable,
        status: session.status ?? "active",
      },
    });
  }

  async update(id: string, updates: Partial<MiningSession>): Promise<MiningSession> {
    const data: any = {};
    if (updates.baseReward !== undefined) data.baseReward = updates.baseReward;
    if (updates.adBoostCount !== undefined) data.adBoostCount = updates.adBoostCount;
    if (updates.boostPercentage !== undefined) data.boostPercentage = updates.boostPercentage;
    if (updates.finalReward !== undefined) data.finalReward = updates.finalReward;
    if (updates.endTime !== undefined) data.endTime = updates.endTime;
    if (updates.nextAvailable !== undefined) data.nextAvailable = updates.nextAvailable;
    if (updates.status !== undefined) data.status = updates.status;

    return prisma.miningSession.update({ where: { id }, data });
  }
}

export const miningRepository = new MiningRepository();
