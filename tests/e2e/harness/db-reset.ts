/**
 * TeleBill Pro - Database Isolation & Reset Helper
 * Provides routines to clean, re-seed, or ensure isolated state for E2E test runs.
 */

import { execSync } from 'child_process';
import { config } from '../config';

export class DbResetHelper {
  private static getTargetDatabaseUrl(): string {
    return process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || config.databaseUrl || 'file:./prisma/dev.db';
  }

  /**
   * Resets the test database schema via Prisma CLI.
   * Runs migrations or pushes schema with data reset.
   */
  static async resetDatabase(): Promise<boolean> {
    const dbUrl = this.getTargetDatabaseUrl();
    try {
      execSync('npx prisma db push --force-reset --accept-data-loss', {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: dbUrl },
      });
      return true;
    } catch (err: any) {
      console.warn(`[DbResetHelper] Prisma db push reset failed (${err.message}), attempting migrate reset...`);
      try {
        execSync('npx prisma migrate reset --force --skip-seed', {
          stdio: 'pipe',
          env: { ...process.env, DATABASE_URL: dbUrl },
        });
        return true;
      } catch (migrateErr: any) {
        console.error(`[DbResetHelper] Database reset failed: ${migrateErr.message}`);
        return false;
      }
    }
  }

  /**
   * Seeds default demo accounts, plans, and system baseline configurations
   * using the project's authoritative seed script (npm run prisma:seed).
   */
  static async seedBaseline(): Promise<boolean> {
    const dbUrl = this.getTargetDatabaseUrl();
    try {
      execSync('npm run prisma:seed', {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: dbUrl },
      });
      return true;
    } catch (err: any) {
      console.warn(`[DbResetHelper] "npm run prisma:seed" failed (${err.message}), trying tsx prisma/seed.ts directly...`);
      try {
        execSync('npx tsx prisma/seed.ts', {
          stdio: 'pipe',
          env: { ...process.env, DATABASE_URL: dbUrl },
        });
        return true;
      } catch (seedErr: any) {
        console.error(`[DbResetHelper] Baseline seeding failed: ${seedErr.message}`);
        return false;
      }
    }
  }

  /**
   * Convenience composite routine: resets schema and seeds baseline accounts.
   */
  static async resetAndSeed(): Promise<boolean> {
    const resetOk = await this.resetDatabase();
    if (!resetOk) {
      console.error('[DbResetHelper] Skipping seed because reset failed.');
      return false;
    }
    return await this.seedBaseline();
  }
}
