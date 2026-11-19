import { CustomerStatus } from '../../shared/types/models';

export interface CreateCustomerDto {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email: string;
  phone?: string;
  phone_number?: string;
  address?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  postal_code?: string;
  planId?: string | number;
  plan_id?: string | number;
  tariffPlanId?: string;
  accountType?: 'PREPAID' | 'POSTPAID';
  account_type?: 'PREPAID' | 'POSTPAID';
  initialBalance?: number | string;
  initial_balance?: number | string;
  creditLimit?: number | string;
  credit_limit?: number | string;
  password?: string;
}

export interface UpdateCustomerDto {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  phone?: string;
  phone_number?: string;
  address?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  postal_code?: string;
  creditLimit?: number | string;
  credit_limit?: number | string;
}

export interface CustomerStatusDto {
  status: CustomerStatus;
  reason?: string;
}

export interface AssignPlanDto {
  newPlanId?: string | number;
  new_plan_id?: string | number;
  planId?: string | number;
  plan_id?: string | number;
  effectiveMode?: 'IMMEDIATE' | 'NEXT_CYCLE';
  effective_mode?: 'IMMEDIATE' | 'NEXT_CYCLE';
}

export interface CustomerQueryDto {
  page?: number | string;
  limit?: number | string;
  search?: string;
  status?: string;
  accountType?: string;
  account_type?: string;
  planId?: string;
}
