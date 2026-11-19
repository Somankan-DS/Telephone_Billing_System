/**
 * TeleBill Pro - Opaque-Box HTTP Test Client
 * 
 * Supports dual execution modes:
 *   1. Live HTTP Mode: Executes standard HTTP requests via native fetch to a running server.
 *   2. In-Process Mode: Dispatches requests directly to the Express application via Supertest
 *      without binding TCP network ports.
 * 
 * Network connection failures strictly throw errors, preventing false-positive test passes.
 */

import * as fs from 'fs';
import * as path from 'path';
import supertest from 'supertest';
import type { Application } from 'express';
import { config } from '../config';

export interface HttpResponse<T = any> {
  status: number;
  headers: Record<string, string>;
  body: T;
  text: string;
  buffer: Buffer;
}

export interface TestClientOptions {
  inProcess?: boolean;
  targetUrl?: string;
  app?: Application;
}

// Global cached in-process Express application instance
let cachedApp: Application | null = null;

function getSharedApp(): Application {
  if (!cachedApp) {
    try {
      // Lazy-load createApp to avoid circular dependencies and allow standalone harness imports
      const appPath = path.resolve(process.cwd(), 'src/app');
      const { createApp } = require(appPath);
      cachedApp = createApp();
    } catch (err: any) {
      throw new Error(
        `[TestClient In-Process Error] Failed to load Express application from src/app: ${err.message}`
      );
    }
  }
  return cachedApp!;
}

export class TestClient {
  private baseUrl: string;
  private token: string | null = null;
  private customHeaders: Record<string, string> = {};
  private inProcess: boolean = false;
  private app: Application | null = null;

  constructor(target?: string | Application | TestClientOptions) {
    if (typeof target === 'object' && target !== null && !('listen' in target)) {
      // Options object passed
      const opts = target as TestClientOptions;
      if (opts.inProcess || process.env.TEST_MODE === 'in-process') {
        this.inProcess = true;
        this.app = opts.app || getSharedApp();
        this.baseUrl = '';
      } else {
        this.baseUrl = (opts.targetUrl || process.env.TEST_BASE_URL || config.baseUrl).replace(/\/$/, '');
      }
    } else if (typeof target === 'object' && target !== null && 'listen' in target) {
      // Express application passed directly
      this.inProcess = true;
      this.app = target as Application;
      this.baseUrl = '';
    } else if (typeof target === 'string') {
      if (target.toLowerCase() === 'in-process' || target.toLowerCase() === 'inprocess') {
        this.inProcess = true;
        this.app = getSharedApp();
        this.baseUrl = '';
      } else {
        this.baseUrl = target.replace(/\/$/, '');
        this.inProcess = false;
      }
    } else {
      // Default: inspect environment
      if (process.env.TEST_MODE === 'in-process') {
        this.inProcess = true;
        this.app = getSharedApp();
        this.baseUrl = '';
      } else {
        this.baseUrl = (process.env.TEST_BASE_URL || config.baseUrl).replace(/\/$/, '');
        this.inProcess = false;
      }
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  setHeader(name: string, value: string) {
    this.customHeaders[name] = value;
  }

  clearHeaders() {
    this.customHeaders = {};
  }

  public isInProcessMode(): boolean {
    return this.inProcess;
  }

  public getBaseUrl(): string {
    return this.inProcess ? '[in-process Express]' : this.baseUrl;
  }

  private buildUrl(endpoint: string): string {
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  private buildHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, application/pdf, */*',
      ...this.customHeaders,
      ...extraHeaders,
    };

    if (this.token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async parseFetchResponse(res: Response): Promise<HttpResponse> {
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const contentType = headers['content-type'] || '';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = buffer.toString('utf-8');

    let body: any = text;
    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    } else if (contentType.includes('application/pdf')) {
      body = buffer;
    }

    return {
      status: res.status,
      headers,
      body,
      text,
      buffer,
    };
  }

  private formatSupertestResponse(res: supertest.Response): HttpResponse {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(res.headers)) {
      headers[key.toLowerCase()] = String(value);
    }

    const contentType = headers['content-type'] || '';
    let buffer: Buffer;

    if (Buffer.isBuffer(res.body)) {
      buffer = res.body;
    } else if ((res as any).buffer && Buffer.isBuffer((res as any).buffer)) {
      buffer = (res as any).buffer;
    } else if (typeof res.text === 'string') {
      buffer = Buffer.from(res.text, contentType.includes('pdf') ? 'binary' : 'utf-8');
    } else {
      buffer = Buffer.from(JSON.stringify(res.body || ''));
    }

    return {
      status: res.status,
      headers,
      body: res.body !== undefined && Object.keys(res.body).length > 0 ? res.body : res.text,
      text: res.text || '',
      buffer,
    };
  }

  private applySupertestHeaders(req: supertest.Test, extraHeaders?: Record<string, string>): supertest.Test {
    const headers = this.buildHeaders(extraHeaders);
    for (const [key, value] of Object.entries(headers)) {
      req.set(key, value);
    }
    return req;
  }

  async get(endpoint: string, headers?: Record<string, string>): Promise<HttpResponse> {
    if (this.inProcess) {
      try {
        const req = supertest(this.app!).get(endpoint);
        req.buffer(true);
        this.applySupertestHeaders(req, headers);
        const res = await req;
        return this.formatSupertestResponse(res);
      } catch (err: any) {
        throw new Error(`[TestClient In-Process Error] GET ${endpoint} execution failed: ${err.message}`);
      }
    }

    const url = this.buildUrl(endpoint);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(headers),
      });
      return await this.parseFetchResponse(res);
    } catch (err: any) {
      throw new Error(
        `[TestClient Network Failure] GET ${url} connection failed (${err.message}). ` +
        `Ensure TeleBill Pro server is running at ${this.baseUrl} or use in-process mode.`
      );
    }
  }

  async post(endpoint: string, body?: any, headers?: Record<string, string>): Promise<HttpResponse> {
    if (this.inProcess) {
      try {
        const req = supertest(this.app!).post(endpoint);
        this.applySupertestHeaders(req, headers);
        if (body !== undefined) {
          req.send(body);
        }
        const res = await req;
        return this.formatSupertestResponse(res);
      } catch (err: any) {
        throw new Error(`[TestClient In-Process Error] POST ${endpoint} execution failed: ${err.message}`);
      }
    }

    const url = this.buildUrl(endpoint);
    const reqHeaders = this.buildHeaders(headers);

    let payload: any = undefined;
    if (body !== undefined) {
      if (typeof body === 'string') {
        payload = body;
      } else {
        if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
        payload = JSON.stringify(body);
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: reqHeaders,
        body: payload,
      });
      return await this.parseFetchResponse(res);
    } catch (err: any) {
      throw new Error(
        `[TestClient Network Failure] POST ${url} connection failed (${err.message}). ` +
        `Ensure TeleBill Pro server is running at ${this.baseUrl} or use in-process mode.`
      );
    }
  }

  async put(endpoint: string, body?: any, headers?: Record<string, string>): Promise<HttpResponse> {
    if (this.inProcess) {
      try {
        const req = supertest(this.app!).put(endpoint);
        this.applySupertestHeaders(req, headers);
        if (body !== undefined) {
          req.send(body);
        }
        const res = await req;
        return this.formatSupertestResponse(res);
      } catch (err: any) {
        throw new Error(`[TestClient In-Process Error] PUT ${endpoint} execution failed: ${err.message}`);
      }
    }

    const url = this.buildUrl(endpoint);
    const reqHeaders = this.buildHeaders(headers);

    let payload: any = undefined;
    if (body !== undefined) {
      if (typeof body === 'string') {
        payload = body;
      } else {
        if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
        payload = JSON.stringify(body);
      }
    }

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: reqHeaders,
        body: payload,
      });
      return await this.parseFetchResponse(res);
    } catch (err: any) {
      throw new Error(
        `[TestClient Network Failure] PUT ${url} connection failed (${err.message}). ` +
        `Ensure TeleBill Pro server is running at ${this.baseUrl} or use in-process mode.`
      );
    }
  }

  async patch(endpoint: string, body?: any, headers?: Record<string, string>): Promise<HttpResponse> {
    if (this.inProcess) {
      try {
        const req = supertest(this.app!).patch(endpoint);
        this.applySupertestHeaders(req, headers);
        if (body !== undefined) {
          req.send(body);
        }
        const res = await req;
        return this.formatSupertestResponse(res);
      } catch (err: any) {
        throw new Error(`[TestClient In-Process Error] PATCH ${endpoint} execution failed: ${err.message}`);
      }
    }

    const url = this.buildUrl(endpoint);
    const reqHeaders = this.buildHeaders(headers);

    let payload: any = undefined;
    if (body !== undefined) {
      if (typeof body === 'string') {
        payload = body;
      } else {
        if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
        payload = JSON.stringify(body);
      }
    }

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: reqHeaders,
        body: payload,
      });
      return await this.parseFetchResponse(res);
    } catch (err: any) {
      throw new Error(
        `[TestClient Network Failure] PATCH ${url} connection failed (${err.message}). ` +
        `Ensure TeleBill Pro server is running at ${this.baseUrl} or use in-process mode.`
      );
    }
  }

  async delete(endpoint: string, headers?: Record<string, string>): Promise<HttpResponse> {
    if (this.inProcess) {
      try {
        const req = supertest(this.app!).delete(endpoint);
        this.applySupertestHeaders(req, headers);
        const res = await req;
        return this.formatSupertestResponse(res);
      } catch (err: any) {
        throw new Error(`[TestClient In-Process Error] DELETE ${endpoint} execution failed: ${err.message}`);
      }
    }

    const url = this.buildUrl(endpoint);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.buildHeaders(headers),
      });
      return await this.parseFetchResponse(res);
    } catch (err: any) {
      throw new Error(
        `[TestClient Network Failure] DELETE ${url} connection failed (${err.message}). ` +
        `Ensure TeleBill Pro server is running at ${this.baseUrl} or use in-process mode.`
      );
    }
  }

  /**
   * Multipart file upload helper for CSV CDR batch ingestion
   */
  async uploadFile(
    endpoint: string,
    fieldName: string,
    filePathOrContent: string,
    filename = 'test.csv',
    extraFields?: Record<string, string>
  ): Promise<HttpResponse> {
    if (this.inProcess) {
      try {
        const req = supertest(this.app!).post(endpoint);
        this.applySupertestHeaders(req);

        if (extraFields) {
          for (const [key, value] of Object.entries(extraFields)) {
            req.field(key, value);
          }
        }

        if (fs.existsSync(filePathOrContent)) {
          const actualFilename = filename || path.basename(filePathOrContent);
          req.attach(fieldName, filePathOrContent, actualFilename);
        } else {
          req.attach(fieldName, Buffer.from(filePathOrContent), filename || 'test.csv');
        }

        const res = await req;
        return this.formatSupertestResponse(res);
      } catch (err: any) {
        throw new Error(`[TestClient In-Process Error] File upload to ${endpoint} failed: ${err.message}`);
      }
    }

    const url = this.buildUrl(endpoint);
    let fileContent: string;
    let actualFilename = filename;

    if (fs.existsSync(filePathOrContent)) {
      fileContent = fs.readFileSync(filePathOrContent, 'utf-8');
      actualFilename = path.basename(filePathOrContent);
    } else {
      fileContent = filePathOrContent;
    }

    const boundary = `----TeleBillBoundary${Date.now().toString(16)}`;
    let body = '';

    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        body += `${value}\r\n`;
      }
    }

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${fieldName}"; filename="${actualFilename}"\r\n`;
    body += `Content-Type: text/csv\r\n\r\n`;
    body += `${fileContent}\r\n`;
    body += `--${boundary}--\r\n`;

    const headers = this.buildHeaders({
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });
      return await this.parseFetchResponse(res);
    } catch (err: any) {
      throw new Error(
        `[TestClient Network Failure] Upload to ${url} failed (${err.message}). ` +
        `Ensure TeleBill Pro server is running at ${this.baseUrl} or use in-process mode.`
      );
    }
  }
}
