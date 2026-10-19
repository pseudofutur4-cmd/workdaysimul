import {
  emptyConfig,
  type ImplementationConfig,
  type SandboxHireInput,
} from "../lib/implementation-catalog";
export function implementationFixture(): ImplementationConfig {
  const c = emptyConfig();
  c.design = {
    organization:
      "Separate the two legal entities from their supervisory hierarchy and cost centers to support management and costing independently.",
    security:
      "HR supports both organizations. Each manager receives only explicitly assigned organization access. Employees cannot see salary or approve Hire.",
    acceptance:
      "Complete a high-salary Hire through Manager, HR Partner and HR review, verify worker and onboarding records, and reconcile a two-worker import.",
  };
  c.companies = [
    { id: "CO-FR", name: "Vale Works France", country: "FR", currency: "EUR" },
    { id: "CO-SE", name: "Vale Works Sweden", country: "SE", currency: "SEK" },
  ];
  c.locations = [
    { id: "LOC-FR", name: "Paris Office", country: "FR" },
    { id: "LOC-SE", name: "Stockholm Office", country: "SE" },
  ];
  c.costCenters = [
    { id: "CC-FR", name: "France Operations", companyId: "CO-FR" },
    { id: "CC-SE", name: "Sweden Operations", companyId: "CO-SE" },
  ];
  c.orgs = [
    {
      id: "SUP-FR",
      name: "France Operations",
      companyId: "CO-FR",
      costCenterId: "CC-FR",
      parentId: "",
      staffing: "Position Management",
    },
    {
      id: "SUP-SE",
      name: "Sweden Operations",
      companyId: "CO-SE",
      costCenterId: "CC-SE",
      parentId: "SUP-FR",
      staffing: "Job Management",
    },
  ];
  c.profiles = [
    { id: "JP-ANALYST", name: "Operations Analyst", family: "Operations" },
  ];
  c.positions = [
    {
      id: "POS-001",
      name: "First analyst seat",
      orgId: "SUP-FR",
      profileId: "JP-ANALYST",
      locationId: "LOC-FR",
    },
  ];
  c.assignments = ["hr", "manager", "partner", "integration"].flatMap(
    (actorId) => c.orgs.map((o) => ({ actorId, orgId: o.id })),
  );
  c.policies = c.policies.map((p) => ({
    ...p,
    workers: p.role !== "Employee",
    salary: p.role === "HR Admin",
    initiate: p.role === "HR Admin",
    approve: ["HR Admin", "Manager", "HR Partner"].includes(p.role),
  }));
  c.hire = {
    firstApprover: "Manager",
    partnerThreshold: 55000,
    finalReview: true,
    onboarding: ["Confirm personal details", "Review welcome checklist"],
  };
  c.integration = { enabled: true, format: "CSV", includeSalary: false };
  return c;
}
export const implementationHireFixture = (): SandboxHireInput => ({
  externalId: "HIRE-001",
  name: "Riley Brooks",
  orgId: "SUP-FR",
  profileId: "JP-ANALYST",
  locationId: "LOC-FR",
  positionId: "POS-001",
  salary: 60000,
  effectiveDate: "2026-10-19",
});
