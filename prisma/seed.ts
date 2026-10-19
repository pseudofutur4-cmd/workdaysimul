import { db } from "../lib/db";
import { passwordHash } from "../lib/auth";
export async function seed() {
  await db.$executeRawUnsafe("DROP TRIGGER IF EXISTS audit_no_update");
  await db.$executeRawUnsafe("DROP TRIGGER IF EXISTS audit_no_delete");
  await db.$transaction(
    async (tx) => {
      for (const table of [
        "ImplementationEvidence",
        "ImplementationWorker",
        "ImplementationHire",
        "ImplementationRelease",
        "ImplementationProject",
        "TutorialProgress",
        "AcademyLedgerLine",
        "AcademyPurchase",
        "AcademyTimeEntry",
        "AcademyGoal",
        "AcademyPayslip",
        "AcademyRun",
        "AcademyAccessTest",
        "AcademyCase",
        "PracticeAttempt",
        "LearningEnrollment",
        "LearningCourse",
        "TimeOffRequest",
        "TimeOffBalance",
        "BenefitEnrollment",
        "BenefitPlan",
        "AuditEvent",
        "ApprovalTask",
        "OnboardingTask",
        "Process",
        "ProcessDefinition",
        "Candidate",
        "Requisition",
        "Session",
        "User",
        "Policy",
        "Compensation",
        "Employment",
        "Contact",
        "PreHire",
        "Worker",
        "Position",
        "JobProfile",
        "JobFamily",
      ])
        await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
      await tx.organization.updateMany({ data: { parentId: null } });
      for (const table of ["Organization", "Location", "Company", "Tenant"])
        await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
      await tx.tenant.create({
        data: { id: "lab", name: "Aster Vale • Practice Tenant" },
      });
      for (let i = 0; i < 3; i++) {
        await tx.company.create({
          data: {
            id: "company-" + i,
            name: [
              "Aster Vale France (fictional)",
              "Aster Vale Sweden (fictional)",
              "Aster Vale US (fictional)",
            ][i],
            country: ["FR", "SE", "US"][i],
            tenantId: "lab",
          },
        });
        await tx.location.create({
          data: {
            id: "loc-" + i,
            name: ["Paris • Studio", "Stockholm • Hub", "Boston • Office"][i],
            country: ["FR", "SE", "US"][i],
          },
        });
      }
      const teams = [
        "People Operations",
        "Product Engineering",
        "Customer Experience",
        "Finance",
        "Research & Design",
      ];
      for (let i = 1; i <= 25; i++)
        await tx.organization.create({
          data: {
            id: `org-${String(i).padStart(2, "0")}`,
            name: teams[(i - 1) % 5] + (i > 5 ? " " + Math.ceil(i / 5) : ""),
            companyId: "company-" + ((i - 1) % 3),
            costCenter: "CC-" + (100 + i),
            parentId: i === 1 ? null : "org-01",
            managerId: "manager-" + i,
          },
        });
      for (let i = 0; i < 5; i++)
        await tx.jobFamily.create({
          data: {
            id: "family-" + i,
            name: ["People", "Engineering", "Operations", "Finance", "Design"][
              i
            ],
          },
        });
      for (let i = 0; i < 50; i++)
        await tx.jobProfile.create({
          data: {
            id: "profile-" + i,
            name:
              [
                "People Specialist",
                "Software Engineer",
                "Operations Analyst",
                "Finance Analyst",
                "Product Designer",
              ][i % 5] +
              " " +
              (Math.floor(i / 5) + 1),
            familyId: "family-" + (i % 5),
            effectiveDate: "2024-01-01",
          },
        });
      for (let i = 0; i < 360; i++)
        await tx.position.create({
          data: {
            id: "pos-" + String(i + 1).padStart(3, "0"),
            title:
              [
                "People Specialist",
                "Software Engineer",
                "Operations Analyst",
                "Finance Analyst",
                "Product Designer",
              ][i % 5] +
              " " +
              (Math.floor(i / 50) + 1),
            orgId: `org-${String((i % 25) + 1).padStart(2, "0")}`,
            profileId: "profile-" + (i % 50),
            locationId: "loc-" + (i % 3),
            earliestDate: "2024-01-01",
            status: i < 300 ? "Filled" : "Open",
          },
        });
      const first = [
        "Avery",
        "Jordan",
        "Morgan",
        "Riley",
        "Casey",
        "Taylor",
        "Quinn",
        "Harper",
        "Skyler",
        "Reese",
      ];
      const last = [
        "Bennett",
        "Chen",
        "Laurent",
        "Lind",
        "Patel",
        "Reed",
        "Silva",
        "Brooks",
        "Park",
        "Ellis",
      ];
      for (let i = 0; i < 300; i++)
        await tx.worker.create({
          data: {
            id: "worker-" + String(i + 1).padStart(3, "0"),
            name:
              i === 0
                ? "Alex Morgan"
                : first[i % 10] +
                  " " +
                  last[Math.floor(i / 10) % 10] +
                  " " +
                  (Math.floor(i / 100) + 1),
            workerType: i % 15 === 14 ? "Contingent" : "Employee",
            contact: {
              create: {
                workEmail: `worker${i + 1}@aster.example`,
                personalEmail: `person${i + 1}@home.example`,
              },
            },
            employments: {
              create: {
                positionId: "pos-" + String(i + 1).padStart(3, "0"),
                orgId: `org-${String((i % 25) + 1).padStart(2, "0")}`,
                title:
                  [
                    "People Specialist",
                    "Software Engineer",
                    "Operations Analyst",
                    "Finance Analyst",
                    "Product Designer",
                  ][i % 5] +
                  " " +
                  (Math.floor(i / 50) + 1),
                status: "Active",
                hours: 40,
                effectiveDate: "2024-01-01",
              },
            },
            compensation: {
              create: {
                annualAmount: 45000 + (i % 8) * 7000,
                effectiveDate: "2024-01-01",
              },
            },
            balance: { create: {} },
          },
        });
      for (let i = 0; i < 30; i++)
        await tx.preHire.create({
          data: {
            id: "prehire-" + String(i + 1).padStart(3, "0"),
            name:
              i === 0
                ? "Jamie Rivera"
                : first[i % 10] +
                  " " +
                  last[(i + 3) % 10] +
                  " (Applicant " +
                  (i + 1) +
                  ")",
            email: `applicant${i + 1}@candidate.example`,
            orgId: `org-${String((i % 25) + 1).padStart(2, "0")}`,
          },
        });
      const hash = passwordHash("Practice123!");
      for (const [id, name, role, orgId, workerId] of [
        ["hr", "Sam Ellis", "HR Administrator", null, null],
        ["hr-partner", "Cameron Reed", "HR Partner", null, null],
        ["security", "Devon Park", "Security Administrator", null, null],
        ["recruiter", "Rowan Lee", "Recruiting Partner", null, null],
        ["comp", "Finley Chen", "Compensation Partner", null, null],
        ["benefits", "Emery Silva", "Benefits Administrator", null, null],
        ["auditor", "Drew Brooks", "Auditor", null, null],
        ["employee", "Alex Morgan", "Employee", "org-01", "worker-001"],
        ["candidate", "Jamie Rivera", "Candidate", "org-01", null],
      ] as const)
        await tx.user.create({
          data: { id, name, role, orgId, workerId, passwordHash: hash },
        });
      for (let i = 1; i <= 25; i++)
        await tx.user.create({
          data: {
            id: "manager-" + i,
            name: i === 1 ? "Robin Bennett" : "Team Manager " + i,
            role: "Manager",
            orgId: `org-${String(i).padStart(2, "0")}`,
            passwordHash: hash,
          },
        });
      const roles: Record<string, string[]> = {
        "HR Administrator": [
          "workers.view",
          "contact.view",
          "contact.modify",
          "staffing.initiate",
          "foundations.modify",
          "process.approve",
          "compensation.view",
          "compensation.modify",
          "reports.view",
          "audit.view",
          "practice.use",
        ],
        "HR Partner": [
          "workers.view",
          "contact.view",
          "process.approve",
          "reports.view",
          "audit.view",
          "practice.use",
        ],
        Manager: [
          "workers.view",
          "staffing.initiate",
          "process.approve",
          "reports.view",
          "practice.use",
        ],
        Employee: [
          "workers.view",
          "contact.view",
          "contact.modify",
          "absence.request",
          "benefits.self",
          "learning.self",
          "practice.use",
        ],
        "Recruiting Partner": [
          "recruiting.modify",
          "workers.view",
          "reports.view",
          "practice.use",
        ],
        "Compensation Partner": [
          "workers.view",
          "compensation.view",
          "compensation.modify",
          "process.approve",
          "reports.view",
          "practice.use",
        ],
        "Benefits Administrator": [
          "workers.view",
          "reports.view",
          "practice.use",
        ],
        "Security Administrator": [
          "security.modify",
          "audit.view",
          "practice.use",
        ],
        Auditor: ["workers.view", "reports.view", "audit.view", "practice.use"],
        Candidate: [],
      };
      for (const [role, domains] of Object.entries(roles))
        for (const domain of domains)
          await tx.policy.create({ data: { role, domain, granted: true } });
      for (const [kind, name, initiatorRoles, approvalRole, finalReview] of [
        ["Hire", "Hire Employee", "HR Administrator", "Manager", true],
        [
          "Change Job",
          "Change Job",
          "HR Administrator,Manager",
          "HR Partner",
          false,
        ],
        [
          "Termination",
          "Terminate Employee",
          "HR Administrator",
          "Manager",
          true,
        ],
        [
          "Compensation",
          "Propose Compensation Change",
          "HR Administrator",
          "Compensation Partner",
          false,
        ],
        ["Time Off", "Request Time Off", "Employee", "Manager", false],
        [
          "Requisition",
          "Create Job Requisition",
          "Recruiting Partner",
          "Manager",
          false,
        ],
        [
          "Offer",
          "Approve Candidate Offer",
          "Recruiting Partner",
          "Manager",
          false,
        ],
      ] as const)
        await tx.processDefinition.create({
          data: {
            kind,
            name,
            initiatorRoles,
            approvalRole,
            finalReview,
            simulationNotes:
              "Independent practice route; configurable per tenant. See docs/RESEARCH_REGISTER.md.",
          },
        });
      for (let i = 0; i < 5; i++)
        await tx.benefitPlan.create({
          data: {
            id: "benefit-" + i,
            name: [
              "Medical • Essential",
              "Dental • Plus",
              "Vision • Standard",
              "Wellbeing • Flexible",
              "Life • Basic",
            ][i],
            monthlyCost: [80, 18, 8, 20, 12][i],
            windowStart: "2024-01-01",
            windowEnd: "2030-12-31",
          },
        });
      for (let i = 0; i < 4; i++)
        await tx.learningCourse.create({
          data: {
            id: "course-" + i,
            name: [
              "Welcome to Aster Vale",
              "Data privacy essentials",
              "Inclusive teams",
              "Manager foundations",
            ][i],
          },
        });
      for (let i = 0; i < 12; i++) {
        const r = await tx.requisition.create({
          data: {
            id: "req-" + i,
            title: "Hiring • " + teams[i % 5],
            positionId: "pos-" + String(301 + i).padStart(3, "0"),
            status: "Open",
            posted: true,
          },
        });
        await tx.candidate.create({
          data: {
            id: "candidate-" + i,
            name: first[i % 10] + " " + last[(i + 2) % 10],
            email: `recruit${i}@candidate.example`,
            requisitionId: r.id,
            stage: ["Applied", "Review", "Interview"][i % 3],
          },
        });
      }
      for (let i = 1; i <= 10; i++) {
        const orgId = `org-${String(i).padStart(2, "0")}`;
        const ph = await tx.preHire.create({
          data: {
            id: "prehire-pending-" + i,
            name: "Practice Newcomer " + i,
            email: `pending${i}@candidate.example`,
            orgId,
          },
        });
        const p = await tx.process.create({
          data: {
            id: "seed-hire-" + i,
            kind: "Hire",
            version: 1,
            initiatorId: "hr",
            orgId,
            prehireId: ph.id,
            positionId: "pos-" + (350 + i),
            status: "Submitted",
            effectiveDate: "2026-11-01",
            reason: "New hire",
            hours: 40,
            requestKey: "seed-pending-hire-" + i,
            createdAt: new Date("2026-10-01T09:00:00Z"),
          },
        });
        await tx.approvalTask.create({
          data: {
            processId: p.id,
            assigneeId: "manager-" + i,
            step: "Manager Approval",
          },
        });
        await tx.position.update({
          where: { id: p.positionId! },
          data: { status: "Reserved" },
        });
      }
    },
    { timeout: 120000 },
  );
  await db.$executeRawUnsafe(
    "CREATE TRIGGER audit_no_update BEFORE UPDATE ON AuditEvent BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END",
  );
  await db.$executeRawUnsafe(
    "CREATE TRIGGER audit_no_delete BEFORE DELETE ON AuditEvent BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END",
  );
  console.log(
    "Seeded 300 workers, 25 orgs, 360 positions, 40 pre-hires, 12 requisitions, 10 pending approvals. Demo password: Practice123!",
  );
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/prisma/seed.ts"))
  seed().finally(() => db.$disconnect());
