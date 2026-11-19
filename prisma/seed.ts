import { PrismaClient } from '@prisma/client';
import { Role, PlanType, CustomerStatus } from '../src/shared/types/models';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Bcrypt Cost Factor 12 as mandated by Security Specification
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Starting TeleBill Pro Database Seeding Engine...');

  // 1. Enable SQLite WAL mode pragmas
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    console.log('✅ SQLite WAL mode and concurrency pragmas verified.');
  } catch (err) {
    console.warn('⚠️ Non-fatal SQLite PRAGMA notice (may be non-SQLite database):', err);
  }

  // Clear transactional and transient tables for clean test/demo state
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.callDetailRecord.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.freeAllowanceBucket.deleteMany({});
  await prisma.usageSummary.deleteMany({});

  // 2. Hash Demo Passwords (cost factor 12)
  console.log('🔒 Hashing demo credentials with Bcrypt cost factor 12...');
  const adminPasswordHash = await bcrypt.hash('Admin@123456', BCRYPT_ROUNDS);
  const staffPasswordHash = await bcrypt.hash('Operator@123456', BCRYPT_ROUNDS);
  const customerPasswordHash = await bcrypt.hash('Customer@123456', BCRYPT_ROUNDS);

  // 3. Seed Users (Admin, Staff, Customer)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@telebill.local' },
    update: { passwordHash: adminPasswordHash, role: Role.ADMIN, isActive: true },
    create: {
      email: 'admin@telebill.local',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log(`👤 Admin account seeded: ${adminUser.email} (ID: ${adminUser.id})`);

  const staffUser = await prisma.user.upsert({
    where: { email: 'operator@telebill.local' },
    update: { passwordHash: staffPasswordHash, role: Role.STAFF, isActive: true },
    create: {
      email: 'operator@telebill.local',
      passwordHash: staffPasswordHash,
      role: Role.STAFF,
      isActive: true,
    },
  });
  console.log(`👤 Staff operator account seeded: ${staffUser.email} (ID: ${staffUser.id})`);

  const primaryCustomerUser = await prisma.user.upsert({
    where: { email: 'customer@telebill.local' },
    update: { passwordHash: customerPasswordHash, role: Role.CUSTOMER, isActive: true },
    create: {
      email: 'customer@telebill.local',
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
      isActive: true,
    },
  });
  console.log(`👤 Customer account seeded: ${primaryCustomerUser.email} (ID: ${primaryCustomerUser.id})`);

  const prepaidCustomerUser = await prisma.user.upsert({
    where: { email: 'prepaid.user@telebill.local' },
    update: { passwordHash: customerPasswordHash, role: Role.CUSTOMER, isActive: true },
    create: {
      email: 'prepaid.user@telebill.local',
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
      isActive: true,
    },
  });

  const enterpriseCustomerUser = await prisma.user.upsert({
    where: { email: 'enterprise.user@telebill.local' },
    update: { passwordHash: customerPasswordHash, role: Role.CUSTOMER, isActive: true },
    create: {
      email: 'enterprise.user@telebill.local',
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
      isActive: true,
    },
  });

  // 4. Seed Configurable Tariff Plans
  console.log('📦 Seeding standard telecom tariff plans...');

  const postpaidStdPlan = await prisma.tariffPlan.upsert({
    where: { planCode: 'POST-STD-299' },
    update: {},
    create: {
      planCode: 'POST-STD-299',
      name: 'Postpaid Standard 299',
      type: PlanType.POSTPAID,
      description: 'Ideal everyday postpaid plan with 500 local minutes and 200 STD minutes included.',
      monthlyRental: '299.00',
      pulseSeconds: 60,
      validityDays: null, // Monthly cycle
      rateLocal: '0.5000',
      rateStd: '0.8000',
      rateIsd: '9.5000',
      includedLocalMinutes: 500,
      includedStdMinutes: 200,
      includedIsdMinutes: 0,
      connectionCharge: '0.0000',
      isActive: true,
    },
  });
  console.log(`📋 Plan seeded: ${postpaidStdPlan.name} [${postpaidStdPlan.planCode}]`);

  const prepaidValPlan = await prisma.tariffPlan.upsert({
    where: { planCode: 'PRE-VAL-199' },
    update: { rateLocal: '1.0000' },
    create: {
      planCode: 'PRE-VAL-199',
      name: 'Prepaid Value 199',
      type: PlanType.PREPAID,
      description: '28-day validity prepaid recharge with 300 local minutes and balance deduction.',
      monthlyRental: '199.00',
      pulseSeconds: 60,
      validityDays: 28,
      rateLocal: '1.0000',
      rateStd: '1.0000',
      rateIsd: '12.0000',
      includedLocalMinutes: 300,
      includedStdMinutes: 100,
      includedIsdMinutes: 0,
      connectionCharge: '0.0000',
      isActive: true,
    },
  });
  console.log(`📋 Plan seeded: ${prepaidValPlan.name} [${prepaidValPlan.planCode}]`);

  const enterprisePlan = await prisma.tariffPlan.upsert({
    where: { planCode: 'POST-ENT-999' },
    update: {},
    create: {
      planCode: 'POST-ENT-999',
      name: 'Enterprise Unlimited 999',
      type: PlanType.POSTPAID,
      description: 'Corporate executive plan with per-second billing, 3000 local, 1500 STD, and 100 ISD minutes.',
      monthlyRental: '999.00',
      pulseSeconds: 1, // 1-second pulse rating!
      validityDays: null,
      rateLocal: '0.2500',
      rateStd: '0.4500',
      rateIsd: '6.5000',
      includedLocalMinutes: 3000,
      includedStdMinutes: 1500,
      includedIsdMinutes: 100,
      connectionCharge: '0.0000',
      isActive: true,
    },
  });
  console.log(`📋 Plan seeded: ${enterprisePlan.name} [${enterprisePlan.planCode}]`);

  // 5. Seed Customer Profiles Linked to Users and Plans
  console.log('👥 Seeding customer profiles and free allowance buckets...');

  const primaryCustomer = await prisma.customer.upsert({
    where: { accountNumber: 'TEL-202611-00001' },
    update: {
      tariffPlanId: postpaidStdPlan.id,
      userId: primaryCustomerUser.id,
      phone: '+919876543210',
      status: CustomerStatus.ACTIVE,
      prepaidBalance: '0.00',
    },
    create: {
      userId: primaryCustomerUser.id,
      accountNumber: 'TEL-202611-00001',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      phone: '+919876543210',
      address: 'Flat 402, Green Glen Layout, Outer Ring Road, Bellandur',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560103',
      status: CustomerStatus.ACTIVE,
      prepaidBalance: '0.00',
      creditLimit: '5000.00',
      tariffPlanId: postpaidStdPlan.id,
    },
  });

  await prisma.freeAllowanceBucket.upsert({
    where: {
      customerId_tariffPlanId: {
        customerId: primaryCustomer.id,
        tariffPlanId: postpaidStdPlan.id,
      },
    },
    update: {
      localMinutesRemaining: '500.0000',
      stdMinutesRemaining: '200.0000',
      isdMinutesRemaining: '0.0000',
    },
    create: {
      customerId: primaryCustomer.id,
      tariffPlanId: postpaidStdPlan.id,
      localMinutesRemaining: '500.0000',
      stdMinutesRemaining: '200.0000',
      isdMinutesRemaining: '0.0000',
      resetDate: new Date('2026-12-01T00:00:00.000Z'),
    },
  });

  const prepaidCustomer = await prisma.customer.upsert({
    where: { accountNumber: 'TEL-202611-00002' },
    update: {
      tariffPlanId: prepaidValPlan.id,
      userId: prepaidCustomerUser.id,
      phone: '+919876543220',
      status: CustomerStatus.ACTIVE,
      prepaidBalance: '350.00',
    },
    create: {
      userId: prepaidCustomerUser.id,
      accountNumber: 'TEL-202611-00002',
      firstName: 'Priya',
      lastName: 'Nair',
      phone: '+919876543220',
      address: '12/A, Sea View Apartments, Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400020',
      status: CustomerStatus.ACTIVE,
      prepaidBalance: '350.00', // Active prepaid wallet balance
      creditLimit: '0.00',
      tariffPlanId: prepaidValPlan.id,
    },
  });

  await prisma.freeAllowanceBucket.upsert({
    where: {
      customerId_tariffPlanId: {
        customerId: prepaidCustomer.id,
        tariffPlanId: prepaidValPlan.id,
      },
    },
    update: {
      localMinutesRemaining: '300.0000',
      stdMinutesRemaining: '100.0000',
      isdMinutesRemaining: '0.0000',
    },
    create: {
      customerId: prepaidCustomer.id,
      tariffPlanId: prepaidValPlan.id,
      localMinutesRemaining: '300.0000',
      stdMinutesRemaining: '100.0000',
      isdMinutesRemaining: '0.0000',
      resetDate: new Date('2026-11-28T00:00:00.000Z'),
    },
  });

  const enterpriseCustomer = await prisma.customer.upsert({
    where: { accountNumber: 'TEL-202611-00003' },
    update: {
      tariffPlanId: enterprisePlan.id,
      userId: enterpriseCustomerUser.id,
      phone: '+919876543230',
      status: CustomerStatus.ACTIVE,
      prepaidBalance: '0.00',
    },
    create: {
      userId: enterpriseCustomerUser.id,
      accountNumber: 'TEL-202611-00003',
      firstName: 'Vikram',
      lastName: 'Mehta',
      phone: '+919876543230',
      address: 'Suite 900, Cyber Towers, HITEC City',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500081',
      status: CustomerStatus.ACTIVE,
      prepaidBalance: '0.00',
      creditLimit: '15000.00',
      tariffPlanId: enterprisePlan.id,
    },
  });

  await prisma.freeAllowanceBucket.upsert({
    where: {
      customerId_tariffPlanId: {
        customerId: enterpriseCustomer.id,
        tariffPlanId: enterprisePlan.id,
      },
    },
    update: {
      localMinutesRemaining: '2800.0000',
      stdMinutesRemaining: '1400.0000',
      isdMinutesRemaining: '90.0000',
    },
    create: {
      customerId: enterpriseCustomer.id,
      tariffPlanId: enterprisePlan.id,
      localMinutesRemaining: '2800.0000',
      stdMinutesRemaining: '1400.0000',
      isdMinutesRemaining: '90.0000',
      resetDate: new Date('2026-12-01T00:00:00.000Z'),
    },
  });

  // 6. Record Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SYSTEM_SEED',
      entity: 'Database',
      entityId: 'init',
      details: JSON.stringify({
        message: 'TeleBill Pro database successfully initialized with demo users, tariff plans, and customer profiles.',
        timestamp: new Date().toISOString(),
      }),
      ipAddress: '127.0.0.1',
    },
  });

  console.log('✅ Seeding complete: 5 users, 3 tariff plans, 3 customer profiles, 3 allowance buckets, and 1 audit log created.');
}

main()
  .catch((e) => {
    console.error('❌ Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
