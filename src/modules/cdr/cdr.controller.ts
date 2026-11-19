import { Request, Response, NextFunction } from 'express';
import { CdrService } from './cdr.service';
import { ValidationError } from '../../shared/errors';

export class CdrController {
  private cdrService: CdrService;

  constructor() {
    this.cdrService = new CdrService();
  }

  public ingest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.cdrService.ingestCdr(req.body);
      const isDuplicate = (result as any)?.is_duplicate === true;
      res.status(isDuplicate ? 200 : 201).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public uploadCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csvContent = req.file?.content || req.body.csv || req.body.content || req.body.file;
      if (!csvContent || typeof csvContent !== 'string') {
        throw new ValidationError('Valid CSV file content is required');
      }

      const result = await this.cdrService.uploadCsv(csvContent);
      res.status(201).json({
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public simulate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.cdrService.simulateTraffic(req.body);
      res.status(200).json({
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.cdrService.listCdrs(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };
}
