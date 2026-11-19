import { prisma } from '../../shared/database';
import { CreateTariffDto, UpdateTariffDto, TariffQueryDto } from './tariff.types';
import { PlanType } from '../../shared/types/models';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { Decimal } from 'decimal.js';

export class TariffService {
  /**
   * Helper to format tariff plan with both camelCase and snake_case properties
   */
  public formatPlan(plan: any) {
    return {
      ...plan,
      id: plan.id,
      planId: plan.id,
      plan_id: plan.id,
      planCode: plan.planCode,
      plan_code: plan.planCode,
      planType: plan.type,
      plan_type: plan.type,
      monthlyRental: plan.monthlyRental.toString(),
      monthly_rental: parseFloat(plan.monthlyRental.toString()),
      pulseSeconds: plan.pulseSeconds,
      pulse_seconds: plan.pulseSeconds,
      validityDays: plan.validityDays,
      validity_days: plan.validityDays,
      rateLocal: plan.rateLocal.toString(),
      rate_local: parseFloat(plan.rateLocal.toString()),
      localRatePerMin: plan.rateLocal.toString(),
      local_rate_per_min: parseFloat(plan.rateLocal.toString()),
      rateStd: plan.rateStd.toString(),
      rate_std: parseFloat(plan.rateStd.toString()),
      stdRatePerMin: plan.rateStd.toString(),
      std_rate_per_min: parseFloat(plan.rateStd.toString()),
      rateIsd: plan.rateIsd.toString(),
      rate_isd: parseFloat(plan.rateIsd.toString()),
      isdRatePerMin: plan.rateIsd.toString(),
      isd_rate_per_min: parseFloat(plan.rateIsd.toString()),
      includedLocalMinutes: plan.includedLocalMinutes,
      free_local_minutes: plan.includedLocalMinutes,
      includedStdMinutes: plan.includedStdMinutes,
      free_std_minutes: plan.includedStdMinutes,
      includedIsdMinutes: plan.includedIsdMinutes,
      free_isd_minutes: plan.includedIsdMinutes,
      isActive: plan.isActive,
      is_active: plan.isActive,
    };
  }

  /**
   * Helper to resolve tariff plan by UUID, planCode, or 1-based index
   */
  public async resolvePlan(idOrIdentifier: string | number) {
    const str = String(idOrIdentifier).trim();

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
        throw new NotFoundError(`Tariff plan '${str}' not found`, 'PLAN_NOT_FOUND');
      }
      const plans = await prisma.tariffPlan.findMany({
        take: 1,
        skip: num - 1,
        orderBy: { createdAt: 'asc' },
      });
      if (plans.length > 0) return plans[0];
    }

    throw new NotFoundError(`Tariff plan '${str}' not found`, 'PLAN_NOT_FOUND');
  }

  /**
   * Create a new tariff plan
   */
  public async createPlan(dto: CreateTariffDto) {
    const planCode = (dto.planCode || dto.plan_code)?.trim();
    const name = dto.name?.trim();
    const rawType = dto.type || dto.planType || dto.plan_type || 'POSTPAID';
    const type = rawType.toUpperCase() === 'PREPAID' ? PlanType.PREPAID : PlanType.POSTPAID;

    if (!planCode || !name) {
      throw new ValidationError('Plan code and name are required');
    }

    const rentalVal = parseFloat(String(dto.monthlyRental ?? dto.monthly_rental ?? 0.0));
    if (rentalVal < 0) {
      throw new ValidationError('Monthly rental cannot be negative', 'NEGATIVE_RENTAL');
    }
    const monthlyRental = new Decimal(rentalVal).toFixed(2);

    const pulseSeconds = dto.pulseSeconds ?? dto.pulse_seconds ?? 60;
    if (pulseSeconds <= 0) {
      throw new ValidationError('Pulse increment must be greater than zero', 'INVALID_PULSE');
    }

    const validityDays = dto.validityDays ?? dto.validity_days ?? null;

    const localRateVal = parseFloat(String(dto.rateLocal ?? dto.local_rate_per_min ?? 0.5));
    const stdRateVal = parseFloat(String(dto.rateStd ?? dto.std_rate_per_min ?? 0.75));
    const isdRateVal = parseFloat(String(dto.rateIsd ?? dto.isd_rate_per_min ?? 5.0));

    if (localRateVal < 0 || stdRateVal < 0 || isdRateVal < 0) {
      throw new ValidationError('Unit call rates cannot be negative', 'NEGATIVE_RATES');
    }

    const existing = await prisma.tariffPlan.findUnique({ where: { planCode } });
    if (existing) {
      throw new ConflictError(`Plan code '${planCode}' already exists`, 'PLAN_CODE_EXISTS');
    }

    const rateLocal = new Decimal(localRateVal).toFixed(4);
    const rateStd = new Decimal(stdRateVal).toFixed(4);
    const rateIsd = new Decimal(isdRateVal).toFixed(4);
    const includedLocalMinutes = dto.includedLocalMinutes ?? dto.free_local_minutes ?? 0;
    const includedStdMinutes = dto.includedStdMinutes ?? dto.free_std_minutes ?? 0;
    const includedIsdMinutes = dto.includedIsdMinutes ?? dto.free_isd_minutes ?? 0;
    const isActive = dto.isActive ?? dto.is_active ?? true;

    const plan = await prisma.tariffPlan.create({
      data: {
        planCode,
        name,
        type,
        description: dto.description || '',
        monthlyRental,
        pulseSeconds,
        validityDays,
        rateLocal,
        rateStd,
        rateIsd,
        includedLocalMinutes,
        includedStdMinutes,
        includedIsdMinutes,
        isActive,
      },
    });

    return this.formatPlan(plan);
  }

  /**
   * Get plan by ID or code
   */
  public async getPlan(idOrIdentifier: string | number) {
    const plan = await this.resolvePlan(idOrIdentifier);
    return this.formatPlan(plan);
  }

  /**
   * Update tariff plan rates, rental, and pulse
   */
  public async updatePlan(idOrIdentifier: string | number, dto: UpdateTariffDto) {
    const plan = await this.resolvePlan(idOrIdentifier);
    const data: any = {};

    if (dto.name) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.monthlyRental !== undefined || dto.monthly_rental !== undefined) {
      const r = parseFloat(String(dto.monthlyRental ?? dto.monthly_rental));
      if (r < 0) throw new ValidationError('Monthly rental cannot be negative', 'NEGATIVE_RENTAL');
      data.monthlyRental = new Decimal(r).toFixed(2);
    }
    if (dto.pulseSeconds !== undefined || dto.pulse_seconds !== undefined) {
      const p = dto.pulseSeconds ?? dto.pulse_seconds!;
      if (p <= 0) throw new ValidationError('Pulse increment must be greater than zero', 'INVALID_PULSE');
      data.pulseSeconds = p;
    }
    if (dto.validityDays !== undefined || dto.validity_days !== undefined) {
      data.validityDays = dto.validityDays ?? dto.validity_days;
    }
    if (dto.rateLocal !== undefined || dto.local_rate_per_min !== undefined) {
      const r = parseFloat(String(dto.rateLocal ?? dto.local_rate_per_min));
      if (r < 0) throw new ValidationError('Unit call rates cannot be negative', 'NEGATIVE_RATES');
      data.rateLocal = new Decimal(r).toFixed(4);
    }
    if (dto.rateStd !== undefined || dto.std_rate_per_min !== undefined) {
      const r = parseFloat(String(dto.rateStd ?? dto.std_rate_per_min));
      if (r < 0) throw new ValidationError('Unit call rates cannot be negative', 'NEGATIVE_RATES');
      data.rateStd = new Decimal(r).toFixed(4);
    }
    if (dto.rateIsd !== undefined || dto.isd_rate_per_min !== undefined) {
      const r = parseFloat(String(dto.rateIsd ?? dto.isd_rate_per_min));
      if (r < 0) throw new ValidationError('Unit call rates cannot be negative', 'NEGATIVE_RATES');
      data.rateIsd = new Decimal(r).toFixed(4);
    }
    if (dto.includedLocalMinutes !== undefined || dto.free_local_minutes !== undefined) {
      data.includedLocalMinutes = dto.includedLocalMinutes ?? dto.free_local_minutes;
    }
    if (dto.includedStdMinutes !== undefined || dto.free_std_minutes !== undefined) {
      data.includedStdMinutes = dto.includedStdMinutes ?? dto.free_std_minutes;
    }
    if (dto.includedIsdMinutes !== undefined || dto.free_isd_minutes !== undefined) {
      data.includedIsdMinutes = dto.includedIsdMinutes ?? dto.free_isd_minutes;
    }
    if (dto.isActive !== undefined || dto.is_active !== undefined) {
      data.isActive = dto.isActive ?? dto.is_active;
    }

    const updated = await prisma.tariffPlan.update({
      where: { id: plan.id },
      data,
    });

    return this.formatPlan(updated);
  }

  /**
   * List all plans or filter by active status / type
   */
  public async listPlans(query: TariffQueryDto) {
    const where: any = {};
    if (query.isActive !== undefined || query.is_active !== undefined) {
      const activeParam = String(query.isActive ?? query.is_active).toLowerCase();
      where.isActive = activeParam === 'true' || activeParam === '1';
    }
    if (query.type || query.planType) {
      const t = (query.type || query.planType)?.toUpperCase();
      where.type = t;
    }

    const plans = await prisma.tariffPlan.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return plans.map((p) => this.formatPlan(p));
  }
}
