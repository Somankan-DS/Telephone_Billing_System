import { Router } from 'express';
import { BillingController } from './billing.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();
const controller = new BillingController();

router.get('/', authenticate, controller.listInvoices);
router.get('/:id', authenticate, controller.getInvoice);
router.get('/:id/pdf', authenticate, controller.downloadPdf);

export default router;
