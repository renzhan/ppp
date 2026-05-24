/**
 * Database utility - Prisma client singleton.
 * Provides a shared PrismaClient instance for use throughout the application.
 */

import { PrismaClient } from '../../generated/prisma/client.js';

let prismaInstance: InstanceType<typeof PrismaClient> | null = null;

/**
 * Get the singleton Prisma client instance.
 * Creates a new instance on first call, reuses it on subsequent calls.
 */
export function getPrismaClient(): InstanceType<typeof PrismaClient> {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

/**
 * Disconnect the Prisma client and clean up resources.
 * Call this during application shutdown or cleanup.
 */
export async function disconnect(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

/**
 * The singleton Prisma client instance for direct import convenience.
 */
export const prisma = getPrismaClient();
