// Original practice curriculum. Public sources establish concepts, not tenant parity.
export type LessonField = {
  key: string;
  label: string;
  hint: string;
  example: string;
  type?: string;
  options?: string[];
};
export type AcademyModule = {
  id: string;
  name: string;
  task: string;
  description: string;
  outcome: string;
  minutes: number;
  icon: string;
  color: string;
  role: string;
  domain: string;
  fields: LessonField[];
  source: string;
  native?: string;
  notes: string;
};
const doc = "https://doc.workday.com/";
export const academyModules: AcademyModule[] = [
  {
    id: "hcm",
    name: "Core HCM",
    task: "Hire Employee",
    description:
      "Welcome a new colleague, route approvals, and understand the worker lifecycle.",
    outcome: "A worker record, occupied position, and onboarding tasks.",
    minutes: 15,
    icon: "/workers",
    color: "blue",
    role: "HR Administrator",
    domain: "staffing.initiate",
    native: "/staffing",
    fields: [],
    source:
      "https://www.workday.com/en-us/products/human-capital-management/overview.html",
    notes:
      "Existing local hire: HR → assigned manager → HR. HCM guide pp. 625–631, 678–681. Configured routing is synthetic.",
  },
  {
    id: "finance",
    name: "Finance",
    task: "Create Accounting Journal",
    description:
      "Enter a balanced journal and see how a reviewed transaction reaches a practice ledger.",
    outcome: "Two balanced ledger lines in EUR.",
    minutes: 7,
    icon: "/compensation",
    color: "amber",
    role: "HR Administrator",
    domain: "foundations.modify",
    fields: [
      {
        key: "memo",
        label: "Journal memo",
        hint: "Explain the business purpose of this journal.",
        example: "Training equipment accrual",
      },
      {
        key: "date",
        label: "Accounting date",
        hint: "Choose the effective accounting date.",
        example: "2026-10-19",
        type: "date",
      },
      {
        key: "debit",
        label: "Debit amount (EUR)",
        hint: "Debit the teaching expense account 6100.",
        example: "250",
        type: "number",
      },
      {
        key: "credit",
        label: "Credit amount (EUR)",
        hint: "Credit the teaching accrued liability account 2100. Debits must equal credits.",
        example: "250",
        type: "number",
      },
    ],
    source:
      doc +
      "workday-education/en-us/course-manuals/financial-management-for-administrators/accounting-journals.html",
    notes:
      "Two-line teaching ledger, fixed accounts, EUR only. HR/Manager stand in for Accountant/Controller; no statutory accounting or period close.",
  },
  {
    id: "integration",
    name: "Integrations",
    task: "Launch Integration",
    description:
      "Configure an outbound fixture, validate it, and inspect an integration event.",
    outcome: "A local output artifact and event log.",
    minutes: 6,
    icon: "/reports",
    color: "teal",
    role: "Security Administrator",
    domain: "security.modify",
    fields: [
      {
        key: "name",
        label: "Integration name",
        hint: "Give your integration a recognizable name.",
        example: "Training worker export",
      },
      {
        key: "direction",
        label: "Direction",
        hint: "This lesson exports a bundled synthetic fixture.",
        example: "Outbound",
        options: ["Outbound"],
      },
      {
        key: "format",
        label: "Output format",
        hint: "Choose JSON or CSV for the local output preview.",
        example: "CSV",
        options: ["CSV", "JSON"],
      },
    ],
    source:
      doc +
      "admin-guide/en-us/workday-studio/studio-fundamentals/ebp1499866049976.html",
    notes:
      "Fixture export only, no remote endpoints, credentials, schedule, or Workday API execution.",
  },
  {
    id: "absence",
    name: "Leave & Absence",
    task: "Request Time Off",
    description:
      "Check the balance, request annual leave, then follow the approval.",
    outcome: "An approved absence reduces the practice balance.",
    minutes: 8,
    icon: "/absence",
    color: "green",
    role: "Employee",
    domain: "absence.request",
    native: "/absence",
    fields: [],
    source:
      "https://www.workday.com/en-us/products/workforce-management/absence.html",
    notes:
      "Existing annual leave workflow. Fixed 25-day bank, weekdays only, no holiday calendar. HCM guide pp. 1968–1970.",
  },
  {
    id: "lms",
    name: "Learning / LMS",
    task: "Enroll in Learning",
    description:
      "Find a course, enroll, and record completion in the learner record.",
    outcome: "A persisted course enrollment and completion.",
    minutes: 4,
    icon: "/learning",
    color: "violet",
    role: "Employee",
    domain: "learning.self",
    native: "/learning",
    fields: [],
    source:
      "https://www.workday.com/en-us/products/talent-management/learning.html",
    notes:
      "Existing learning catalog; completion is self-reported, without media or certification. HCM guide pp. 1683–1684.",
  },
  {
    id: "payroll",
    name: "Payroll",
    task: "Calculate Practice Payroll",
    description:
      "Calculate gross-to-net using explicit fictional rules and review a payslip.",
    outcome: "A simulated payslip with earnings, deductions, and net pay.",
    minutes: 7,
    icon: "/compensation",
    color: "blue",
    role: "HR Administrator",
    domain: "compensation.modify",
    fields: [
      {
        key: "hours",
        label: "Regular hours",
        hint: "Enter the hours in this teaching pay period (1–160).",
        example: "40",
        type: "number",
      },
      {
        key: "rate",
        label: "Hourly rate (EUR)",
        hint: "Use a fictional rate; gross pay equals hours × rate.",
        example: "25",
        type: "number",
      },
      {
        key: "deduction",
        label: "Fixed deduction (EUR)",
        hint: "The lab also deducts a fictional 20% teaching tax. Total deductions cannot exceed gross.",
        example: "50",
        type: "number",
      },
    ],
    source: "https://www.workday.com/en-us/products/payroll/overview.html",
    notes:
      "Arithmetic exercise only: 20% fictional tax, no country rules, bank payment, tax filing, or connection to worker compensation.",
  },
  {
    id: "scm",
    name: "Supply Chain / Procurement",
    task: "Create Purchase Requisition",
    description:
      "Request an item, route it to a manager, and receive the approved order.",
    outcome: "A purchase order and a recorded goods receipt.",
    minutes: 8,
    icon: "/positions",
    color: "teal",
    role: "HR Administrator",
    domain: "foundations.modify",
    fields: [
      {
        key: "item",
        label: "Item description",
        hint: "Describe a synthetic noncatalog item.",
        example: "Training laptop",
      },
      {
        key: "quantity",
        label: "Quantity",
        hint: "Enter a whole quantity between 1 and 100.",
        example: "2",
        type: "number",
      },
      {
        key: "price",
        label: "Unit price (EUR)",
        hint: "The purchase order total is quantity × unit price.",
        example: "600",
        type: "number",
      },
      {
        key: "supplier",
        label: "Supplier",
        hint: "Select the fictional supplier in this lab.",
        example: "Aster Office Supplies (fictional)",
        options: [
          "Aster Office Supplies (fictional)",
          "Vale Equipment (fictional)",
        ],
      },
    ],
    source:
      doc +
      "admin-guide/en-us/spend-management/procurement/requisitions-worklet/dnh1663779831778.html",
    notes:
      "Single-line procurement exercise. HR/Manager teaching roles; no supplier communication, invoice payment, inventory valuation, or full SCM suite.",
  },
  {
    id: "security",
    name: "Security",
    task: "Test Domain Access",
    description:
      "Compare domain and business-process permissions without changing the active tenant.",
    outcome: "A recorded access decision in an isolated policy exercise.",
    minutes: 6,
    icon: "/admin/security",
    color: "violet",
    role: "Security Administrator",
    domain: "security.modify",
    fields: [
      {
        key: "role",
        label: "Security group",
        hint: "Choose the role whose access you are testing.",
        example: "Employee",
        options: ["Employee", "Manager"],
      },
      {
        key: "domain",
        label: "Domain",
        hint: "A domain controls data access; approval permission is a separate decision.",
        example: "Worker Data",
        options: ["Worker Data", "Compensation Data"],
      },
      {
        key: "grant",
        label: "Domain permission",
        hint: "Grant or deny access in this isolated teaching policy.",
        example: "Deny",
        options: ["Deny", "View"],
      },
    ],
    source:
      doc +
      "workday-education/en-us/course-manuals/creating-and-securing-integrations/workday-configurable-security.html?toc=8",
    notes:
      "Isolated policy test; does not activate live policies. The existing Security & Processes page edits actual local domain policies.",
  },
  {
    id: "studio",
    name: "Studio",
    task: "Build a Practice Assembly",
    description:
      "Connect source, transformation, and output stages and inspect a local execution.",
    outcome: "A transformed fixture with a stage-by-stage run log.",
    minutes: 8,
    icon: "/organizations",
    color: "blue",
    role: "Security Administrator",
    domain: "security.modify",
    fields: [
      {
        key: "name",
        label: "Assembly name",
        hint: "Name this practice assembly.",
        example: "Worker name normalization",
      },
      {
        key: "transform",
        label: "Transformation",
        hint: "Select a real local transformation on the bundled fixture.",
        example: "Uppercase names",
        options: ["Uppercase names", "Lowercase names"],
      },
      {
        key: "destination",
        label: "Destination",
        hint: "Keep output inside the local practice preview.",
        example: "Local preview",
        options: ["Local preview"],
      },
    ],
    source:
      doc +
      "admin-guide/en-us/workday-studio/studio-fundamentals/ebp1499866049976.html",
    notes:
      "Browser concept exercise, not the separate Eclipse-based Workday Studio IDE. No CLAR compilation, deployment, Java, or remote execution.",
  },
  {
    id: "talent",
    name: "Talent & Performance",
    task: "Create Goal and Review",
    description:
      "Write a measurable individual goal and obtain feedback from a manager.",
    outcome: "An approved goal with a manager rating and feedback.",
    minutes: 7,
    icon: "/workers",
    color: "amber",
    role: "Employee",
    domain: "practice.use",
    fields: [
      {
        key: "goal",
        label: "Goal",
        hint: "Describe a measurable outcome rather than a vague activity.",
        example: "Complete three customer onboarding plans",
      },
      {
        key: "due",
        label: "Due date",
        hint: "Set the date you will review progress.",
        example: "2026-12-31",
        type: "date",
      },
      {
        key: "measure",
        label: "Success measure",
        hint: "Explain how a manager can judge success.",
        example: "Three plans reviewed with no missing required fields",
      },
      {
        key: "progress",
        label: "Progress (%)",
        hint: "Enter your self-reported progress from 0 to 100.",
        example: "25",
        type: "number",
      },
    ],
    source:
      "https://www.workday.com/en-us/products/talent-management/overview.html",
    notes:
      "Individual goal and single manager review only. No calibration, succession, weighting or full review cycle. HCM guide pp. 1341–1342.",
  },
  {
    id: "time",
    name: "Time Tracking",
    task: "Enter Time",
    description:
      "Enter a day of time, validate hours, and obtain manager approval.",
    outcome: "An approved time entry with regular and overtime hours.",
    minutes: 6,
    icon: "/audit",
    color: "green",
    role: "Employee",
    domain: "practice.use",
    fields: [
      {
        key: "date",
        label: "Work date",
        hint: "Choose a day in the teaching period.",
        example: "2026-10-19",
        type: "date",
      },
      {
        key: "hours",
        label: "Hours worked",
        hint: "Enter 0.25–16 hours, in quarter-hour increments. Above 8 hours is teaching overtime.",
        example: "9",
        type: "number",
      },
      {
        key: "code",
        label: "Time entry code",
        hint: "Use the regular-work code for this lesson.",
        example: "Regular work",
        options: ["Regular work"],
      },
    ],
    source:
      doc +
      "admin-guide/en-us/human-capital-management/time-tracking/time-tracking-hub/zbd1535573341579.html",
    notes:
      "One daily entry, quarter-hour validation, >8 hours synthetic overtime. No statutory overtime, schedules, breaks, or payroll feed. HCM guide pp. 2313–2314.",
  },
];
export const moduleById = (id: string) =>
  academyModules.find((m) => m.id === id);
export const fixtureWorkers = [
  { id: "DEMO-001", name: "Alex Rowan" },
  { id: "DEMO-002", name: "Sam Vale" },
];
