CREATE TABLE "ImplementationProject" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "config" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "learningMode" TEXT NOT NULL DEFAULT 'Guided', "guideStep" INTEGER NOT NULL DEFAULT 0,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ImplementationProject_ownerId_idx" ON "ImplementationProject"("ownerId");
CREATE TABLE "ImplementationRelease" (
 "id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "stage" TEXT NOT NULL,
 "config" TEXT NOT NULL, "configHash" TEXT NOT NULL, "sourceVersion" INTEGER NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ImplementationRelease_projectId_stage_idx" ON "ImplementationRelease"("projectId", "stage");
CREATE TABLE "ImplementationHire" (
 "id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
 "environment" TEXT NOT NULL, "config" TEXT NOT NULL, "configHash" TEXT NOT NULL,
 "payload" TEXT NOT NULL, "initiator" TEXT NOT NULL, "assignee" TEXT,
 "step" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL, "history" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImplementationHire_projectId_requestKey_key" ON "ImplementationHire"("projectId", "requestKey");
CREATE TABLE "ImplementationWorker" (
 "id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "hireId" TEXT,
 "externalId" TEXT NOT NULL, "environment" TEXT NOT NULL, "name" TEXT NOT NULL,
 "orgId" TEXT NOT NULL, "profileId" TEXT NOT NULL, "locationId" TEXT NOT NULL,
 "positionId" TEXT, "salary" INTEGER NOT NULL, "effectiveDate" TEXT NOT NULL,
 "onboarding" TEXT NOT NULL, "source" TEXT NOT NULL,
 FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("hireId") REFERENCES "ImplementationHire"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImplementationWorker_hireId_key" ON "ImplementationWorker"("hireId");
CREATE UNIQUE INDEX "ImplementationWorker_projectId_environment_externalId_key" ON "ImplementationWorker"("projectId", "environment", "externalId");
CREATE UNIQUE INDEX "ImplementationWorker_projectId_environment_positionId_key" ON "ImplementationWorker"("projectId", "environment", "positionId");
CREATE TABLE "ImplementationEvidence" (
 "id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "configHash" TEXT NOT NULL, "result" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ImplementationEvidence_projectId_kind_idx" ON "ImplementationEvidence"("projectId", "kind");
