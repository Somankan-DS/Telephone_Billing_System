import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new AnalyticsController();

router.get('/monthly-revenue', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getMonthlyRevenue);
router.get('/customer-growth', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getCustomerGrowth);
router.get('/outstanding-aging', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getOutstandingAging);
router.get('/aging-receivables', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getOutstandingAging);
router.get('/call-distribution', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.getCallDistribution);

export default router;
