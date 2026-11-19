import { Decimal } from 'decimal.js';
import { CallType } from '../../shared/types/models';

export interface RatingInput {
  customerId: string;
  callType: CallType | string;
  durationSeconds: number;
  pulseSeconds?: number;
}

export interface RatingResult {
  pulseCount: number;
  billableSeconds: number;
  ratePerMinute: Decimal;
  freeMinutesDeducted: Decimal;
  ratedAmount: Decimal;
  newAllowanceRemaining: Decimal;
}
