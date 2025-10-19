// Referenced from PostgreSQL database blueprint
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { PrismaClient } from '@prisma/client';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Drizzle ORM client (used for sessions)
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

/**
 * Singleton Prisma Client (used for business logic)
 * 
 * Creates a single global instance to prevent database connection exhaustion.
 * In development, this persists across module reloads using global scope.
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

/**
 * Graceful shutdown handler
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  await pool.end();
}
