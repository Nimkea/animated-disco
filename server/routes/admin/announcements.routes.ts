import type { Express } from "express";
import type { RouteContext } from "../../routes";

export function registerAdminAnnouncementRoutes(app: Express, ctx: RouteContext) {
  const {
    storage,
    prisma,
    requireAuth,
    requireAdmin,
    validateCSRF,
    STAKING_TIERS,
    Prisma,
    notifyUser,
    sendPushNotification,
    verifyBscUsdtDeposit,
    ethers,
    mintXNRT,
    isTokenServiceReady,
    getTxExplorerUrl,
    generateAnonymizedHandle,
    MINING_SESSION_DURATION_MS,
    MINING_SESSION_XNRT_REWARD,
    MINING_SESSION_XP_REWARD,
    getWalletRates,
    decimalValueToNumber,
    isSameLocalDay,
    normalizeBscAddress,
    getBalanceSourceKey,
    getOrCreateUserDepositAddress,
    normalizeLeaderboardPeriodParam,
    getLeaderboardDateFilter,
    clampLeaderboardLimit,
    toLeaderboardNumber,
    syncUserTasksForActiveTasks,
    serializeTask,
    serializeUserTaskWithTask,
    parseTaskPayload,
    awardUserXp,
    parseAchievementPayload,
    profileUpdateSchema,
    pushSubscriptionLimiter,
    VAPID_PUBLIC_KEY,
    TRUST_LOAN_CONFIG,
    getDirectReferralStats,
    insertAnnouncementSchema,
    z,
  } = ctx;
  // ===== ANNOUNCEMENTS =====
  app.get("/api/announcements", async (_req, res) => {
    try {
      const now = new Date();
      const announcements = await prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.get(
    "/api/admin/announcements",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const announcements = await prisma.announcement.findMany({
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        res.json(announcements);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch announcements" });
      }
    }
  );

  app.post(
    "/api/admin/announcements",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const validationResult = insertAnnouncementSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationResult.error.issues,
          });
        }

        const { title, content, type, isActive, expiresAt } =
          validationResult.data;

        const announcement = await prisma.announcement.create({
          data: {
            title,
            content,
            type: type || "info",
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.authUser!.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
        });

        res.status(201).json(announcement);
      } catch (error) {
        console.error("Error creating announcement:", error);
        res
          .status(500)
          .json({ message: "Failed to create announcement" });
      }
    }
  );

  app.put(
    "/api/admin/announcements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;

        const partialSchema = insertAnnouncementSchema.partial();
        const validationResult = partialSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationResult.error.issues,
          });
        }

        const { title, content, type, isActive, expiresAt } =
          validationResult.data;

        const announcement = await prisma.announcement.update({
          where: { id },
          data: {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            ...(type !== undefined && { type }),
            ...(isActive !== undefined && { isActive }),
            ...(expiresAt !== undefined && {
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            }),
          },
          include: {
            creator: { select: { id: true, username: true, email: true } },
          },
        });

        res.json(announcement);
      } catch (error: any) {
        console.error("Error updating announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res
          .status(500)
          .json({ message: "Failed to update announcement" });
      }
    }
  );

  app.delete(
    "/api/admin/announcements/:id",
    requireAuth,
    requireAdmin,
    validateCSRF,
    async (req, res) => {
      try {
        const { id } = req.params;
        await prisma.announcement.delete({ where: { id } });
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting announcement:", error);
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Announcement not found" });
        }
        res
          .status(500)
          .json({ message: "Failed to delete announcement" });
      }
    }
  );
}
