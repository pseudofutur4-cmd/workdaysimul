import { z } from "zod";
import { date } from "./validators";

export const implementationSources = [
  {
    id: "IMP-ORG",
    title: "Workday: Organization setup considerations",
    url: "https://doc.workday.com/admin-guide/en-us/manage-workday/organizations/ivq1568755825744.html",
    note: "Organization, staffing, role and reporting dependencies; local editor and examples are original.",
  },
  {
    id: "IMP-BP",
    title: "Workday: Business process setup considerations",
    url: "https://doc.workday.com/admin-guide/en-us/manage-workday/business-processes/business-process-framework-concepts/khy1593557050505.html",
    note: "Role routing, conditions and distinct business process security; local Hire route is a teaching configuration.",
  },
  {
    id: "IMP-DEP",
    title: "Workday: Launch Flex deployment overview",
    url: "https://community-content.workday.com/en-us/public/learn/resources/customer-deployment/launch-flex-overview.html",
    note: "Implementation lifecycle context; promotion gates and interview rubric here are simulator rules.",
  },
  {
    id: "IMP-SEC",
    title: "Workday: Shared responsibility",
    url: "https://security.workday.com/shared-responsibility",
    note: "Hosted platform responsibility boundary. No real tenant provisioning occurs here.",
  },
];
export const implementationChapters = [
  {
    id: "brief",
    title: "Discover & design",
    short: "Client brief",
    minutes: 8,
    source: "IMP-DEP",
    objective: "Turn a client's requirements into decisions you can defend.",
    explain:
      "Configuration starts with business requirements. Identify who owns each decision, what data is in scope, and how success will be demonstrated.",
    task: "Read the two-company brief. Record your organization design, security boundary, and acceptance criteria.",
    question:
      "What would you clarify before configuring a new HCM environment?",
    hint: "Separate legal reporting, management reporting, access requirements, and a measurable acceptance test.",
  },
  {
    id: "foundations",
    title: "Build the foundation",
    short: "Organizations",
    minutes: 15,
    source: "IMP-ORG",
    objective:
      "Create legal and management structures with valid dependencies.",
    explain:
      "A company represents a legal entity; a supervisory organization groups workers under management. A cost center supports costing. They answer different business questions even when their names resemble each other.",
    task: "Create two companies, locations and cost centers. Add a root supervisory organization and a child. Assign a company, cost center and staffing model to each.",
    question:
      "Why should a supervisory organization and a cost center be separate objects?",
    hint: "A manager change should not require redesigning the legal or financial reporting structure.",
  },
  {
    id: "staffing",
    title: "Design jobs & positions",
    short: "Staffing",
    minutes: 12,
    source: "IMP-ORG",
    objective: "Choose the right staffing model and enforce its consequences.",
    explain:
      "In this lab, Position Management requires an approved open seat. Job Management lets the hire reference a job profile directly. A job profile describes the type of work; a position represents a seat in a particular organization.",
    task: "Create a job profile and an open position for your Position Management organization. Explain when a seat should exist before a worker is hired.",
    question:
      "When would you choose Position Management instead of Job Management?",
    hint: "Discuss headcount control and persistent seats versus flexible staffing. Consider reporting, approvals and operational effort.",
  },
  {
    id: "security",
    title: "Set access boundaries",
    short: "Security",
    minutes: 15,
    source: "IMP-BP",
    objective:
      "Distinguish data visibility from permission to participate in a process.",
    explain:
      "Domain access and business process participation are separate decisions. Viewing a worker must not automatically grant salary access or permission to approve a Hire. The sandbox evaluates these decisions on the server.",
    task: "Assign an HR Admin, Manager and HR Partner. Set worker visibility, salary visibility, Hire initiation and Hire approval separately. Keep employee salary access denied.",
    question:
      "A manager can view a worker but cannot approve their hire. What would you investigate?",
    hint: "Check the pending step, organizational role assignment, business process approval permission, and organization scope separately.",
  },
  {
    id: "process",
    title: "Configure Hire",
    short: "Business process",
    minutes: 15,
    source: "IMP-BP",
    objective: "Connect role resolution, conditions, approvals and onboarding.",
    explain:
      "A process definition determines the route. Role assignments resolve the people for a particular organization. This lab snapshots configuration when a Hire starts, so later configuration edits do not silently rewrite an in-flight event.",
    task: "Select the first approval role, optionally require HR Partner review above a salary threshold, add final HR review and onboarding tasks. Test a missing-role failure.",
    question:
      "Why can a valid process definition still fail to route a transaction?",
    hint: "A definition can reference a role without anyone being assigned that role in the target organization.",
  },
  {
    id: "data",
    title: "Convert & reconcile data",
    short: "Data migration",
    minutes: 12,
    source: "IMP-DEP",
    objective: "Validate incoming records and reconcile persisted outcomes.",
    explain:
      "Imports depend on stable reference IDs and a dependency order. This lab validates every row before committing any of them. An error report is useful evidence; a success message alone is not reconciliation.",
    task: "Map a small synthetic CSV, preview its errors, then import valid workers. Deliberately use an unknown organization and confirm that no partial batch is saved.",
    question:
      "How would you investigate a worker conversion whose totals do not reconcile?",
    hint: "Compare source totals, rejected rows, reference mapping, duplicate identifiers, effective dates and target totals.",
  },
  {
    id: "reporting",
    title: "Report & exchange data",
    short: "Reports & integrations",
    minutes: 12,
    source: "IMP-ORG",
    objective:
      "Prove that reports and outbound data respect the same access boundary.",
    explain:
      "A report is another path to data. The local report and integration preview use the configured role, organization and salary permissions. Output is generated locally; no external system is contacted.",
    task: "Configure a worker report. Run it as HR and as a scoped manager. Enable a local outbound exchange and test the Integration User's permissions.",
    question: "What security checks belong in an outbound worker integration?",
    hint: "Consider the service identity, its data scope, permitted fields, transport, monitoring and reconciliation. Only identity, scope and fields are simulated here.",
  },
  {
    id: "launch",
    title: "Prove & release",
    short: "Testing & go-live",
    minutes: 15,
    source: "IMP-DEP",
    objective: "Produce evidence before promoting a configuration.",
    explain:
      "Configuration validation checks references. Acceptance testing checks behavior. This lab requires a current passing suite, completed sandbox Hire, committed worker conversion and nonempty exchange before Test release. Production requires the same configuration in the latest Test release.",
    task: "Complete a Hire in the sandbox, run the acceptance suite, promote to Test, then to simulated Production. Inspect the configuration diff and audit history.",
    question:
      "What evidence would you require before promoting a configuration?",
    hint: "Dependency validation, positive and negative security tests, a full transaction, reconciliation, sign-off, and a recovery plan.",
  },
] as const;
export type ChapterId = (typeof implementationChapters)[number]["id"];
export const previewRoles = [
  "HR Admin",
  "Manager",
  "HR Partner",
  "Employee",
  "Integration User",
] as const;
export const previewActors = [
  { id: "hr", name: "Alex Morgan", role: "HR Admin" },
  { id: "manager", name: "Jamie Reed", role: "Manager" },
  { id: "partner", name: "Taylor Quinn", role: "HR Partner" },
  { id: "employee", name: "Robin Vale", role: "Employee" },
  { id: "integration", name: "Local worker export", role: "Integration User" },
] as const;
const code = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z][A-Za-z0-9_-]{1,39}$/,
    "Use 2–40 letters, digits, hyphens or underscores; start with a letter",
  );
const name = z.string().trim().min(2).max(100);
const list = <T extends z.ZodType>(s: T) => z.array(s).max(100);
export const configSchema = z
  .object({
    design: z
      .object({
        organization: z.string().max(3000),
        security: z.string().max(3000),
        acceptance: z.string().max(3000),
      })
      .strict(),
    companies: list(
      z
        .object({
          id: code,
          name,
          country: z.enum(["FR", "SE", "US"]),
          currency: z.enum(["EUR", "SEK", "USD"]),
        })
        .strict(),
    ),
    locations: list(
      z
        .object({ id: code, name, country: z.enum(["FR", "SE", "US"]) })
        .strict(),
    ),
    costCenters: list(z.object({ id: code, name, companyId: code }).strict()),
    orgs: list(
      z
        .object({
          id: code,
          name,
          companyId: code,
          costCenterId: code,
          parentId: z.string().max(40),
          staffing: z.enum(["Position Management", "Job Management"]),
        })
        .strict(),
    ),
    profiles: list(z.object({ id: code, name, family: name }).strict()),
    positions: list(
      z
        .object({
          id: code,
          name,
          orgId: code,
          profileId: code,
          locationId: code,
        })
        .strict(),
    ),
    assignments: list(
      z
        .object({
          actorId: z.enum(
            previewActors.map((a) => a.id) as [string, ...string[]],
          ),
          orgId: code,
        })
        .strict(),
    ),
    policies: z
      .array(
        z
          .object({
            role: z.enum(previewRoles),
            workers: z.boolean(),
            salary: z.boolean(),
            initiate: z.boolean(),
            approve: z.boolean(),
          })
          .strict(),
      )
      .length(5),
    hire: z
      .object({
        firstApprover: z.enum(["Manager", "HR Partner"]),
        partnerThreshold: z.number().int().min(0).max(1000000),
        finalReview: z.boolean(),
        onboarding: z.array(name).max(8),
      })
      .strict(),
    report: z.object({ name, includeSalary: z.boolean() }).strict(),
    integration: z
      .object({
        enabled: z.boolean(),
        format: z.enum(["CSV", "JSON"]),
        includeSalary: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    for (const key of [
      "companies",
      "locations",
      "costCenters",
      "orgs",
      "profiles",
      "positions",
    ] as const) {
      if (new Set(c[key].map((x) => x.id)).size !== c[key].length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "IDs must be unique within this object type",
        });
    }
    if (new Set(c.policies.map((p) => p.role)).size !== 5)
      ctx.addIssue({
        code: "custom",
        path: ["policies"],
        message: "Exactly one policy per role is required",
      });
    if (
      new Set(c.assignments.map((a) => `${a.actorId}:${a.orgId}`)).size !==
      c.assignments.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["assignments"],
        message: "Duplicate role assignment",
      });
  });
export type ImplementationConfig = z.infer<typeof configSchema>;
export const emptyConfig = (): ImplementationConfig => ({
  design: { organization: "", security: "", acceptance: "" },
  companies: [],
  locations: [],
  costCenters: [],
  orgs: [],
  profiles: [],
  positions: [],
  assignments: [],
  policies: previewRoles.map((role) => ({
    role,
    workers: false,
    salary: false,
    initiate: false,
    approve: false,
  })),
  hire: {
    firstApprover: "Manager",
    partnerThreshold: 0,
    finalReview: false,
    onboarding: [],
  },
  report: { name: "Worker reconciliation", includeSalary: false },
  integration: { enabled: false, format: "CSV", includeSalary: false },
});
export const sandboxHireSchema = z
  .object({
    externalId: code,
    name,
    orgId: code,
    profileId: code,
    locationId: code,
    positionId: z.string().max(40),
    salary: z.coerce.number().int().min(1).max(1000000),
    effectiveDate: date,
  })
  .strict();
export type SandboxHireInput = z.infer<typeof sandboxHireSchema>;
export const sampleWorkerCsv =
  "employee_id,full_name,organization,job_profile,location,position,annual_salary,start_date\nCONV-001,Morgan Lane,SUP-SE,JP-ANALYST,LOC-SE,,48000,2026-10-01\nCONV-002,Casey Park,SUP-SE,JP-ANALYST,LOC-SE,,52000,2026-10-01";
export const defaultMapping: Record<keyof SandboxHireInput, string> = {
  externalId: "employee_id",
  name: "full_name",
  orgId: "organization",
  profileId: "job_profile",
  locationId: "location",
  positionId: "position",
  salary: "annual_salary",
  effectiveDate: "start_date",
};
export const recommendedObjects = {
  company: {
    id: "CO-FR",
    name: "Vale Works France (fictional)",
    country: "FR",
    currency: "EUR",
  },
  location: { id: "LOC-FR", name: "Paris Office", country: "FR" },
  costCenter: { id: "CC-FR", name: "France Operations", companyId: "CO-FR" },
  org: {
    id: "SUP-FR",
    name: "France Operations",
    companyId: "CO-FR",
    costCenterId: "CC-FR",
    parentId: "",
    staffing: "Position Management",
  },
  profile: {
    id: "JP-ANALYST",
    name: "Operations Analyst",
    family: "Operations",
  },
  position: {
    id: "POS-001",
    name: "Operations Analyst — first seat",
    orgId: "SUP-FR",
    profileId: "JP-ANALYST",
    locationId: "LOC-FR",
  },
} as const;
