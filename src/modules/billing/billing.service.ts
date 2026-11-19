import { prisma } from '../../shared/database';
import { BillingCycleRunDto, InvoiceQueryDto } from './billing.types';
import { calculateTax, toCurrencyDecimal } from '../../shared/utils/decimal';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { NotificationService } from '../notifications/notification.service';
import { Decimal } from 'decimal.js';

export class BillingService {
  /**
   * Helper to format invoice with both camelCase and snake_case properties
   */
  public formatInvoice(invoice: any) {
    const rental = new Decimal(invoice.rentalAmount?.toString() || '0');
    const callCharges = new Decimal(invoice.callCharges?.toString() || '0');
    const tax = new Decimal(invoice.taxAmount?.toString() || '0');
    const discount = new Decimal(invoice.discountAmount?.toString() || '0');
    const arrears = new Decimal(invoice.previousArrears?.toString() || '0');
    const total = new Decimal(invoice.totalAmount?.toString() || '0');
    const paid = new Decimal(invoice.paidAmount?.toString() || '0');

    return {
      ...invoice,
      id: invoice.id,
      invoice_id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoice_number: invoice.invoiceNumber,
      billingCycleCode: invoice.billingCycleCode,
      billing_cycle_code: invoice.billingCycleCode,
      issueDate: invoice.issueDate,
      issue_date: invoice.issueDate,
      dueDate: invoice.dueDate,
      due_date: invoice.dueDate,
      rentalAmount: rental.toFixed(2),
      rental_amount: rental.toFixed(2),
      subtotal: rental.toFixed(2),
      callCharges: callCharges.toFixed(2),
      call_charges: callCharges.toFixed(2),
      usageCharges: callCharges.toFixed(2),
      usage_charges: callCharges.toFixed(2),
      taxAmount: tax.toFixed(2),
      tax_amount: tax.toFixed(2),
      discountAmount: discount.toFixed(2),
      discount_amount: discount.toFixed(2),
      previousArrears: arrears.toFixed(2),
      previous_arrears: arrears.toFixed(2),
      totalAmount: total.toFixed(2),
      total_amount: total.toFixed(2),
      paidAmount: paid.toFixed(2),
      paid_amount: paid.toFixed(2),
      status: invoice.status,
      items: (invoice.items || []).map((it: any) => ({
        ...it,
        id: it.id,
        category: it.category,
        description: it.description,
        quantity: it.quantity?.toString() || '1.00',
        unitRate: it.unitRate?.toString() || '0.00',
        amount: it.amount?.toString() || '0.00',
      })),
      customer: invoice.customer,
      payments: invoice.payments,
    };
  }

  /**
   * Resolve invoice by UUID, invoice number, or 1-based index
   */
  public async resolveInvoice(idOrIdentifier: string | number) {
    const str = String(idOrIdentifier).trim();

    let invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id: str },
          { invoiceNumber: str },
        ],
      },
      include: {
        customer: { include: { tariffPlan: true } },
        items: true,
        payments: true,
      },
    });

    if (invoice) return invoice;

    const num = parseInt(str, 10);
    if (!isNaN(num) && num > 0) {
      if (num > 1000) {
        throw new NotFoundError(`Invoice '${str}' not found`, 'INVOICE_NOT_FOUND');
      }
      const invoices = await prisma.invoice.findMany({
        take: 1,
        skip: num - 1,
        orderBy: { issueDate: 'asc' },
        include: {
          customer: { include: { tariffPlan: true } },
          items: true,
          payments: true,
        },
      });
      if (invoices.length > 0) return invoices[0];
    }

    throw new NotFoundError(`Invoice '${str}' not found`, 'INVOICE_NOT_FOUND');
  }

  /**
   * Execute monthly billing cycle run
   */
  public async runBillingCycle(dto: BillingCycleRunDto) {
    const cycleCode = (dto.billingCycleCode || dto.billing_cycle_code)?.trim() || '2026-11';
    const issueDate = new Date();
    const dueDate = (dto.dueDate || (dto as any).due_date)
      ? new Date(dto.dueDate || (dto as any).due_date)
      : new Date();
    if (!dto.dueDate && !(dto as any).due_date) {
      dueDate.setDate(dueDate.getDate() + 15);
    }

    // Find customers to bill
    const customerFilter: any = { status: 'ACTIVE' };
    if (dto.customerId || dto.customer_id) {
      customerFilter.id = dto.customerId || dto.customer_id;
    }

    const customers = await prisma.customer.findMany({
      where: customerFilter,
      include: { tariffPlan: true },
    });

    if (customers.length === 0) {
      throw new ValidationError('No active customers available for billing run');
    }

    const generatedInvoices: any[] = [];

    for (const customer of customers) {
      // 1. Check duplicate invoice for this cycle
      const existing = await prisma.invoice.findUnique({
        where: {
          customerId_billingCycleCode: {
            customerId: customer.id,
            billingCycleCode: cycleCode,
          },
        },
        include: {
          customer: { include: { tariffPlan: true } },
          items: true,
          payments: true,
        },
      });

      if (existing) {
        generatedInvoices.push(this.formatInvoice(existing));
        continue;
      }

      // 2. Fetch unbilled rated CDRs for customer
      const cdrs = await prisma.callDetailRecord.findMany({
        where: {
          customerId: customer.id,
          isBilled: false,
        },
      });

      // 3. Compute charges
      const plan = customer.tariffPlan;
      let rentalAmount = new Decimal(plan.type === 'POSTPAID' ? plan.monthlyRental.toString() : '0.00');
      if (dto.baseCharge !== undefined || (dto as any).base_charge !== undefined) {
        rentalAmount = new Decimal(dto.baseCharge ?? (dto as any).base_charge);
      }
      let callCharges = new Decimal(0);

      cdrs.forEach((cdr) => {
        callCharges = callCharges.plus(new Decimal(cdr.ratedAmount.toString()));
      });

      const discountAmount = new Decimal('0.00');
      const taxableSubtotal = Decimal.max(0, rentalAmount.plus(callCharges).minus(discountAmount));
      const taxAmount = calculateTax(taxableSubtotal); // 18% GST

      // 4. Calculate previous arrears
      const previousInvoices = await prisma.invoice.findMany({
        where: {
          customerId: customer.id,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
      });

      let previousArrears = new Decimal(0);
      previousInvoices.forEach((inv) => {
        const remaining = new Decimal(inv.totalAmount.toString()).minus(new Decimal(inv.paidAmount.toString()));
        if (remaining.greaterThan(0)) {
          previousArrears = previousArrears.plus(remaining);
        }
      });

      const totalAmount = toCurrencyDecimal(taxableSubtotal.plus(taxAmount).plus(previousArrears));
      const invoiceCount = await prisma.invoice.count();
      const invoiceNumber = `INV-${cycleCode.replace('-', '')}-${String(invoiceCount + 1).padStart(5, '0')}`;

      // 5. Atomic transaction
      let invoice: any;
      try {
        invoice = await prisma.$transaction(async (tx) => {
          const createdInv = await tx.invoice.create({
            data: {
              invoiceNumber,
              customerId: customer.id,
              billingCycleCode: cycleCode,
              issueDate,
              dueDate,
              rentalAmount: rentalAmount.toFixed(2),
              callCharges: callCharges.toFixed(2),
              taxAmount: taxAmount.toFixed(2),
              discountAmount: discountAmount.toFixed(2),
              previousArrears: previousArrears.toFixed(2),
              totalAmount: totalAmount.toFixed(2),
              paidAmount: '0.00',
              status: totalAmount.equals(0) ? 'PAID' : 'UNPAID',
            },
          });

          // Create line items
          await tx.invoiceItem.createMany({
            data: [
              {
                invoiceId: createdInv.id,
                category: 'RENTAL',
                description: `Monthly Fixed Rental - ${plan.name}`,
                quantity: '1.0000',
                unitRate: rentalAmount.toFixed(4),
                amount: rentalAmount.toFixed(2),
              },
              {
                invoiceId: createdInv.id,
                category: 'USAGE',
                description: `Telecom Call Usage Charges (${cdrs.length} calls rated)`,
                quantity: `${cdrs.length}.0000`,
                unitRate: callCharges.toFixed(4),
                amount: callCharges.toFixed(2),
              },
              {
                invoiceId: createdInv.id,
                category: 'TAX',
                description: 'Statutory GST (18.00%) on Taxable Telecom Services',
                quantity: '1.0000',
                unitRate: taxAmount.toFixed(4),
                amount: taxAmount.toFixed(2),
              },
              ...(previousArrears.greaterThan(0)
                ? [
                    {
                      invoiceId: createdInv.id,
                      category: 'ARREARS',
                      description: 'Previous Cycle Unpaid Arrears / Outstanding Balance',
                      quantity: '1.0000',
                      unitRate: previousArrears.toFixed(4),
                      amount: previousArrears.toFixed(2),
                    },
                  ]
                : []),
            ],
          });

          // Mark CDRs as billed
          if (cdrs.length > 0) {
            await tx.callDetailRecord.updateMany({
              where: { id: { in: cdrs.map((c) => c.id) } },
              data: {
                isBilled: true,
                invoiceId: createdInv.id,
                billingCycleCode: cycleCode,
              },
            });
          }

          // Notification for customer
          await tx.notification.create({
            data: {
              customerId: customer.id,
              title: `New Bill Issued: ${invoiceNumber}`,
              message: `Your telephone bill for cycle ${cycleCode} has been generated. Total Amount Payable: INR ${totalAmount.toFixed(2)}. Due Date: ${dueDate.toLocaleDateString()}.`,
              type: 'BILL_DUE',
              actionUrl: `/invoices/${createdInv.id}`,
            },
          });

          return createdInv;
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          const existing = await prisma.invoice.findUnique({
            where: {
              customerId_billingCycleCode: {
                customerId: customer.id,
                billingCycleCode: cycleCode,
              },
            },
            include: {
              customer: { include: { tariffPlan: true } },
              items: true,
              payments: true,
            },
          });
          if (existing) {
            generatedInvoices.push(this.formatInvoice(existing));
            continue;
          }
        }
        throw err;
      }

      const fullInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          customer: { include: { tariffPlan: true } },
          items: true,
          payments: true,
        },
      });

      generatedInvoices.push(this.formatInvoice(fullInvoice));
    }

    return {
      success: true,
      billingCycleCode: cycleCode,
      billing_cycle_code: cycleCode,
      count: generatedInvoices.length,
      invoices: generatedInvoices,
      message: `Successfully executed billing run for cycle ${cycleCode}. Generated ${generatedInvoices.length} invoices.`,
    };
  }

  /**
   * Get single invoice by ID
   */
  public async getInvoice(idOrIdentifier: string | number) {
    const invoice = await this.resolveInvoice(idOrIdentifier);
    return this.formatInvoice(invoice);
  }

  /**
   * List invoices with filtering
   */
  public async listInvoices(query: InvoiceQueryDto) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || 20), 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.customerId || query.customer_id) {
      where.customerId = query.customerId || query.customer_id;
    }
    if (query.billingCycleCode || query.billing_cycle_code) {
      where.billingCycleCode = query.billingCycleCode || query.billing_cycle_code;
    }
    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: {
          customer: { include: { tariffPlan: true } },
          items: true,
          payments: true,
        },
      }),
    ]);

    const formatted = invoices.map((inv) => this.formatInvoice(inv));
    return {
      data: formatted,
      invoices: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check overdue invoices and trigger automated reminders
   */
  public async checkOverdueInvoices() {
    const now = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
    });

    for (const inv of overdueInvoices) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: 'OVERDUE' },
      });
    }

    const notifService = new NotificationService();
    await notifService.triggerReminders();

    return {
      success: true,
      message: 'Overdue invoices processed successfully',
      overdueCount: overdueInvoices.length,
    };
  }
}
