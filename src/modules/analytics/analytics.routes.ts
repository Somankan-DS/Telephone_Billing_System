import { Router } from 'express';
import { exec } from 'child_process';
import path from 'path';
import { AnalyticsController } from './analytics.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new AnalyticsController();

// Admin Dashboard stats
router.get('/dashboard/stats', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getDashboardStats);
router.get('/stats', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getDashboardStats);
router.get('/dashboard/revenue-trends', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getMonthlyRevenue);
router.get('/dashboard/call-distribution', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getCallDistribution);

// 1-Click Database Reset to Benchmark (Admin Only)
router.post('/reset-database', authenticate, requireRole([Role.ADMIN]), (_req, res) => {
  const seedScript = path.resolve(process.cwd(), 'prisma/seed.ts');
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  exec(`${npxCmd} tsx "${seedScript}"`, (error, _stdout, stderr) => {
    if (error) {
      console.error('Database reset failed:', error, stderr);
      return res.status(500).json({ success: false, error: 'Database reset failed', details: stderr || error.message });
    }
    return res.status(200).json({ success: true, message: 'Database reset to clean benchmark state successfully' });
  });
});

export default router;
