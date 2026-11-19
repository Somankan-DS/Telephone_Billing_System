import { Router } from 'express';
import { BillingController } from './billing.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new BillingController();

// Trigger billing cycle run
router.post('/run-cycle', authenticate, requireRole([Role.ADMIN]), controller.runCycle);
router.post('/run', authenticate, requireRole([Role.ADMIN]), controller.runCycle);
router.post('/check-overdue', authenticate, requireRole([Role.ADMIN]), controller.checkOverdue);

export default router;
