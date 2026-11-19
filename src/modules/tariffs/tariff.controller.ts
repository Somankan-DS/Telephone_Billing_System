import { Request, Response, NextFunction } from 'express';
import { TariffService } from './tariff.service';

export class TariffController {
  private tariffService: TariffService;

  constructor() {
    this.tariffService = new TariffService();
  }

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.tariffService.createPlan(req.body);
      res.status(201).json({
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
      const result = await this.tariffService.getPlan(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.tariffService.updatePlan(req.params.id, req.body);
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
      const result = await this.tariffService.listPlans(req.query);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
