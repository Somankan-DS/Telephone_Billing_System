import jwt from 'jsonwebtoken';
import { JwtService } from '../../../src/modules/auth/jwt.service';
import { Role } from '../../../src/modules/auth/auth.types';
import { config } from '../../../src/shared/config';
import { UnauthorizedError } from '../../../src/shared/errors';

describe('Feature 6: JWT Authentication & Session Token Service', () => {
  const samplePayload = {
    id: 'user-uuid-1234',
    email: 'admin@telebill.local',
    role: Role.ADMIN,
    customerId: null,
  };

  test('signToken generates a valid signed JWT with HS256 and 60-minute expiration', () => {
    const token = JwtService.signToken(samplePayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // Decode token header and payload
    const decodedHeader = jwt.decode(token, { complete: true })?.header;
    expect(decodedHeader?.alg).toBe('HS256');

    const decodedPayload = jwt.decode(token) as any;
    expect(decodedPayload.id).toBe(samplePayload.id);
    expect(decodedPayload.email).toBe(samplePayload.email);
    expect(decodedPayload.role).toBe(samplePayload.role);
    expect(decodedPayload.customerId).toBeNull();

    // Verify 60-minute (3600 seconds) duration
    const lifespanSeconds = decodedPayload.exp - decodedPayload.iat;
    expect(lifespanSeconds).toBe(3600);
  });

  test('verifyToken successfully verifies and decodes valid token', () => {
    const token = JwtService.signToken(samplePayload);
    const verified = JwtService.verifyToken(token);

    expect(verified.id).toBe(samplePayload.id);
    expect(verified.email).toBe(samplePayload.email);
    expect(verified.role).toBe(samplePayload.role);
    expect(verified.customerId).toBeNull();
  });

  test('verifyToken throws UnauthorizedError (TOKEN_EXPIRED) on expired token', () => {
    const expiredToken = jwt.sign(samplePayload, config.JWT_SECRET, {
      expiresIn: '-10s',
      algorithm: 'HS256',
    });

    expect(() => JwtService.verifyToken(expiredToken)).toThrow(UnauthorizedError);
    try {
      JwtService.verifyToken(expiredToken);
    } catch (err: any) {
      expect(err.code).toBe('TOKEN_EXPIRED');
    }
  });

  test('verifyToken throws UnauthorizedError (INVALID_TOKEN) on altered signature', () => {
    const token = JwtService.signToken(samplePayload);
    const tamperedToken = token.slice(0, -5) + 'xxxxx';

    expect(() => JwtService.verifyToken(tamperedToken)).toThrow(UnauthorizedError);
    try {
      JwtService.verifyToken(tamperedToken);
    } catch (err: any) {
      expect(err.code).toBe('INVALID_TOKEN');
    }
  });

  test('verifyToken throws UnauthorizedError on token signed with wrong secret', () => {
    const wrongToken = jwt.sign(samplePayload, 'wrong_secret_key_at_least_32_characters_long_12345!', {
      expiresIn: '60m',
      algorithm: 'HS256',
    });

    expect(() => JwtService.verifyToken(wrongToken)).toThrow(UnauthorizedError);
  });
});
