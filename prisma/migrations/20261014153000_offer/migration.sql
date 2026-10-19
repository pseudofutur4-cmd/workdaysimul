ALTER TABLE "Process" ADD COLUMN "candidateId" TEXT REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "ProcessDefinition" ("kind","name","simulationNotes","initiatorRoles","approvalRole","finalReview") VALUES ('Offer','Approve Candidate Offer','Independent practice route; manager decision precedes simulated acceptance.','Recruiting Partner','Manager',false);
