-- CreateTable
CREATE TABLE "AcademyCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "orgId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" TEXT NOT NULL,
    "feedback" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademyCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AcademyCase_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AcademyCase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyLedgerLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "debitCents" INTEGER NOT NULL,
    "creditCents" INTEGER NOT NULL,
    "accountingDate" TEXT NOT NULL,
    CONSTRAINT "AcademyLedgerLine_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AcademyCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyPurchase" (
    "caseId" TEXT NOT NULL PRIMARY KEY,
    "item" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AcademyPurchase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AcademyCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyTimeEntry" (
    "caseId" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "workDate" TEXT NOT NULL,
    "regularMinutes" INTEGER NOT NULL,
    "overtimeMinutes" INTEGER NOT NULL,
    CONSTRAINT "AcademyTimeEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AcademyCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyGoal" (
    "caseId" TEXT NOT NULL PRIMARY KEY,
    "goal" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "measure" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "managerRating" INTEGER NOT NULL,
    "managerFeedback" TEXT NOT NULL,
    CONSTRAINT "AcademyGoal_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AcademyCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyPayslip" (
    "caseId" TEXT NOT NULL PRIMARY KEY,
    "grossCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "deductionCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    CONSTRAINT "AcademyPayslip_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AcademyCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyRun" (
    "caseId" TEXT NOT NULL PRIMARY KEY,
    "output" TEXT NOT NULL,
    "log" TEXT NOT NULL,
    CONSTRAINT "AcademyRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AcademyCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademyAccessTest" (
    "caseId" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "approvalAllowed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AcademyAccessTest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AcademyCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TutorialProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lesson" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "caseId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TutorialProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AcademyCase_module_ownerId_idx" ON "AcademyCase"("module", "ownerId");

-- CreateIndex
CREATE INDEX "AcademyCase_reviewerId_status_idx" ON "AcademyCase"("reviewerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyTimeEntry_ownerId_workDate_key" ON "AcademyTimeEntry"("ownerId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "TutorialProgress_userId_lesson_key" ON "TutorialProgress"("userId", "lesson");
