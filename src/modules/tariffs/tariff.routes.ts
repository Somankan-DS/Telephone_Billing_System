import { Router } from 'express';
import { TariffController } from './tariff.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new TariffController();

router.post('/', authenticate, requireRole([Role.ADMIN]), controller.create);
router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, controller.getById);
router.put('/:id', authenticate, requireRole([Role.ADMIN]), controller.update);

export default router;
