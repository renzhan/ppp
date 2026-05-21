import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient, Prisma } from '../../../generated/prisma';

// Load .env from root project directory (parent of web/)
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { Prisma };
