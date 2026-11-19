/**
 * TeleBill Pro - Multi-Role Authentication Helper & Token Cache
 * Handles ADMIN, STAFF, and CUSTOMER session acquisition and token caching.
 */

import { TestClient } from './client';
import { config } from '../config';

export interface AuthUser {
  id: string | number;
  username: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  customerId?: string | number;
  customer_id?: string | number;
}

export interface AuthSession {
  client: TestClient;
  token: string;
  user: AuthUser;
}

export class AuthHelper {
  private static tokenCache: Map<string, AuthSession> = new Map();

  static clearCache() {
    this.tokenCache.clear();
  }

  static async login(
    identifier: string,
    password: string,
    options: { fresh?: boolean; targetUrl?: string } = {}
  ): Promise<AuthSession> {
    const cacheKey = `${identifier}:${options.targetUrl || 'default'}`;
    if (!options.fresh && this.tokenCache.has(cacheKey)) {
      const cached = this.tokenCache.get(cacheKey)!;
      // return a new client instance sharing the cached token
      const client = new TestClient(options.targetUrl);
      client.setToken(cached.token);
      return { client, token: cached.token, user: cached.user };
    }

    const client = new TestClient(options.targetUrl);
    const res = await client.post('/api/auth/login', { identifier, password });

    if (res.status === 200 && res.body?.token) {
      const token = res.body.token;
      const user = res.body.user || {
        id: res.body.userId || 1,
        username: identifier.split('@')[0],
        email: identifier,
        role: identifier.includes('admin') ? 'ADMIN' : identifier.includes('staff') ? 'STAFF' : 'CUSTOMER',
      };
      client.setToken(token);
      const session: AuthSession = { client, token, user };
      this.tokenCache.set(cacheKey, session);
      return session;
    }

    // Try alternative route pattern /api/v1/auth/login if /api/auth/login returned 404
    if (res.status === 404) {
      const altRes = await client.post('/api/v1/auth/login', { identifier, password });
      if (altRes.status === 200 && altRes.body?.token) {
        const token = altRes.body.token;
        const user = altRes.body.user || {
          id: altRes.body.userId || 1,
          username: identifier.split('@')[0],
          email: identifier,
          role: identifier.includes('admin') ? 'ADMIN' : identifier.includes('staff') ? 'STAFF' : 'CUSTOMER',
        };
        client.setToken(token);
        const session: AuthSession = { client, token, user };
        this.tokenCache.set(cacheKey, session);
        return session;
      }
    }

    throw new Error(
      `Failed to authenticate as ${identifier}: status=${res.status} body=${JSON.stringify(res.body)}`
    );
  }

  static async getAdminSession(options?: { fresh?: boolean; targetUrl?: string }): Promise<AuthSession> {
    return this.login(config.credentials.admin.identifier, config.credentials.admin.password, options);
  }

  static async getStaffSession(options?: { fresh?: boolean; targetUrl?: string }): Promise<AuthSession> {
    try {
      return await this.login(config.credentials.staff.identifier, config.credentials.staff.password, options);
    } catch (err) {
      const fallbackEmail = config.credentials.staff.identifier === 'operator@telebill.local' ? 'staff@telebill.local' : 'operator@telebill.local';
      const fallbackPass = fallbackEmail === 'staff@telebill.local' ? 'Staff@123456' : 'Operator@123456';
      return await this.login(fallbackEmail, fallbackPass, options);
    }
  }

  static async getCustomerSession(
    email?: string,
    password?: string,
    options?: { fresh?: boolean; targetUrl?: string }
  ): Promise<AuthSession> {
    return this.login(
      email || config.credentials.customer.identifier,
      password || config.credentials.customer.password,
      options
    );
  }
}
