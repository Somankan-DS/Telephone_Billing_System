export interface SimulatePaymentDto {
  invoiceId?: string | number | null;
  invoice_id?: string | number | null;
  customerId?: string | number;
  customer_id?: string | number;
  amount: number | string;
  paymentMethod?: string;
  payment_method?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
  simulationOutcome?: 'SUCCESS' | 'FAILED';
  simulation_outcome?: 'SUCCESS' | 'FAILED';
  notes?: string;
}

export interface PaymentQueryDto {
  page?: number | string;
  limit?: number | string;
  customerId?: string;
  customer_id?: string;
  invoiceId?: string;
  invoice_id?: string;
  status?: string;
}
