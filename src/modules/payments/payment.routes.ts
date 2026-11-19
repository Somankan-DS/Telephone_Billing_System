import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();
const controller = new PaymentController();

router.post('/simulate', authenticate, controller.simulate);
router.post('/', authenticate, controller.simulate);
router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, controller.getById);

export default router;
