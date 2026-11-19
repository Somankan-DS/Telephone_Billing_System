import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../../modules/auth/jwt.service';
import { Role, AuthUserPayload } from '../../modules/auth/auth.types';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { prisma } from '../database';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Authentication Middleware:
 * Extracts Bearer token from Authorization header and verifies it.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(new UnauthorizedError('Authorization header missing', 'AUTH_HEADER_MISSING'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next(new UnauthorizedError("Malformed authorization header. Expected 'Bearer <token>'", 'MALFORMED_AUTH_HEADER'));
  }

  const token = parts[1].trim();
  if (!token) {
    return next(new UnauthorizedError('Token cannot be empty', 'EMPTY_TOKEN'));
  }

  try {
    const payload = JwtService.verifyToken(token);

    // Verify account active status in database
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { isActive: true },
    });

    if (!user) {
      return next(new UnauthorizedError('User account no longer exists', 'USER_NOT_FOUND'));
    }

    if (!user.isActive) {
      return next(new ForbiddenError('User account has been deactivated', 'ACCOUNT_DEACTIVATED'));
    }

    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 3-Tier Role-Based Access Control Guard:
 * Rejects requests if user's role is not within allowedRoles.
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required', 'UNAUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied: required role in [${allowedRoles.join(', ')}], current role '${req.user.role}'`,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
}
