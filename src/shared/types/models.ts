export enum Role {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum PlanType {
  PREPAID = 'PREPAID',
  POSTPAID = 'POSTPAID',
}

export enum CallType {
  LOCAL = 'LOCAL',
  STD = 'STD',
  ISD = 'ISD',
}

export enum CallStatus {
  COMPLETED = 'COMPLETED',
  BUSY = 'BUSY',
  NO_ANSWER = 'NO_ANSWER',
  FAILED = 'FAILED',
}

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export enum InvoiceItemCategory {
  RENTAL = 'RENTAL',
  USAGE = 'USAGE',
  TAX = 'TAX',
  DISCOUNT = 'DISCOUNT',
  ARREARS = 'ARREARS',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  NET_BANKING = 'NET_BANKING',
  UPI = 'UPI',
  SIMULATED = 'SIMULATED',
}

export enum PaymentStatus {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export enum NotificationType {
  BILL_DUE = 'BILL_DUE',
  OVERDUE = 'OVERDUE',
  LOW_BALANCE = 'LOW_BALANCE',
  SYSTEM = 'SYSTEM',
}
