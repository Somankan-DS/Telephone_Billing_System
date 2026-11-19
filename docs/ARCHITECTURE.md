# TeleBill Pro — System Architecture & Design Specification

## 1. Architectural Paradigm: Modular Monolith

TeleBill Pro is architected as a **Modular Monolith** using TypeScript and Node.js. 

Rather than fragmenting a student/prototype application into overengineered microservices with network latency, distributed transactions, and RPC overhead, the system encapsulates domain logic into strict, decoupled, and independently testable modules within a single high-performance Express application runtime.

```mermaid
flowchart TD
    subgraph ClientLayer["Presentation Layer (SPA & Mobile Ready)"]
        UI["Web Single Page App (Tailwind CSS + Chart.js + Lucide)"]
        CLI["Automated Test Runner & CLI Tooling"]
    end

    subgraph Perimeter["Security & Perimeter Middleware"]
        Helmet["Helmet Security Headers"]
        CORS["CORS Policy Guard"]
        Parser["JSON / URL-Encoded Parser (10MB Cap)"]
        AuthMid["JWT Verification & 3-Tier RBAC (ADMIN/STAFF/CUSTOMER)"]
        IdorMid["Tenant Isolation & Anti-IDOR Guard"]
    end

    subgraph DomainModules["Core Domain Modules (src/modules)"]
        AuthMod["Auth Module (Bcrypt Cost 12, JWT)"]
        CustMod["Customer 360 (CRM Lifecycle)"]
        TariffMod["Tariff & Rating Rules (Pulses, Quotas)"]
        CdrMod["CDR Ingestion & Deduplication (SHA-256)"]
        RatingMod["Rating Service (Fixed-Point Math)"]
        BillingMod["Billing Engine (Cycles, GST, Arrears)"]
        PdfMod["Vector PDF Invoice Generator (PDFKit)"]
        PaymentMod["Payment Gateway Simulator (Idempotent)"]
        AnalyticsMod["Analytics & Prediction (HWMA Algorithm)"]
        NotifMod["Notifications & Automated Dunning"]
    end

    subgraph StorageLayer["Data & Persistence Layer"]
        PrismaORM["Prisma ORM Query Builder (Parameterized Queries)"]
        SQLiteWAL[("SQLite Database Engine with WAL Mode enabled")]
    end

    ClientLayer --> Perimeter
    Perimeter --> DomainModules
    CdrMod --> RatingMod
    BillingMod --> RatingMod
    BillingMod --> PdfMod
    BillingMod --> NotifMod
    PaymentMod --> BillingMod
    DomainModules --> PrismaORM
    PrismaORM --> SQLiteWAL
```

---

## 2. Directory Structure & Module Layout

The codebase enforces strict separation of concerns:

```
c:\Users\soman\OneDrive\Desktop\Innovative project\
├── prisma/
│   ├── schema.prisma           # 11-table relational data model
│   └── seed.ts                 # Idempotent database seeding engine
├── public/                     # Client-side SPA web assets
│   ├── index.html              # Modern Tailwind dashboard layout
│   ├── styles.css              # Custom design system classes
│   └── app.js                  # Interactive client-side application logic
├── src/
│   ├── app.ts                  # Express application setup & middleware pipeline
│   ├── server.ts               # HTTP listener & graceful shutdown coordinator
│   ├── modules/
│   │   ├── auth/               # Bcrypt password hashing, JWT sessions, RBAC guards
│   │   ├── customers/          # Subscriber onboarding, lifecycle state machine, CRM 360
│   │   ├── tariffs/            # Multi-tier pricing rules, pulses, allowance buckets
│   │   ├── rating/             # Fixed-point deterministic rating math (Decimal.js)
│   │   ├── cdr/                # Single/batch CSV ingestion, SHA-256 hash, Poisson simulator
│   │   ├── billing/            # Postpaid monthly cycle engine, GST tax, PDF invoices
│   │   ├── payments/           # Simulated gateway, idempotency checks, wallet credits
│   │   ├── analytics/          # Live KPIs, revenue trends, HWMA bill prediction
│   │   └── notifications/      # In-app alerts, 24h deduplication throttling
│   └── shared/
│       ├── config/             # Environment validation and company settings
│       ├── database/           # Prisma client singleton and WAL mode pragmas
│       ├── errors/             # AppError taxonomy (ValidationError, NotFoundError, etc.)
│       ├── middleware/         # Auth, RBAC, error handling, tenant perimeter guards
│       ├── types/              # Domain models, enums, DTOs, and interfaces
│       └── utils/              # Decimal.js financial math helpers
├── tests/
│   ├── unit/                   # Unit test suites (Bcrypt, JWT, Decimal.js)
│   ├── integration/            # Relational database, WAL mode, RBAC, IDOR tests
│   └── e2e/                    # Opaque-box E2E test suites (Tiers 1, 2, 3, 4)
└── docs/                       # Comprehensive academic & engineering documentation
```

---

## 3. Core Data Flow Pipelines

### A. Call Detail Record (CDR) Ingestion & Rating Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Probe as Telecom Mediation / Simulator
    participant CdrCtrl as CdrController (/api/cdrs)
    participant CdrSvc as CdrService
    participant Rating as RatingService (Decimal.js)
    participant DB as SQLite (Prisma ORM)

    Probe->>CdrCtrl: POST /api/cdrs (caller, receiver, duration, startTime)
    CdrCtrl->>CdrSvc: ingestCdr(dto)
    CdrSvc->>CdrSvc: Compute SHA-256 Fingerprint (caller:receiver:time:duration)
    CdrSvc->>DB: Check if cdrHash exists
    alt Duplicate Hash Found
        DB-->>CdrSvc: Return existing record
        CdrSvc-->>CdrCtrl: Return CDR with is_duplicate = true
        CdrCtrl-->>Probe: HTTP 200 OK (Idempotent replay)
    else Unique Call Event
        CdrSvc->>DB: Resolve Customer & Active Tariff Plan
        alt Customer Suspended / Inactive
            CdrSvc-->>CdrCtrl: Throw ValidationError (Account Barred)
            CdrCtrl-->>Probe: HTTP 400 Bad Request
        else Customer Active
            CdrSvc->>DB: Query FreeAllowanceBucket (Local/STD/ISD minutes)
            CdrSvc->>Rating: calculateRating(duration, pulse, rate, allowance)
            Rating-->>CdrSvc: RatingResult (pulseCount, freeMinutesDeducted, ratedAmount)
            alt Plan is Prepaid & ratedAmount > 0
                alt Prepaid Balance < ratedAmount
                    CdrSvc-->>CdrCtrl: Throw ValidationError (Insufficient Balance)
                    CdrCtrl-->>Probe: HTTP 400 Bad Request
                else Sufficient Balance
                    CdrSvc->>DB: Decrement customer.prepaidBalance
                end
            end
            CdrSvc->>DB: Update FreeAllowanceBucket & Insert CallDetailRecord
            DB-->>CdrSvc: Created CDR Record
            CdrSvc-->>CdrCtrl: Return rated CDR object
            CdrCtrl-->>Probe: HTTP 201 Created
        end
    end
```

---

### B. Monthly Billing Run & Invoice Settlement Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Billing Operator
    participant BillCtrl as BillingController (/api/billing/run-cycle)
    participant BillSvc as BillingService
    participant TaxEngine as Decimal Tax Engine (18% GST)
    participant DB as SQLite (Prisma ORM)

    Admin->>BillCtrl: POST /api/billing/run-cycle (billingCycleCode, customerId)
    BillCtrl->>BillSvc: runBillingCycle(dto)
    BillSvc->>DB: Check for existing invoice (customerId + billingCycleCode)
    alt Already Invoiced for Cycle
        DB-->>BillSvc: Existing Invoice
        BillSvc-->>BillCtrl: Return existing invoice (Duplicate Safe)
    else Fresh Cycle Run
        BillSvc->>DB: Fetch unbilled CDRs where isBilled = false
        BillSvc->>BillSvc: Aggregate callCharges = sum(cdr.ratedAmount)
        BillSvc->>BillSvc: Compute monthly rental based on customer plan
        BillSvc->>TaxEngine: calculateTax(rental + callCharges) -> 18% GST
        BillSvc->>DB: Query previous unpaid invoices (status != 'PAID')
        BillSvc->>BillSvc: Aggregate previousArrears (Tax Isolated)
        BillSvc->>BillSvc: totalAmount = rental + usage + GST + previousArrears
        BillSvc->>DB: BEGIN TRANSACTION (Atomic Invoice + Items + CDR Mark)
        DB-->>BillSvc: Invoice Generated (INV-YYYYMM-XXXXX)
        BillSvc-->>BillCtrl: Return BillingRunSummary
        BillCtrl-->>Admin: HTTP 200 OK (Generated Invoices)
    end
```

---

## 4. Dual Routing Compatibility Contract

To accommodate standard RESTful convention alongside backward compatibility with external testing harnesses, all domain modules are dual-mounted in `src/app.ts`:
- Canonical Root: `/api/{resource}`
- Versioned Root: `/api/v1/{resource}`

Any request addressed to `/api/customers` or `/api/v1/customers` resolves to the identical controller action, preventing fragile route mismatches during integration testing.

---

## 5. Concurrency Model: SQLite Write-Ahead Logging (WAL)

Standard SQLite configurations execute in `DELETE` journal mode, locking the entire database during write transactions and causing `SQLITE_BUSY` errors under concurrent traffic.

TeleBill Pro activates SQLite Write-Ahead Logging (WAL) pragmas on database connection initialization (`src/shared/database.ts`):
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
```

### Engineering Implications:
1. **Concurrent Non-Blocking Reads:** Readers do not block writers, and writers do not block readers. Subscribers can inspect their live dashboards while automated billing runs write thousands of invoice line items.
2. **Busy Timeout Resilience:** If two threads attempt concurrent writes, SQLite waits up to 5000 milliseconds for lock release before throwing `SQLITE_BUSY`.
3. **Data Durability:** `synchronous = NORMAL` in WAL mode provides ACID compliance without the severe disk sync performance penalty of `FULL`.
