import type { InsertUserTask, Task, UserTask } from "@shared/schema";
import { prisma } from "../lib/db";
import { convertPrismaTask, convertPrismaUserTask } from "./converters";

export class TaskRepository {
  async findAllActive(): Promise<Task[]> {
    const tasks = await prisma.task.findMany({ where: { isActive: true } });
    return tasks.map(convertPrismaTask);
  }

  async findUserTasks(userId: string): Promise<UserTask[]> {
    const userTasks = await prisma.userTask.findMany({ where: { userId } });
    return userTasks.map(convertPrismaUserTask);
  }

  async createUserTask(userTask: InsertUserTask): Promise<UserTask> {
    const newUserTask = await prisma.userTask.create({
      data: {
        userId: userTask.userId,
        taskId: userTask.taskId,
        progress: userTask.progress || 0,
        maxProgress: userTask.maxProgress || 1,
        completed: userTask.completed || false,
        completedAt: userTask.completedAt,
      },
    });
    return convertPrismaUserTask(newUserTask);
  }

  async updateUserTask(id: string, updates: Partial<UserTask>): Promise<UserTask> {
    const data: any = {};
    if (updates.progress !== undefined) data.progress = updates.progress;
    if (updates.maxProgress !== undefined) data.maxProgress = updates.maxProgress;
    if (updates.completed !== undefined) data.completed = updates.completed;
    if (updates.completedAt !== undefined) data.completedAt = updates.completedAt;

    const userTask = await prisma.userTask.update({ where: { id }, data });
    return convertPrismaUserTask(userTask);
  }
}

export const taskRepository = new TaskRepository();
