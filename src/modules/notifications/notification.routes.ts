import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Role } from '../../shared/types/models';

const router = Router();
const controller = new NotificationController();

router.get('/', authenticate, controller.getNotifications);
router.patch('/mark-all-read', authenticate, controller.markAllRead);
router.patch('/:id/read', authenticate, controller.markAsRead);
router.post('/trigger-reminders', authenticate, requireRole([Role.ADMIN, Role.STAFF]), controller.triggerReminders);

export default router;
