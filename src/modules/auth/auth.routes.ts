import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { assertCustomerAccess } from '../../shared/middleware/idor.middleware';
import { Role } from './auth.types';

const router = Router();
const controller = new AuthController();

// Public routes
router.post('/login', controller.login);

// Protected routes (require valid JWT)
router.get('/profile', authenticate, controller.getProfile);
router.get('/me', authenticate, controller.getProfile);
router.put('/password', authenticate, controller.changePassword);
router.post('/change-password', authenticate, controller.changePassword);

// RBAC & IDOR Route Guards (Feature 7 & Feature 8 verification endpoints)
router.get('/test/admin-only', authenticate, requireRole([Role.ADMIN]), (_req, res) => {
  res.status(200).json({ success: true, message: 'Admin access granted' });
});

router.get('/test/staff-or-admin', authenticate, requireRole([Role.ADMIN, Role.STAFF]), (_req, res) => {
  res.status(200).json({ success: true, message: 'Staff/Admin access granted' });
});

router.get('/test/customer-only', authenticate, requireRole([Role.CUSTOMER]), (_req, res) => {
  res.status(200).json({ success: true, message: 'Customer access granted' });
});

router.get('/test/customers/:customerId/data', authenticate, assertCustomerAccess('customerId'), (req, res) => {
  res.status(200).json({ success: true, customerId: req.params.customerId });
});

export default router;
