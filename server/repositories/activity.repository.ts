import type { Activity, InsertActivity } from "@shared/schema";
import { prisma } from "../lib/db";
import { convertPrismaActivity } from "./converters";

export class ActivityRepository {
  async create(activity: InsertActivity): Promise<Activity> {
    const data: any = {
      userId: activity.userId,
      type: activity.type,
      description: activity.description,
    };
    if (activity.metadata !== undefined && activity.metadata !== null) data.metadata = activity.metadata;
    const newActivity = await prisma.activity.create({ data });
    return convertPrismaActivity(newActivity);
  }

  async findByUser(userId: string, limit: number = 10): Promise<Activity[]> {
    const activities = await prisma.activity.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
    return activities.map(convertPrismaActivity);
  }
}

export const activityRepository = new ActivityRepository();
