import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  public simulate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.paymentService.simulatePayment(req.body);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.paymentService.getPayment(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.paymentService.listPayments(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        payments: result.payments,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };
}
