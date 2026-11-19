import { Decimal } from 'decimal.js';
import { RatingResult } from './rating.types';
import { toRateDecimal } from '../../shared/utils/decimal';

export class RatingService {
  /**
   * Deterministically rate a call detail record using fixed-point arithmetic.
   * Eliminates IEEE-754 floating point drift and guarantees exact mathematical consistency.
   */
  public static calculateRating(params: {
    durationSeconds: number;
    pulseSeconds: number;
    ratePerMinute: Decimal | number | string;
    allowanceMinutesRemaining: Decimal | number | string;
  }): RatingResult {
    const durationSeconds = Math.max(0, params.durationSeconds);
    const pulseSeconds = Math.max(1, params.pulseSeconds || 60);
    const ratePerMin = toRateDecimal(params.ratePerMinute);
    const allowanceRem = toRateDecimal(params.allowanceMinutesRemaining);

    if (durationSeconds === 0) {
      return {
        pulseCount: 0,
        billableSeconds: 0,
        ratePerMinute: ratePerMin,
        freeMinutesDeducted: new Decimal('0.0000'),
        ratedAmount: new Decimal('0.0000'),
        newAllowanceRemaining: allowanceRem,
      };
    }

    const pulseCount = Math.ceil(durationSeconds / pulseSeconds);
    const billableSeconds = pulseCount * pulseSeconds;
    const billableMinutes = new Decimal(billableSeconds).dividedBy(60);

    let freeMinutesDeducted = new Decimal(0);
    let billableChargedMinutes = billableMinutes;
    let newAllowanceRemaining = allowanceRem;

    if (allowanceRem.greaterThanOrEqualTo(billableMinutes)) {
      freeMinutesDeducted = billableMinutes;
      newAllowanceRemaining = allowanceRem.minus(billableMinutes);
      billableChargedMinutes = new Decimal(0);
    } else if (allowanceRem.greaterThan(0)) {
      freeMinutesDeducted = allowanceRem;
      billableChargedMinutes = billableMinutes.minus(allowanceRem);
      newAllowanceRemaining = new Decimal(0);
    }

    const rawRatedAmount = billableChargedMinutes.times(ratePerMin);
    const ratedAmount = toRateDecimal(rawRatedAmount);

    return {
      pulseCount,
      billableSeconds,
      ratePerMinute: ratePerMin,
      freeMinutesDeducted: toRateDecimal(freeMinutesDeducted),
      ratedAmount,
      newAllowanceRemaining: toRateDecimal(newAllowanceRemaining),
    };
  }
}
