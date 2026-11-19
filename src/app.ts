import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './shared/config';
import { errorHandler } from './shared/middleware/error.middleware';
import { NotFoundError } from './shared/errors';

import authRoutes from './modules/auth/auth.routes';
import customerRoutes from './modules/customers/customer.routes';
import tariffRoutes from './modules/tariffs/tariff.routes';
import cdrRoutes from './modules/cdr/cdr.routes';
import simulationRoutes from './modules/cdr/simulation.routes';
import billingRoutes from './modules/billing/billing.routes';
import invoiceRoutes from './modules/billing/invoice.routes';
import paymentRoutes from './modules/payments/payment.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import reportRoutes from './modules/analytics/report.routes';
import notificationRoutes from './modules/notifications/notification.routes';

export function createApp(): Application {
  const app: Application = express();

  // Security headers with relaxed CSP for inline scripts/styles and CDNs in demo UI
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  // CORS configuration
  const allowedOrigins = config.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(origin) ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1')
        ) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    })
  );

  // Request body parsing (10mb limit for bulk CDR uploads)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP request logging
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('short'));
  }

  // Static web portal assets
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir));

  // Liveness / Health Check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      service: 'telebill-pro-backend',
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
    });
  });

  // Helper to mount routes under both /api and /api/v1 prefixes
  const mountRoute = (routePath: string, router: express.Router) => {
    app.use(`/api${routePath}`, router);
    app.use(`/api/v1${routePath}`, router);
  };

  // Mount API Domain Modules
  mountRoute('/auth', authRoutes);
  mountRoute('/customers', customerRoutes);
  mountRoute('/tariffs', tariffRoutes);
  mountRoute('/cdrs', cdrRoutes);
  mountRoute('/cdr', cdrRoutes);
  mountRoute('/simulation', simulationRoutes);
  mountRoute('/billing', billingRoutes);
  mountRoute('/invoices', invoiceRoutes);
  mountRoute('/payments', paymentRoutes);
  mountRoute('/admin', analyticsRoutes);
  mountRoute('/reports', reportRoutes);
  mountRoute('/notifications', notificationRoutes);

  // 404 Route Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
