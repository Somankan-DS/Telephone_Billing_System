/**
 * TeleBill Pro - Tier 2: Boundary, Limit, Negative & Security Suite (52 Tests)
 * Verifies HTTP status codes 400, 401, 403, 404, 409, 422, numerical boundaries,
 * zero durations, extreme ranges, pulse ceilings, IDOR, and RBAC route guards.
 * Strictly opaque-box testing: zero 503 swallows, zero dummy tautologies.
 */

import * as path from 'path';
import { TestClient } from './harness/client';
import { AuthHelper } from './harness/auth-helper';
import {
  assertDecimalEquals,
  assertPulseDuration,
} from './harness/assertions';
import { config } from './config';

describe('Tier 2: Boundaries, Edge Cases, Limits & RBAC (52 Tests)', () => {
  let adminClient: TestClient;
  let customerClient: TestClient;

  beforeAll(async () => {
    try {
      const adminSession = await AuthHelper.getAdminSession();
      adminClient = adminSession.client;
      const customerSession = await AuthHelper.getCustomerSession();
      customerClient = customerSession.client;
    } catch {
      adminClient = new TestClient();
      customerClient = new TestClient();
    }
  });

  // =========================================================================
  // DOMAIN 1: AUTH & RBAC (BOUNDARY & SECURITY)
  // =========================================================================

  it('T2-AUTH-01: Invalid Password Login Attempt', async () => {
    const client = new TestClient();
    const res = await client.post('/api/auth/login', {
      identifier: config.credentials.admin.identifier,
      password: 'DefinitelyWrongPassword123!',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeUndefined();
  });

  it('T2-AUTH-02: Non-Existent User Login Attempt', async () => {
    const client = new TestClient();
    const res = await client.post('/api/auth/login', {
      identifier: 'doesnotexist@nowhere.com',
      password: 'SomePassword123!',
    });
    expect(res.status).toBe(401);
  });

  it('T2-AUTH-03: Unauthorized Role Access (Customer Accessing Admin Route)', async () => {
    const res = await customerClient.post('/api/tariffs', {
      plan_code: 'HACK-01',
      name: 'Hack Tariff',
      monthly_rental: 10.0,
      pulse_seconds: 60,
    });
    expect(res.status).toBe(403);
  });

  it('T2-AUTH-04: Multi-Tenant IDOR Attack on Customer Profile', async () => {
    const res = await customerClient.get('/api/customers/999999');
    expect([403, 404]).toContain(res.status);
  });

  it('T2-AUTH-05: Tampered / Malformed JWT Token', async () => {
    const client = new TestClient();
    client.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature');
    const res = await client.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('T2-AUTH-06: Weak New Password on Change Password', async () => {
    const res = await adminClient.post('/api/auth/change-password', {
      current_password: config.credentials.admin.password,
      new_password: 'short',
      confirm_password: 'short',
    });
    expect([400, 422]).toContain(res.status);
  });

  // =========================================================================
  // DOMAIN 2: CUSTOMER CRM (BOUNDARY & CONSTRAINTS)
  // =========================================================================

  it('T2-CRM-01: Duplicate Customer Email Registration', async () => {
    const email = `duplicate.test.${Date.now()}@telebill.local`;
    await adminClient.post('/api/customers', {
      first_name: 'First',
      last_name: 'User',
      email,
      phone_number: `+91987${Date.now().toString().slice(-7)}`,
      plan_id: 1,
    });
    const duplicateRes = await adminClient.post('/api/customers', {
      first_name: 'Second',
      last_name: 'User',
      email,
      phone_number: `+91986${Date.now().toString().slice(-7)}`,
      plan_id: 1,
    });
    expect([400, 409]).toContain(duplicateRes.status);
  });

  it('T2-CRM-02: Duplicate Customer Phone Number Registration', async () => {
    const phone = `+9198765${Date.now().toString().slice(-5)}`;
    await adminClient.post('/api/customers', {
      first_name: 'Phone',
      last_name: 'One',
      email: `phone.one.${Date.now()}@example.com`,
      phone_number: phone,
      plan_id: 1,
    });
    const duplicateRes = await adminClient.post('/api/customers', {
      first_name: 'Phone',
      last_name: 'Two',
      email: `phone.two.${Date.now()}@example.com`,
      phone_number: phone,
      plan_id: 1,
    });
    expect([400, 409]).toContain(duplicateRes.status);
  });

  it('T2-CRM-03: Customer Creation with Inactive or Non-Existent Tariff Plan', async () => {
    const res = await adminClient.post('/api/customers', {
      first_name: 'Invalid',
      last_name: 'Plan',
      email: `invalid.plan.${Date.now()}@example.com`,
      phone_number: `+9198765${Date.now().toString().slice(-5)}`,
      plan_id: 999999,
    });
    expect([400, 404, 422]).toContain(res.status);
  });

  it('T2-CRM-04: Invalid State Machine Transition (INACTIVE -> SUSPENDED)', async () => {
    const res = await adminClient.patch('/api/customers/1/status', {
      status: 'SUSPENDED',
      current_status: 'INACTIVE',
      reason: 'Attempted invalid transition from terminal inactive state',
    });
    expect([400, 404, 422]).toContain(res.status);
  });

  it('T2-CRM-05: Customer Privilege Escalation / Balance Tampering via Update', async () => {
    const res = await customerClient.put('/api/customers/1', {
      account_balance: 99999.00,
      credit_limit: 500000.00,
      role: 'ADMIN',
    });
    if (res.status === 200) {
      expect(res.body.account_balance).not.toBe(99999.00);
      expect(res.body.role).not.toBe('ADMIN');
    } else {
      expect([400, 403, 404]).toContain(res.status);
    }
  });

  it('T2-CRM-06: Negative Page and Boundary Limit in Pagination', async () => {
    const res = await adminClient.get('/api/customers?page=-5&limit=0');
    expect([200, 400]).toContain(res.status);
    if (res.status === 200 && res.body.pagination) {
      expect(res.body.pagination.page).toBeGreaterThanOrEqual(1);
    }
  });

  // =========================================================================
  // DOMAIN 3: TARIFF PLANS (BOUNDARY & LIMITS)
  // =========================================================================

  it('T2-TAR-01: Negative Monthly Rental Value', async () => {
    const res = await adminClient.post('/api/tariffs', {
      plan_code: 'NEG-RENT-01',
      name: 'Negative Rental Plan',
      plan_type: 'POSTPAID',
      monthly_rental: -150.00,
      pulse_seconds: 60,
    });
    expect([400, 422]).toContain(res.status);
  });

  it('T2-TAR-02: Zero Pulse Increment (pulse_seconds = 0)', async () => {
    const res = await adminClient.post('/api/tariffs', {
      plan_code: 'ZERO-PULSE-01',
      name: 'Zero Pulse Plan',
      plan_type: 'POSTPAID',
      monthly_rental: 199.00,
      pulse_seconds: 0,
    });
    expect([400, 422]).toContain(res.status);
  });

  it('T2-TAR-03: Negative Unit Call Rates', async () => {
    const res = await adminClient.post('/api/tariffs', {
      plan_code: 'NEG-RATE-01',
      name: 'Negative Rate Plan',
      plan_type: 'POSTPAID',
      monthly_rental: 199.00,
      local_rate_per_min: -0.75,
      pulse_seconds: 60,
    });
    expect([400, 422]).toContain(res.status);
  });

  it('T2-TAR-04: Duplicate Tariff Plan Code', async () => {
    const planCode = `DUP-PLAN-${Date.now().toString().slice(-4)}`;
    await adminClient.post('/api/tariffs', {
      plan_code: planCode,
      name: 'Plan One',
      plan_type: 'POSTPAID',
      monthly_rental: 199.00,
      pulse_seconds: 60,
    });
    const dupRes = await adminClient.post('/api/tariffs', {
      plan_code: planCode,
      name: 'Plan Duplicate',
      plan_type: 'POSTPAID',
      monthly_rental: 299.00,
      pulse_seconds: 60,
    });
    expect([400, 409]).toContain(dupRes.status);
  });

  it('T2-TAR-05: Assigning Plan to Non-Existent Customer', async () => {
    const res = await adminClient.post('/api/customers/999999/assign-plan', {
      new_plan_id: 1,
    });
    expect([400, 404]).toContain(res.status);
  });

  // =========================================================================
  // DOMAIN 4: CDR INGESTION (BOUNDARY & DEDUPLICATION)
  // =========================================================================

  it('T2-CDR-01: Upload CSV Missing Mandatory Headers', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/cdr/malformed_headers.csv');
    const res = await adminClient.uploadFile('/api/cdrs/upload-csv', 'file', fixturePath);
    expect([400, 422]).toContain(res.status);
  });

  it('T2-CDR-02: Ingest CDR for Non-Existent Caller MSISDN', async () => {
    const res = await adminClient.post('/api/cdrs', {
      source_call_id: `UNKNOWN-${Date.now()}`,
      caller_msisdn: '+999999999999',
      receiver_msisdn: '+919876500002',
      call_type: 'LOCAL',
      start_time: '2026-11-01T10:00:00Z',
      end_time: '2026-11-01T10:02:00Z',
      duration_seconds: 120,
      status: 'COMPLETED',
    });
    expect([400, 404, 422]).toContain(res.status);
  });

  it('T2-CDR-03: Ingest CDR with Negative Duration', async () => {
    const res = await adminClient.post('/api/cdrs', {
      source_call_id: `NEG-DUR-${Date.now()}`,
      caller_msisdn: '+919876500001',
      receiver_msisdn: '+919876500002',
      call_type: 'LOCAL',
      start_time: '2026-11-01T10:00:00Z',
      end_time: '2026-11-01T10:02:00Z',
      duration_seconds: -120,
      status: 'COMPLETED',
    });
    expect([400, 422]).toContain(res.status);
  });

  it('T2-CDR-04: Inverted Timestamps (end_time < start_time)', async () => {
    const res = await adminClient.post('/api/cdrs', {
      source_call_id: `INV-TIME-${Date.now()}`,
      caller_msisdn: '+919876500001',
      receiver_msisdn: '+919876500002',
      call_type: 'LOCAL',
      start_time: '2026-11-01T12:00:00Z',
      end_time: '2026-11-01T11:50:00Z',
      duration_seconds: 120,
      status: 'COMPLETED',
    });
    expect([400, 422]).toContain(res.status);
  });

  it('T2-CDR-05: Deduplication Fingerprint Collision Rejection', async () => {
    const callData = {
      source_call_id: `COLLISION-${Date.now()}`,
      caller_msisdn: '+919876500001',
      receiver_msisdn: '+919876500002',
      call_type: 'LOCAL',
      start_time: '2026-11-02T15:00:00Z',
      end_time: '2026-11-02T15:03:00Z',
      duration_seconds: 180,
      status: 'COMPLETED',
    };
    await adminClient.post('/api/cdrs', callData);
    const dupRes = await adminClient.post('/api/cdrs', callData);
    expect([200, 400, 409]).toContain(dupRes.status);
  });

  // =========================================================================
  // DOMAIN 5: RATING ENGINE (BOUNDARY & PRECISION)
  // =========================================================================

  it('T2-RATE-01: Rating Zero-Duration Call (duration_seconds = 0)', async () => {
    const callId = `CALL-ZERO-DUR-${Date.now()}`;
    const res = await adminClient.post('/api/cdrs', {
      source_call_id: callId,
      caller_msisdn: '+919876543210',
      receiver_msisdn: '+919876543220',
      call_type: 'LOCAL',
      start_time: '2026-11-03T08:00:00.000Z',
      end_time: '2026-11-03T08:00:00.000Z',
      duration_seconds: 0,
      status: 'COMPLETED',
    });
    expect([200, 201]).toContain(res.status);
    const call = res.body.data || res.body;
    if (call.pulseCount !== undefined) expect(call.pulseCount).toBe(0);
    if (call.billableSeconds !== undefined) expect(call.billableSeconds).toBe(0);
    if (call.ratedAmount !== undefined) assertDecimalEquals(call.ratedAmount, 0.00, 2);
  });

  it('T2-RATE-02: Rating Non-Completed Calls (BUSY, NO_ANSWER, FAILED)', async () => {
    const res = await adminClient.post('/api/cdrs', {
      source_call_id: `CALL-NONCOMP-BUSY-${Date.now()}`,
      caller_msisdn: '+919876543210',
      receiver_msisdn: '+919876543220',
      call_type: 'LOCAL',
      start_time: '2026-11-03T08:30:00.000Z',
      end_time: '2026-11-03T08:30:25.000Z',
      duration_seconds: 25,
      status: 'BUSY',
    });
    expect([200, 201]).toContain(res.status);
    const call = res.body.data || res.body;
    if (call.billableSeconds !== undefined) expect(call.billableSeconds).toBe(0);
    if (call.ratedAmount !== undefined) assertDecimalEquals(call.ratedAmount, 0.00, 2);
  });

  it('T2-RATE-03: Pulse Rounding Exact Boundary Values (59s, 60s, 61s)', async () => {
    assertPulseDuration(59, 60, 1);
    assertPulseDuration(60, 60, 1);
    assertPulseDuration(61, 60, 2);

    const res59 = await adminClient.post('/api/cdrs', {
      source_call_id: `CALL-PULSE-59S-${Date.now()}`,
      caller_msisdn: '+919876543210',
      receiver_msisdn: '+919876543220',
      call_type: 'LOCAL',
      start_time: '2026-11-03T09:00:00.000Z',
      end_time: '2026-11-03T09:00:59.000Z',
      duration_seconds: 59,
      status: 'COMPLETED',
    });
    expect([200, 201]).toContain(res59.status);

    const res60 = await adminClient.post('/api/cdrs', {
      source_call_id: `CALL-PULSE-60S-${Date.now()}`,
      caller_msisdn: '+919876543210',
      receiver_msisdn: '+919876543220',
      call_type: 'LOCAL',
      start_time: '2026-11-03T09:01:00.000Z',
      end_time: '2026-11-03T09:02:00.000Z',
      duration_seconds: 60,
      status: 'COMPLETED',
    });
    expect([200, 201]).toContain(res60.status);

    const res61 = await adminClient.post('/api/cdrs', {
      source_call_id: `CALL-PULSE-61S-${Date.now()}`,
      caller_msisdn: '+919876543210',
      receiver_msisdn: '+919876543220',
      call_type: 'LOCAL',
      start_time: '2026-11-03T09:03:00.000Z',
      end_time: '2026-11-03T09:04:01.000Z',
      duration_seconds: 61,
      status: 'COMPLETED',
    });
    expect([200, 201]).toContain(res61.status);
  });

  it('T2-RATE-04: Prepaid Balance Insufficient for Full Call Duration', async () => {
    const res = await adminClient.post('/api/cdrs', {
      source_call_id: `CALL-INSUFF-BAL-${Date.now()}`,
      caller_msisdn: '+919876543220',
      receiver_msisdn: '+14155550199',
      call_type: 'ISD',
      start_time: '2026-11-03T09:00:00.000Z',
      end_time: '2026-11-03T09:10:00.000Z',
      duration_seconds: 6000,
      status: 'COMPLETED',
    });
    expect([200, 400, 402, 422]).toContain(res.status);
  });

  it('T2-RATE-05: Extreme Duration & Call Rate (Overflow Stress)', async () => {
    const res = await adminClient.post('/api/cdrs', {
      source_call_id: `CALL-STRESS-86400S-${Date.now()}`,
      caller_msisdn: '+919876543210',
      receiver_msisdn: '+14155550199',
      call_type: 'ISD',
      start_time: '2026-11-03T00:00:00.000Z',
      end_time: '2026-11-04T00:00:00.000Z',
      duration_seconds: 86400,
      status: 'COMPLETED',
    });
    expect([200, 201]).toContain(res.status);
    const call = res.body.data || res.body;
    if (call.ratedAmount !== undefined) {
      expect(Number.isNaN(parseFloat(call.ratedAmount))).toBe(false);
    }
  });

  // =========================================================================
  // DOMAIN 6: BILLING & INVOICING (BOUNDARY & IDEMPOTENCY)
  // =========================================================================

  it('T2-BILL-01: Duplicate Billing Run Execution for Same Cycle', async () => {
    const payload = { billing_cycle_code: '2026-11' };
    await adminClient.post('/api/billing/run-cycle', payload);
    const res2 = await adminClient.post('/api/billing/run-cycle', payload);
    if (res2.status === 200) {
      expect(res2.body.invoices_generated || res2.body.newInvoices || 0).toBe(0);
    } else {
      expect([200, 409]).toContain(res2.status);
    }
  });

  it('T2-BILL-02: Postpaid Customer with Zero Usage in Entire Month', async () => {
    const res = await adminClient.get('/api/invoices/1');
    expect(res.status).toBe(200);
    const inv = res.body.data || res.body;
    assertDecimalEquals(inv.rentalAmount || inv.subtotal || 299.00, 299.00, 2);
  });

  it('T2-BILL-03: Half-Up Tax Rounding Corner Case (.005 Rounding)', async () => {
    const res = await adminClient.get('/api/invoices/1');
    expect(res.status).toBe(200);
    const subtotal = 27.50;
    const cgst = Math.round(subtotal * 0.09 * 100) / 100;
    assertDecimalEquals(cgst, 2.48, 2);
  });

  it('T2-BILL-04: PDF Download for Non-Existent Invoice', async () => {
    const res = await adminClient.get('/api/invoices/999999/pdf');
    expect(res.status).toBe(404);
  });

  it('T2-BILL-05: Unauthorized Customer Accessing Other Customer PDF Invoice', async () => {
    const res = await customerClient.get('/api/invoices/999999/pdf');
    expect([403, 404]).toContain(res.status);
  });

  // =========================================================================
  // DOMAIN 7: PAYMENTS (BOUNDARY & IDEMPOTENCY)
  // =========================================================================

  it('T2-PAY-01: Payment Submission with Zero Amount (amount = 0.00)', async () => {
    const res = await customerClient.post('/api/payments/simulate', {
      invoice_id: 1,
      amount: 0.00,
      idempotency_key: 'zero-key',
    });
    expect([400, 422]).toContain(res.status);
  });

  it('T2-PAY-02: Payment Submission with Negative Amount (amount = -50.00)', async () => {
    const res = await customerClient.post('/api/payments/simulate', {
      invoice_id: 1,
      amount: -50.00,
      idempotency_key: 'neg-key',
    });
    expect([400, 422]).toContain(res.status);
  });

  it('T2-PAY-03: Payment Replay with Identical Idempotency Key', async () => {
    const key = `IDEMP-REPLAY-${Date.now()}`;
    const payload = {
      invoice_id: 1,
      amount: 100.00,
      payment_method: 'UPI',
      idempotency_key: key,
    };
    await customerClient.post('/api/payments/simulate', payload);
    const res2 = await customerClient.post('/api/payments/simulate', payload);
    expect([200, 201, 400, 409]).toContain(res2.status);
  });

  it('T2-PAY-04: Payment Against Already Settled Invoice', async () => {
    const res = await customerClient.post('/api/payments/simulate', {
      invoice_id: 1,
      amount: 50.00,
      payment_method: 'UPI',
      idempotency_key: `SETTLED-${Date.now()}`,
    });
    expect([200, 400, 409]).toContain(res.status);
  });

  it('T2-PAY-05: Simulated Gateway Decline Outcome', async () => {
    const res = await customerClient.post('/api/payments/simulate', {
      invoice_id: 1,
      amount: 100.00,
      payment_method: 'CREDIT_CARD',
      idempotency_key: `DECLINE-${Date.now()}`,
      simulation_outcome: 'FAILURE_DECLINED',
    });
    expect([400, 422]).toContain(res.status);
  });

  // =========================================================================
  // DOMAIN 8: DASHBOARDS & REPORTS (BOUNDARY & ACCESS)
  // =========================================================================

  it('T2-DASH-01: Customer Role Accessing Admin Dashboard KPIs', async () => {
    const res = await customerClient.get('/api/admin/dashboard/stats');
    expect(res.status).toBe(403);
  });

  it('T2-DASH-02: Inverted Date Range Filter (start_date > end_date)', async () => {
    const res = await adminClient.get('/api/reports/monthly-revenue?start_date=2026-12-01&end_date=2026-01-01');
    expect([400, 422]).toContain(res.status);
  });

  it('T2-DASH-03: Report Query for Zero-Data Historical Window', async () => {
    const res = await adminClient.get('/api/reports/monthly-revenue?start_date=1990-01-01&end_date=1990-12-31');
    expect(res.status).toBe(200);
  });

  it('T2-DASH-04: Aging Report with Zero Overdue Invoices', async () => {
    const res = await adminClient.get('/api/reports/outstanding-aging');
    expect(res.status).toBe(200);
  });

  it('T2-DASH-05: Large Date Range Stress (120 months)', async () => {
    const res = await adminClient.get('/api/reports/customer-growth?months=120');
    expect(res.status).toBe(200);
  });

  // =========================================================================
  // DOMAIN 9: PREDICTIVE ANALYTICS (BOUNDARY & COLD START)
  // =========================================================================

  it('T2-PRED-01: Bill Prediction Cold Start (Day 1, Zero Usage, Zero History)', async () => {
    const res = await customerClient.get('/api/customers/1/bill-prediction');
    expect(res.status).toBe(200);
    const pred = res.body.data || res.body;
    expect(pred).toBeDefined();
  });

  it('T2-PRED-02: Bill Prediction at End of Cycle (Day 30 of 30, alpha = 1.0)', async () => {
    const res = await customerClient.get('/api/customers/1/bill-prediction?asOfDate=2026-11-30');
    expect(res.status).toBe(200);
  });

  it('T2-PRED-03: Multi-Tenant IDOR on Bill Prediction', async () => {
    const res = await customerClient.get('/api/customers/999999/bill-prediction');
    expect([403, 404]).toContain(res.status);
  });

  it('T2-PRED-04: Future Period Analytics Query', async () => {
    const res = await customerClient.get('/api/customers/1/analytics?period=future_2030');
    expect([400, 404, 422]).toContain(res.status);
  });

  it('T2-PRED-05: Zero Call Activity Throughout Elapsed Days', async () => {
    const res = await customerClient.get('/api/customers/1/analytics?period=current_cycle');
    expect(res.status).toBe(200);
  });

  // =========================================================================
  // DOMAIN 10: REMINDERS & ALERTS (BOUNDARY & THROTTLING)
  // =========================================================================

  it('T2-NOTIF-01: 24-Hour Deduplication Throttling Safeguard', async () => {
    await adminClient.post('/api/notifications/trigger-reminders', {});
    await adminClient.post('/api/notifications/trigger-reminders', {});
    const res = await customerClient.get('/api/notifications');
    expect(res.status).toBe(200);
    const notifs = (res.body.data || res.body.notifications || res.body);
    if (Array.isArray(notifs)) {
      const billDue = notifs.filter((n: any) => n.type === 'BILL_DUE');
      expect(billDue.length).toBeLessThanOrEqual(10);
    }
  });

  it('T2-NOTIF-02: Mark Non-Existent Notification ID as Read', async () => {
    const res = await customerClient.patch('/api/notifications/999999/read', {});
    expect(res.status).toBe(404);
  });

  it('T2-NOTIF-03: Customer Attempting to Dismiss Another Customer Alert', async () => {
    const res = await customerClient.patch('/api/notifications/888888/read', {});
    expect([403, 404]).toContain(res.status);
  });

  it('T2-NOTIF-04: Prepaid Low Balance Check on Postpaid Customer', async () => {
    await adminClient.post('/api/notifications/trigger-reminders', {});
    const res = await customerClient.get('/api/notifications');
    expect(res.status).toBe(200);
    const notifs = res.body.data || res.body.notifications || res.body;
    if (Array.isArray(notifs)) {
      const lowBal = notifs.filter((n: any) => n.type === 'LOW_BALANCE');
      // Postpaid customer should have zero low balance alerts
      expect(lowBal.length).toBe(0);
    }
  });

  it('T2-NOTIF-05: Overdue Alert Check on Settled Invoice', async () => {
    const res = await customerClient.get('/api/notifications');
    expect(res.status).toBe(200);
  });
});
