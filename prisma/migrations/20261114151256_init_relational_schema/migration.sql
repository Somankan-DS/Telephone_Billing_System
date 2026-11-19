-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "prepaidBalance" DECIMAL NOT NULL DEFAULT 0.00,
    "creditLimit" DECIMAL NOT NULL DEFAULT 2000.00,
    "tariffPlanId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customers_tariffPlanId_fkey" FOREIGN KEY ("tariffPlanId") REFERENCES "tariff_plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tariff_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "monthlyRental" DECIMAL NOT NULL DEFAULT 0.00,
    "pulseSeconds" INTEGER NOT NULL DEFAULT 60,
    "validityDays" INTEGER,
    "rateLocal" DECIMAL NOT NULL DEFAULT 0.0000,
    "rateStd" DECIMAL NOT NULL DEFAULT 0.0000,
    "rateIsd" DECIMAL NOT NULL DEFAULT 0.0000,
    "includedLocalMinutes" INTEGER NOT NULL DEFAULT 0,
    "includedStdMinutes" INTEGER NOT NULL DEFAULT 0,
    "includedIsdMinutes" INTEGER NOT NULL DEFAULT 0,
    "connectionCharge" DECIMAL NOT NULL DEFAULT 0.0000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "free_allowance_buckets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "tariffPlanId" TEXT NOT NULL,
    "localMinutesRemaining" DECIMAL NOT NULL DEFAULT 0.0000,
    "stdMinutesRemaining" DECIMAL NOT NULL DEFAULT 0.0000,
    "isdMinutesRemaining" DECIMAL NOT NULL DEFAULT 0.0000,
    "resetDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "free_allowance_buckets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "free_allowance_buckets_tariffPlanId_fkey" FOREIGN KEY ("tariffPlanId") REFERENCES "tariff_plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "call_detail_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceCallId" TEXT,
    "cdrHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "receiverNumber" TEXT NOT NULL,
    "callType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "billableSeconds" INTEGER NOT NULL DEFAULT 0,
    "pulseCount" INTEGER NOT NULL DEFAULT 0,
    "ratePerMinute" DECIMAL NOT NULL DEFAULT 0.0000,
    "freeMinutesDeducted" DECIMAL NOT NULL DEFAULT 0.0000,
    "ratedAmount" DECIMAL NOT NULL DEFAULT 0.0000,
    "isBilled" BOOLEAN NOT NULL DEFAULT false,
    "billingCycleCode" TEXT,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "call_detail_records_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "call_detail_records_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "billingCycleCode" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "rentalAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "callCharges" DECIMAL NOT NULL DEFAULT 0.00,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "previousArrears" DECIMAL NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "pdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 1.0000,
    "unitRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "amount" DECIMAL NOT NULL DEFAULT 0.00,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "notes" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usage_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "billingCycleCode" TEXT NOT NULL,
    "totalLocalMinutes" DECIMAL NOT NULL DEFAULT 0.00,
    "totalStdMinutes" DECIMAL NOT NULL DEFAULT 0.00,
    "totalIsdMinutes" DECIMAL NOT NULL DEFAULT 0.00,
    "totalCallCount" INTEGER NOT NULL DEFAULT 0,
    "totalRatedAmount" DECIMAL NOT NULL DEFAULT 0.00,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "usage_summaries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_userId_key" ON "customers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_accountNumber_key" ON "customers"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customers_tariffPlanId_idx" ON "customers"("tariffPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_plans_planCode_key" ON "tariff_plans"("planCode");

-- CreateIndex
CREATE INDEX "tariff_plans_type_idx" ON "tariff_plans"("type");

-- CreateIndex
CREATE INDEX "tariff_plans_isActive_idx" ON "tariff_plans"("isActive");

-- CreateIndex
CREATE INDEX "free_allowance_buckets_resetDate_idx" ON "free_allowance_buckets"("resetDate");

-- CreateIndex
CREATE UNIQUE INDEX "free_allowance_buckets_customerId_tariffPlanId_key" ON "free_allowance_buckets"("customerId", "tariffPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "call_detail_records_cdrHash_key" ON "call_detail_records"("cdrHash");

-- CreateIndex
CREATE INDEX "call_detail_records_customerId_isBilled_idx" ON "call_detail_records"("customerId", "isBilled");

-- CreateIndex
CREATE INDEX "call_detail_records_customerId_billingCycleCode_idx" ON "call_detail_records"("customerId", "billingCycleCode");

-- CreateIndex
CREATE INDEX "call_detail_records_startTime_idx" ON "call_detail_records"("startTime");

-- CreateIndex
CREATE INDEX "call_detail_records_callerNumber_idx" ON "call_detail_records"("callerNumber");

-- CreateIndex
CREATE INDEX "call_detail_records_callType_idx" ON "call_detail_records"("callType");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "invoices_billingCycleCode_idx" ON "invoices"("billingCycleCode");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_customerId_billingCycleCode_key" ON "invoices"("customerId", "billingCycleCode");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_category_idx" ON "invoice_items"("category");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionRef_key" ON "payments"("transactionRef");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_customerId_idx" ON "payments"("customerId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_customerId_isRead_idx" ON "notifications"("customerId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "usage_summaries_billingCycleCode_idx" ON "usage_summaries"("billingCycleCode");

-- CreateIndex
CREATE UNIQUE INDEX "usage_summaries_customerId_billingCycleCode_key" ON "usage_summaries"("customerId", "billingCycleCode");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
