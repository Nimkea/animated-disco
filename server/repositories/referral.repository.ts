import { Prisma } from "@prisma/client";
import type { InsertReferral, Referral, User } from "@shared/schema";
import { prisma } from "../lib/db";
import { convertPrismaReferral, convertPrismaUser } from "./converters";

export function normalizeReferralCodeValue(code?: string | null): string | null {
  const normalized = (code || "").trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export class ReferralRepository {
  async findByReferrer(referrerId: string): Promise<Referral[]> {
    const referrals = await prisma.referral.findMany({ where: { referrerId } });
    return referrals.map(convertPrismaReferral);
  }

  async create(referral: InsertReferral): Promise<Referral> {
    const existing = await prisma.referral.findFirst({
      where: {
        referrerId: referral.referrerId,
        referredUserId: referral.referredUserId,
        level: referral.level,
      },
    });
    if (existing) return convertPrismaReferral(existing);

    const newReferral = await prisma.referral.create({
      data: {
        referrerId: referral.referrerId,
        referredUserId: referral.referredUserId,
        level: referral.level,
        totalCommission: new Prisma.Decimal(referral.totalCommission || "0"),
      },
    });
    return convertPrismaReferral(newReferral);
  }

  async update(id: string, updates: Partial<Referral>): Promise<Referral> {
    const data: any = {};
    if (updates.totalCommission !== undefined) data.totalCommission = new Prisma.Decimal(updates.totalCommission);
    const referral = await prisma.referral.update({ where: { id }, data });
    return convertPrismaReferral(referral);
  }

  async resolveCodeToUserId(refCode?: string | null): Promise<string | null> {
    const normalized = normalizeReferralCodeValue(refCode);
    if (!normalized) return null;
    const referrer = await prisma.user.findUnique({
      where: { referralCode: normalized },
      select: { id: true },
    });
    return referrer?.id || null;
  }

  async ensureRecord(referrerId: string, referredUserId: string, level: number, totalCommission = "0"): Promise<void> {
    if (!referrerId || !referredUserId || referrerId === referredUserId) return;

    const existing = await prisma.referral.findFirst({
      where: { referrerId, referredUserId, level },
      select: { id: true },
    });
    if (existing) return;

    await prisma.referral.create({
      data: {
        referrerId,
        referredUserId,
        level,
        totalCommission: new Prisma.Decimal(totalCommission),
      },
    });
  }

  async getReferrerChain(userId: string, maxLevels: number): Promise<User[]> {
    const chain: User[] = [];
    const seen = new Set<string>([userId]);
    let currentUserId = userId;

    for (let i = 0; i < maxLevels; i++) {
      const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
      if (!currentUser || !currentUser.referredBy) break;

      let referrer = await prisma.user.findUnique({ where: { id: currentUser.referredBy } });

      // Backfill old records where referredBy stored a referral code instead of a user id.
      if (!referrer) {
        const normalizedCode = normalizeReferralCodeValue(currentUser.referredBy);
        referrer = normalizedCode
          ? await prisma.user.findUnique({ where: { referralCode: normalizedCode } })
          : null;

        if (referrer) {
          await prisma.user.update({ where: { id: currentUser.id }, data: { referredBy: referrer.id } });
        }
      }

      if (!referrer) break;
      if (seen.has(referrer.id)) {
        console.warn(`[REFERRAL] Referral cycle detected at user ${referrer.id}; stopping chain lookup.`);
        break;
      }

      chain.push(convertPrismaUser(referrer));
      seen.add(referrer.id);
      currentUserId = referrer.id;
    }

    return chain;
  }
}

export const referralRepository = new ReferralRepository();
