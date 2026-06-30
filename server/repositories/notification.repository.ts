import type { InsertNotification, InsertPushSubscription, Notification, PushSubscription } from "@shared/schema";
import { prisma } from "../lib/db";
import { convertPrismaNotification, convertPrismaPushSubscription } from "./converters";

export class NotificationRepository {
  async create(notification: InsertNotification): Promise<Notification> {
    const data: any = {
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read || false,
    };

    if (notification.metadata !== undefined && notification.metadata !== null) {
      data.metadata = typeof notification.metadata === "string" ? notification.metadata : JSON.stringify(notification.metadata);
    }

    const newNotification = await prisma.notification.create({ data });
    return convertPrismaNotification(newNotification);
  }

  async findByUser(userId: string, limit: number = 20): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
    return notifications.map(convertPrismaNotification);
  }

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, read: false } });
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await prisma.notification.update({ where: { id }, data: { read: true } });
    return convertPrismaNotification(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  async findPendingPush(limit: number = 50): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({
      where: { pendingPush: true, deliveryAttempts: { lt: 5 } } as any,
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return notifications.map(convertPrismaNotification);
  }

  async updateDelivery(
    id: string,
    updates: {
      deliveredAt?: Date;
      deliveryAttempts?: number;
      lastAttemptAt?: Date;
      pendingPush?: boolean;
      pushError?: string;
    }
  ): Promise<Notification> {
    const data: any = {};
    if (updates.deliveredAt !== undefined) data.deliveredAt = updates.deliveredAt;
    if (updates.deliveryAttempts !== undefined) data.deliveryAttempts = updates.deliveryAttempts;
    if (updates.lastAttemptAt !== undefined) data.lastAttemptAt = updates.lastAttemptAt;
    if (updates.pendingPush !== undefined) data.pendingPush = updates.pendingPush;
    if (updates.pushError !== undefined) data.pushError = updates.pushError;
    const notification = await prisma.notification.update({ where: { id }, data });
    return convertPrismaNotification(notification);
  }

  async findPushSubscription(userId: string, endpoint: string): Promise<PushSubscription | null> {
    const subscription = await prisma.pushSubscription.findFirst({ where: { userId, endpoint } });
    return subscription ? convertPrismaPushSubscription(subscription) : null;
  }

  async upsertPushSubscription(data: InsertPushSubscription): Promise<PushSubscription> {
    const subscription = await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: data.userId, endpoint: data.endpoint } },
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
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async findUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId, enabled: true }, orderBy: { createdAt: "desc" } });
    return subscriptions.map(convertPrismaPushSubscription);
  }

  async disablePushSubscription(endpoint: string): Promise<void> {
    await prisma.pushSubscription.updateMany({ where: { endpoint }, data: { enabled: false, updatedAt: new Date() } });
  }
}

export const notificationRepository = new NotificationRepository();
