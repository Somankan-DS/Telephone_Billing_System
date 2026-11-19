import { Request, Response, NextFunction } from 'express';
import { BillingService } from './billing.service';
import { PdfService } from './pdf.service';
import { ForbiddenError } from '../../shared/errors';

export class BillingController {
  private billingService: BillingService;

  constructor() {
    this.billingService = new BillingService();
  }

  public runCycle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.billingService.runBillingCycle(req.body);
      res.status(200).json({
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await this.billingService.getInvoice(req.params.id);

      if (req.user && req.user.role === 'CUSTOMER' && req.user.customerId && invoice.customerId !== req.user.customerId) {
        throw new ForbiddenError('Unauthorized: You cannot view invoices belonging to another customer', 'IDOR_VIOLATION');
      }

      res.status(200).json({
        success: true,
        data: invoice,
        ...invoice,
      });
    } catch (error) {
      next(error);
    }
  };

  public listInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.billingService.listInvoices(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        invoices: result.invoices,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  public downloadPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await this.billingService.getInvoice(req.params.id);

      if (req.user && req.user.role === 'CUSTOMER' && req.user.customerId && invoice.customerId !== req.user.customerId) {
        throw new ForbiddenError('Unauthorized: You cannot access invoices belonging to another customer', 'IDOR_VIOLATION');
      }

      const pdfBuffer = await PdfService.generateInvoicePdf(invoice);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  public checkOverdue = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.billingService.checkOverdueInvoices();
      res.status(200).json({
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
