import type { User } from "@shared/schema";
import { prisma } from "../lib/db";
import { convertPrismaUser } from "./converters";

export class UserRepository {
  async findById(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? convertPrismaUser(user) : undefined;
  }

  async update(userId: string, updates: Partial<User>): Promise<User> {
    const updateData: any = {};

    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.isAdmin !== undefined) updateData.isAdmin = updates.isAdmin;
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName || null;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName || null;
    if (updates.profileImageUrl !== undefined) updateData.profileImageUrl = updates.profileImageUrl || null;
    if (updates.xp !== undefined) updateData.xp = updates.xp;
    if (updates.level !== undefined) updateData.level = updates.level;
    if (updates.streak !== undefined) updateData.streak = updates.streak;
    if (updates.lastCheckIn !== undefined) updateData.lastCheckIn = updates.lastCheckIn;
    updateData.updatedAt = new Date();

    const user = await prisma.user.update({ where: { id: userId }, data: updateData });
    return convertPrismaUser(user);
  }

  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany();
    return users.map(convertPrismaUser);
  }
}

export const userRepository = new UserRepository();
