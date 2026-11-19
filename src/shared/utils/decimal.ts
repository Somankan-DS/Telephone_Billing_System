import Decimal from 'decimal.js';

// Configure decimal.js for telecom OSS/BSS financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/**
 * Format rating unit rate (4 decimal places: DECIMAL(10, 4)).
 */
export function toRateDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * Format currency amount (2 decimal places: DECIMAL(10, 2)).
 */
export function toCurrencyDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Return formatted currency string with exactly 2 decimal places.
 */
export function formatCurrency(value: string | number | Decimal): string {
  return toCurrencyDecimal(value).toFixed(2);
}

/**
 * Calculate deterministic GST tax amount (default 18%).
 */
export function calculateTax(taxableAmount: Decimal, taxRatePercent = 18): Decimal {
  return taxableAmount.times(taxRatePercent).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
