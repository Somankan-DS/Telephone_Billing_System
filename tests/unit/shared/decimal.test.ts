import {
  Decimal,
  toRateDecimal,
  toCurrencyDecimal,
  formatCurrency,
  calculateTax,
} from '../../../src/shared/utils/decimal';

describe('Shared Utilities: Financial Decimal Precision (No IEEE-754 Drift)', () => {
  test('eliminates IEEE-754 drift in telecom call rating', () => {
    // In standard JavaScript IEEE-754: 7 * 0.70 = 4.8999999999999995
    const jsResult = 7 * 0.7;
    expect(jsResult).not.toBe(4.9);

    // Using Decimal precision:
    const minutes = new Decimal(7);
    const rate = toRateDecimal(0.7);
    const amount = toRateDecimal(minutes.times(rate));

    expect(amount.toString()).toBe('4.9');
    expect(amount.toFixed(4)).toBe('4.9000');
  });

  test('toRateDecimal rounds to exactly 4 decimal places with ROUND_HALF_UP', () => {
    const rate1 = toRateDecimal('0.12345');
    expect(rate1.toFixed(4)).toBe('0.1235');

    const rate2 = toRateDecimal('0.12344');
    expect(rate2.toFixed(4)).toBe('0.1234');
  });

  test('toCurrencyDecimal rounds to exactly 2 decimal places with ROUND_HALF_UP', () => {
    const cur1 = toCurrencyDecimal('199.995');
    expect(cur1.toFixed(2)).toBe('200.00');

    const cur2 = toCurrencyDecimal('199.994');
    expect(cur2.toFixed(2)).toBe('199.99');
  });

  test('formatCurrency returns formatted string with 2 decimal places', () => {
    expect(formatCurrency(299)).toBe('299.00');
    expect(formatCurrency('149.5')).toBe('149.50');
    expect(formatCurrency(new Decimal('1000.123'))).toBe('1000.12');
  });

  test('calculateTax calculates deterministic 18% GST', () => {
    const taxableAmount = new Decimal('1000.00');
    const tax = calculateTax(taxableAmount, 18);
    expect(tax.toFixed(2)).toBe('180.00');

    // Fractional cents rounding check: 299.00 * 18% = 53.82
    const rentalTax = calculateTax(new Decimal('299.00'), 18);
    expect(rentalTax.toFixed(2)).toBe('53.82');
  });

  test('pulse increment calculation: ceil rounding logic', () => {
    // 61s on 60s pulse should round up to 120s (2 pulses)
    const durationSeconds = 61;
    const pulseSeconds = 60;
    const pulseCount = Math.ceil(durationSeconds / pulseSeconds);
    const billableSeconds = pulseCount * pulseSeconds;
    const billableMinutes = new Decimal(billableSeconds).dividedBy(60);

    expect(pulseCount).toBe(2);
    expect(billableSeconds).toBe(120);
    expect(billableMinutes.toFixed(2)).toBe('2.00');
  });
});
