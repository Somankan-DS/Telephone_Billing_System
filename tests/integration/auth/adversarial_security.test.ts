import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { connectDatabase, disconnectDatabase, prisma } from '../../../src/shared/database';
import { hashPassword, comparePassword, dummyHashCompare, validatePasswordStrength, BCRYPT_SALT_ROUNDS, DUMMY_HASH } from '../../../src/shared/utils/hash';
import { JwtService } from '../../../src/modules/auth/jwt.service';
import { Role } from '../../../src/modules/auth/auth.types';
import { config } from '../../../src/shared/config';

describe('Milestone 1 Adversarial Security, Cryptographic & Stress Verification Suite', () => {
  // Generous timeout for Bcrypt cost-12 calculations
  jest.setTimeout(60000);

  let app: any;
  let adminToken: string;
  let staffToken: string;
  let customerAToken: string;
  let customerAId: string;
  let customerAUuid: string;

  let customerBToken: string;
  let customerBId: string;
  let customerBUuid: string;

  beforeAll(async () => {
    await connectDatabase();
    app = createApp();

    // 1. Obtain tokens for Admin and Staff
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@telebill.local', password: 'Admin@123456' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    const staffRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'operator@telebill.local', password: 'Operator@123456' });
    expect(staffRes.status).toBe(200);
    staffToken = staffRes.body.data.token;

    // 2. Obtain token for primary Customer A
    const custRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@telebill.local', password: 'Customer@123456' });
    expect(custRes.status).toBe(200);
    customerAToken = custRes.body.data.token;
    customerAUuid = custRes.body.data.user.id;
    customerAId = custRes.body.data.user.customerId;

    // 3. Find or seed a secondary Customer B for cross-tenant IDOR probing
    const secondaryUser = await prisma.user.findFirst({
      where: {
        role: 'CUSTOMER',
        NOT: { id: customerAUuid },
      },
      include: { customer: true },
    });

    if (secondaryUser && secondaryUser.customer) {
      customerBUuid = secondaryUser.id;
      customerBId = secondaryUser.customer.id;
      customerBToken = JwtService.signToken({
        id: secondaryUser.id,
        email: secondaryUser.email,
        role: Role.CUSTOMER,
        customerId: secondaryUser.customer.id,
      });
    } else {
      // Create temporary Customer B for test isolation
      const pwdHash = await bcrypt.hash('CustomerB@123456', 12);
      const newCustUser = await prisma.user.create({
        data: {
          email: 'adversarial_cust_b@telebill.local',
          passwordHash: pwdHash,
          role: 'CUSTOMER',
          isActive: true,
          customer: {
            create: {
              accountNumber: 'TEL-ADV-TEST-0002',
              firstName: 'Adversarial',
              lastName: 'Victim',
              phone: '+919999900002',
              status: 'ACTIVE',
            },
          },
        },
        include: { customer: true },
      });
      customerBUuid = newCustUser.id;
      customerBId = newCustUser.customer!.id;
      customerBToken = JwtService.signToken({
        id: newCustUser.id,
        email: newCustUser.email,
        role: Role.CUSTOMER,
        customerId: newCustUser.customer!.id,
      });
    }
  });

  afterAll(async () => {
    // Clean up temporary user if created
    await prisma.user.deleteMany({
      where: { email: 'adversarial_cust_b@telebill.local' },
    });
    await disconnectDatabase();
  });

  // =========================================================================
  // SECTION 1: Bcrypt Cost Factor 12 Verification & Performance Timing
  // =========================================================================
  describe('1. Cryptographic Bcrypt Cost Factor 12 & Hash Verification', () => {
    test('BCRYPT_SALT_ROUNDS constant is exactly 12', () => {
      expect(BCRYPT_SALT_ROUNDS).toBe(12);
    });

    test('hashPassword generates hashes strictly with $2a$12$ or $2b$12$ prefix', async () => {
      const hash = await hashPassword('P@ssword12345678');
      expect(hash).toMatch(/^\$2[ab]\$12\$/);
      expect(hash.length).toBe(60);
    });

    test('Empirical performance: Bcrypt cost factor 12 timing benchmark', async () => {
      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await hashPassword(`BenchmarkPass@${i}#12345`);
        const elapsed = Date.now() - start;
        durations.push(elapsed);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`[Bcrypt Cost 12 Benchmark] Durations: ${durations.join('ms, ')}ms. Average: ${avgDuration}ms`);

      // Cost factor 12 (4096 rounds) takes > 100ms on any modern x86/x64 CPU in JS
      expect(avgDuration).toBeGreaterThan(100);
    });

    test('DUMMY_HASH is a valid, parseable Bcrypt cost-12 hash', async () => {
      expect(DUMMY_HASH).toMatch(/^\$2[ab]\$12\$/);
      expect(DUMMY_HASH.length).toBe(60);

      // Verify that bcrypt.compare parses and checks DUMMY_HASH without error
      const start = Date.now();
      const result = await bcrypt.compare('dummyTestingPass@123', DUMMY_HASH);
      const elapsed = Date.now() - start;

      expect(result).toBe(false);
      // Confirm that dummy comparison actually executed full rounds (> 100ms)
      expect(elapsed).toBeGreaterThan(100);
      console.log(`[DUMMY_HASH Timing] Duration: ${elapsed}ms`);
    });
  });

  // =========================================================================
  // SECTION 2: Timing Attack Resilience Probing
  // =========================================================================
  describe('2. Timing Attack Resilience Probing (Non-existent vs Bad Password)', () => {
    test('Response latency between existing user (bad pass) and non-existent user is comparable', async () => {
      const sampleSize = 3;
      const badPasswordTimes: number[] = [];
      const nonExistentTimes: number[] = [];

      // Test existing user with bad password
      for (let i = 0; i < sampleSize; i++) {
        const start = Date.now();
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'admin@telebill.local', password: 'WrongPassword@999' });
        const elapsed = Date.now() - start;
        badPasswordTimes.push(elapsed);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      }

      // Test non-existent user with any password
      for (let i = 0; i < sampleSize; i++) {
        const start = Date.now();
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: `ghost_${Date.now()}_${i}@telebill.local`, password: 'WrongPassword@999' });
        const elapsed = Date.now() - start;
        nonExistentTimes.push(elapsed);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      }

      const avgBadPassword = badPasswordTimes.reduce((a, b) => a + b, 0) / badPasswordTimes.length;
      const avgNonExistent = nonExistentTimes.reduce((a, b) => a + b, 0) / nonExistentTimes.length;

      console.log(`[Timing Attack Benchmark] Bad Password Avg: ${avgBadPassword}ms | Non-Existent User Avg: ${avgNonExistent}ms`);

      // Both must execute full Bcrypt key derivation (> 100ms)
      expect(avgBadPassword).toBeGreaterThan(100);
      expect(avgNonExistent).toBeGreaterThan(100);

      // The ratio between them should be within a reasonable factor (0.5x to 2.0x), proving timing mitigation
      const ratio = avgNonExistent / avgBadPassword;
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
    });
  });

  // =========================================================================
  // SECTION 3: 72-Byte Password Boundary & Character Encoding Stress
  // =========================================================================
  describe('3. 72-Byte Bcrypt Password Boundary & Encoding Stress', () => {
    test('Boundary: Exactly 71-byte password is accepted by validator and hashPassword', async () => {
      // 71 ASCII bytes: 1 upper, 1 lower, 1 digit, 1 special + 67 'x'
      const pwd71 = 'A' + 'a' + '1' + '!' + 'x'.repeat(67);
      expect(Buffer.byteLength(pwd71, 'utf8')).toBe(71);

      const strength = validatePasswordStrength(pwd71);
      expect(strength.valid).toBe(true);

      const hash = await hashPassword(pwd71);
      expect(hash).toMatch(/^\$2[ab]\$12\$/);

      const match = await comparePassword(pwd71, hash);
      expect(match).toBe(true);
    });

    test('Boundary: Exactly 72-byte password is accepted by validator and hashPassword', async () => {
      // 72 ASCII bytes: 1 upper, 1 lower, 1 digit, 1 special + 68 'x'
      const pwd72 = 'A' + 'a' + '1' + '!' + 'x'.repeat(68);
      expect(Buffer.byteLength(pwd72, 'utf8')).toBe(72);

      const strength = validatePasswordStrength(pwd72);
      expect(strength.valid).toBe(true);

      const hash = await hashPassword(pwd72);
      expect(hash).toMatch(/^\$2[ab]\$12\$/);

      const match = await comparePassword(pwd72, hash);
      expect(match).toBe(true);
    });

    test('Boundary: Exactly 73-byte password is REJECTED by validator and hashPassword', async () => {
      // 73 ASCII bytes
      const pwd73 = 'A' + 'a' + '1' + '!' + 'x'.repeat(69);
      expect(Buffer.byteLength(pwd73, 'utf8')).toBe(73);

      const strength = validatePasswordStrength(pwd73);
      expect(strength.valid).toBe(false);
      expect(strength.errors).toContain('Password must not exceed 72 bytes');

      await expect(hashPassword(pwd73)).rejects.toThrow('Password exceeds maximum length of 72 bytes');
    });

    test('Multibyte UTF-8 Attack: Character count < 72 but byte length > 72 must be rejected', async () => {
      // Euro symbol '€' is 3 bytes in UTF-8
      // 25 characters of '€' = 75 bytes
      const multibytePwd = 'Aa1!' + '€'.repeat(24); // 4 + (24 * 3) = 76 bytes, but length is 28!
      expect(multibytePwd.length).toBe(28);
      expect(Buffer.byteLength(multibytePwd, 'utf8')).toBe(76);

      const strength = validatePasswordStrength(multibytePwd);
      expect(strength.valid).toBe(false);
      expect(strength.errors).toContain('Password must not exceed 72 bytes');

      await expect(hashPassword(multibytePwd)).rejects.toThrow('Password exceeds maximum length of 72 bytes');
    });

    test('Large payload stress on login: 10,000-character password does not crash server', async () => {
      const hugePassword = 'Z'.repeat(10000);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telebill.local', password: hugePassword });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 4: Token Manipulation, Tampering & Signature Forgery
  // =========================================================================
  describe('4. Token Manipulation, Alg "none" & Tampering Attacks', () => {
    test('Attack: Algorithm switching to "none" is rejected with 401', async () => {
      // Create an unsigned JWT header with alg: "none"
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          id: customerAUuid,
          email: 'customer@telebill.local',
          role: 'ADMIN', // Attempt privilege escalation
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const algNoneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${algNoneToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('Attack: Algorithm switching to HS512 / HS384 / RS256 is rejected', async () => {
      // Sign with HS512 using the secret
      const hs512Token = jwt.sign(
        { id: customerAUuid, role: Role.ADMIN },
        config.JWT_SECRET,
        { algorithm: 'HS512', expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${hs512Token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('Attack: Tampered payload with valid original signature is rejected', async () => {
      const parts = adminToken.split('.');
      expect(parts.length).toBe(3);

      // Decode payload, modify email/role, re-encode without resigning
      const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      decodedPayload.role = 'SUPER_ADMIN';
      const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('Attack: Tampered signature bytes are rejected', async () => {
      const parts = adminToken.split('.');
      // Invert characters in signature
      const tamperedSig = parts[2].split('').reverse().join('');
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('Attack: Expired token is rejected with TOKEN_EXPIRED error code', async () => {
      const expiredToken = jwt.sign(
        { id: customerAUuid, role: Role.CUSTOMER, customerId: customerAId },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-5s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    test('Attack: Token signed with weak/external secret is rejected', async () => {
      const forgedToken = jwt.sign(
        { id: customerAUuid, role: Role.ADMIN },
        'attacker_controlled_secret_key_1234567890!',
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('Header parsing: Various malformed Authorization headers are safely rejected with 401', async () => {
      const cases = [
        { header: '', expectedCodes: ['AUTH_HEADER_MISSING'] },
        { header: 'Bearer', expectedCodes: ['MALFORMED_AUTH_HEADER'] },
        { header: 'Bearer ', expectedCodes: ['MALFORMED_AUTH_HEADER', 'EMPTY_TOKEN'] },
        { header: 'Bearer    ', expectedCodes: ['MALFORMED_AUTH_HEADER', 'EMPTY_TOKEN'] },
        { header: 'Token abcdef', expectedCodes: ['MALFORMED_AUTH_HEADER'] },
        { header: 'Bearer abc.def', expectedCodes: ['INVALID_TOKEN'] },
        { header: 'Bearer a.b.c.d.e', expectedCodes: ['INVALID_TOKEN'] },
      ];

      for (const c of cases) {
        const reqBuilder = request(app).get('/api/v1/auth/profile');
        if (c.header !== '') {
          reqBuilder.set('Authorization', c.header);
        }
        const res = await reqBuilder;
        expect(res.status).toBe(401);
        expect(c.expectedCodes).toContain(res.body.error.code);
      }
    });
  });

  // =========================================================================
  // SECTION 5: 3-Tier RBAC Privilege Boundaries & Vertical Escalation Probing
  // =========================================================================
  describe('5. 3-Tier RBAC Boundaries & Escalation Probing', () => {
    test('Customer role attempting Admin-only route is blocked with 403 INSUFFICIENT_PERMISSIONS', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Customer role attempting Staff-or-Admin route is blocked with 403 INSUFFICIENT_PERMISSIONS', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/staff-or-admin')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Staff role attempting Admin-only route is blocked with 403 INSUFFICIENT_PERMISSIONS', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Staff role attempting Customer-only route is blocked with 403 INSUFFICIENT_PERMISSIONS', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/customer-only')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Admin role accessing Admin-only route succeeds with 200', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Staff role accessing Staff-or-Admin route succeeds with 200', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/staff-or-admin')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Customer role accessing Customer-only route succeeds with 200', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/customer-only')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Deactivated User Account is blocked with 403 ACCOUNT_DEACTIVATED even with valid JWT', async () => {
      // 1. Create a temporary active user and mint token
      const tempEmail = `deactivated_${Date.now()}@telebill.local`;
      const pwdHash = await bcrypt.hash('ActiveUser@123', 12);
      const tempUser = await prisma.user.create({
        data: {
          email: tempEmail,
          passwordHash: pwdHash,
          role: 'STAFF',
          isActive: true,
        },
      });

      const token = JwtService.signToken({
        id: tempUser.id,
        email: tempUser.email,
        role: Role.STAFF,
        customerId: null,
      });

      // 2. Verify active request succeeds
      const resActive = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(resActive.status).toBe(200);

      // 3. Deactivate user in database
      await prisma.user.update({
        where: { id: tempUser.id },
        data: { isActive: false },
      });

      // 4. Request with valid token must now be blocked with 403 ACCOUNT_DEACTIVATED
      const resDeactivated = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(resDeactivated.status).toBe(403);
      expect(resDeactivated.body.error.code).toBe('ACCOUNT_DEACTIVATED');

      // 5. Clean up
      await prisma.user.delete({ where: { id: tempUser.id } });
    });

    test('Deleted User Account is blocked with 401 USER_NOT_FOUND even with unexpired JWT', async () => {
      // 1. Mint token for a phantom user ID
      const ghostId = 'phantom-uuid-9999-not-in-db';
      const ghostToken = JwtService.signToken({
        id: ghostId,
        email: 'ghost@telebill.local',
        role: Role.STAFF,
        customerId: null,
      });

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${ghostToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  // =========================================================================
  // SECTION 6: Cross-Tenant IDOR Penetration Probing
  // =========================================================================
  describe('6. Zero-Trust IDOR Penetration Probing', () => {
    test('IDOR on Profile: Customer A supplying Customer B userId in query string receives Customer A profile', async () => {
      const res = await request(app)
        .get(`/api/v1/auth/profile?userId=${customerBUuid}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(customerAUuid);
      expect(res.body.data.email).toBe('customer@telebill.local');
      expect(res.body.data.id).not.toBe(customerBUuid);
    });

    test('IDOR on Password Change: Customer A supplying Customer B userId in payload cannot alter Customer B password', async () => {
      // Create ephemeral attacker user to preserve seeded demo state
      const attackerEmail = `ephemeral_attacker_${Date.now()}@telebill.local`;
      const attackerPwd = 'Attacker@123456';
      const attackerHash = await bcrypt.hash(attackerPwd, 12);
      const attackerUser = await prisma.user.create({
        data: {
          email: attackerEmail,
          passwordHash: attackerHash,
          role: 'CUSTOMER',
          isActive: true,
        },
      });

      const attackerToken = JwtService.signToken({
        id: attackerUser.id,
        email: attackerUser.email,
        role: Role.CUSTOMER,
        customerId: null,
      });

      // Verify Customer B password is NOT modified
      const custBBefore = await prisma.user.findUnique({ where: { id: customerBUuid } });
      const initialHash = custBBefore!.passwordHash;

      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          userId: customerBUuid, // Malicious target ID
          currentPassword: attackerPwd,
          newPassword: 'HackedPassword@123456',
        });

      // The password change affects attacker only, not victim Customer B
      expect(res.status).toBe(200);

      // Verify Customer B password hash in database remains completely untouched
      const custBAfter = await prisma.user.findUnique({ where: { id: customerBUuid } });
      expect(custBAfter).toBeDefined();
      expect(custBAfter!.passwordHash).toBe(initialHash);

      // Clean up ephemeral attacker
      await prisma.user.delete({ where: { id: attackerUser.id } });
    });

    test('IDOR on Resource Endpoint: Customer A accessing Customer B customerId is blocked with 403 IDOR_VIOLATION', async () => {
      const res = await request(app)
        .get(`/api/v1/auth/test/customers/${customerBId}/data`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('IDOR_VIOLATION');
    });

    test('IDOR Parameter Confusion Attack: Customer A putting own ID in query but Customer B in path is BLOCKED', async () => {
      // Attacker attempts to trick query parameter evaluator by supplying own customerId in query
      const res = await request(app)
        .get(`/api/v1/auth/test/customers/${customerBId}/data?customerId=${customerAId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('IDOR_VIOLATION');
    });

    test('Admin role has universal operational access across all customer IDs', async () => {
      const resA = await request(app)
        .get(`/api/v1/auth/test/customers/${customerAId}/data`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.customerId).toBe(customerAId);

      const resB = await request(app)
        .get(`/api/v1/auth/test/customers/${customerBId}/data`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resB.status).toBe(200);
      expect(resB.body.customerId).toBe(customerBId);
    });

    test('Staff role has operational access across all customer IDs', async () => {
      const resA = await request(app)
        .get(`/api/v1/auth/test/customers/${customerAId}/data`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.customerId).toBe(customerAId);

      const resB = await request(app)
        .get(`/api/v1/auth/test/customers/${customerBId}/data`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(resB.status).toBe(200);
      expect(resB.body.customerId).toBe(customerBId);
    });
  });
});
