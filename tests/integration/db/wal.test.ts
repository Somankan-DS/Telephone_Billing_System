import { prisma, connectDatabase, disconnectDatabase } from '../../../src/shared/database';

describe('Feature 3: Database & SQLite WAL Mode Pragma Integration', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  test('SQLite journal_mode is configured to WAL', async () => {
    const result = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode;');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.journal_mode?.toLowerCase()).toBe('wal');
  });

  test('SQLite foreign_keys pragma is enabled', async () => {
    const result = await prisma.$queryRawUnsafe<Array<{ foreign_keys: number | bigint }>>('PRAGMA foreign_keys;');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(Number(result[0]?.foreign_keys)).toBe(1);
  });

  test('Database responds to relational queries', async () => {
    const count = await prisma.user.count();
    expect(typeof count).toBe('number');
  });
});
