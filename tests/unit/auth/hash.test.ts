import {
  hashPassword,
  comparePassword,
  dummyHashCompare,
  validatePasswordStrength,
  BCRYPT_SALT_ROUNDS,
} from '../../../src/shared/utils/hash';

describe('Feature 5: Cryptographic Password Hashing & Security Utilities', () => {
  const plainPassword = 'AdminSecure@2026!';

  test('hashPassword produces valid Bcrypt hash with cost factor 12', async () => {
    const hash = await hashPassword(plainPassword);
    expect(hash).toBeDefined();
    // Bcrypt format: $2a$12$... or $2b$12$...
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
    expect(BCRYPT_SALT_ROUNDS).toBe(12);
  });

  test('comparePassword returns true for matching password', async () => {
    const hash = await hashPassword(plainPassword);
    const isMatch = await comparePassword(plainPassword, hash);
    expect(isMatch).toBe(true);
  });

  test('comparePassword returns false for non-matching password', async () => {
    const hash = await hashPassword(plainPassword);
    const isMatch = await comparePassword('WrongPassword123!', hash);
    expect(isMatch).toBe(false);
  });

  test('comparePassword returns false for empty or null inputs', async () => {
    expect(await comparePassword('', 'someHash')).toBe(false);
    expect(await comparePassword('somePass', '')).toBe(false);
  });

  test('hashPassword throws when password exceeds 72 bytes (Bcrypt boundary)', async () => {
    const longPassword = 'A'.repeat(73) + 'a1!';
    await expect(hashPassword(longPassword)).rejects.toThrow('Password exceeds maximum length of 72 bytes');
  });

  test('hashPassword throws when password is empty or non-string', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    await expect(hashPassword(null as any)).rejects.toThrow('Password must be a non-empty string');
  });

  test('dummyHashCompare executes safely without throwing', async () => {
    await expect(dummyHashCompare('anyDummyPassword123!')).resolves.not.toThrow();
  });

  describe('validatePasswordStrength', () => {
    test('accepts strong, compliant passwords', () => {
      const result = validatePasswordStrength('ValidP@ssw0rd!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects passwords shorter than 8 characters', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('rejects passwords exceeding 72 bytes', () => {
      const result = validatePasswordStrength('A'.repeat(75) + 'a1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 72 bytes');
    });

    test('rejects passwords missing uppercase letters', () => {
      const result = validatePasswordStrength('lowercase123!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('rejects passwords missing lowercase letters', () => {
      const result = validatePasswordStrength('UPPERCASE123!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('rejects passwords missing numeric digits', () => {
      const result = validatePasswordStrength('NoNumbersHere!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one numeric digit');
    });

    test('rejects passwords missing special characters', () => {
      const result = validatePasswordStrength('NoSpecialChars123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });
});
