import { prisma, connectDatabase, disconnectDatabase } from '../../../src/shared/database';
import { Decimal, toRateDecimal, toCurrencyDecimal, formatCurrency, calculateTax } from '../../../src/shared/utils/decimal';
import { Role, CustomerStatus, PlanType } from '../../../src/shared/types/models';
import crypto from 'crypto';

describe('Challenger 2: Empirical Verification & Adversarial Stress Testing of Database, WAL Mode & Schema', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // =========================================================================
  // SUITE 1: SQLite WAL Mode, Pragmas & Concurrency Configuration
  // =========================================================================
  describe('1. SQLite WAL Mode, Pragmas & Connection Settings', () => {
    test('PRAGMA journal_mode is strictly WAL', async () => {
      const result = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>('PRAGMA journal_mode;');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.journal_mode?.toLowerCase()).toBe('wal');
    });

    test('PRAGMA foreign_keys is strictly enabled (value = 1)', async () => {
      const result = await prisma.$queryRawUnsafe<Array<{ foreign_keys: number | bigint }>>('PRAGMA foreign_keys;');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(Number(result[0]?.foreign_keys)).toBe(1);
    });

    test('PRAGMA busy_timeout is configured to 5000ms', async () => {
      const result = await prisma.$queryRawUnsafe<Array<{ timeout: number | bigint }>>('PRAGMA busy_timeout;');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // SQLite returns the timeout in milliseconds
      expect(Number(result[0]?.timeout)).toBe(5000);
    });

    test('PRAGMA synchronous is configured to NORMAL (1)', async () => {
      const result = await prisma.$queryRawUnsafe<Array<{ synchronous: number | bigint }>>('PRAGMA synchronous;');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // NORMAL = 1 in SQLite
      expect(Number(result[0]?.synchronous)).toBe(1);
    });
  });

  // =========================================================================
  // SUITE 2: Foreign Key Constraints & Referential Integrity Stress
  // =========================================================================
  describe('2. Foreign Key Referential Integrity & Cascading Deletions', () => {
    test('Reject insertion of Customer with non-existent userId', async () => {
      const nonExistentUserId = crypto.randomUUID();
      const plan = await prisma.tariffPlan.findFirst();
      expect(plan).toBeDefined();

      await expect(
        prisma.customer.create({
          data: {
            userId: nonExistentUserId,
            accountNumber: `TEL-STRESS-${Date.now().toString().slice(-5)}`,
            firstName: 'FK',
            lastName: 'Tester',
            phone: `+919999${Date.now().toString().slice(-6)}`,
            address: 'Stress Test Street',
            status: CustomerStatus.ACTIVE,
            tariffPlanId: plan!.id,
          },
        })
      ).rejects.toThrow();
    });

    test('Reject insertion of Customer with non-existent tariffPlanId', async () => {
      const nonExistentPlanId = crypto.randomUUID();
      const testUser = await prisma.user.create({
        data: {
          email: `fk_test_${Date.now()}@telebill.local`,
          passwordHash: '$2b$12$dummyhashforforeignkeytest1234567890123456789012',
          role: Role.CUSTOMER,
        },
      });

      try {
        await expect(
          prisma.customer.create({
            data: {
              userId: testUser.id,
              accountNumber: `TEL-STRESS-${Date.now().toString().slice(-5)}`,
              firstName: 'FK',
              lastName: 'Tester',
              phone: `+919998${Date.now().toString().slice(-6)}`,
              address: 'Stress Test Street',
              status: CustomerStatus.ACTIVE,
              tariffPlanId: nonExistentPlanId,
            },
          })
        ).rejects.toThrow();
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    test('Reject insertion of CallDetailRecord with non-existent customerId', async () => {
      const nonExistentCustomerId = crypto.randomUUID();
      const hash = crypto.createHash('sha256').update(`dummy-cdr-${Date.now()}`).digest('hex');

      await expect(
        prisma.callDetailRecord.create({
          data: {
            customerId: nonExistentCustomerId,
            cdrHash: hash,
            callerNumber: '+919876543210',
            receiverNumber: '+919876543211',
            callType: 'LOCAL',
            startTime: new Date(),
            endTime: new Date(),
            durationSeconds: 60,
          },
        })
      ).rejects.toThrow();
    });

    test('Cascading deletion: deleting a Customer cascades to child records', async () => {
      const plan = await prisma.tariffPlan.findFirst();
      expect(plan).toBeDefined();

      // Create a test user + customer with child records
      const suffix = Date.now().toString().slice(-6);
      const testUser = await prisma.user.create({
        data: {
          email: `cascade_${suffix}@telebill.local`,
          passwordHash: '$2b$12$dummyhashforforeignkeytest1234567890123456789012',
          role: Role.CUSTOMER,
        },
      });

      const customer = await prisma.customer.create({
        data: {
          userId: testUser.id,
          accountNumber: `TEL-CAS-${suffix}`,
          firstName: 'Cascade',
          lastName: 'Tester',
          phone: `+918888${suffix}`,
          address: 'Cascade Lane',
          tariffPlanId: plan!.id,
        },
      });

      // Create allowance bucket
      const bucket = await prisma.freeAllowanceBucket.create({
        data: {
          customerId: customer.id,
          tariffPlanId: plan!.id,
          localMinutesRemaining: 100,
          stdMinutesRemaining: 50,
          isdMinutesRemaining: 0,
          resetDate: new Date(),
        },
      });

      // Create CDR
      const cdrHash = crypto.createHash('sha256').update(`cas-cdr-${suffix}`).digest('hex');
      const cdr = await prisma.callDetailRecord.create({
        data: {
          customerId: customer.id,
          cdrHash,
          callerNumber: customer.phone,
          receiverNumber: '+919111111111',
          callType: 'LOCAL',
          startTime: new Date(),
          endTime: new Date(),
          durationSeconds: 120,
        },
      });

      // Create Invoice & Item
      const invoice = await prisma.invoice.create({
        data: {
          customerId: customer.id,
          invoiceNumber: `INV-CAS-${suffix}`,
          billingCycleCode: `2099-${suffix.slice(-2)}`,
          dueDate: new Date(),
          totalAmount: 299.0,
        },
      });

      const invoiceItem = await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: 'Monthly Rental',
          category: 'RENTAL',
          amount: 299.0,
        },
      });

      // Create Notification
      const notification = await prisma.notification.create({
        data: {
          customerId: customer.id,
          title: 'Welcome',
          message: 'Welcome to TeleBill Pro',
          type: 'SYSTEM',
        },
      });

      // Create Usage Summary
      const summary = await prisma.usageSummary.create({
        data: {
          customerId: customer.id,
          billingCycleCode: `2099-${suffix.slice(-2)}`,
          totalLocalMinutes: 2,
        },
      });

      // Now DELETE customer: verify cascading delete cleans up all dependent records
      await prisma.customer.delete({ where: { id: customer.id } });

      // Assert all child records have been cascaded
      const bucketCheck = await prisma.freeAllowanceBucket.findUnique({ where: { id: bucket.id } });
      const cdrCheck = await prisma.callDetailRecord.findUnique({ where: { id: cdr.id } });
      const invoiceCheck = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      const itemCheck = await prisma.invoiceItem.findUnique({ where: { id: invoiceItem.id } });
      const notifCheck = await prisma.notification.findUnique({ where: { id: notification.id } });
      const summaryCheck = await prisma.usageSummary.findUnique({ where: { id: summary.id } });

      expect(bucketCheck).toBeNull();
      expect(cdrCheck).toBeNull();
      expect(invoiceCheck).toBeNull();
      expect(itemCheck).toBeNull();
      expect(notifCheck).toBeNull();
      expect(summaryCheck).toBeNull();

      // Clean up user
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    });
  });

  // =========================================================================
  // SUITE 3: Schema Unique Constraints Collision & Integrity Testing
  // =========================================================================
  describe('3. Schema Unique Constraints & Collision Invalidation', () => {
    test('CDR SHA-256 fingerprint collision strictly rejected (cdrHash UNIQUE)', async () => {
      const customer = await prisma.customer.findFirst();
      expect(customer).toBeDefined();

      const uniqueHash = crypto.createHash('sha256').update(`unique-cdr-${Date.now()}-${Math.random()}`).digest('hex');

      // First insert must succeed
      const cdr1 = await prisma.callDetailRecord.create({
        data: {
          customerId: customer!.id,
          cdrHash: uniqueHash,
          callerNumber: customer!.phone,
          receiverNumber: '+919876500001',
          callType: 'LOCAL',
          startTime: new Date('2026-11-01T10:00:00Z'),
          endTime: new Date('2026-11-01T10:02:00Z'),
          durationSeconds: 120,
        },
      });
      expect(cdr1.id).toBeDefined();

      // Duplicate insert with same cdrHash MUST fail with unique constraint violation
      await expect(
        prisma.callDetailRecord.create({
          data: {
            customerId: customer!.id,
            cdrHash: uniqueHash, // SAME HASH!
            callerNumber: customer!.phone,
            receiverNumber: '+919876500099', // Different destination
            callType: 'STD',
            startTime: new Date('2026-11-02T10:00:00Z'),
            endTime: new Date('2026-11-02T10:05:00Z'),
            durationSeconds: 300,
          },
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.callDetailRecord.delete({ where: { id: cdr1.id } }).catch(() => {});
    });

    test('Invoice compound uniqueness (customerId + billingCycleCode UNIQUE)', async () => {
      const customer = await prisma.customer.findFirst();
      expect(customer).toBeDefined();

      const cycleCode = `2088-${Date.now().toString().slice(-4)}`;
      const invNum1 = `INV-TEST-${Date.now()}-1`;
      const invNum2 = `INV-TEST-${Date.now()}-2`;

      // First invoice for this customer + cycle succeeds
      const inv1 = await prisma.invoice.create({
        data: {
          customerId: customer!.id,
          invoiceNumber: invNum1,
          billingCycleCode: cycleCode,
          dueDate: new Date(),
          totalAmount: 199.0,
        },
      });
      expect(inv1.id).toBeDefined();

      // Second invoice for the SAME customer and SAME cycle MUST fail
      await expect(
        prisma.invoice.create({
          data: {
            customerId: customer!.id,
            invoiceNumber: invNum2,
            billingCycleCode: cycleCode, // SAME CYCLE!
            dueDate: new Date(),
            totalAmount: 299.0,
          },
        })
      ).rejects.toThrow();

      // Second invoice for a DIFFERENT cycle succeeds
      const invDiffCycle = await prisma.invoice.create({
        data: {
          customerId: customer!.id,
          invoiceNumber: invNum2,
          billingCycleCode: `${cycleCode}-DIFF`,
          dueDate: new Date(),
          totalAmount: 299.0,
        },
      });
      expect(invDiffCycle.id).toBeDefined();

      // Cleanup
      await prisma.invoice.deleteMany({
        where: { id: { in: [inv1.id, invDiffCycle.id] } },
      });
    });

    test('Customer accountNumber uniqueness strictly enforced', async () => {
      const existing = await prisma.customer.findFirst();
      expect(existing).toBeDefined();

      const plan = await prisma.tariffPlan.findFirst();
      const testUser = await prisma.user.create({
        data: {
          email: `acc_num_test_${Date.now()}@telebill.local`,
          passwordHash: '$2b$12$dummyhashforforeignkeytest1234567890123456789012',
          role: Role.CUSTOMER,
        },
      });

      try {
        await expect(
          prisma.customer.create({
            data: {
              userId: testUser.id,
              accountNumber: existing!.accountNumber, // DUPLICATE ACCOUNT NUMBER!
              firstName: 'Duplicate',
              lastName: 'Account',
              phone: `+917777${Date.now().toString().slice(-6)}`,
              address: 'Duplicate Lane',
              tariffPlanId: plan!.id,
            },
          })
        ).rejects.toThrow();
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    test('Payment idempotencyKey uniqueness strictly enforced', async () => {
      const customer = await prisma.customer.findFirst();
      expect(customer).toBeDefined();

      const idemKey = `IDEM-STRESS-${Date.now()}-${Math.random()}`;
      const txn1 = `TXN-${Date.now()}-1`;
      const txn2 = `TXN-${Date.now()}-2`;
      const payNum1 = `PAY-${Date.now()}-1`;
      const payNum2 = `PAY-${Date.now()}-2`;

      const pay1 = await prisma.payment.create({
        data: {
          customerId: customer!.id,
          paymentNumber: payNum1,
          amount: 500.0,
          paymentMethod: 'UPI',
          transactionRef: txn1,
          idempotencyKey: idemKey,
          status: 'SUCCESS',
        },
      });
      expect(pay1.id).toBeDefined();

      // Re-posting identical idempotencyKey MUST fail
      await expect(
        prisma.payment.create({
          data: {
            customerId: customer!.id,
            paymentNumber: payNum2,
            amount: 500.0,
            paymentMethod: 'UPI',
            transactionRef: txn2,
            idempotencyKey: idemKey, // DUPLICATE IDEMPOTENCY KEY
            status: 'SUCCESS',
          },
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.payment.delete({ where: { id: pay1.id } }).catch(() => {});
    });

    test('User email uniqueness strictly enforced', async () => {
      const existingUser = await prisma.user.findFirst();
      expect(existingUser).toBeDefined();

      await expect(
        prisma.user.create({
          data: {
            email: existingUser!.email, // DUPLICATE EMAIL
            passwordHash: '$2b$12$dummyhashforforeignkeytest1234567890123456789012',
            role: Role.CUSTOMER,
          },
        })
      ).rejects.toThrow();
    });

    test('TariffPlan planCode uniqueness strictly enforced', async () => {
      const existingPlan = await prisma.tariffPlan.findFirst();
      expect(existingPlan).toBeDefined();

      await expect(
        prisma.tariffPlan.create({
          data: {
            planCode: existingPlan!.planCode, // DUPLICATE PLAN CODE
            name: 'Duplicate Plan Code Test',
            type: PlanType.POSTPAID,
            monthlyRental: 199.0,
          },
        })
      ).rejects.toThrow();
    });

    test('FreeAllowanceBucket (customerId + tariffPlanId) compound uniqueness enforced', async () => {
      const existingBucket = await prisma.freeAllowanceBucket.findFirst();
      expect(existingBucket).toBeDefined();

      await expect(
        prisma.freeAllowanceBucket.create({
          data: {
            customerId: existingBucket!.customerId,
            tariffPlanId: existingBucket!.tariffPlanId, // SAME CUSTOMER + PLAN
            localMinutesRemaining: 50,
            stdMinutesRemaining: 50,
            isdMinutesRemaining: 0,
            resetDate: new Date(),
          },
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // SUITE 4: Concurrency Stress Harness & SQLite WAL Mode
  // =========================================================================
  describe('4. Concurrency Stress Harness & SQLite WAL Non-Blocking Verification', () => {
    test('Non-blocking WAL concurrency: Simultaneous readers execute during ongoing write operations', async () => {
      const customer = await prisma.customer.findFirst();
      expect(customer).toBeDefined();

      const writeCount = 5;
      const readIterations = 20;

      // Start an asynchronous write batch
      const writePromise = (async () => {
        const createdIds: string[] = [];
        for (let i = 0; i < writeCount; i++) {
          const cdrHash = crypto.createHash('sha256').update(`wal-concurrent-${Date.now()}-${i}-${Math.random()}`).digest('hex');
          const cdr = await prisma.callDetailRecord.create({
            data: {
              customerId: customer!.id,
              cdrHash,
              callerNumber: customer!.phone,
              receiverNumber: '+919999000000',
              callType: 'LOCAL',
              startTime: new Date(),
              endTime: new Date(),
              durationSeconds: 30 + i,
            },
          });
          createdIds.push(cdr.id);
          // Yield tick
          await new Promise((res) => setTimeout(res, 20));
        }
        return createdIds;
      })();

      // Simultaneously execute multiple concurrent reads from different tables
      const readPromises = Array.from({ length: readIterations }, async (_, idx) => {
        const [usersCount, plansCount, customersCount] = await Promise.all([
          prisma.user.count(),
          prisma.tariffPlan.count(),
          prisma.customer.count(),
        ]);
        return { idx, usersCount, plansCount, customersCount };
      });

      // Both reads and writes must complete successfully without SQLITE_BUSY or locks
      const [createdIds, readResults] = await Promise.all([writePromise, Promise.all(readPromises)]);

      expect(createdIds.length).toBe(writeCount);
      expect(readResults.length).toBe(readIterations);
      for (const res of readResults) {
        expect(res.usersCount).toBeGreaterThan(0);
        expect(res.plansCount).toBeGreaterThan(0);
        expect(res.customersCount).toBeGreaterThan(0);
      }

      // Cleanup
      await prisma.callDetailRecord.deleteMany({
        where: { id: { in: createdIds } },
      });
    });

    test('Concurrent writes: Multiple parallel write promises resolve cleanly via busy_timeout', async () => {
      const customer = await prisma.customer.findFirst();
      expect(customer).toBeDefined();

      const parallelWrites = 12;
      const createdIds: string[] = [];

      // Dispatch 12 writes concurrently
      const tasks = Array.from({ length: parallelWrites }, async (_, i) => {
        const cdrHash = crypto.createHash('sha256').update(`busy-stress-${Date.now()}-${i}-${Math.random()}`).digest('hex');
        const res = await prisma.callDetailRecord.create({
          data: {
            customerId: customer!.id,
            cdrHash,
            callerNumber: customer!.phone,
            receiverNumber: '+919876543299',
            callType: 'LOCAL',
            startTime: new Date(),
            endTime: new Date(),
            durationSeconds: 45,
          },
        });
        return res.id;
      });

      const results = await Promise.allSettled(tasks);
      const failures = results.filter((r) => r.status === 'rejected');
      const successes = results.filter((r) => r.status === 'fulfilled');

      // Track created IDs for cleanup
      for (const r of successes) {
        if (r.status === 'fulfilled') createdIds.push(r.value);
      }

      await prisma.callDetailRecord.deleteMany({
        where: { id: { in: createdIds } },
      });

      // In WAL mode with busy_timeout=5000ms, all 12 concurrent writes should succeed
      expect(failures.length).toBe(0);
      expect(successes.length).toBe(parallelWrites);
    });

    test('Parallel mixed read/write transaction stress under heavy load', async () => {
      const customer = await prisma.customer.findFirst();
      expect(customer).toBeDefined();

      const iterations = 15;
      const createdCdrIds: string[] = [];

      const operations = Array.from({ length: iterations }, async (_, i) => {
        if (i % 2 === 0) {
          // Read operation
          return prisma.customer.findUnique({
            where: { id: customer!.id },
            include: { tariffPlan: true },
          });
        } else {
          // Write operation
          const hash = crypto.createHash('sha256').update(`mixed-load-${Date.now()}-${i}-${Math.random()}`).digest('hex');
          const created = await prisma.callDetailRecord.create({
            data: {
              customerId: customer!.id,
              cdrHash: hash,
              callerNumber: customer!.phone,
              receiverNumber: '+919800000000',
              callType: 'STD',
              startTime: new Date(),
              endTime: new Date(),
              durationSeconds: 15,
            },
          });
          createdCdrIds.push(created.id);
          return created;
        }
      });

      const results = await Promise.all(operations);
      expect(results.length).toBe(iterations);

      // Cleanup
      await prisma.callDetailRecord.deleteMany({
        where: { id: { in: createdCdrIds } },
      });
    });
  });

  // =========================================================================
  // SUITE 5: Precision Decimal Math & IEEE-754 Drift Elimination
  // =========================================================================
  describe('5. High-Precision Decimal Math & Accumulator Stress', () => {
    test('Large-scale rating accumulation: 10,000 CDR rating iterations without drift', () => {
      const ratePerPulse = new Decimal('0.0075'); // 4 decimal places
      const iterations = 10000;

      // IEEE-754 native float calculation
      let floatSum = 0;
      for (let i = 0; i < iterations; i++) {
        floatSum += 0.0075;
      }
      // Native float will suffer floating-point drift:
      // 10,000 * 0.0075 = 75, but floatSum often has IEEE-754 drift (e.g. 75.00000000000216 or similar)

      // Decimal.js fixed-point accumulator
      let decimalSum = new Decimal(0);
      for (let i = 0; i < iterations; i++) {
        decimalSum = decimalSum.plus(ratePerPulse);
      }

      expect(decimalSum.toString()).toBe('75');
      expect(decimalSum.toFixed(4)).toBe('75.0000');
      expect(toCurrencyDecimal(decimalSum).toFixed(2)).toBe('75.00');
    });

    test('Complex telecom GST tax rounding with half-up precision', () => {
      // Test cases where standard floats round down incorrectly
      // Example 1: Amount 299.00 * 18% = 53.82 exactly
      expect(calculateTax(new Decimal('299.00'), 18).toFixed(2)).toBe('53.82');

      // Example 2: Amount 199.95 * 18% = 35.991 -> rounds to 35.99
      expect(calculateTax(new Decimal('199.95'), 18).toFixed(2)).toBe('35.99');

      // Example 3: Amount 199.99 * 18% = 35.9982 -> rounds to 36.00
      expect(calculateTax(new Decimal('199.99'), 18).toFixed(2)).toBe('36.00');

      // Example 4: Amount 0.00 -> 0.00
      expect(calculateTax(new Decimal('0.00'), 18).toFixed(2)).toBe('0.00');
    });

    test('Fractional unit rates (DECIMAL 10, 4) preserve 4 exact decimal places', () => {
      const rate1 = toRateDecimal('0.0025');
      const rate2 = toRateDecimal('0.5000');
      const rate3 = toRateDecimal('9.5000');

      expect(rate1.toFixed(4)).toBe('0.0025');
      expect(rate2.toFixed(4)).toBe('0.5000');
      expect(rate3.toFixed(4)).toBe('9.5000');

      // Multiplication with duration
      const totalCost = rate1.times(360); // 360 seconds at 0.0025/sec = 0.9000
      expect(totalCost.toFixed(4)).toBe('0.9000');
      expect(formatCurrency(totalCost)).toBe('0.90');
    });

    test('Round-trip decimal database persistence preserves precision', async () => {
      const plan = await prisma.tariffPlan.findFirst();
      expect(plan).toBeDefined();

      const suffix = Date.now().toString().slice(-5);
      const testUser = await prisma.user.create({
        data: {
          email: `decimal_${suffix}@telebill.local`,
          passwordHash: '$2b$12$dummyhashforforeignkeytest1234567890123456789012',
          role: Role.CUSTOMER,
        },
      });

      // Insert customer with exact decimal amounts
      const customer = await prisma.customer.create({
        data: {
          userId: testUser.id,
          accountNumber: `TEL-DEC-${suffix}`,
          firstName: 'Decimal',
          lastName: 'Precision',
          phone: `+916666${suffix}`,
          address: 'Math Street',
          tariffPlanId: plan!.id,
          prepaidBalance: '1234.56', // DECIMAL(10, 2)
          creditLimit: '9876.54',
        },
      });

      // Re-query from database
      const fetched = await prisma.customer.findUnique({
        where: { id: customer.id },
      });

      expect(fetched).toBeDefined();
      expect(fetched!.prepaidBalance.toString()).toBe('1234.56');
      expect(fetched!.creditLimit.toString()).toBe('9876.54');

      // Insert CDR with 4-decimal place rate
      const cdrHash = crypto.createHash('sha256').update(`dec-cdr-${suffix}`).digest('hex');
      const cdr = await prisma.callDetailRecord.create({
        data: {
          customerId: customer.id,
          cdrHash,
          callerNumber: customer.phone,
          receiverNumber: '+919999999999',
          callType: 'LOCAL',
          startTime: new Date(),
          endTime: new Date(),
          durationSeconds: 120,
          ratePerMinute: '0.5000',
          ratedAmount: '1.0000',
        },
      });

      const fetchedCdr = await prisma.callDetailRecord.findUnique({
        where: { id: cdr.id },
      });

      expect(fetchedCdr).toBeDefined();
      expect(fetchedCdr!.ratePerMinute.toString()).toBe('0.5');
      expect(new Decimal(fetchedCdr!.ratePerMinute.toString()).toFixed(4)).toBe('0.5000');
      expect(new Decimal(fetchedCdr!.ratedAmount.toString()).toFixed(4)).toBe('1.0000');

      // Cleanup
      await prisma.callDetailRecord.delete({ where: { id: cdr.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    });
  });

  // =========================================================================
  // SUITE 6: Database Seeding Idempotency Verification
  // =========================================================================
  describe('6. Database Seeding Idempotency & Demo State Stability', () => {
    beforeAll(async () => {
      // Clean up ephemeral test records from earlier stress tests to isolate seed assertions
      await prisma.customer.deleteMany({
        where: {
          accountNumber: { notIn: ['TEL-202611-00001', 'TEL-202611-00002', 'TEL-202611-00003'] },
        },
      });
      await prisma.tariffPlan.deleteMany({
        where: {
          planCode: { notIn: ['POST-STD-299', 'PRE-VAL-199', 'POST-ENT-999'] },
        },
      });
    });

    test('Database contains expected core seed records', async () => {
      const [usersCount, plansCount, customersCount, bucketsCount] = await Promise.all([
        prisma.user.count(),
        prisma.tariffPlan.count(),
        prisma.customer.count(),
        prisma.freeAllowanceBucket.count(),
      ]);

      // Seed defines 5 demo users, 3 plans, 3 customers, 3 buckets
      expect(usersCount).toBeGreaterThanOrEqual(5);
      expect(plansCount).toBe(3);
      expect(customersCount).toBe(3);
      expect(bucketsCount).toBe(3);
    });

    test('Demo tariff plans match specification rates and configurations', async () => {
      const plans = await prisma.tariffPlan.findMany();
      expect(plans.length).toBe(3);

      const postStd = plans.find((p) => p.planCode === 'POST-STD-299');
      const preVal = plans.find((p) => p.planCode === 'PRE-VAL-199');
      const entPlan = plans.find((p) => p.planCode === 'POST-ENT-999');

      expect(postStd).toBeDefined();
      expect(postStd!.type).toBe('POSTPAID');
      expect(postStd!.monthlyRental.toString()).toBe('299');
      expect(postStd!.pulseSeconds).toBe(60);

      expect(preVal).toBeDefined();
      expect(preVal!.type).toBe('PREPAID');
      expect(preVal!.validityDays).toBe(28);

      expect(entPlan).toBeDefined();
      expect(entPlan!.pulseSeconds).toBe(1); // Per-second pulse!
    });

    test('Consecutive seed execution idempotency: zero duplicate entities across repeated upserts', async () => {
      // Record baseline counts before consecutive seed execution
      const [u0, p0, c0, b0] = await Promise.all([
        prisma.user.count(),
        prisma.tariffPlan.count(),
        prisma.customer.count(),
        prisma.freeAllowanceBucket.count(),
      ]);

      // Execute seed upsert queries identically to prisma/seed.ts (Run 1)
      const admin = await prisma.user.upsert({
        where: { email: 'admin@telebill.local' },
        update: { role: Role.ADMIN, isActive: true },
        create: {
          email: 'admin@telebill.local',
          passwordHash: '$2b$12$dummyhashforforeignkeytest1234567890123456789012',
          role: Role.ADMIN,
          isActive: true,
        },
      });

      const customerUser = await prisma.user.findUnique({
        where: { email: 'customer@telebill.local' },
      });
      expect(customerUser).toBeDefined();

      const postpaidPlan = await prisma.tariffPlan.upsert({
        where: { planCode: 'POST-STD-299' },
        update: {},
        create: {
          planCode: 'POST-STD-299',
          name: 'Postpaid Standard 299',
          type: PlanType.POSTPAID,
          monthlyRental: '299.00',
        },
      });

      const primaryCust = await prisma.customer.upsert({
        where: { accountNumber: 'TEL-202611-00001' },
        update: { tariffPlanId: postpaidPlan.id, userId: customerUser!.id },
        create: {
          userId: customerUser!.id,
          accountNumber: 'TEL-202611-00001',
          firstName: 'Rajesh',
          lastName: 'Sharma',
          phone: '+919876543210',
          address: 'Bellandur',
          tariffPlanId: postpaidPlan.id,
        },
      });

      await prisma.freeAllowanceBucket.upsert({
        where: {
          customerId_tariffPlanId: {
            customerId: primaryCust.id,
            tariffPlanId: postpaidPlan.id,
          },
        },
        update: {},
        create: {
          customerId: primaryCust.id,
          tariffPlanId: postpaidPlan.id,
          resetDate: new Date('2026-12-01T00:00:00.000Z'),
        },
      });

      // Repeat the exact same upsert batch (Run 2)
      await prisma.user.upsert({
        where: { email: 'admin@telebill.local' },
        update: { role: Role.ADMIN, isActive: true },
        create: {
          email: 'admin@telebill.local',
          passwordHash: '$2b$12$dummyhashforforeignkeytest1234567890123456789012',
          role: Role.ADMIN,
          isActive: true,
        },
      });

      await prisma.tariffPlan.upsert({
        where: { planCode: 'POST-STD-299' },
        update: {},
        create: {
          planCode: 'POST-STD-299',
          name: 'Postpaid Standard 299',
          type: PlanType.POSTPAID,
          monthlyRental: '299.00',
        },
      });

      await prisma.customer.upsert({
        where: { accountNumber: 'TEL-202611-00001' },
        update: { tariffPlanId: postpaidPlan.id },
        create: {
          userId: admin.id,
          accountNumber: 'TEL-202611-00001',
          firstName: 'Rajesh',
          lastName: 'Sharma',
          phone: '+919876543210',
          address: 'Bellandur',
          tariffPlanId: postpaidPlan.id,
        },
      });

      const [uFinal, pFinal, cFinal, bFinal] = await Promise.all([
        prisma.user.count(),
        prisma.tariffPlan.count(),
        prisma.customer.count(),
        prisma.freeAllowanceBucket.count(),
      ]);

      // Counts after repeat upserts must remain strictly unchanged (zero duplicate records)
      expect(uFinal).toBe(u0);
      expect(pFinal).toBe(p0);
      expect(cFinal).toBe(c0);
      expect(bFinal).toBe(b0);

      // Confirm all 3 customers can still be retrieved with intact relationships
      const allCustomers = await prisma.customer.findMany({
        include: { user: true, tariffPlan: true, allowanceBuckets: true },
      });
      expect(allCustomers.length).toBe(3);
      for (const cust of allCustomers) {
        expect(cust.user).toBeDefined();
        expect(cust.tariffPlan).toBeDefined();
        expect(cust.allowanceBuckets.length).toBeGreaterThan(0);
      }
    });
  });
});
