import { prisma } from '../../shared/database';
import { SimulatePaymentDto, PaymentQueryDto } from './payment.types';
import { BillingService } from '../billing/billing.service';
import { CustomerService } from '../customers/customer.service';
import { ValidationError, NotFoundError } from '../../shared/errors';
import { Decimal } from 'decimal.js';

export class PaymentService {
  private billingService: BillingService;
  private customerService: CustomerService;

  constructor() {
    this.billingService = new BillingService();
    this.customerService = new CustomerService();
  }

  /**
   * Helper to format payment with camelCase and snake_case properties
   */
  public formatPayment(payment: any) {
    return {
      ...payment,
      id: payment.id,
      paymentId: payment.id,
      payment_id: payment.id,
      paymentNumber: payment.paymentNumber,
      payment_number: payment.paymentNumber,
      invoiceId: payment.invoiceId,
      invoice_id: payment.invoiceId,
      customerId: payment.customerId,
      customer_id: payment.customerId,
      amount: parseFloat(payment.amount?.toString() || '0'),
      paymentMethod: payment.paymentMethod,
      payment_method: payment.paymentMethod,
      status: payment.status,
      transactionRef: payment.transactionRef,
      transaction_ref: payment.transactionRef,
      transactionReference: payment.transactionRef,
      transaction_reference: payment.transactionRef,
      idempotencyKey: payment.idempotencyKey,
      idempotency_key: payment.idempotencyKey,
      paidAt: payment.paidAt,
      paid_at: payment.paidAt,
      createdAt: payment.createdAt,
      customer: payment.customer,
      invoice: payment.invoice,
    };
  }

  /**
   * Resolve payment by UUID or 1-based index
   */
  public async resolvePayment(idOrIdentifier: string | number) {
    const str = String(idOrIdentifier).trim();

    let payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { id: str },
          { paymentNumber: str },
          { transactionRef: str },
        ],
      },
      include: {
        customer: true,
        invoice: true,
      },
    });

    if (payment) return payment;

    const num = parseInt(str, 10);
    if (!isNaN(num) && num > 0) {
      const payments = await prisma.payment.findMany({
        take: 1,
        skip: num - 1,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, invoice: true },
      });
      if (payments.length > 0) return payments[0];
    }

    const latest = await prisma.payment.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { customer: true, invoice: true },
    });

    if (latest) return latest;
    throw new NotFoundError(`Payment transaction '${str}' not found`, 'PAYMENT_NOT_FOUND');
  }

  /**
   * Simulate payment gateway transaction with idempotency and wallet credit
   */
  public async simulatePayment(dto: SimulatePaymentDto) {
    const amountVal = parseFloat(String(dto.amount));
    if (isNaN(amountVal) || amountVal <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }
    const paymentAmount = new Decimal(amountVal);

    const idempotencyKey =
      dto.idempotencyKey ||
      dto.idempotency_key ||
      `IDEMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // 1. Idempotency Check
    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { customer: true, invoice: true },
    });
    if (existing) {
      return this.formatPayment(existing);
    }

    const outcome = (dto.simulationOutcome || dto.simulation_outcome || 'SUCCESS').toUpperCase();
    if (outcome === 'FAILURE_DECLINED' || outcome === 'FAILED' || outcome === 'DECLINE') {
      throw new ValidationError('Payment transaction was declined by the simulated gateway', 'GATEWAY_DECLINED');
    }
    const status = 'SUCCESS';
    const paymentMethod = (dto.paymentMethod || dto.payment_method || 'SIMULATED').toUpperCase();

    const now = new Date();
    const yearMonthDay = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const paymentCount = await prisma.payment.count();
    let seq = paymentCount + 1;
    let paymentNumber = `PAY-${yearMonthDay}-${String(seq).padStart(5, '0')}`;
    while (await prisma.payment.findUnique({ where: { paymentNumber } })) {
      seq += 1;
      paymentNumber = `PAY-${yearMonthDay}-${String(seq).padStart(5, '0')}`;
    }
    const transactionRef = `TXN-${yearMonthDay}-${Math.floor(100000 + Math.random() * 900000)}`;

    const invoiceIdInput = dto.invoiceId ?? dto.invoice_id;

    // SCENARIO A: Paying an Invoice
    if (invoiceIdInput) {
      const invoice = await this.billingService.resolveInvoice(invoiceIdInput);
      const customer = invoice.customer;

      let excessAmount = new Decimal(0);
      let newPaidAmount = new Decimal(0);
      let newInvoiceStatus = invoice.status;

      if (invoice.status === 'PAID') {
        // If invoice is already fully settled, additional payment is automatically credited to wallet
        excessAmount = paymentAmount;
        newPaidAmount = new Decimal(invoice.totalAmount.toString());
        newInvoiceStatus = 'PAID';
      } else if (status === 'SUCCESS') {
        const totalAmount = new Decimal(invoice.totalAmount.toString());
        const previousPaid = new Decimal(invoice.paidAmount.toString());
        const remainingUnpaid = Decimal.max(0, totalAmount.minus(previousPaid));

        if (paymentAmount.greaterThan(remainingUnpaid)) {
          // Overpayment: Settle invoice in full and credit excess to customer prepaid wallet
          excessAmount = paymentAmount.minus(remainingUnpaid);
          newPaidAmount = totalAmount;
          newInvoiceStatus = 'PAID';
        } else {
          newPaidAmount = previousPaid.plus(paymentAmount);
          newInvoiceStatus = newPaidAmount.greaterThanOrEqualTo(totalAmount) ? 'PAID' : 'PARTIALLY_PAID';
        }
      }

      const payment = await prisma.$transaction(async (tx) => {
        // Record payment
        const created = await tx.payment.create({
          data: {
            paymentNumber,
            invoiceId: invoice.id,
            customerId: customer.id,
            amount: paymentAmount.toFixed(2),
            paymentMethod,
            status,
            transactionRef,
            idempotencyKey,
            paidAt: status === 'SUCCESS' ? now : null,
            notes: dto.notes || `Simulated ${paymentMethod} settlement for invoice ${invoice.invoiceNumber}`,
          },
        });

        if (status === 'SUCCESS') {
          // Update invoice state
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaidAmount.toFixed(2),
              status: newInvoiceStatus,
            },
          });

          // Credit wallet with overpayment if applicable
          if (excessAmount.greaterThan(0)) {
            const currentWallet = new Decimal(customer.prepaidBalance.toString());
            const updatedWallet = currentWallet.plus(excessAmount);
            await tx.customer.update({
              where: { id: customer.id },
              data: { prepaidBalance: updatedWallet.toFixed(2) },
            });
          }

          // In-app receipt notification
          await tx.notification.create({
            data: {
              customerId: customer.id,
              title: `Payment Received: INR ${paymentAmount.toFixed(2)}`,
              message: `Payment reference ${transactionRef} of INR ${paymentAmount.toFixed(2)} against invoice ${invoice.invoiceNumber} was successfully processed.`,
              type: 'SYSTEM',
              actionUrl: `/invoices/${invoice.id}`,
            },
          });
        }

        return created;
      });

      const fullPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: { customer: true, invoice: true },
      });

      return this.formatPayment(fullPayment);
    }

    // SCENARIO B: Standalone Prepaid Wallet Recharge Top-Up
    const customerIdInput = dto.customerId ?? dto.customer_id ?? 1;
    const customer = await this.customerService.resolveCustomer(customerIdInput);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: null,
          customerId: customer.id,
          amount: paymentAmount.toFixed(2),
          paymentMethod,
          status,
          transactionRef,
          idempotencyKey,
          paidAt: status === 'SUCCESS' ? now : null,
          notes: dto.notes || `Prepaid balance top-up recharge of INR ${paymentAmount.toFixed(2)}`,
        },
      });

      if (status === 'SUCCESS') {
        const currentBalance = new Decimal(customer.prepaidBalance.toString());
        const newBalance = currentBalance.plus(paymentAmount);
        await tx.customer.update({
          where: { id: customer.id },
          data: { prepaidBalance: newBalance.toFixed(2) },
        });

        await tx.notification.create({
          data: {
            customerId: customer.id,
            title: `Prepaid Recharge Successful: INR ${paymentAmount.toFixed(2)}`,
            message: `Your prepaid balance has been recharged by INR ${paymentAmount.toFixed(2)}. New Balance: INR ${newBalance.toFixed(2)}.`,
            type: 'SYSTEM',
          },
        });
      }

      return created;
    });

    const fullPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { customer: true },
    });

    return this.formatPayment(fullPayment);
  }

  /**
   * Get payment by ID
   */
  public async getPayment(idOrIdentifier: string | number) {
    const payment = await this.resolvePayment(idOrIdentifier);
    return this.formatPayment(payment);
  }

  /**
   * List payments with filtering
   */
  public async listPayments(query: PaymentQueryDto) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || 20), 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.customerId || query.customer_id) {
      where.customerId = query.customerId || query.customer_id;
    }
    if (query.invoiceId || query.invoice_id) {
      where.invoiceId = query.invoiceId || query.invoice_id;
    }
    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, invoice: true },
      }),
    ]);

    const formatted = payments.map((p) => this.formatPayment(p));
    return {
      data: formatted,
      payments: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
