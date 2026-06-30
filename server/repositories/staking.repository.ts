import { Prisma } from "@prisma/client";
import type { InsertStake, Stake } from "@shared/schema";
import { prisma } from "../lib/db";
import { convertPrismaStake } from "./converters";

export class StakingRepository {
  async findByUser(userId: string): Promise<Stake[]> {
    const stakes = await prisma.stake.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return stakes.map(convertPrismaStake);
  }

  async findById(id: string): Promise<Stake | undefined> {
    const stake = await prisma.stake.findUnique({ where: { id } });
    return stake ? convertPrismaStake(stake) : undefined;
  }

  async create(stake: InsertStake): Promise<Stake> {
    const newStake = await prisma.stake.create({
      data: {
        userId: stake.userId,
        tier: stake.tier,
        amount: new Prisma.Decimal(stake.amount),
        dailyRate: new Prisma.Decimal(stake.dailyRate),
        duration: stake.duration,
        startDate: stake.startDate || new Date(),
        endDate: stake.endDate,
        totalProfit: new Prisma.Decimal(stake.totalProfit || "0"),
        lastProfitDate: stake.lastProfitDate,
        status: stake.status || "active",
        loanProgram: stake.loanProgram,
        unlockMet: stake.unlockMet || false,
        requiredReferrals: stake.requiredReferrals,
        requiredInvestingReferrals: stake.requiredInvestingReferrals,
        minInvestUsdtPerReferral: stake.minInvestUsdtPerReferral
          ? new Prisma.Decimal(stake.minInvestUsdtPerReferral)
          : undefined,
      },
    });
    return convertPrismaStake(newStake);
  }

  async update(id: string, updates: Partial<Stake>): Promise<Stake> {
    const data: any = {};
    if (updates.totalProfit !== undefined) data.totalProfit = new Prisma.Decimal(updates.totalProfit);
    if (updates.lastProfitDate !== undefined) data.lastProfitDate = updates.lastProfitDate;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.unlockMet !== undefined) data.unlockMet = updates.unlockMet;

    const stake = await prisma.stake.update({ where: { id }, data });
    return convertPrismaStake(stake);
  }

  async atomicWithdraw(id: string, totalProfit: string): Promise<Stake | null> {
    try {
      const stake = await prisma.stake.updateMany({
        where: { id, OR: [{ status: "completed" }, { status: "active" }] },
        data: { status: "withdrawn", totalProfit: new Prisma.Decimal(totalProfit) },
      });
      if (stake.count === 0) return null;

      const updatedStake = await prisma.stake.findUnique({ where: { id } });
      return updatedStake ? convertPrismaStake(updatedStake) : null;
    } catch {
      return null;
    }
  }

  async findAllActive(): Promise<Stake[]> {
    const stakes = await prisma.stake.findMany({ where: { status: "active" } });
    return stakes.map(convertPrismaStake);
  }
}

export const stakingRepository = new StakingRepository();
