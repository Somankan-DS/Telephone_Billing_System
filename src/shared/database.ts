import { PrismaClient } from '@prisma/client';
import { config } from './config';

declare global {
  // Prevent duplicate PrismaClient instantiation during hot reloads in development
  var __telebill_prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__telebill_prisma ||
  new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });

if (config.NODE_ENV !== 'production') {
  global.__telebill_prisma = prisma;
}

/**
 * Connect to database and configure SQLite WAL mode, busy timeout, and foreign keys.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();

    // Check if provider is SQLite before applying SQLite PRAGMAs
    if (config.DATABASE_URL.startsWith('file:') || config.DATABASE_URL.includes('.db')) {
      await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
      await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
      await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
      console.log('✅ SQLite WAL mode enabled: PRAGMA journal_mode = WAL, busy_timeout = 5000, foreign_keys = ON.');
    } else {
      console.log('✅ Relational database connection established.');
    }
  } catch (error) {
    console.error('❌ Failed to connect to database or configure WAL mode:', error);
    throw error;
  }
}

/**
 * Gracefully disconnect Prisma client.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('🔌 Database connection closed.');
}
