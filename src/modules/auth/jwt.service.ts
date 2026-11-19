import jwt from 'jsonwebtoken';
import { AuthUserPayload } from './auth.types';
import { config } from '../../shared/config';
import { UnauthorizedError } from '../../shared/errors';

const JWT_EXPIRES_IN = '60m';

export class JwtService {
  private static getSecret(): string {
    const secret = config.JWT_SECRET;
    if (!secret || secret.length < 32) {
      if (config.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be at least 32 characters in production');
      }
      return secret || 'default_super_secret_jwt_key_for_telebill_pro_min_32_chars!';
    }
    return secret;
  }

  public static signToken(payload: Omit<AuthUserPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.getSecret(), {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });
  }

  public static verifyToken(token: string): AuthUserPayload {
    try {
      return jwt.verify(token, this.getSecret(), {
        algorithms: ['HS256'],
      }) as AuthUserPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired. Please log in again', 'TOKEN_EXPIRED');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token signature or payload', 'INVALID_TOKEN');
      }
      throw new UnauthorizedError('Authentication failed', 'AUTH_FAILED');
    }
  }
}
