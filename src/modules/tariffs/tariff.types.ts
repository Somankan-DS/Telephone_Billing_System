import { PlanType } from '../../shared/types/models';

export interface CreateTariffDto {
  planCode?: string;
  plan_code?: string;
  name: string;
  type?: PlanType;
  planType?: PlanType;
  plan_type?: PlanType;
  description?: string;
  monthlyRental?: number | string;
  monthly_rental?: number | string;
  pulseSeconds?: number;
  pulse_seconds?: number;
  validityDays?: number | null;
  validity_days?: number | null;
  rateLocal?: number | string;
  local_rate_per_min?: number | string;
  rateStd?: number | string;
  std_rate_per_min?: number | string;
  rateIsd?: number | string;
  isd_rate_per_min?: number | string;
  includedLocalMinutes?: number;
  free_local_minutes?: number;
  includedStdMinutes?: number;
  free_std_minutes?: number;
  includedIsdMinutes?: number;
  free_isd_minutes?: number;
  connectionCharge?: number | string;
  isActive?: boolean;
  is_active?: boolean;
}

export interface UpdateTariffDto {
  name?: string;
  description?: string;
  monthlyRental?: number | string;
  monthly_rental?: number | string;
  pulseSeconds?: number;
  pulse_seconds?: number;
  validityDays?: number | null;
  validity_days?: number | null;
  rateLocal?: number | string;
  local_rate_per_min?: number | string;
  rateStd?: number | string;
  std_rate_per_min?: number | string;
  rateIsd?: number | string;
  isd_rate_per_min?: number | string;
  includedLocalMinutes?: number;
  free_local_minutes?: number;
  includedStdMinutes?: number;
  free_std_minutes?: number;
  includedIsdMinutes?: number;
  free_isd_minutes?: number;
  isActive?: boolean;
  is_active?: boolean;
}

export interface TariffQueryDto {
  isActive?: string | boolean;
  is_active?: string | boolean;
  type?: string;
  planType?: string;
}
