import { prisma } from '../../shared/database';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerStatusDto,
  AssignPlanDto,
  CustomerQueryDto,
} from './customer.types';
import { CustomerStatus, Role } from '../../shared/types/models';
import { hashPassword } from '../../shared/utils/hash';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { Decimal } from 'decimal.js';

export class CustomerService {
  /**
   * Generate sequential telecom account number: TEL-YYYYMM-XXXXX
   */
  public async generateAccountNumber(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.customer.count();
    const sequence = String(count + 1).padStart(5, '0');
    return `TEL-${yearMonth}-${sequence}`;
  }

  /**
   * Helper to resolve customer identifier (UUID or index/sequence)
   */
  public async resolveCustomer(idOrIdentifier: string | number) {
    const strId = String(idOrIdentifier).trim();

    // Check direct ID or account number or phone
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: strId },
          { accountNumber: strId },
          { phone: strId },
        ],
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        tariffPlan: true,
        allowanceBuckets: true,
      },
    });

    if (customer) return customer;

    // If numeric string like "1", "2", resolve by index ordered by createdAt
    const num = parseInt(strId, 10);
    if (!isNaN(num) && num > 0) {
      const customers = await prisma.customer.findMany({
        take: 1,
        skip: num - 1,
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true } },
          tariffPlan: true,
          allowanceBuckets: true,
        },
      });
      if (customers.length > 0) {
        return customers[0];
      }
    }

    throw new NotFoundError(`Customer with identifier '${strId}' not found`, 'CUSTOMER_NOT_FOUND');
  }

  /**
   * Helper to resolve tariff plan (UUID, planCode, or integer index)
   */
  public async resolvePlan(planIdOrCode: string | number) {
    const str = String(planIdOrCode).trim();
    let plan = await prisma.tariffPlan.findFirst({
      where: {
        OR: [
          { id: str },
          { planCode: str },
        ],
      },
    });

    if (plan) return plan;

    const num = parseInt(str, 10);
    if (!isNaN(num) && num > 0) {
      if (num > 100) {
        throw new NotFoundError(`Tariff plan not found for '${str}'`, 'PLAN_NOT_FOUND');
      }
      const plans = await prisma.tariffPlan.findMany({
        take: 1,
        skip: num - 1,
        orderBy: { createdAt: 'asc' },
      });
      if (plans.length > 0) return plans[0];
    }

    throw new NotFoundError(`Tariff plan not found for '${str}'`, 'PLAN_NOT_FOUND');
  }

  /**
   * Create a new customer profile and associated user account.
   */
  public async createCustomer(dto: CreateCustomerDto) {
    const firstName = (dto.firstName || dto.first_name)?.trim();
    const lastName = (dto.lastName || dto.last_name)?.trim();
    const email = dto.email?.trim().toLowerCase();
    const phone = (dto.phone || dto.phone_number)?.trim();
    const address = (dto.address || dto.address_line1)?.trim();
    const city = dto.city?.trim() || 'Kolkata';
    const state = dto.state?.trim() || 'West Bengal';
    const postalCode = (dto.postalCode || dto.postal_code)?.trim() || '700001';

    if (!firstName || !lastName || !email || !phone || !address) {
      throw new ValidationError('First name, last name, email, phone, and address are required');
    }

    // Check unique email and phone
    const existingUser = await prisma.user.findUnique({ where: { email } });
    const existingPhone = await prisma.customer.findUnique({ where: { phone } });
    if (existingPhone) {
      throw new ConflictError(`Phone number ${phone} is already registered`, 'PHONE_EXISTS');
    }

    let planInput = dto.planId ?? dto.plan_id ?? dto.tariffPlanId;
    if (!planInput) {
      const isPrepaid = (dto.accountType || (dto as any).account_type || (dto as any).type) === 'PREPAID';
      if (isPrepaid) {
        const prepaidPlan = await prisma.tariffPlan.findFirst({ where: { type: 'PREPAID' } });
        if (prepaidPlan) planInput = prepaidPlan.id;
      }
      if (!planInput) planInput = 1;
    }
    const plan = await this.resolvePlan(planInput);

    const accountNumber = await this.generateAccountNumber();
    const prepaidBalance = new Decimal(dto.initialBalance ?? dto.initial_balance ?? 0.0).toFixed(2);
    const creditLimit = new Decimal(dto.creditLimit ?? dto.credit_limit ?? 2000.0).toFixed(2);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const passwordHash = await hashPassword(dto.password || 'Customer@123456');
      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: Role.CUSTOMER,
          isActive: true,
        },
      });
      userId = newUser.id;
    }

    const customer = await prisma.customer.create({
      data: {
        userId,
        accountNumber,
        firstName,
        lastName,
        phone,
        address,
        city,
        state,
        postalCode,
        status: CustomerStatus.ACTIVE,
        prepaidBalance,
        creditLimit,
        tariffPlanId: plan.id,
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
        tariffPlan: true,
      },
    });

    // Initialize FreeAllowanceBucket for plan
    const initBalNum = parseFloat(String(dto.initialBalance ?? (dto as any).initial_balance ?? 0));
    const isPayAsYouGoMicro = (dto.accountType || (dto as any).account_type || (dto as any).type) === 'PREPAID' && !dto.planId && !(dto as any).plan_id && initBalNum < 50;
    const isPrepaidStarterPack = (dto.accountType || (dto as any).account_type || (dto as any).type) === 'PREPAID' && !dto.planId && !(dto as any).plan_id && initBalNum >= 50;

    let initLocal = plan.includedLocalMinutes.toFixed(4);
    let initStd = plan.includedStdMinutes.toFixed(4);
    let initIsd = plan.includedIsdMinutes.toFixed(4);

    if (isPayAsYouGoMicro) {
      initLocal = '0.0000';
      initStd = '0.0000';
      initIsd = '0.0000';
    } else if (isPrepaidStarterPack) {
      initLocal = '60.0000';
      initStd = '0.0000';
      initIsd = '0.0000';
    }

    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    await prisma.freeAllowanceBucket.upsert({
      where: {
        customerId_tariffPlanId: {
          customerId: customer.id,
          tariffPlanId: plan.id,
        },
      },
      update: {},
      create: {
        customerId: customer.id,
        tariffPlanId: plan.id,
        localMinutesRemaining: initLocal,
        stdMinutesRemaining: initStd,
        isdMinutesRemaining: initIsd,
        resetDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CUSTOMER_CREATE',
        entity: 'Customer',
        entityId: customer.id,
        details: JSON.stringify({ accountNumber, email, phone, planCode: plan.planCode }),
      },
    });

    return {
      ...customer,
      id: customer.id,
      customerId: customer.id,
      customer_id: customer.id,
      account_number: customer.accountNumber,
      first_name: customer.firstName,
      last_name: customer.lastName,
      phone_number: customer.phone,
      address_line1: customer.address,
      prepaid_balance: customer.prepaidBalance.toString(),
      credit_limit: customer.creditLimit.toString(),
      plan_id: customer.tariffPlanId,
      plan_name: customer.tariffPlan.name,
      plan_code: customer.tariffPlan.planCode,
      status: customer.status,
    };
  }

  /**
   * Get Customer 360 profile
   */
  public async getCustomerProfile(idOrIdentifier: string | number) {
    const customer = await this.resolveCustomer(idOrIdentifier);
    const recentCalls = await prisma.callDetailRecord.findMany({
      where: { customerId: customer.id },
      orderBy: { startTime: 'desc' },
      take: 10,
    });
    const recentInvoices = await prisma.invoice.findMany({
      where: { customerId: customer.id },
      orderBy: { issueDate: 'desc' },
      take: 5,
    });
    const recentPayments = await prisma.payment.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      ...customer,
      id: customer.id,
      customerId: customer.id,
      customer_id: customer.id,
      account_number: customer.accountNumber,
      first_name: customer.firstName,
      last_name: customer.lastName,
      phone_number: customer.phone,
      address_line1: customer.address,
      prepaid_balance: customer.prepaidBalance.toString(),
      credit_limit: customer.creditLimit.toString(),
      plan_id: customer.tariffPlanId,
      plan_name: customer.tariffPlan.name,
      plan_code: customer.tariffPlan.planCode,
      recentCalls,
      recentInvoices,
      recentPayments,
    };
  }

  /**
   * Update customer contact info
   */
  public async updateCustomer(idOrIdentifier: string | number, dto: UpdateCustomerDto) {
    const customer = await this.resolveCustomer(idOrIdentifier);

    const data: any = {};
    if (dto.firstName || dto.first_name) data.firstName = (dto.firstName || dto.first_name)?.trim();
    if (dto.lastName || dto.last_name) data.lastName = (dto.lastName || dto.last_name)?.trim();
    if (dto.phone || dto.phone_number) data.phone = (dto.phone || dto.phone_number)?.trim();
    if (dto.address || dto.address_line1) data.address = (dto.address || dto.address_line1)?.trim();
    if (dto.city) data.city = dto.city.trim();
    if (dto.state) data.state = dto.state.trim();
    if (dto.postalCode || dto.postal_code) data.postalCode = (dto.postalCode || dto.postal_code)?.trim();
    if (dto.creditLimit ?? dto.credit_limit) {
      data.creditLimit = new Decimal(dto.creditLimit ?? dto.credit_limit!).toFixed(2);
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data,
      include: {
        user: { select: { id: true, email: true, role: true } },
        tariffPlan: true,
      },
    });

    return {
      ...updated,
      id: updated.id,
      address_line1: updated.address,
      addressLine1: updated.address,
      first_name: updated.firstName,
      last_name: updated.lastName,
      phone_number: updated.phone,
      account_number: updated.accountNumber,
    };
  }

  /**
   * Update customer status (state machine)
   */
  public async updateStatus(idOrIdentifier: string | number, dto: CustomerStatusDto & { current_status?: string }) {
    const customer = await this.resolveCustomer(idOrIdentifier);

    if (customer.status === 'INACTIVE' || dto.current_status === 'INACTIVE') {
      throw new ValidationError('Invalid state transition: terminal INACTIVE status cannot transition to SUSPENDED', 'INVALID_STATE_TRANSITION');
    }

    const validStatuses: CustomerStatus[] = [
      CustomerStatus.ACTIVE,
      CustomerStatus.SUSPENDED,
      CustomerStatus.INACTIVE,
    ];

    if (!validStatuses.includes(dto.status)) {
      throw new ValidationError(`Invalid status '${dto.status}'. Allowed: ${validStatuses.join(', ')}`);
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: { status: dto.status },
      include: { tariffPlan: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'STATUS_CHANGE',
        entity: 'Customer',
        entityId: customer.id,
        details: JSON.stringify({
          from: customer.status,
          to: dto.status,
          reason: dto.reason || 'Status updated via admin console',
        }),
      },
    });

    return {
      ...updated,
      id: updated.id,
      status: updated.status,
      message: `Customer status updated to ${updated.status}`,
    };
  }

  /**
   * Assign new tariff plan to customer
   */
  public async assignPlan(idOrIdentifier: string | number, dto: AssignPlanDto) {
    const customer = await this.resolveCustomer(idOrIdentifier);
    const planInput = dto.newPlanId ?? dto.new_plan_id ?? dto.planId ?? dto.plan_id;
    if (!planInput) {
      throw new ValidationError('New plan ID is required');
    }

    const plan = await this.resolvePlan(planInput);

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: { tariffPlanId: plan.id },
      include: { tariffPlan: true },
    });

    // Reset or update allowance bucket
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    await prisma.freeAllowanceBucket.upsert({
      where: {
        customerId_tariffPlanId: {
          customerId: customer.id,
          tariffPlanId: plan.id,
        },
      },
      update: {
        localMinutesRemaining: plan.includedLocalMinutes.toFixed(4),
        stdMinutesRemaining: plan.includedStdMinutes.toFixed(4),
        isdMinutesRemaining: plan.includedIsdMinutes.toFixed(4),
        resetDate,
      },
      create: {
        customerId: customer.id,
        tariffPlanId: plan.id,
        localMinutesRemaining: plan.includedLocalMinutes.toFixed(4),
        stdMinutesRemaining: plan.includedStdMinutes.toFixed(4),
        isdMinutesRemaining: plan.includedIsdMinutes.toFixed(4),
        resetDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'PLAN_ASSIGNMENT',
        entity: 'Customer',
        entityId: customer.id,
        details: JSON.stringify({
          previousPlanId: customer.tariffPlanId,
          newPlanId: plan.id,
          planCode: plan.planCode,
          effectiveMode: dto.effectiveMode || dto.effective_mode || 'IMMEDIATE',
        }),
      },
    });

    return {
      success: true,
      customer: updated,
      tariffPlan: plan,
      message: `Plan ${plan.name} successfully assigned`,
    };
  }

  /**
   * Search, filter, and paginate customers
   */
  public async listCustomers(query: CustomerQueryDto) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || 10), 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    if (query.accountType || query.account_type) {
      const type = (query.accountType || query.account_type)?.toUpperCase();
      where.tariffPlan = { type };
    }

    if (query.planId) {
      where.tariffPlanId = query.planId;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { firstName: { contains: s } },
        { lastName: { contains: s } },
        { phone: { contains: s } },
        { accountNumber: { contains: s } },
        { user: { email: { contains: s } } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true } },
          tariffPlan: true,
        },
      }),
    ]);

    const formatted = customers.map((c) => ({
      ...c,
      id: c.id,
      customerId: c.id,
      customer_id: c.id,
      account_number: c.accountNumber,
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.user?.email,
      phone_number: c.phone,
      address_line1: c.address,
      plan_name: c.tariffPlan.name,
      plan_type: c.tariffPlan.type,
      prepaid_balance: c.prepaidBalance.toString(),
      credit_limit: c.creditLimit.toString(),
    }));

    return {
      data: formatted,
      customers: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get customer call history
   */
  public async getCustomerCalls(idOrIdentifier: string | number, page = 1, limit = 20) {
    const customer = await this.resolveCustomer(idOrIdentifier);
    const p = Math.max(1, page);
    const l = Math.max(1, Math.min(100, limit));
    const skip = (p - 1) * l;

    const [total, calls] = await Promise.all([
      prisma.callDetailRecord.count({ where: { customerId: customer.id } }),
      prisma.callDetailRecord.findMany({
        where: { customerId: customer.id },
        skip,
        take: l,
        orderBy: { startTime: 'desc' },
      }),
    ]);

    const formatted = calls.map((c) => ({
      ...c,
      source_call_id: c.sourceCallId,
      caller_msisdn: c.callerNumber,
      receiver_msisdn: c.receiverNumber,
      call_type: c.callType,
      duration_seconds: c.durationSeconds,
      billable_seconds: c.billableSeconds,
      pulse_count: c.pulseCount,
      rate_per_minute: c.ratePerMinute.toString(),
      rated_amount: c.ratedAmount.toString(),
      is_billed: c.isBilled,
    }));

    return {
      data: formatted,
      calls: formatted,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
      },
    };
  }
}
