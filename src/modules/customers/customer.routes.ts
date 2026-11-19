import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { AnalyticsController } from '../analytics/analytics.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new CustomerController();
const analyticsController = new AnalyticsController();

// Customer CRUD & Management
router.post('/', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.create);
router.get('/', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.list);
router.get('/:id', authenticate, controller.getById);
router.put('/:id', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.update);
router.patch('/:id/status', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.updateStatus);
router.post('/:id/assign-plan', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.assignPlan);
router.get('/:id/calls', authenticate, controller.getCalls);
router.get('/:id/billing', authenticate, controller.getBilling);
router.get('/:id/invoices', authenticate, controller.getBilling);
router.get('/:id/analytics', authenticate, analyticsController.getCustomerAnalytics);
router.get('/:id/bill-prediction', authenticate, analyticsController.predictBill);

export default router;
