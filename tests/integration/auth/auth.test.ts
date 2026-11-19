import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectDatabase, disconnectDatabase } from '../../../src/shared/database';

describe('Features 6, 7 & 8: Authentication, 3-Tier RBAC & IDOR Integration Tests', () => {
  jest.setTimeout(35000);

  let app: any;
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;
  let customerId: string;

  beforeAll(async () => {
    await connectDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('POST /api/v1/auth/login', () => {
    test('Admin login succeeds with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telebill.local', password: 'Admin@123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.user.email).toBe('admin@telebill.local');
      adminToken = res.body.data.token;
    });

    test('Staff operator login succeeds with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'operator@telebill.local', password: 'Operator@123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('STAFF');
      staffToken = res.body.data.token;
    });

    test('Customer login succeeds and returns linked customerId', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'customer@telebill.local', password: 'Customer@123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('CUSTOMER');
      expect(res.body.data.user.customerId).toBeDefined();
      customerToken = res.body.data.token;
      customerId = res.body.data.user.customerId;
    });

    test('Login fails with 401 Unauthorized for incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telebill.local', password: 'WrongPassword@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('Login fails with 401 Unauthorized for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@telebill.local', password: 'AnyPassword@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('Login fails with 400 Bad Request if fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telebill.local' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/profile (IDOR Protection)', () => {
    test('Rejects request without Authorization header with 401', async () => {
      const res = await request(app).get('/api/v1/auth/profile');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
    });

    test('Rejects request with malformed Bearer header with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Basic invalid_token');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MALFORMED_AUTH_HEADER');
    });

    test('Returns admin user profile with customer null', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('ADMIN');
      expect(res.body.data.customer).toBeNull();
    });

    test('Returns customer user profile with linked customer profile details', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('CUSTOMER');
      expect(res.body.data.customer).toBeDefined();
      expect(res.body.data.customer.accountNumber).toBe('TEL-202611-00001');
      expect(res.body.data.customer.firstName).toBe('Rajesh');
      expect(res.body.data.customer.phone).toBe('+919876543210');
    });

    test('IDOR protection: ignores query parameter attempts to access another user', async () => {
      // Attacker customer tries to view admin profile by appending ?userId=admin_id
      const res = await request(app)
        .get('/api/v1/auth/profile?userId=some-other-user-uuid')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      // Still returns customer's own profile, NOT the other user's
      expect(res.body.data.role).toBe('CUSTOMER');
      expect(res.body.data.email).toBe('customer@telebill.local');
    });
  });

  describe('PUT /api/v1/auth/password (Self-Service & IDOR Protection)', () => {
    test('Rejects unauthenticated password change with 401', async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .send({ currentPassword: 'Customer@123456', newPassword: 'NewCustomer@123456' });

      expect(res.status).toBe(401);
    });

    test('Rejects password change with wrong current password with 401', async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ currentPassword: 'WrongPassword@123', newPassword: 'NewCustomer@123456' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INCORRECT_CURRENT_PASSWORD');
    });

    test('Rejects password change when new password is same as current with 400', async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ currentPassword: 'Customer@123456', newPassword: 'Customer@123456' });

      expect(res.status).toBe(400);
    });

    test('Rejects password change when new password does not meet complexity with 400', async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ currentPassword: 'Customer@123456', newPassword: 'short' });

      expect(res.status).toBe(400);
    });

    test('Successfully updates password, old password fails login, new password succeeds', async () => {
      // 1. Update password
      const changeRes = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ currentPassword: 'Customer@123456', newPassword: 'CustomerNew@123456' });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // 2. Old password should now fail
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'customer@telebill.local', password: 'Customer@123456' });
      expect(oldLoginRes.status).toBe(401);

      // 3. New password should succeed
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'customer@telebill.local', password: 'CustomerNew@123456' });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.data.token).toBeDefined();

      // 4. Revert password back to original Customer@123456 to maintain seed idempotency
      const revertRes = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${newLoginRes.body.data.token}`)
        .send({ currentPassword: 'CustomerNew@123456', newPassword: 'Customer@123456' });
      expect(revertRes.status).toBe(200);

      // Refresh customerToken with restored password
      const restoreLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'customer@telebill.local', password: 'Customer@123456' });
      customerToken = restoreLogin.body.data.token;
    });
  });

  describe('Feature 7: 3-Tier RBAC Route Guard Integration', () => {
    test('Admin route permits ADMIN role', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Admin route rejects STAFF role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Admin route rejects CUSTOMER role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/admin-only')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Admin route rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/auth/test/admin-only');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
    });

    test('Staff-or-Admin route permits STAFF role', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/staff-or-admin')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Staff-or-Admin route permits ADMIN role', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/staff-or-admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    test('Staff-or-Admin route rejects CUSTOMER role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/staff-or-admin')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Customer-only route permits CUSTOMER role', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/customer-only')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Customer-only route rejects STAFF role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/customer-only')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Resource-Level IDOR Protection Guard (assertCustomerAccess)', () => {
    test('Customer can access their own customerId resource', async () => {
      const res = await request(app)
        .get(`/api/v1/auth/test/customers/${customerId}/data`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customerId).toBe(customerId);
    });

    test('Customer is blocked with 403 Forbidden when attempting to access another customerId', async () => {
      const foreignCustomerId = 'foreign-cust-9999';
      const res = await request(app)
        .get(`/api/v1/auth/test/customers/${foreignCustomerId}/data`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('IDOR_VIOLATION');
    });

    test('Admin can access any customerId resource', async () => {
      const anyCustomerId = 'any-cust-1234';
      const res = await request(app)
        .get(`/api/v1/auth/test/customers/${anyCustomerId}/data`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customerId).toBe(anyCustomerId);
    });

    test('Staff can access any customerId resource', async () => {
      const anyCustomerId = 'any-cust-5678';
      const res = await request(app)
        .get(`/api/v1/auth/test/customers/${anyCustomerId}/data`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customerId).toBe(anyCustomerId);
    });
  });
});
