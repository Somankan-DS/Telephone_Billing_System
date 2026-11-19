# TeleBill Pro — Security Specification & Threat Model

## 1. Threat Modeling & STRIDE Analysis

As a financial and telecom mediation prototype handling subscriber personally identifiable information (PII), call records, and billing transactions, TeleBill Pro applies a comprehensive **STRIDE Threat Modeling** methodology:

| Threat Category | Specific Telecom Risk | TeleBill Pro Mitigation & Architecture |
| :--- | :--- | :--- |
| **Spoofing Identity** | Fake admin login, brute-force password cracking, non-existent user enumeration. | Bcrypt Cost Factor 12 password stretching (~300ms wall), constant-time dummy hash comparison for non-existent users. |
| **Tampering with Data** | Manipulation of call rated amounts, altering invoice total payable amounts, forged JWT signatures. | Cryptographic HS256 JWT signatures, strict fixed-point Decimal calculations on the backend, immutability of settled invoices. |
| **Repudiation** | Denying an administrative plan rate alteration or CDR simulation run. | Tamper-evident, append-only `AuditLog` table capturing admin userId, entity mutations, timestamp, and client IP. |
| **Information Disclosure** | Cross-tenant IDOR attack where Customer A downloads Customer B's PDF invoice or call records. | Kernel-level tenancy enforcement (`assertCustomerAccess` middleware); JWT claims verify ownership of requested entity. |
| **Denial of Service** | Gigabyte payload flooding, concurrent SQLite write locking crashes, billion-call Poisson loops. | 10MB payload size limits, SQLite 5000ms busy timeout in WAL mode, capped simulator iterations (100 max per invocation). |
| **Elevation of Privilege** | Subscriber role submitting administrative billing run cycles or altering credit limits. | Declarative 3-tier Role-Based Access Control (`requireRole([Role.ADMIN, Role.STAFF])`) guarding operational endpoints. |

---

## 2. Cryptographic Password Hashing Standards

### Bcrypt Cost Factor 12 Configuration
Password hashes are generated using `bcryptjs` strictly configured to **12 salt rounds** (2^12 = 4,096 iterations):
- Each hash operation requires approximately 280ms to 350ms of CPU compute time on modern multicore hardware.
- This creates an effective computational wall, preventing offline GPU cluster attacks from cracking leaked database dumps.

### Timing Attack Neutralization (Constant-Time Dummy Hash)
Standard authentication pipelines leak user existence through execution timing: if an email is not found, returning immediately takes ~1ms, whereas checking an existing user's password takes ~300ms. Attackers measure latency to compile lists of valid customer emails.

TeleBill Pro neutralizes timing attacks (`src/modules/auth/auth.service.ts`):
```typescript
if (!user) {
  // Execute dummy Bcrypt compare to equalize execution latency (~300ms)
  await comparePassword(password, DUMMY_HASH);
  throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
}
```

### 72-Byte Bcrypt Boundary & UTF-8 Handling
The standard Bcrypt algorithm truncates passwords after 72 bytes. A password of 72 bytes followed by arbitrary characters would evaluate as identical. TeleBill Pro enforces an explicit pre-validation check rejecting passwords exceeding 72 bytes.

---

## 3. Session Management & Token Security

- **Algorithm:** HS256 (HMAC with SHA-256) signed with a high-entropy secret (`min 32 characters`).
- **Token Expiration:** Exactly 60 minutes (`JWT_EXPIRES_IN=60m`).
- **Stateless Verification:** Verification strictly rejects algorithm switching (`alg: "none"` or asymmetric confusion attacks like RS256 with HMAC).
- **Session Revocation & Lifecycle Enforcement:** On every authenticated request, the database verifies `user.isActive = true`. Deactivated or suspended users are immediately barred even with an unexpired token.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Endpoint Domain | HTTP Method & Path | Minimum Permitted Role | Tenant IDOR Guard |
| :--- | :--- | :--- | :--- |
| **Authentication** | `POST /api/auth/login` | Public (Unauthenticated) | None |
| **Self-Service Auth** | `GET /api/auth/me`, `PUT /api/auth/password`| `CUSTOMER`, `STAFF`, `ADMIN` | Bound to active JWT session |
| **Dashboard KPIs** | `GET /api/admin/dashboard/*` | `ADMIN`, `STAFF` | Role-restricted (Customer 403) |
| **Customer CRUD** | `POST, PUT, PATCH /api/customers` | `ADMIN`, `STAFF` | Role-restricted |
| **Customer 360** | `GET /api/customers/:id` | `CUSTOMER` (Own only), `STAFF`, `ADMIN` | Enforced (`assertCustomerAccess`) |
| **Tariff Config** | `POST, PUT /api/tariffs` | `ADMIN`, `STAFF` | Role-restricted |
| **CDR Ingestion** | `POST /api/cdrs`, `POST /api/simulation/traffic`| `ADMIN`, `STAFF` | Role-restricted |
| **Billing Cycle Run** | `POST /api/billing/run-cycle` | `ADMIN`, `STAFF` | Role-restricted |
| **View Invoices** | `GET /api/invoices`, `GET /api/invoices/:id` | `CUSTOMER` (Own only), `STAFF`, `ADMIN` | Enforced (`assertCustomerAccess`) |
| **Download PDF** | `GET /api/invoices/:id/pdf` | `CUSTOMER` (Own only), `STAFF`, `ADMIN` | Enforced (`assertCustomerAccess`) |
| **Simulate Payment**| `POST /api/payments/simulate` | `CUSTOMER`, `STAFF`, `ADMIN` | Enforced on invoice target |
| **Reports & Aging** | `GET /api/reports/*` | `ADMIN`, `STAFF` | Role-restricted |
| **Subscriber Portal**| `GET /api/customers/:id/bill-prediction` | `CUSTOMER` (Own only), `STAFF`, `ADMIN` | Enforced (`assertCustomerAccess`) |

---

## 5. Insecure Direct Object Reference (IDOR) Perimeter Controls

To guarantee tenant isolation, `assertCustomerAccess` middleware is mounted on all subscriber-specific routes:

```typescript
export function assertCustomerAccess(req: Request, targetCustomerId: string): void {
  const user = req.user;
  if (!user) throw new UnauthorizedError();
  if (user.role === Role.ADMIN || user.role === Role.STAFF) return; // Universal operator access
  
  if (user.role === Role.CUSTOMER) {
    if (user.customerId !== targetCustomerId) {
      throw new ForbiddenError('Unauthorized: You cannot access resources belonging to another customer', 'IDOR_VIOLATION');
    }
  }
}
```

This prevents malicious subscribers from modifying path parameters (e.g. replacing their ID with another customer's account number or invoice ID) to intercept invoices or call records.
