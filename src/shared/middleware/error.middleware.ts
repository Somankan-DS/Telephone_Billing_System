import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors';
import { ApiErrorResponse } from '../types/api';

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Domain Application Custom Errors
  if (err instanceof AppError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // 2. Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const formattedDetails = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formattedDetails,
      },
    };
    res.status(400).json(errorResponse);
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint failed
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || [];
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CONFLICT',
          message: `A record with this ${target.join(', ') || 'field'} already exists.`,
          details: { fields: target },
        },
      };
      res.status(409).json(errorResponse);
      return;
    }

    // P2025: Record not found
    if (err.code === 'P2025') {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested record does not exist or has been deleted.',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }
  }

  // 4. Fallback / Unhandled Internal Server Errors
  console.error('💥 Unhandled Exception:', err);
  const fallbackResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An internal server error occurred' : err.message,
    },
  };
  res.status(500).json(fallbackResponse);
}
