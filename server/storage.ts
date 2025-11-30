ring): Promise<Notification> {
    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return convertPrismaNotification(notification);
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { 
        userId,
        read: false,
      },
      data: { read: true },
    });
  }

  async getNotificationsPendingPush(limit: number = 50): Promise<Notification[]> {
    // @ts-ignore - pendingPush field exists in runtime but LSP cache issue
    const notifications = await prisma.notification.findMany({
      where: {
        pendingPush: true,
        deliveryAttempts: {
          lt: 5,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return notifications.map(convertPrismaNotification);
  }

  async updateNotificationDelivery(id: string, updates: {
    deliveredAt?: Date;
    deliveryAttempts?: number;
    lastAttemptAt?: Date;
    pendingPush?: boolean;
    pushError?: string;
  }): Promise<Notification> {
    const data: any = {};
    if (updates.deliveredAt !== undefined) data.deliveredAt = updates.deliveredAt;
    if (updates.deliveryAttempts !== undefined) data.deliveryAttempts = updates.deliveryAttempts;
    if (updates.lastAttemptAt !== undefined) data.lastAttemptAt = updates.lastAttemptAt;
    if (updates.pendingPush !== undefined) data.pendingPush = updates.pendingPush;
    if (updates.pushError !== undefined) data.pushError = updates.pushError;

    const notification = await prisma.notification.update({
      where: { id },
      data,
    });
    return convertPrismaNotification(notification);
  }

  // Push Subscription operations
  async getPushSubscription(userId: string, endpoint: string): Promise<PushSubscription | null> {
    try {
      const subscription = await prisma.pushSubscription.findFirst({
        where: { userId, endpoint },
      });
      return subscription ? convertPrismaPushSubscription(subscription) : null;
    } catch (error) {
      console.error("Error getting push subscription:", error);
      return null;
    }
  }

  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription> {
    try {
      const subscription = await prisma.pushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId: data.userId,
            endpoint: data.endpoint,
          },
        },
        update: {
          p256dh: data.p256dh,
          auth: data.auth,
          expirationTime: data.expirationTime || null,
          enabled: true,
          updatedAt: new Date(),
        },
        create: {
          userId: data.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          expirationTime: data.expirationTime || null,
          enabled: true,
        },
      });
      return convertPrismaPushSubscription(subscription);
    } catch (error) {
      console.error("Error creating push subscription:", error);
      throw new Error("Failed to create push subscription");
    }
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
    } catch (error) {
      console.error("Error deleting push subscription:", error);
      throw new Error("Failed to delete push subscription");
    }
  }

  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId, enabled: true },
        orderBy: { createdAt: 'desc' },
      });
      return subscriptions.map(convertPrismaPushSubscription);
    } catch (error) {
      console.error("Error getting user push subscriptions:", error);
      return [];
    }
  }

  async disablePushSubscription(endpoint: string): Promise<void> {
    try {
      await prisma.pushSubscription.updateMany({
        where: { endpoint },
        data: { enabled: false, updatedAt: new Date() },
      });
    } catch (error) {
      console.error("Error disabling push subscription:", error);
    }
  }

  // XP Leaderboard operations
  async getXPLeaderboard(currentUserId: string, period: string, category: string, isAdmin: boolean = false): Promise<any> {
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date | null = null;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all-time':
      default:
        startDate = null;
        break;
    }

    if (category === 'overall') {
      // Overall: Rank by total user XP
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          xp: true,
        },
        orderBy: { xp: 'desc' },
        take: 100, // Get top 100 to find current user
      });

      const leaderboard = users.slice(0, 10).map((user, index) => {
        const baseData = {
          xp: user.xp,
          categoryXp: user.xp,
          rank: index + 1,
        };
        
        if (isAdmin) {
          return {
            ...baseData,
            userId: user.id,
            username: user.username,
            email: user.email,
            displayName: user.username || user.email,
          };
        } else {
          return {
            ...baseData,
            displayName: generateAnonymizedHandle(user.id),
          };
        }
      });

      // Find current user position
      const currentUserRank = users.findIndex(u => u.id === currentUserId);
      let userPosition = null;

      if (currentUserRank > 9) {
        const currentUser = users[currentUserRank];
        const baseData = {
          xp: currentUser.xp,
          categoryXp: currentUser.xp,
          rank: currentUserRank + 1,
        };
        
        if (isAdmin) {
          userPosition = {
            ...baseData,
            userId: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            displayName: currentUser.username || currentUser.email,
          };
        } else {
          userPosition = {
            ...baseData,
            displayName: 'You',
          };
        }
      }

      return { leaderboard, userPosition };
    } else {
      // Category-specific: Calculate from activities
      const typeFilter = category === 'mining' ? 'mining' : category === 'staking' ? 'stak' : 'referral';
      
      // Get top 100 users by overall XP to limit scope (performance optimization)
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          xp: true,
        },
        orderBy: { xp: 'desc' },
        take: 100,
      });

      // Calculate category XP for each user
      const userXPData = await Promise.all(
        users.map(async (user) => {
          const whereClause: any = {
            userId: user.id,
            type: { contains: typeFilter },
          };
          
          if (startDate) {
            whereClause.createdAt = { gte: startDate };
          }

          const activities = await prisma.activity.findMany({
            where: whereClause,
          });

          // Extract XP from activity descriptions
          let categoryXp = 0;
          activities.forEach(activity => {
            const xpMatch = activity.description.match(/(\d+)\s*XP/i);
            if (xpMatch) {
              categoryXp += parseInt(xpMatch[1]);
            }
          });

          return {
            userId: user.id,
            username: user.username,
            email: user.email,
            xp: user.xp,
            categoryXp,
          };
        })
      );

      // Sort by category XP
      userXPData.sort((a, b) => b.categoryXp - a.categoryXp);

      const leaderboard = userXPData.slice(0, 10).map((user, index) => {
        const baseData = {
          xp: user.xp,
          categoryXp: user.categoryXp,
          rank: index + 1,
        };
        
        if (isAdmin) {
          return {
            ...baseData,
            userId: user.userId,
            username: user.username,
            email: user.email,
            displayName: user.username || user.email,
          };
        } else {
          return {
            ...baseData,
            displayName: generateAnonymizedHandle(user.userId),
          };
        }
      });

      // Find current user position
      const currentUserRank = userXPData.findIndex(u => u.userId === currentUserId);
      let userPosition = null;

      if (currentUserRank > 9) {
        const currentUser = userXPData[currentUserRank];
        const baseData = {
          xp: currentUser.xp,
          categoryXp: currentUser.categoryXp,
          rank: currentUserRank + 1,
        };
        
        if (isAdmin) {
          userPosition = {
            ...baseData,
            userId: currentUser.userId,
            username: currentUser.username,
            email: currentUser.email,
            displayName: currentUser.username || currentUser.email,
          };
        } else {
          userPosition = {
            ...baseData,
            displayName: 'You',
          };
        }
      }

      return { leaderboard, userPosition };
    }
  }

  // Raw query support
  async raw(query: string, params: any[] = []): Promise<any[]> {
    return await prisma.$queryRawUnsafe(query, ...params);
  }
}

export const storage = new DatabaseStorage();
