import { Router } from 'express';
import { CdrController } from './cdr.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { parseCsvUpload } from '../../shared/middleware/upload.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new CdrController();

router.post('/upload-csv', authenticate, requireRole([Role.ADMIN, Role.STAFF]), parseCsvUpload, controller.uploadCsv);
router.post('/', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.ingest);
router.post('/simulate', authenticate, requireRole([Role.ADMIN]), controller.simulate);
router.get('/', authenticate, controller.list);

export default router;
