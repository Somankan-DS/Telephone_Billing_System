# TeleBill Pro: End-to-End Test Infrastructure Specification (TEST_INFRA.md)

**Version:** 1.0.0  
**Target Repository:** TeleBill Pro Modular Monolith  
**Track:** Dual Track E2E Testing Track  
**Document Status:** Approved Infrastructure Architecture Blueprint  

---

## 1. Architectural Philosophy & Dual Track Testing

TeleBill Pro enforces a strict **Dual Track Software Engineering** model:
1. **Implementation Track:** Modules M1 through M6 build out the functional system, modular monolith backend, database persistence, domain logic, and frontend user interfaces.
2. **E2E Testing Track:** An independent, parallel engineering track developing an opaque-box, requirement-driven automated test infrastructure and test suites.

### Core Principles
- **Decoupled & Opaque-Box:** Tests treat TeleBill Pro strictly as a black box. No internal private functions, unexported services, or internal database connections are directly forged or altered by tests. All state transitions, data operations, and assertions occur strictly over HTTP/REST endpoints.
- **Strict Financial Determinism:** All tests validating call rating, free allowance deduction, pulse calculation, tax calculation (18% GST), and invoice generation assert exact fixed-point decimal values (e.g., `DECIMAL(10,4)` for rates, `DECIMAL(10,2)` for invoices and payments), rejecting any IEEE-754 floating-point drift.
- **Progressive Testability:** Tier 1 and Tier 2 tests are organized so that tests for earlier modules (e.g., M1 Authentication and M2 CRM) can run independently and provide immediate pass/fail feedback as soon as those milestones are built, before M3–M6 are finished.
- **Dual Execution Target (In-Process & Live Server):** The test harness seamlessly supports both fast in-process testing via Supertest (`request(app)`) without binding local network ports, and live network testing against a running server (`http://localhost:5000` or `TEST_BASE_URL`) via standard HTTP requests.

---

## 2. Directory Layout & Test Suite Hierarchy

The E2E test infrastructure resides exclusively in `tests/e2e/`:

```
c:\Users\soman\OneDrive\Desktop\Innovative project\
├── TEST_INFRA.md                         # Infrastructure specification document at project root
├── TEST_READY.md                         # Completion signal published when test suite is fully authored
├── tests/
│   ├── e2e/
│   │   ├── config.ts                     # Environment variables, timeouts, base URLs, retry configs
│   │   ├── test-runner.ts                # Standalone master CLI test runner & reporter
│   │   ├── harness/
│   │   │   ├── client.ts                 # Opaque-box HTTP API client wrapping Supertest / native fetch
│   │   │   ├── auth-helper.ts            # Multi-role authentication (Admin, Staff, Customer) & token cache
│   │   │   ├── db-reset.ts               # Test database initialization, isolation, and seed helpers
│   │   │   └── assertions.ts             # Custom matchers (Decimal precision, GST tax, pulse increments)
│   │   ├── fixtures/
│   │   │   ├── cdr/
│   │   │   │   ├── valid_local.csv       # Standard Local call records with valid MSISDNs
│   │   │   │   ├── valid_std.csv         # STD inter-circle call records
│   │   │   │   ├── valid_isd.csv         # ISD international call records (+1, +44, etc.)
│   │   │   │   ├── mixed_batch.csv       # Mixed call types with varied durations
│   │   │   │   ├── duplicate_records.csv # Batches containing identical calls for SHA-256 deduplication
│   │   │   │   ├── malformed_headers.csv # CSV with corrupt/missing column headers
│   │   │   │   ├── invalid_timestamps.csv# Inverted timestamps, future calls, negative durations
│   │   │   │   └── high_volume_poisson.csv # 500+ simulated Poisson arrival records for Tier 4
│   │   │   ├── tariffs/
│   │   │   │   ├── postpaid_standard.json
│   │   │   │   ├── prepaid_unlimited.json
│   │   │   │   ├── corporate_flexi.json
│   │   │   │   └── invalid_tariffs.json  # Negative rates, zero pulse, missing allowance buckets
│   │   │   ├── customers/
│   │   │   │   ├── valid_customers.json
│   │   │   │   └── boundary_customers.json # Limit length strings, special characters, edge MSISDNs
│   │   │   └── payments/
│   │   │       ├── valid_payment_methods.json # Credit card, UPI, NetBanking mock payloads
│   │   │       └── idempotency_collision.json # Same idempotency key with conflicting amounts
│   │   ├── tier1_feature_coverage.test.ts # Systematic happy-path coverage across all 48 features
│   │   ├── tier2_boundaries_corners.test.ts # Negative, boundary, limit, overflow, and RBAC tests
│   │   ├── tier3_cross_feature.test.ts    # Pairwise feature interaction and concurrency tests
│   │   └── tier4_realworld_scenarios.test.ts # 4 full end-to-end customer lifecycle workloads
```

---

## 3. Test Runner Architecture & Harness Design

### 3.1 HTTP Client Abstraction (`tests/e2e/harness/client.ts`)
The `TestClient` class provides a unified interface for dispatching HTTP requests regardless of execution target:

- Dual execution:
  - If `TEST_BASE_URL` is set or an explicit URL is provided, requests are sent via HTTP fetch to the live server.
  - If no URL is provided, in-process mode imports the Express `app` dynamically and executes requests via Supertest without opening a TCP socket.
- Automatic authentication token injection (`Authorization: Bearer <token>`).
- Built-in multipart file upload support for CSV CDR bulk ingestions.

### 3.2 Role-Based Authentication Helper (`tests/e2e/harness/auth-helper.ts`)
Simplifies RBAC testing by caching and providing authenticated client instances for:
- Admin Role (`admin@telebill.local` / `Admin@123456`)
- Staff/Operator Role (`staff@telebill.local` / `Staff@123456`)
- Customer Role (`customer@telebill.local` / `Customer@123456`)

### 3.3 Domain Assertions (`tests/e2e/harness/assertions.ts`)
Enforces telecom precision standards across tests:
- `assertDecimalEquals(actual, expected, precision)`: Verifies exact fixed-point match within epsilon $10^{-\text{precision}} / 2$.
- `assertGstTax(taxableAmount, taxAmount)`: Confirms exact 18% statutory GST (9% CGST + 9% SGST) with Half-Up paise rounding.
- `assertPulseDuration(actualSeconds, pulseSeconds, expectedBillableUnits)`: Verifies pulse ceiling logic: $\lceil \text{duration} / \text{pulse} \rceil$.

### 3.4 Master CLI Test Runner (`tests/e2e/test-runner.ts`)
A dedicated command-line runner providing colorized console output, tier-specific execution filtering, error diff summaries, and exit code management for CI/CD gates:
- `--all`: Run all test tiers (Tiers 1-4).
- `--tier=<1|2|3|4>`: Run a specific tier suite.
- `--bail`: Stop execution on first failure.
- `--target=<url>`: Run tests against an external URL.
- `--in-process`: Execute tests in-process via Supertest without binding a port.
- `--dry-run`: Verify test suite structure, definitions, and compilation without dispatching network calls.
- `--json`: Output execution results in JSON format.

---

## 4. Test Tier Architecture & Pass Criteria

| Tier | Name | Target Scope | Minimum Test Count | Pass Threshold | Exit Code Policy |
|:---:|:---|:---|:---:|:---:|:---|
| **Tier 1** | **Feature Coverage** | Happy-path verification of all 48 features across all 10 domain areas. Asserts valid 2xx HTTP responses, expected payload schemas, and correct data persistence. | >= 50 tests | **100% Pass** (0 failures allowed) | Exit 0 on success; Exit 1 on any failure |
| **Tier 2** | **Boundaries & Corners** | Negative validation, boundary limits, empty strings, zero values, negative values, malformed CSV headers, duplicate constraints, expired tokens, IDOR attacks, and RBAC forbidden access (400/401/403/404/409/422). | >= 50 tests | **100% Pass** (0 failures allowed) | Exit 0 on success; Exit 1 on any failure |
| **Tier 3** | **Cross-Feature Interactions** | Pairwise interactions between dependent subsystems: Tariff plan rate modification affecting unbilled CDR rating; Overpayments resulting in wallet credit and auto-deduction on next invoice; Concurrent bill run locks preventing duplicate invoices; Plan proration calculations mid-cycle. | >= 12 tests | **100% Pass** (0 failures allowed) | Exit 0 on success; Exit 1 on any failure |
| **Tier 4** | **Real-World Workloads** | Full end-to-end multi-step customer lifecycles simulating production telecommunications operations: Enterprise Postpaid lifecycle, Consumer Prepaid lifecycle, Mixed Traffic Ingestion, and Customer Delinquency / Dunning / Debt Clearance. | 4 Complete Scenarios (>= 20 assertions each) | **100% Pass** (0 failures allowed) | Exit 0 on success; Exit 1 on any failure |

---

## 5. Feature Inventory to Test Tier Mapping (All 48 Features)

| Feature # | Feature Name | Domain Module | Tier 1 (Coverage) | Tier 2 (Boundaries) | Tier 3 (Interactions) | Tier 4 (Workloads) |
|:---:|:---|:---|:---:|:---:|:---:|:---:|
| 1 | Runtime Environment Bootstrap | Infrastructure | `T1-INFRA-01` | `T2-INFRA-01` | `T3-BOOT-01` | `T4-E2E-01` |
| 2 | Modular Monolith Scaffolding | Core / App | `T1-APP-01` | `T2-APP-01` | `T3-BOOT-01` | `T4-E2E-01` |
| 3 | Relational Schema & Migrations | Database | `T1-DB-01` | `T2-DB-01` | `T3-DB-01` | `T4-E2E-01` |
| 4 | Database Seeding Engine | Database / Seed | `T1-SEED-01` | `T2-SEED-01` | `T3-SEED-01` | `T4-E2E-01` |
| 5 | Cryptographic Password Hashing | Auth / Security | `T1-AUTH-01` | `T2-AUTH-01` | `T3-AUTH-01` | `T4-E2E-01` |
| 6 | JWT Authentication & Sessions | Auth / Tokens | `T1-AUTH-02` | `T2-AUTH-02` | `T3-AUTH-02` | `T4-E2E-01` |
| 7 | 3-Tier Role-Based Access Control | Auth / RBAC | `T1-AUTH-03` | `T2-AUTH-03` | `T3-AUTH-03` | `T4-E2E-01` |
| 8 | User Profile & Password Mgmt | Auth / Profile | `T1-AUTH-04` | `T2-AUTH-04` | `T3-AUTH-04` | `T4-E2E-01` |
| 9 | Customer Account Auto-Generation | Customer CRM | `T1-CRM-01` | `T2-CRM-01` | `T3-CRM-01` | `T4-E2E-01` |
| 10 | Customer CRUD Lifecycle Mgmt | Customer CRM | `T1-CRM-02` | `T2-CRM-02` | `T3-CRM-02` | `T4-E2E-01` |
| 11 | Customer Status State Machine | Customer CRM | `T1-CRM-03` | `T2-CRM-03` | `T3-CRM-03` | `T4-E2E-01` |
| 12 | Customer Search, Filter & Paging | Customer CRM | `T1-CRM-04` | `T2-CRM-04` | `T3-CRM-04` | `T4-E2E-01` |
| 13 | Tariff Plan Configuration Engine | Tariff Plans | `T1-TAR-01` | `T2-TAR-01` | `T3-TAR-01` | `T4-E2E-01` |
| 14 | Multi-Tier Call Rates | Tariff Plans | `T1-TAR-02` | `T2-TAR-02` | `T3-TAR-02` | `T4-E2E-01` |
| 15 | Free Allowance Bucket Management | Tariff Plans | `T1-TAR-03` | `T2-TAR-03` | `T3-TAR-03` | `T4-E2E-01` |
| 16 | Pulse Increment Rating Rules | Tariff Plans | `T1-TAR-04` | `T2-TAR-04` | `T3-TAR-04` | `T4-E2E-01` |
| 17 | Customer Plan Sub & Proration | Tariff Plans | `T1-TAR-05` | `T2-TAR-05` | `T3-TAR-05` | `T4-E2E-01` |
| 18 | CDR Relational Schema & Indexing | CDR Ingestion | `T1-CDR-01` | `T2-CDR-01` | `T3-CDR-01` | `T4-E2E-01` |
| 19 | CDR CSV Ingestion Pipeline | CDR Ingestion | `T1-CDR-02` | `T2-CDR-02` | `T3-CDR-02` | `T4-E2E-01` |
| 20 | Realistic Traffic Simulation Gen | CDR / Simulation | `T1-CDR-03` | `T2-CDR-03` | `T3-CDR-03` | `T4-E2E-01` |
| 21 | Deterministic SHA-256 Deduplication | CDR Ingestion | `T1-CDR-04` | `T2-CDR-04` | `T3-CDR-04` | `T4-E2E-01` |
| 22 | Fixed-Point Decimal Rating Engine| Rating Engine | `T1-RATE-01` | `T2-RATE-01` | `T3-RATE-01` | `T4-E2E-01` |
| 23 | Free Allowance Deduction Algo | Rating Engine | `T1-RATE-02` | `T2-RATE-02` | `T3-RATE-02` | `T4-E2E-01` |
| 24 | Atomic Prepaid Balance Deduction | Rating Engine | `T1-RATE-03` | `T2-RATE-03` | `T3-RATE-03` | `T4-E2E-01` |
| 25 | Rated CDR Stamping & Billing Links| Rating Engine | `T1-RATE-04` | `T2-RATE-04` | `T3-RATE-04` | `T4-E2E-01` |
| 26 | Postpaid Billing Cycle Engine | Billing & Invoicing | `T1-BILL-01` | `T2-BILL-01` | `T3-BILL-01` | `T4-E2E-01` |
| 27 | Duplicate Invoice Prevention | Billing & Invoicing | `T1-BILL-02` | `T2-BILL-02` | `T3-BILL-02` | `T4-E2E-01` |
| 28 | Comprehensive Line-Item Calc | Billing & Invoicing | `T1-BILL-03` | `T2-BILL-03` | `T3-BILL-03` | `T4-E2E-01` |
| 29 | Telecom Tax Engine (18% GST) | Billing & Invoicing | `T1-BILL-04` | `T2-BILL-04` | `T3-BILL-04` | `T4-E2E-01` |
| 30 | Arrears & Balance Carryover | Billing & Invoicing | `T1-BILL-05` | `T2-BILL-05` | `T3-BILL-05` | `T4-E2E-01` |
| 31 | Invoice Payment Status Machine | Billing & Invoicing | `T1-BILL-06` | `T2-BILL-06` | `T3-BILL-06` | `T4-E2E-01` |
| 32 | Professional PDF Invoice Gen | Billing & Invoicing | `T1-BILL-07` | `T2-BILL-07` | `T3-BILL-07` | `T4-E2E-01` |
| 33 | Simulated Payment Gateway Workflow| Payments | `T1-PAY-01` | `T2-PAY-01` | `T3-PAY-01` | `T4-E2E-01` |
| 34 | Transactional Payment Settlement | Payments | `T1-PAY-02` | `T2-PAY-02` | `T3-PAY-02` | `T4-E2E-01` |
| 35 | Customer Wallet Overpayment Credit| Payments | `T1-PAY-03` | `T2-PAY-03` | `T3-PAY-03` | `T4-E2E-01` |
| 36 | Dynamic Admin Dashboard Metrics | Dashboard & KPIs | `T1-DASH-01` | `T2-DASH-01` | `T3-DASH-01` | `T4-E2E-01` |
| 37 | Telecom KPI Visual Reports | Reports | `T1-DASH-02` | `T2-DASH-02` | `T3-DASH-02` | `T4-E2E-01` |
| 38 | Call Usage Distribution Analytics| Reports | `T1-DASH-03` | `T2-DASH-03` | `T3-DASH-03` | `T4-E2E-01` |
| 39 | Hybrid Bill Prediction Engine | Predictive AI | `T1-PRED-01` | `T2-PRED-01` | `T3-PRED-01` | `T4-E2E-01` |
| 40 | Explainable Prediction Insights | Predictive AI | `T1-PRED-02` | `T2-PRED-02` | `T3-PRED-02` | `T4-E2E-01` |
| 41 | Customer Usage Analytics Portal | Customer Portal | `T1-PORT-01` | `T2-PORT-01` | `T3-PORT-01` | `T4-E2E-01` |
| 42 | In-App Reminder & Alert Engine | Reminders | `T1-NOTIF-01` | `T2-NOTIF-01` | `T3-NOTIF-01` | `T4-E2E-01` |
| 43 | Reminder Deduplication System | Reminders | `T1-NOTIF-02` | `T2-NOTIF-02` | `T3-NOTIF-02` | `T4-E2E-01` |
| 44 | Complete Academic Documentation | Documentation | `T1-DOC-01` | `T2-DOC-01` | `T3-DOC-01` | `T4-E2E-01` |
| 45 | Academic PowerPoint Deck (.pptx) | Deliverables | `T1-DOC-02` | `T2-DOC-02` | `T3-DOC-02` | `T4-E2E-01` |
| 46 | Viva Technical Q&A Guide | Deliverables | `T1-DOC-03` | `T2-DOC-03` | `T3-DOC-03` | `T4-E2E-01` |
| 47 | 100% E2E Test Suite Pass | E2E Track | `T1-E2E-01` | `T2-E2E-01` | `T3-E2E-01` | `T4-E2E-01` |
| 48 | Adversarial Coverage Hardening | E2E Track | `T1-E2E-02` | `T2-E2E-02` | `T3-E2E-02` | `T4-E2E-01` |

---

## 6. Execution Commands & npm Script Definitions

The test runner scripts configured in `package.json`:

```json
{
  "scripts": {
    "test": "jest --runInBand",
    "test:e2e": "jest tests/e2e --runInBand",
    "test:e2e:runner": "tsx tests/e2e/test-runner.ts --all",
    "test:e2e:inprocess": "tsx tests/e2e/test-runner.ts --all --in-process",
    "test:e2e:tier1": "jest tests/e2e/tier1_feature_coverage.test.ts --runInBand",
    "test:e2e:tier2": "jest tests/e2e/tier2_boundaries_corners.test.ts --runInBand",
    "test:e2e:tier3": "jest tests/e2e/tier3_cross_feature.test.ts --runInBand",
    "test:e2e:tier4": "jest tests/e2e/tier4_realworld_scenarios.test.ts --runInBand",
    "test:e2e:bail": "jest tests/e2e --bail --runInBand"
  }
}
```

### Direct CLI Invocations
- Run all test tiers with Jest:
  ```bash
  npm run test:e2e
  ```
- Run with the master CLI coordinator against live server:
  ```bash
  npx tsx tests/e2e/test-runner.ts --all
  ```
- Run with the master CLI coordinator in-process (no TCP port binding):
  ```bash
  npx tsx tests/e2e/test-runner.ts --all --in-process
  ```
- Run syntax, structure, and registration verification dry-run:
  ```bash
  npx tsx tests/e2e/test-runner.ts --dry-run
  ```
- Run an individual tier with Jest:
  ```bash
  npm run test:e2e:tier1
  ```
- Run an individual tier with the master CLI coordinator:
  ```bash
  npx tsx tests/e2e/test-runner.ts --tier=1
  ```
- Run with bail on first failure:
  ```bash
  npm run test:e2e:bail
  ```

---

## 7. Readiness Trigger: `TEST_READY.md` Publishing Protocol

Upon successful implementation and self-verification of the test infrastructure and test suites across all 4 tiers, the E2E Test Writer publishes `TEST_READY.md` at the project root.
