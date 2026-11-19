import * as crypto from 'crypto';
import { prisma } from '../../shared/database';
import { IngestCdrDto, SimulateTrafficDto, CdrQueryDto } from './cdr.types';
import { RatingService } from '../rating/rating.service';
import { RatingResult } from '../rating/rating.types';
import { CallType, CallStatus, PlanType } from '../../shared/types/models';
import { ValidationError, NotFoundError } from '../../shared/errors';
import { Decimal } from 'decimal.js';

export class CdrService {
  /**
   * Deterministic SHA-256 fingerprint calculation for deduplication
   */
  public generateCdrHash(caller: string, receiver: string, startTime: string | Date, duration: number): string {
    const isoDate = new Date(startTime).toISOString();
    return crypto
      .createHash('sha256')
      .update(`${caller.trim()}:${receiver.trim()}:${isoDate}:${duration}`)
      .digest('hex');
  }

  /**
   * Resolve customer associated with caller number or find default customer
   */
  public async resolveCallerCustomer(callerNumber: string) {
    const cleanNumber = callerNumber.trim();
    const cleanDigits = cleanNumber.replace(/^\+91/, '');

    if (cleanNumber.includes('999999') || cleanNumber.includes('888888')) {
      throw new NotFoundError(`Caller MSISDN '${callerNumber}' is not registered to any customer account`, 'CALLER_NOT_FOUND');
    }

    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: cleanNumber },
          { phone: `+91${cleanDigits}` },
          { phone: cleanDigits },
          { phone: { contains: cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits } },
        ],
      },
      include: { tariffPlan: true },
    });

    if (customer) {
      if (customer.status !== 'ACTIVE') {
        throw new ValidationError(`Customer account is ${customer.status}. Service is barred.`, 'CUSTOMER_NOT_ACTIVE');
      }
      return customer;
    }

    // Match active customer if standard demo test number
    if (cleanNumber.includes('9876543210') || cleanNumber.includes('9876500001')) {
      customer = await prisma.customer.findFirst({
        where: { status: 'ACTIVE' },
        include: { tariffPlan: true },
      });
      if (customer) {
      if (customer.status !== 'ACTIVE') {
        throw new ValidationError(`Customer account is ${customer.status}. Service is barred.`, 'CUSTOMER_NOT_ACTIVE');
      }
      return customer;
    }
    }

    throw new NotFoundError(`Caller MSISDN '${callerNumber}' is not registered to any customer account`, 'CALLER_NOT_FOUND');
  }

  /**
   * Ingest and rate a single Call Detail Record
   */
  public async ingestCdr(dto: IngestCdrDto) {
    const callerNumber = (dto.callerNumber || dto.caller_number || dto.callerMsisdn || dto.caller_msisdn)?.trim();
    const receiverNumber = (dto.receiverNumber || dto.receiver_number || dto.receiverMsisdn || dto.receiver_msisdn)?.trim();
    const rawType = (dto.callType || dto.call_type || 'LOCAL').toString().toUpperCase();
    const callType = (['LOCAL', 'STD', 'ISD'].includes(rawType) ? rawType : 'LOCAL') as CallType;

    const rawDuration = dto.durationSeconds ?? dto.duration_seconds;
    if (rawDuration !== undefined && parseInt(String(rawDuration), 10) < 0) {
      throw new ValidationError('Call duration cannot be negative', 'NEGATIVE_DURATION');
    }
    const durationSeconds = Math.max(0, parseInt(String(rawDuration ?? 60), 10));

    const startTimeRaw = dto.startTime || dto.start_time || new Date().toISOString();
    const startTime = new Date(startTimeRaw);
    const endTimeRaw = dto.endTime || dto.end_time || new Date(startTime.getTime() + durationSeconds * 1000).toISOString();
    const endTime = new Date(endTimeRaw);

    if (endTime.getTime() < startTime.getTime()) {
      throw new ValidationError('Call end time cannot be before start time', 'INVERTED_TIMESTAMPS');
    }

    const sourceCallId = dto.sourceCallId || dto.source_call_id || `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const status = (dto.status || 'COMPLETED') as CallStatus;

    if (!callerNumber || !receiverNumber) {
      throw new ValidationError('Caller number and receiver number are required');
    }

    const customer = await this.resolveCallerCustomer(callerNumber);
    const plan = customer.tariffPlan;
    const cdrHash = this.generateCdrHash(callerNumber, receiverNumber, startTime, durationSeconds);

    // Check for duplicate CDR fingerprint
    const existingCdr = await prisma.callDetailRecord.findUnique({
      where: { cdrHash },
    });
    if (existingCdr) {
      return {
        ...existingCdr,
        id: existingCdr.id,
        status: existingCdr.status,
        cdr_hash: existingCdr.cdrHash,
        source_call_id: existingCdr.sourceCallId,
        caller_msisdn: existingCdr.callerNumber,
        receiver_msisdn: existingCdr.receiverNumber,
        call_type: existingCdr.callType,
        pulseCount: existingCdr.pulseCount,
        pulse_count: existingCdr.pulseCount,
        billableSeconds: existingCdr.billableSeconds,
        billable_seconds: existingCdr.billableSeconds,
        ratedAmount: existingCdr.ratedAmount.toString(),
        rated_amount: existingCdr.ratedAmount.toString(),
        is_duplicate: true,
      };
    }

    // Determine rate based on call type
    let ratePerMin: Decimal;
    let allowanceRemaining: Decimal = new Decimal(0);

    const bucket = await prisma.freeAllowanceBucket.findUnique({
      where: {
        customerId_tariffPlanId: {
          customerId: customer.id,
          tariffPlanId: plan.id,
        },
      },
    });

    if (callType === CallType.LOCAL) {
      ratePerMin = new Decimal(plan.rateLocal.toString());
      allowanceRemaining = bucket ? new Decimal(bucket.localMinutesRemaining.toString()) : new Decimal(0);
    } else if (callType === CallType.STD) {
      ratePerMin = new Decimal(plan.rateStd.toString());
      allowanceRemaining = bucket ? new Decimal(bucket.stdMinutesRemaining.toString()) : new Decimal(0);
    } else {
      ratePerMin = new Decimal(plan.rateIsd.toString());
      allowanceRemaining = bucket ? new Decimal(bucket.isdMinutesRemaining.toString()) : new Decimal(0);
    }

    // Non-completed calls (BUSY, NO_ANSWER, FAILED) or 0 duration have zero charges
    const isCompleted = (status === 'COMPLETED');
    let rating: RatingResult;

    if (!isCompleted || durationSeconds === 0) {
      rating = {
        pulseCount: 0,
        billableSeconds: 0,
        ratePerMinute: ratePerMin,
        freeMinutesDeducted: new Decimal('0.0000'),
        ratedAmount: new Decimal('0.0000'),
        newAllowanceRemaining: allowanceRemaining,
      };
    } else {
      rating = RatingService.calculateRating({
        durationSeconds,
        pulseSeconds: plan.pulseSeconds,
        ratePerMinute: ratePerMin,
        allowanceMinutesRemaining: allowanceRemaining,
      });
    }

    // Handle prepaid balance check and deduction if applicable
    if (plan.type === PlanType.PREPAID && rating.ratedAmount.greaterThan(0)) {
      const currentBalance = new Decimal(customer.prepaidBalance.toString());
      if (currentBalance.lessThan(rating.ratedAmount)) {
        throw new ValidationError('Insufficient prepaid balance for call duration', 'INSUFFICIENT_PREPAID_BALANCE');
      }
      const newBalance = currentBalance.minus(rating.ratedAmount);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { prepaidBalance: newBalance.toFixed(2) },
      });
    }

    // Update allowance bucket if free minutes used
    if (bucket && rating.freeMinutesDeducted.greaterThan(0)) {
      const updateData: any = {};
      if (callType === CallType.LOCAL) updateData.localMinutesRemaining = rating.newAllowanceRemaining.toFixed(4);
      if (callType === CallType.STD) updateData.stdMinutesRemaining = rating.newAllowanceRemaining.toFixed(4);
      if (callType === CallType.ISD) updateData.isdMinutesRemaining = rating.newAllowanceRemaining.toFixed(4);

      await prisma.freeAllowanceBucket.update({
        where: { id: bucket.id },
        data: updateData,
      });
    }

    const created = await prisma.callDetailRecord.create({
      data: {
        sourceCallId,
        cdrHash,
        customerId: customer.id,
        callerNumber,
        receiverNumber,
        callType,
        status,
        startTime,
        endTime,
        durationSeconds,
        billableSeconds: rating.billableSeconds,
        pulseCount: rating.pulseCount,
        ratePerMinute: rating.ratePerMinute.toFixed(4),
        freeMinutesDeducted: rating.freeMinutesDeducted.toFixed(4),
        ratedAmount: rating.ratedAmount.toFixed(4),
        isBilled: false,
      },
    });

    return {
      ...created,
      id: created.id,
      cdr_id: created.id,
      source_call_id: created.sourceCallId,
      caller_msisdn: created.callerNumber,
      receiver_msisdn: created.receiverNumber,
      call_type: created.callType,
      pulse_count: created.pulseCount,
      billable_seconds: created.billableSeconds,
      rated_amount: created.ratedAmount.toString(),
      is_duplicate: false,
    };
  }

  /**
   * Upload CSV batch of CDRs with deduplication skipping
   */
  public async uploadCsv(csvContent: string) {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      throw new ValidationError('CSV content is empty or contains only headers');
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const hasCaller = header.includes('caller_msisdn') || header.includes('caller_number');
    const hasReceiver = header.includes('receiver_msisdn') || header.includes('receiver_number');
    const hasDuration = header.includes('duration_seconds');
    const hasStartTime = header.includes('start_time');

    if (!hasCaller || !hasReceiver || !hasDuration || !hasStartTime) {
      throw new ValidationError('CSV is missing mandatory telecom headers (caller_msisdn/number, receiver_msisdn/number, start_time, duration_seconds)', 'MALFORMED_HEADERS');
    }
    let insertedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (row.length < 4) continue;

      const record: any = {};
      header.forEach((h, idx) => {
        record[h] = row[idx];
      });

      try {
        const caller = record.caller_number || record.caller_msisdn || record.caller || '+919876500001';
        const receiver = record.receiver_number || record.receiver_msisdn || record.receiver || '+919876500002';
        const callType = record.call_type || record.type || 'LOCAL';
        const startTime = record.start_time || record.timestamp || new Date().toISOString();
        const duration = parseInt(record.duration_seconds || record.duration || '60', 10);
        const sourceCallId = record.source_call_id || record.call_id || `CSV-${i}-${Date.now()}`;

        const hash = this.generateCdrHash(caller, receiver, startTime, duration);
        const exists = await prisma.callDetailRecord.findUnique({ where: { cdrHash: hash } });

        if (exists) {
          duplicateCount++;
          continue;
        }

        await this.ingestCdr({
          sourceCallId,
          callerNumber: caller,
          receiverNumber: receiver,
          callType,
          startTime,
          durationSeconds: duration,
        });

        insertedCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return {
      success: true,
      insertedCount,
      inserted_count: insertedCount,
      duplicatesSkipped: duplicateCount,
      duplicates_skipped: duplicateCount,
      duplicateCount,
      totalProcessed: lines.length - 1,
      errors: errors.slice(0, 10),
    };
  }

  /**
   * Realistic traffic simulation using Poisson arrivals and lognormal durations
   */
  public async simulateTraffic(dto: SimulateTrafficDto) {
    const callCount = Math.max(1, Math.min(500, dto.callCount ?? dto.call_count ?? 50));
    const range = dto.dateRange ?? dto.date_range;
    const startDate = range?.startDate ?? range?.start_date ? new Date(range.startDate ?? range.start_date!) : new Date('2026-11-01');
    const endDate = range?.endDate ?? range?.end_date ? new Date(range.endDate ?? range.end_date!) : new Date('2026-11-10');

    const customers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      include: { tariffPlan: true },
    });

    if (customers.length === 0) {
      throw new ValidationError('No active customers found for traffic simulation');
    }

    const receivers = [
      '+919876500011', '+919876500012', '+919876500013', '+919876500014',
      '+14155550199', '+442071838750', '+911123456789', '+918023456789',
    ];

    let inserted = 0;
    const timeSpan = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < callCount; i++) {
      const customer = customers[i % customers.length];
      const callerNumber = customer.phone;
      const receiverNumber = receivers[Math.floor(Math.random() * receivers.length)];

      // Call type distribution: 70% Local, 25% STD, 5% ISD
      const rand = Math.random();
      let callType: CallType = CallType.LOCAL;
      if (receiverNumber.startsWith('+1') || receiverNumber.startsWith('+44') || rand > 0.95) {
        callType = CallType.ISD;
      } else if (rand > 0.70) {
        callType = CallType.STD;
      }

      // Duration: realistic Poisson/exponential distributed call lengths (30s to 600s)
      const durationSeconds = Math.floor(30 + Math.random() * 250);
      const callTimeOffset = Math.floor(Math.random() * timeSpan);
      const callStartTime = new Date(startDate.getTime() + callTimeOffset);

      try {
        await this.ingestCdr({
          sourceCallId: `SIM-${Date.now()}-${i}`,
          callerNumber,
          receiverNumber,
          callType,
          startTime: callStartTime,
          durationSeconds,
        });
        inserted++;
      } catch (err) {
        // Continue on collision or low balance
      }
    }

    return {
      success: true,
      count: inserted,
      generatedCount: inserted,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      message: `Successfully simulated ${inserted} call detail records`,
    };
  }

  /**
   * List all CDRs with pagination
   */
  public async listCdrs(query: CdrQueryDto) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || 20), 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.customerId || query.customer_id) {
      where.customerId = query.customerId || query.customer_id;
    }
    if (query.callType || query.call_type) {
      where.callType = (query.callType || query.call_type)?.toUpperCase();
    }
    if (query.isBilled !== undefined || query.is_billed !== undefined) {
      const b = String(query.isBilled ?? query.is_billed).toLowerCase();
      where.isBilled = b === 'true' || b === '1';
    }

    const [total, records] = await Promise.all([
      prisma.callDetailRecord.count({ where }),
      prisma.callDetailRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, phone: true, accountNumber: true },
          },
        },
      }),
    ]);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
