export interface BillingCycleRunDto {
  billingCycleCode?: string;
  billing_cycle_code?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  customerId?: string;
  customer_id?: string;
  dueDate?: string;
  due_date?: string;
  baseCharge?: number | string;
  base_charge?: number | string;
}

export interface InvoiceQueryDto {
  page?: number | string;
  limit?: number | string;
  customerId?: string;
  customer_id?: string;
  billingCycleCode?: string;
  billing_cycle_code?: string;
  status?: string;
}
