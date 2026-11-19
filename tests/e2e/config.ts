/**
 * TeleBill Pro - End-to-End Test Suite Configuration
 * Centralized settings for test target, timeouts, and seed credentials.
 */

export interface TestConfig {
  baseUrl: string;
  timeoutMs: number;
  credentials: {
    admin: { identifier: string; password: string };
    staff: { identifier: string; password: string };
    customer: { identifier: string; password: string };
  };
  databaseUrl?: string;
  jwtSecret: string;
}

export const config: TestConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5000',
  timeoutMs: parseInt(process.env.TEST_TIMEOUT_MS || '30000', 10),
  credentials: {
    admin: {
      identifier: process.env.TEST_ADMIN_EMAIL || 'admin@telebill.local',
      password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123456',
    },
    staff: {
      identifier: process.env.TEST_STAFF_EMAIL || 'operator@telebill.local',
      password: process.env.TEST_STAFF_PASSWORD || 'Operator@123456',
    },
    customer: {
      identifier: process.env.TEST_CUSTOMER_EMAIL || 'customer@telebill.local',
      password: process.env.TEST_CUSTOMER_PASSWORD || 'Customer@123456',
    },
  },
  databaseUrl: process.env.TEST_DATABASE_URL || 'file:./prisma/test_e2e.db',
  jwtSecret: process.env.JWT_SECRET || 'telebill-e2e-test-secret-key-super-secure-32bytes',
};
