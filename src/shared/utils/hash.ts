import bcrypt from 'bcryptjs';

export const BCRYPT_SALT_ROUNDS = 12;
// Precomputed valid bcrypt hash with cost 12 for timing-attack mitigation
export const DUMMY_HASH = '$2a$12$e8kZ1u7.Wn8C1rB8pX7l4O5jL/6eD9v7pB8yH9aJ6mK4oP3qR5sTu';

/**
 * Hash a plaintext password using Bcrypt with cost factor 12.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password exceeds maximum length of 72 bytes');
  }
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plaintext password with a stored hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

/**
 * Perform a dummy comparison to defend against user enumeration timing attacks.
 */
export async function dummyHashCompare(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

/**
 * Password complexity validation:
 * - Minimum 8 characters, maximum 72 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 numeric digit
 * - At least 1 special character
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (Buffer.byteLength(password || '', 'utf8') > 72) {
    errors.push('Password must not exceed 72 bytes');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numeric digit');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
