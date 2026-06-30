import type { Express } from "express";
import type { RouteContext } from "../../routes";
import type { StakingTier } from "../../../shared/schema";

const ADMIN_STAKE_STATUSES = new Set(["active", "completed", "withdrawn"]);

function serializeAdminStake(stake: any) {
  return {
    ...stake,
    amount: stake.amount?.toString?.() ?? String(stake.amount ?? "0"),
    dailyRate: stake.dailyRate?.toString?.() ?? String(stake.dailyRate ?? "0"),
    totalProfit: stake.totalProfit?.toString?.() ?? String(stake.totalProfit ?? "0"),
  };
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function registerAdminStakeRoutes(app: Express, ctx: RouteContext) {
  const { prisma, requireAuth, requireAdmin, validateCSRF, STAKING_TIERS, Prisma } = ctx;

  app.get("/api/admin/stakes", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const stakes = await prisma.stake.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(stakes.map(serializeAdminStake));
    } catch (error) {
      console.error("Error fetching admin stakes:", error);
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });

  app.post("/api/admin/stakes", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { userId, tier, amount, duration } = req.body ?? {};

      if (!userId || typeof userId !== "string") {
        return res.status(400).json({ message: "User is required" });
      }

      if (!tier || typeof tier !== "string" || !(tier in STAKING_TIERS)) {
        return res.status(400).json({ message: "Invalid staking tier" });
      }

      const stakeAmount = parsePositiveNumber(amount);
      if (!stakeAmount) {
        return res.status(400).json({ message: "Enter a valid stake amount" });
      }

      const tierKey = tier as StakingTier;
      const tierConfig = STAKING_TIERS[tierKey];
      const durationDays = parsePositiveInt(duration) ?? tierConfig.duration;
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const stakeAmountDecimal = new Prisma.Decimal(stakeAmount.toString());

      const createdStake = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, email: true },
        });

        if (!user) {
          throw Object.assign(new Error("User not found"), { statusCode: 404 });
        }

        const balance = await tx.balance.findUnique({ where: { userId } });
        if (!balance) {
          throw Object.assign(new Error("User balance not found"), { statusCode: 404 });
        }

        if (new Prisma.Decimal(balance.xnrtBalance).lessThan(stakeAmountDecimal)) {
          throw Object.assign(new Error("Insufficient user balance for this stake"), { statusCode: 400 });
        }

        const stake = await tx.stake.create({
          data: {
            userId,
            tier: tierKey,
            amount: stakeAmountDecimal,
            dailyRate: new Prisma.Decimal(tierConfig.dailyRate.toString()),
            duration: durationDays,
            startDate,
            endDate,
            totalProfit: new Prisma.Decimal(0),
            lastProfitDate: null,
            status: "active",
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        });

        await tx.balance.update({
          where: { userId },
          data: {
            xnrtBalance: { decrement: stakeAmountDecimal },
            stakingBalance: { increment: stakeAmountDecimal },
          },
        });

        await tx.activity.create({
          data: {
            userId,
            type: "admin_stake_created",
            description: `Admin created ${stakeAmount.toLocaleString()} XNRT ${tierConfig.name} stake for ${durationDays} days`,
          },
        });

        return stake;
      });

      res.status(201).json(serializeAdminStake(createdStake));
    } catch (error: any) {
      const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
      if (statusCode >= 500) console.error("Error creating admin stake:", error);
      res.status(statusCode).json({ message: error?.message || "Failed to create stake" });
    }
  });

  app.put("/api/admin/stakes/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, totalProfit } = req.body ?? {};
      const data: any = {};

      if (status !== undefined) {
        if (typeof status !== "string" || !ADMIN_STAKE_STATUSES.has(status)) {
          return res.status(400).json({ message: "Invalid stake status" });
        }
        data.status = status;
      }

      if (totalProfit !== undefined && totalProfit !== "") {
        const parsedProfit = parsePositiveNumber(totalProfit) ?? (Number(totalProfit) === 0 ? 0 : null);
        if (parsedProfit === null) {
          return res.status(400).json({ message: "Enter a valid total profit" });
        }
        data.totalProfit = new Prisma.Decimal(parsedProfit.toString());
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No valid stake updates provided" });
      }

      const updatedStake = await prisma.stake.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      await prisma.activity.create({
        data: {
          userId: updatedStake.userId,
          type: "admin_stake_updated",
          description: `Admin updated stake ${updatedStake.id}`,
        },
      });

      res.json(serializeAdminStake(updatedStake));
    } catch (error: any) {
      if (error?.code === "P2025") {
        return res.status(404).json({ message: "Stake not found" });
      }
      console.error("Error updating admin stake:", error);
      res.status(500).json({ message: "Failed to update stake" });
    }
  });

  app.delete("/api/admin/stakes/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.$transaction(async (tx) => {
        const stake = await tx.stake.findUnique({ where: { id } });
        if (!stake) {
          throw Object.assign(new Error("Stake not found"), { statusCode: 404 });
        }

        if (stake.status === "active") {
          const balance = await tx.balance.findUnique({ where: { userId: stake.userId } });
          if (balance) {
            const currentStakingBalance = new Prisma.Decimal(balance.stakingBalance);
            const nextStakingBalance = currentStakingBalance.lessThan(stake.amount)
              ? new Prisma.Decimal(0)
              : currentStakingBalance.minus(stake.amount);

            await tx.balance.update({
              where: { userId: stake.userId },
              data: {
                xnrtBalance: { increment: stake.amount },
                stakingBalance: nextStakingBalance,
              },
            });
          }
        }

        await tx.stake.delete({ where: { id } });
        await tx.activity.create({
          data: {
            userId: stake.userId,
            type: "admin_stake_deleted",
            description: `Admin deleted stake ${stake.id}`,
          },
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
      if (statusCode >= 500) console.error("Error deleting admin stake:", error);
      res.status(statusCode).json({ message: error?.message || "Failed to delete stake" });
    }
  });
}
