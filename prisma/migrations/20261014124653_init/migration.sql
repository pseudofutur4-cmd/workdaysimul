-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "companyId" TEXT NOT NULL,
    "costCenter" TEXT NOT NULL,
    "managerId" TEXT,
    CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "JobProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    CONSTRAINT "JobProfile_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "JobFamily" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "earliestDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    CONSTRAINT "Position_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Position_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "JobProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Position_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreHire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "workerId" TEXT,
    CONSTRAINT "PreHire_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PreHire_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "workerType" TEXT NOT NULL DEFAULT 'Employee'
);

-- CreateTable
CREATE TABLE "Contact" (
    "workerId" TEXT NOT NULL PRIMARY KEY,
    "workEmail" TEXT NOT NULL,
    "personalEmail" TEXT NOT NULL,
    CONSTRAINT "Contact_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processId" TEXT,
    CONSTRAINT "Employment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Compensation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "annualAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "effectiveDate" TEXT NOT NULL,
    "processId" TEXT,
    CONSTRAINT "Compensation_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "orgId" TEXT,
    "workerId" TEXT,
    CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessDefinition" (
    "kind" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceVersion" TEXT NOT NULL DEFAULT '2024-08-22',
    "observedAt" TEXT NOT NULL DEFAULT '2026-10-14',
    "confidence" TEXT NOT NULL DEFAULT 'inferred-routing',
    "simulationNotes" TEXT NOT NULL,
    "initiatorRoles" TEXT NOT NULL,
    "approvalRole" TEXT NOT NULL,
    "finalReview" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workerId" TEXT,
    "prehireId" TEXT,
    "positionId" TEXT,
    "requisitionId" TEXT,
    "status" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "hours" REAL NOT NULL DEFAULT 40,
    "amount" INTEGER,
    "endDate" TEXT,
    "days" INTEGER,
    "comment" TEXT NOT NULL DEFAULT '',
    "requestKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Process_kind_fkey" FOREIGN KEY ("kind") REFERENCES "ProcessDefinition" ("kind") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Process_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Process_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Process_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_prehireId_fkey" FOREIGN KEY ("prehireId") REFERENCES "PreHire" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "actedAt" DATETIME,
    CONSTRAINT "ApprovalTask_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OnboardingTask_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "orgId" TEXT,
    "processId" TEXT,
    "effectiveDate" TEXT,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'Allowed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "posted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Requisition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'Applied',
    "prehireId" TEXT,
    CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Candidate_prehireId_fkey" FOREIGN KEY ("prehireId") REFERENCES "PreHire" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenefitPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "monthlyCost" INTEGER NOT NULL,
    "employeeOnly" BOOLEAN NOT NULL DEFAULT true,
    "windowStart" TEXT NOT NULL,
    "windowEnd" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BenefitEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    CONSTRAINT "BenefitEnrollment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BenefitEnrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BenefitPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeOffBalance" (
    "workerId" TEXT NOT NULL PRIMARY KEY,
    "entitlement" INTEGER NOT NULL DEFAULT 25,
    "used" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TimeOffBalance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TimeOffRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "LearningEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LearningEnrollment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LearningCourse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "baselineAudit" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "JobProfile_name_familyId_effectiveDate_key" ON "JobProfile"("name", "familyId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "PreHire_email_key" ON "PreHire"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PreHire_workerId_key" ON "PreHire"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Employment_processId_key" ON "Employment"("processId");

-- CreateIndex
CREATE INDEX "Employment_orgId_effectiveDate_idx" ON "Employment"("orgId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "Employment_workerId_effectiveDate_key" ON "Employment"("workerId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "Compensation_processId_key" ON "Compensation"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "Compensation_workerId_effectiveDate_key" ON "Compensation"("workerId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_workerId_key" ON "User"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_role_domain_key" ON "Policy"("role", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Process_requestKey_key" ON "Process"("requestKey");

-- CreateIndex
CREATE INDEX "Process_orgId_status_idx" ON "Process"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTask_workerId_label_key" ON "OnboardingTask"("workerId", "label");

-- CreateIndex
CREATE INDEX "AuditEvent_objectId_idx" ON "AuditEvent"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_prehireId_key" ON "Candidate"("prehireId");

-- CreateIndex
CREATE UNIQUE INDEX "BenefitEnrollment_workerId_planId_key" ON "BenefitEnrollment"("workerId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffRequest_processId_key" ON "TimeOffRequest"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEnrollment_workerId_courseId_key" ON "LearningEnrollment"("workerId", "courseId");
