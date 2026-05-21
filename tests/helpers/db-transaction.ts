/**
 * Database transaction helper for test isolation.
 * Wraps each test in a transaction that is rolled back after the test completes,
 * ensuring tests don't leave data in the database.
 */

import { PrismaClient } from '../../generated/prisma/client.js';

let prisma: InstanceType<typeof PrismaClient> | null = null;

/**
 * Get a shared Prisma client instance for tests.
 * Uses a separate instance from the application singleton to avoid conflicts.
 */
export function getTestPrismaClient(): InstanceType<typeof PrismaClient> {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/**
 * Execute a test function within a database transaction that is rolled back.
 * This ensures test isolation without leaving data in the database.
 *
 * @param fn - The test function to execute within the transaction
 */
export async function withTestTransaction<T>(
  fn: (prisma: InstanceType<typeof PrismaClient>) => Promise<T>
): Promise<T> {
  const client = getTestPrismaClient();

  // Use Prisma's interactive transaction with rollback
  try {
    const result = await client.$transaction(async (tx: unknown) => {
      const res = await fn(tx as InstanceType<typeof PrismaClient>);
      // Force rollback by throwing after getting result
      throw { __rollback: true, result: res };
    });
    return result;
  } catch (e: unknown) {
    if (e && typeof e === 'object' && '__rollback' in e) {
      return (e as { __rollback: boolean; result: T }).result;
    }
    throw e;
  }
}

/**
 * Disconnect the test Prisma client. Call in afterAll.
 */
export async function disconnectTestClient(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
