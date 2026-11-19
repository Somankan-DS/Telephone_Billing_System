import { Request, Response, NextFunction } from 'express';
import { CustomerService } from './customer.service';
import { prisma } from '../../shared/database';
import { ForbiddenError } from '../../shared/errors';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.customerService.createCustomer(req.body);
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
      const result = await this.customerService.getCustomerProfile(req.params.id);
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
      const result = await this.customerService.updateCustomer(req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.customerService.updateStatus(req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public assignPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.customerService.assignPlan(req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.customerService.listCustomers(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        customers: result.customers,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  public getCalls = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(String(req.query.page || 1), 10);
      const limit = parseInt(String(req.query.limit || 20), 10);
      const result = await this.customerService.getCustomerCalls(req.params.id, page, limit);
      res.status(200).json({
        success: true,
        data: result.data,
        calls: result.calls,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  public getBilling = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customer = await this.customerService.resolveCustomer(req.params.id);
      if (req.user && req.user.role === 'CUSTOMER' && req.user.customerId && customer.id !== req.user.customerId) {
        throw new ForbiddenError('Access Denied: You cannot view invoices belonging to another subscriber.', 'IDOR_VIOLATION');
      }
      const invoices = await prisma.invoice.findMany({
        where: { customerId: customer.id },
        orderBy: { issueDate: 'desc' },
        include: { items: true },
      });
      res.status(200).json({
        success: true,
        data: invoices,
        invoices,
      });
    } catch (error) {
      next(error);
    }
  };
}
