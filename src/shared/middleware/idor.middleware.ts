import { Request, Response, NextFunction } from 'express';
import { Role } from '../../modules/auth/auth.types';
import { ForbiddenError, UnauthorizedError } from '../errors';

/**
 * IDOR Protection Middleware for customer-specific endpoints.
 * - ADMIN and STAFF can access any customer's resource.
 * - CUSTOMER can ONLY access resources matching their own customerId.
 *
 * @param paramName Route parameter name containing the customerId (default: 'customerId')
 */
export function assertCustomerAccess(paramName = 'customerId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required', 'UNAUTHENTICATED'));
    }

    const { role, customerId } = req.user;

    // Admin and Staff have universal operational access
    if (role === Role.ADMIN || role === Role.STAFF) {
      return next();
    }

    // Customer role is strictly bound to their own customerId
    if (role === Role.CUSTOMER) {
      const targetCustomerId = req.params[paramName] || req.query[paramName] || req.body[paramName];
      if (!targetCustomerId || targetCustomerId !== customerId) {
        return next(
          new ForbiddenError(
            'Access denied: You cannot access or modify resources belonging to another customer',
            'IDOR_VIOLATION'
          )
        );
      }
      return next();
    }

    return next(new ForbiddenError('Access denied', 'FORBIDDEN'));
  };
}
