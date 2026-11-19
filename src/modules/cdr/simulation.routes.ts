import { Router } from 'express';
import { CdrController } from './cdr.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new CdrController();

router.post('/generate-cdrs', authenticate, requireRole([Role.ADMIN]), controller.simulate);
router.post('/simulate', authenticate, requireRole([Role.ADMIN]), controller.simulate);
router.post('/traffic', authenticate, requireRole([Role.ADMIN]), controller.simulate);

export default router;
