import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  public getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customerId = req.user?.customerId || req.user?.id;
      const result = await this.notificationService.getNotifications(customerId);
      res.status(200).json({
        success: true,
        data: result,
        notifications: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customerId = req.user?.customerId || undefined;
      const result = await this.notificationService.markAsRead(req.params.id, customerId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customerId = req.user?.customerId || req.user?.id;
      const result = await this.notificationService.markAllRead(customerId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public triggerReminders = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.notificationService.triggerReminders();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
