import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  public getDashboardStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.analyticsService.getDashboardStats();
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getMonthlyRevenue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.analyticsService.getMonthlyRevenueReport(req.query);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getCustomerGrowth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.analyticsService.getCustomerGrowthReport(req.query);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getOutstandingAging = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.analyticsService.getOutstandingAgingReport();
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getCallDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.analyticsService.getCallDistributionReport(req.query);
      res.status(200).json({
        success: true,
        data: result,
        breakdown: result.breakdown,
        totalCalls: result.totalCalls,
      });
    } catch (error) {
      next(error);
    }
  };

  public predictBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.analyticsService.predictNextBill(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getCustomerAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.analyticsService.getCustomerUsageAnalytics(req.params.id, req.query);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
