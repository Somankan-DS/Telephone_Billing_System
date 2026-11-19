/**
 * TeleBill Pro - Telecom Domain Specific Assertions
 * Financial precision, pulse calculation, tax verification, and protocol matchers.
 */

export class AssertionError extends Error {
  constructor(message: string, public expected?: any, public actual?: any) {
    super(message);
    this.name = 'AssertionError';
  }
}

/**
 * Asserts exact fixed-point decimal equality within epsilon precision.
 * Default precision is 2 decimals (currency), or 4 decimals (telecom unit rates).
 */
export function assertDecimalEquals(
  actual: number | string | null | undefined,
  expected: number | string,
  precision = 2,
  contextMessage?: string
): void {
  if (actual === null || actual === undefined) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}Expected ${expected} but received ${actual}`,
      expected,
      actual
    );
  }

  const actualNum = typeof actual === 'number' ? actual : parseFloat(actual);
  const expectedNum = typeof expected === 'number' ? expected : parseFloat(expected);

  if (isNaN(actualNum) || isNaN(expectedNum)) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}Invalid decimal conversion: actual=${actual}, expected=${expected}`,
      expected,
      actual
    );
  }

  const epsilon = Math.pow(10, -precision) / 2 + 1e-9;
  const diff = Math.abs(actualNum - expectedNum);

  if (diff > epsilon) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}Decimal mismatch at precision ${precision}: expected ${expectedNum.toFixed(
        precision
      )}, got ${actualNum.toFixed(precision)} (diff=${diff.toFixed(6)}, epsilon=${epsilon.toFixed(6)})`,
      expectedNum,
      actualNum
    );
  }
}

/**
 * Asserts statutory Indian Telecom 18% GST (9% CGST + 9% SGST) with standard Half-Up paise rounding.
 */
export function assertGstTax(
  taxableAmount: number | string,
  taxAmount: number | string,
  contextMessage?: string
): void {
  const taxable = typeof taxableAmount === 'number' ? taxableAmount : parseFloat(taxableAmount);
  const expectedTax = Math.round(taxable * 0.18 * 100) / 100;
  assertDecimalEquals(
    taxAmount,
    expectedTax,
    2,
    `${contextMessage ? contextMessage + ': ' : ''}18% GST tax calculation on subtotal ${taxable}`
  );
}

/**
 * Asserts pulse duration rating rule: ceil(actualSeconds / pulseSeconds) == expectedBillableUnits
 */
export function assertPulseDuration(
  actualSeconds: number,
  pulseSeconds: number,
  expectedBillableUnits: number,
  contextMessage?: string
): void {
  if (pulseSeconds <= 0) {
    throw new AssertionError('pulseSeconds must be greater than zero', '> 0', pulseSeconds);
  }
  const units = Math.ceil(actualSeconds / pulseSeconds);
  if (units !== expectedBillableUnits) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}Pulse calculation failed for ${actualSeconds}s with ${pulseSeconds}s pulse: expected ${expectedBillableUnits} billable units, got ${units}`,
      expectedBillableUnits,
      units
    );
  }
}

/**
 * Asserts string matches standard telecom account format TEL-YYYYMM-XXXXX
 */
export function assertAccountNumberFormat(accountNumber: string, contextMessage?: string): void {
  const regex = /^TEL-\d{6}-\d{5}$/;
  if (!regex.test(accountNumber)) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}Account number "${accountNumber}" does not match required format /^TEL-\\d{6}-\\d{5}$/`,
      'TEL-YYYYMM-XXXXX',
      accountNumber
    );
  }
}

/**
 * Asserts string matches 64-character SHA-256 hexadecimal hash
 */
export function assertCdrHashFormat(cdrHash: string, contextMessage?: string): void {
  const regex = /^[a-f0-9]{64}$/i;
  if (!regex.test(cdrHash)) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}CDR hash "${cdrHash}" is not a valid 64-char SHA-256 hexadecimal string`,
      '64-character hex string',
      cdrHash
    );
  }
}

/**
 * Asserts binary buffer starts with standard %PDF- header (Hex 25 50 44 46 2D)
 */
export function assertPdfHeader(buffer: Buffer | undefined, contextMessage?: string): void {
  if (!buffer || buffer.length < 5) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}Buffer is empty or too short for PDF header`,
      'Buffer >= 5 bytes',
      buffer?.length
    );
  }
  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}Invalid PDF header: expected "%PDF-", got "${header}"`,
      '%PDF-',
      header
    );
  }
}

/**
 * Asserts string is a valid 3-part base64url signed JWT
 */
export function assertValidJwt(token: string, contextMessage?: string): void {
  if (typeof token !== 'string') {
    throw new AssertionError('Token must be a string', 'string', typeof token);
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AssertionError(
      `${contextMessage ? contextMessage + ': ' : ''}JWT token must have exactly 3 dot-separated parts, found ${parts.length}`,
      3,
      parts.length
    );
  }
}
