import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { audit } from "./engine";
import { Actor, LabError, requirePermission } from "./policy";
import { date } from "./validators";
import {
  configSchema,
  emptyConfig,
  implementationChapters,
  previewActors,
  sandboxHireSchema,
  type ImplementationConfig,
  type SandboxHireInput,
} from "./implementation-catalog";

type Tx = Prisma.TransactionClient;
export const configurationHash = (c: ImplementationConfig) =>
  createHash("sha256").update(JSON.stringify(c)).digest("hex");
// Discovery and reporting edits do not change the Hire route or its outcomes.
export const hireConfigurationHash = (c: ImplementationConfig) => {
  const { design, report, integration, ...runtime } = c;
  return createHash("sha256").update(JSON.stringify(runtime)).digest("hex");
};
export type Finding = { area: string; message: string };
export function configurationFindings(c: ImplementationConfig): Finding[] {
  const out: Finding[] = [],
    add = (area: string, message: string) => out.push({ area, message });
  if (!c.companies.length)
    add("foundations", "Create a company before its organizations.");
  if (!c.orgs.length) add("foundations", "Create a supervisory organization.");
  if (c.orgs.length && c.orgs.filter((o) => !o.parentId).length !== 1)
    add(
      "foundations",
      "The capstone requires exactly one root supervisory organization.",
    );
  for (const cc of c.costCenters)
    if (!c.companies.some((x) => x.id === cc.companyId))
      add("foundations", `${cc.id}: company ${cc.companyId} does not exist.`);
  for (const o of c.orgs) {
    if (!c.companies.some((x) => x.id === o.companyId))
      add("foundations", `${o.id}: company ${o.companyId} does not exist.`);
    if (
      !c.costCenters.some(
        (x) => x.id === o.costCenterId && x.companyId === o.companyId,
      )
    )
      add(
        "foundations",
        `${o.id}: cost center must belong to the selected company.`,
      );
    const seen = new Set<string>([o.id]);
    let parent = o.parentId;
    while (parent) {
      if (seen.has(parent)) {
        add("foundations", `${o.id}: organization hierarchy contains a cycle.`);
        break;
      }
      seen.add(parent);
      const next = c.orgs.find((x) => x.id === parent);
      if (!next) {
        add(
          "foundations",
          `${o.id}: superior organization ${parent} does not exist.`,
        );
        break;
      }
      parent = next.parentId;
    }
  }
  for (const p of c.positions) {
    if (
      !c.orgs.some(
        (x) => x.id === p.orgId && x.staffing === "Position Management",
      )
    )
      add("staffing", `${p.id}: choose a Position Management organization.`);
    if (!c.profiles.some((x) => x.id === p.profileId))
      add("staffing", `${p.id}: job profile does not exist.`);
    if (!c.locations.some((x) => x.id === p.locationId))
      add("staffing", `${p.id}: location does not exist.`);
  }
  for (const a of c.assignments)
    if (!c.orgs.some((x) => x.id === a.orgId))
      add(
        "security",
        `Role assignment references missing organization ${a.orgId}.`,
      );
  return out;
}
export function sandboxAccess(
  c: ImplementationConfig,
  actorId: string,
  orgId: string,
) {
  const actor = previewActors.find((a) => a.id === actorId);
  if (!actor) throw new LabError("Unknown sandbox identity");
  const p = c.policies.find((p) => p.role === actor.role)!;
  const scoped = c.assignments.some(
    (a) => a.actorId === actorId && a.orgId === orgId,
  );
  return {
    actor,
    scoped,
    workers: scoped && p.workers,
    salary: scoped && p.salary,
    initiate: scoped && p.initiate,
    approve: scoped && p.approve,
  };
}
export function hireRoute(
  c: ImplementationConfig,
  x: SandboxHireInput,
  initiator: string,
) {
  const roles = [
    c.hire.firstApprover,
    ...(c.hire.partnerThreshold > 0 &&
    x.salary >= c.hire.partnerThreshold &&
    c.hire.firstApprover !== "HR Partner"
      ? ["HR Partner"]
      : []),
    ...(c.hire.finalReview ? ["HR Admin"] : []),
  ];
  return roles.map((role, i) => {
    const actor = previewActors.find(
      (a) =>
        a.role === role &&
        c.assignments.some((b) => b.actorId === a.id && b.orgId === x.orgId),
    );
    if (!actor)
      throw new LabError(
        `Routing blocked: ${role} has no assignment in ${x.orgId}. Configure Security → Role assignments.`,
      );
    if (i === 0 && actor.id === initiator)
      throw new LabError(
        "The first approval must be independent of the initiator.",
      );
    if (!sandboxAccess(c, actor.id, x.orgId).approve)
      throw new LabError(
        `Routing blocked: ${role} lacks Hire approval permission. Worker visibility alone does not grant approval.`,
      );
    return {
      actorId: actor.id,
      role,
      label: role === "HR Admin" ? "Final HR review" : `${role} approval`,
    };
  });
}
export function validateSandboxHire(
  c: ImplementationConfig,
  x: SandboxHireInput,
) {
  const findings = configurationFindings(c);
  if (findings.length) throw new LabError(findings[0].message);
  const org = c.orgs.find((o) => o.id === x.orgId);
  if (!org) throw new LabError(`Unknown organization ${x.orgId}`);
  if (!c.profiles.some((p) => p.id === x.profileId))
    throw new LabError(`Unknown job profile ${x.profileId}`);
  if (!c.locations.some((l) => l.id === x.locationId))
    throw new LabError(`Unknown location ${x.locationId}`);
  if (
    org.staffing === "Position Management" &&
    !c.positions.some(
      (p) =>
        p.id === x.positionId &&
        p.orgId === x.orgId &&
        p.profileId === x.profileId &&
        p.locationId === x.locationId,
    )
  )
    throw new LabError(
      "Position Management requires a matching open seat, job profile and location.",
    );
  if (org.staffing === "Job Management" && x.positionId)
    throw new LabError(
      "Job Management uses a job profile directly; leave position empty.",
    );
}
type Check = { id: string; title: string; passed: boolean; detail: string };
export function acceptanceSuite(c: ImplementationConfig): Check[] {
  const checks: Check[] = [];
  const check = (id: string, title: string, fn: () => string) => {
    try {
      checks.push({ id, title, passed: true, detail: fn() });
    } catch (e) {
      checks.push({ id, title, passed: false, detail: (e as Error).message });
    }
  };
  const assert = (ok: boolean, message: string) => {
    if (!ok) throw new Error(message);
  };
  const pm = c.orgs.find((o) => o.staffing === "Position Management"),
    jm = c.orgs.find((o) => o.staffing === "Job Management");
  const sample = (org = pm): SandboxHireInput => {
    const p = c.positions.find((p) => p.orgId === org?.id);
    return {
      externalId: "TEST-001",
      name: "Synthetic test worker",
      orgId: org?.id ?? "missing",
      profileId: p?.profileId ?? c.profiles[0]?.id ?? "missing",
      locationId: p?.locationId ?? c.locations[0]?.id ?? "missing",
      positionId: p?.id ?? "",
      salary: Math.max(60000, c.hire.partnerThreshold),
      effectiveDate: "2026-10-19",
    };
  };
  check("references", "Configuration dependencies resolve", () => {
    const f = configurationFindings(c);
    assert(!f.length, f.map((x) => x.message).join(" "));
    return "Hierarchy, companies, cost centers, positions and role references resolve.";
  });
  check("brief", "Client scope and design decisions are recorded", () => {
    assert(
      c.companies.length >= 2 &&
        c.locations.length >= 2 &&
        c.costCenters.length >= 2 &&
        c.orgs.length >= 2,
      "The client needs two companies, locations, cost centers and supervisory organizations.",
    );
    assert(
      Object.values(c.design).every((x) => x.trim().length >= 40),
      "Record at least 40 characters for each discovery decision.",
    );
    return "Two-company scope and three design rationales are present.";
  });
  check("staffing", "Both staffing models have a valid example", () => {
    assert(
      !!pm && !!jm,
      "Configure a Position Management organization and a Job Management organization.",
    );
    validateSandboxHire(c, sample());
    validateSandboxHire(c, { ...sample(jm), positionId: "" });
    return "Position-based and job-based validation pass.";
  });
  check("seat", "A missing position is rejected", () => {
    assert(!!pm, "Create a Position Management organization first.");
    let rejected = false;
    try {
      validateSandboxHire(c, { ...sample(), positionId: "" });
    } catch {
      rejected = true;
    }
    assert(rejected, "A missing seat was accepted.");
    return "Position Management rejects an empty seat.";
  });
  check("initiate", "HR can initiate; employees cannot", () => {
    assert(
      !!pm && sandboxAccess(c, "hr", pm.id).initiate,
      "Assign HR Admin and allow Hire initiation in the Position Management organization.",
    );
    assert(
      !c.policies.find((p) => p.role === "Employee")!.initiate,
      "Remove Employee Hire initiation permission.",
    );
    return "Separate initiation boundary enforced.";
  });
  check("routing", "Manager, conditional partner and HR review resolve", () => {
    assert(
      c.hire.firstApprover === "Manager" &&
        c.hire.partnerThreshold > 0 &&
        c.hire.finalReview,
      "Client requires Manager → conditional HR Partner → final HR review.",
    );
    const route = hireRoute(c, sample(), "hr");
    assert(
      route.map((r) => r.role).join(",") === "Manager,HR Partner,HR Admin",
      "High salary must route to three configured roles.",
    );
    return route.map((r) => r.label).join(" → ");
  });
  check("condition", "Salary condition changes the route", () => {
    assert(
      c.hire.partnerThreshold > 1,
      "Set a partner review threshold greater than 1.",
    );
    const route = hireRoute(
      c,
      { ...sample(), salary: c.hire.partnerThreshold - 1 },
      "hr",
    );
    assert(
      !route.some((r) => r.role === "HR Partner"),
      "Below-threshold requests should skip the optional HR Partner step.",
    );
    return "Below-threshold request skips HR Partner review.";
  });
  check("privacy", "Employee salary and approval access are denied", () => {
    const p = c.policies.find((p) => p.role === "Employee")!;
    assert(
      !p.salary && !p.approve,
      "Remove Employee salary access and Hire approval permission.",
    );
    assert(
      c.policies.find((p) => p.role === "HR Admin")!.salary,
      "HR Admin needs salary visibility for reconciliation.",
    );
    return "Employee salary and approval are denied independently of worker visibility.";
  });
  check("onboarding", "Completion generates onboarding work", () => {
    assert(
      c.hire.onboarding.length >= 2 &&
        new Set(c.hire.onboarding).size === c.hire.onboarding.length,
      "Configure at least two distinct onboarding tasks.",
    );
    return `${c.hire.onboarding.length} tasks configured; completion is also checked against the real sandbox Hire.`;
  });
  check("export", "Outbound exchange has an authorized identity", () => {
    assert(c.integration.enabled, "Enable a local outbound exchange.");
    assert(
      !!pm && sandboxAccess(c, "integration", pm.id).workers,
      "Assign Integration User and grant worker visibility.",
    );
    if (c.integration.includeSalary)
      assert(
        sandboxAccess(c, "integration", pm!.id).salary,
        "Salary output requires salary permission for Integration User.",
      );
    return "Exchange identity and requested field permissions are valid.";
  });
  return checks;
}

// Bounded RFC-style CSV parser: quoted commas/newlines and escaped quotes supported.
export function parseWorkerCsv(csv: string, mapping: Record<string, string>) {
  if (csv.length > 100000)
    throw new LabError("Use a sample CSV of at most 100 KB.");
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  const input = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i <= input.length; i++) {
    const ch = input[i] ?? "\n";
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        if (i === input.length)
          throw new LabError("CSV has an unclosed quoted field.");
        value += ch;
      }
    } else if (ch === "," || ch === "\n") {
      row.push(value);
      value = "";
      closed = false;
      if (ch === "\n") {
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      }
    } else if (ch === '"' && !value && !closed) quoted = true;
    else {
      if (closed || ch === '"')
        throw new LabError("CSV quotes must enclose the complete field.");
      value += ch;
    }
  }
  if (rows.length < 2 || rows.length > 101)
    throw new LabError("Provide a header and 1–100 sample workers.");
  const [headers, ...data] = rows;
  if (new Set(headers).size !== headers.length)
    throw new LabError("CSV headers must be unique.");
  const keys = Object.keys(sandboxHireSchema.shape);
  for (const key of keys)
    if (!headers.includes(mapping[key]))
      throw new LabError(`Map ${key} to an existing CSV header.`);
  return data.map((r, i) => {
    if (r.length !== headers.length)
      throw new LabError(
        `Row ${i + 2} has ${r.length} columns; expected ${headers.length}.`,
      );
    return Object.fromEntries(
      keys.map((k) => [k, r[headers.indexOf(mapping[k])].trim()]),
    );
  });
}
const actorSchema = z.enum(
  previewActors.map((a) => a.id) as [string, ...string[]],
);
const environmentSchema = z.enum(["Development", "Test", "Production"]);
const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("drill"),
      fault: z.enum(["routing", "privacy", "reference"]),
    })
    .strict(),
  z.object({ action: z.literal("save"), config: configSchema }).strict(),
  z
    .object({
      action: z.literal("progress"),
      mode: z.enum(["Guided", "Independent", "Assessment"]),
      step: z.number().int().min(0).max(15),
    })
    .strict(),
  z.object({ action: z.literal("suite") }).strict(),
  z
    .object({
      action: z.literal("promote"),
      stage: z.enum(["Test", "Production"]),
    })
    .strict(),
  z
    .object({ action: z.literal("restore"), releaseId: z.string().min(1) })
    .strict(),
  z
    .object({
      action: z.literal("import"),
      csv: z.string().max(100000),
      mapping: z.record(z.string(), z.string()),
      commit: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("hire"),
      actorId: actorSchema,
      environment: environmentSchema,
      input: sandboxHireSchema,
      requestKey: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("act"),
      actorId: actorSchema,
      hireId: z.string().min(1),
      decision: z.enum(["approve", "deny", "cancel"]),
      comment: z.string().trim().min(3).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("onboard"),
      actorId: actorSchema,
      workerId: z.string().min(1),
      label: z.string().min(2).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("exchange"),
      environment: environmentSchema,
      asOf: date,
    })
    .strict(),
  z
    .object({
      action: z.literal("interview"),
      answers: z.record(z.string(), z.string().max(3000)),
    })
    .strict(),
]);
async function owned(tx: Tx, u: Actor, id: string) {
  await requirePermission(u, "practice.use", tx);
  const project = await tx.implementationProject.findFirst({
    where: { id, ownerId: u.id },
  });
  if (!project)
    throw new LabError(
      "Implementation project not found for this practice account.",
      404,
    );
  return project;
}
async function environmentConfig(
  tx: Tx,
  project: { id: string; config: string },
  environment: string,
) {
  if (environment === "Development")
    return configSchema.parse(JSON.parse(project.config));
  const release = await tx.implementationRelease.findFirst({
    where: { projectId: project.id, stage: environment },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (!release)
    throw new LabError(`Promote a configuration to ${environment} first.`);
  return configSchema.parse(JSON.parse(release.config));
}
export async function implementationProjects(u: Actor) {
  await requirePermission(u, "practice.use");
  return db.implementationProject.findMany({
    where: { ownerId: u.id },
    select: { id: true, name: true, version: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}
export async function createImplementationProject(u: Actor, input: unknown) {
  const b = z
    .object({ name: z.string().trim().min(3).max(80) })
    .strict()
    .parse(input);
  return db.$transaction(async (tx) => {
    await requirePermission(u, "practice.use", tx);
    if (
      (await tx.implementationProject.count({ where: { ownerId: u.id } })) >= 20
    )
      throw new LabError(
        "This account has 20 projects. Reuse an existing project.",
      );
    const p = await tx.implementationProject.create({
      data: {
        ownerId: u.id,
        name: b.name,
        config: JSON.stringify(emptyConfig()),
      },
    });
    await audit(tx, u, "Create implementation project", p.id, null, {
      name: p.name,
    });
    return p;
  });
}
export async function implementationDetail(u: Actor, id: string) {
  const p = await owned(db, u, id);
  const config = configSchema.parse(JSON.parse(p.config)),
    hash = configurationHash(config);
  const [releases, hires, workers, evidence, events] = await Promise.all([
    db.implementationRelease.findMany({
      where: { projectId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    db.implementationHire.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.implementationWorker.findMany({
      where: { projectId: id },
      orderBy: { externalId: "asc" },
      take: 500,
    }),
    db.implementationEvidence.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.auditEvent.findMany({
      where: { objectId: id },
      orderBy: { id: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        createdAt: true,
        before: true,
        after: true,
        permission: true,
      },
    }),
  ]);
  const findings = configurationFindings(config);
  const currentEvidence = evidence.filter((e) => e.configHash === hash);
  const complete = [
    Object.values(config.design).every((s) => s.trim().length >= 40),
    config.companies.length >= 2 &&
      config.orgs.length >= 2 &&
      config.locations.length >= 2 &&
      config.costCenters.length >= 2 &&
      !findings.some((f) => f.area === "foundations"),
    config.profiles.length > 0 &&
      config.positions.length > 0 &&
      !findings.some((f) => f.area === "staffing"),
    config.orgs.length > 0 &&
      config.orgs.every((o) =>
        ["hr", "manager", "partner"].every((a) =>
          config.assignments.some((x) => x.actorId === a && x.orgId === o.id),
        ),
      ) &&
      config.policies.some(
        (p) => p.role === "HR Admin" && p.initiate && p.approve,
      ) &&
      config.policies.some((p) => p.role === "Manager" && p.approve) &&
      !config.policies.find((p) => p.role === "Employee")!.salary,
    hires.some(
      (h) =>
        h.status === "Completed" &&
        hireConfigurationHash(JSON.parse(h.config)) ===
          hireConfigurationHash(config) &&
        h.environment === "Development",
    ),
    workers.some(
      (w) => w.source === "Import" && w.environment === "Development",
    ),
    currentEvidence.some((e) => e.kind === "Exchange"),
    releases.some((r) => r.stage === "Production" && r.configHash === hash),
  ];
  return {
    ...p,
    config,
    hash,
    findings,
    chapters: implementationChapters.map((c, i) => ({
      ...c,
      complete: complete[i],
    })),
    releases: releases.map((r) => ({ ...r, config: JSON.parse(r.config) })),
    hires: hires.map(({ config: snapshot, ...h }) => ({
      ...h,
      payload: JSON.parse(h.payload),
      history: JSON.parse(h.history),
      route: hireRouteSafe(
        JSON.parse(snapshot),
        JSON.parse(h.payload),
        h.initiator,
      ),
    })),
    workers: workers.map((w) => ({
      ...w,
      onboarding: JSON.parse(w.onboarding),
    })),
    evidence: evidence.map((e) => ({
      ...e,
      result: JSON.parse(e.result),
      current: e.configHash === hash,
    })),
    events,
  };
}
function hireRouteSafe(
  c: ImplementationConfig,
  x: SandboxHireInput,
  actor: string,
) {
  try {
    return hireRoute(c, x, actor);
  } catch {
    return [];
  }
}
async function protectReferences(tx: Tx, id: string, c: ImplementationConfig) {
  const rows = await tx.implementationWorker.findMany({
    where: { projectId: id, environment: "Development" },
  });
  const active = await tx.implementationHire.findMany({
    where: { projectId: id, environment: "Development", status: "Pending" },
  });
  for (const x of [
    ...rows,
    ...active.map((h) => JSON.parse(h.payload) as SandboxHireInput),
  ]) {
    if (
      !c.orgs.some((o) => o.id === x.orgId) ||
      !c.profiles.some((p) => p.id === x.profileId) ||
      !c.locations.some((l) => l.id === x.locationId) ||
      (x.positionId && !c.positions.some((p) => p.id === x.positionId))
    )
      throw new LabError(
        "Cannot remove an object referenced by a Development worker or pending Hire. Use a new project for a clean implementation.",
      );
  }
}
export async function implementationAction(
  u: Actor,
  id: string,
  version: number,
  raw: unknown,
) {
  const b = commandSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const p = await owned(tx, u, id);
      if (p.version !== version)
        throw new LabError(
          "This project changed in another tab. Refresh project to load the latest saved version; your unsaved form stays available.",
          409,
        );
      // Compare-and-swap serializes configuration, occupancy, approval and promotion decisions.
      const lock = await tx.implementationProject.updateMany({
        where: { id, ownerId: u.id, version },
        data: { version: { increment: 1 } },
      });
      if (lock.count !== 1)
        throw new LabError(
          "Project changed. Refresh project before retrying.",
          409,
        );
      let c = configSchema.parse(JSON.parse(p.config));
      const hash = configurationHash(c);
      let result: unknown;
      const record = async (kind: string, value: unknown) =>
        tx.implementationEvidence.create({
          data: {
            projectId: id,
            kind,
            configHash: hash,
            result: JSON.stringify(value),
          },
        });
      if (b.action === "drill") {
        if (!acceptanceSuite(c).every((check) => check.passed))
          throw new LabError(
            "Finish a valid baseline configuration before creating a troubleshooting copy. Run the acceptance suite to find missing prerequisites.",
          );
        if (
          (await tx.implementationProject.count({
            where: { ownerId: u.id },
          })) >= 20
        )
          throw new LabError("This account already has 20 projects.");
        const broken = configSchema.parse(JSON.parse(p.config));
        const pm = broken.orgs.find(
          (o) => o.staffing === "Position Management",
        )!;
        if (b.fault === "routing")
          broken.assignments = broken.assignments.filter(
            (a) => a.actorId !== "manager" || a.orgId !== pm.id,
          );
        if (b.fault === "privacy")
          broken.policies.find((p) => p.role === "Employee")!.salary = true;
        if (b.fault === "reference")
          broken.orgs.find((o) => o.id === pm.id)!.costCenterId =
            "MISSING-COST-CENTER";
        const child = await tx.implementationProject.create({
          data: {
            ownerId: u.id,
            name: `Troubleshooting: ${b.fault === "routing" ? "Hire cannot route" : b.fault === "privacy" ? "Unexpected salary grant" : "Broken organization reference"}`,
            config: JSON.stringify(broken),
            learningMode: p.learningMode,
          },
        });
        await audit(tx, u, "Create troubleshooting project", child.id, null, {
          sourceProjectId: id,
          scenario: b.fault,
        });
        result = {
          id: child.id,
          section: b.fault === "reference" ? "foundations" : "security",
        };
      } else if (b.action === "save") {
        await protectReferences(tx, id, b.config);
        c = b.config;
        result = await tx.implementationProject.update({
          where: { id },
          data: { config: JSON.stringify(c) },
        });
      } else if (b.action === "progress") {
        result = await tx.implementationProject.update({
          where: { id },
          data: { learningMode: b.mode, guideStep: b.step },
        });
      } else if (b.action === "suite") {
        const checks = acceptanceSuite(c);
        result = await record("Suite", {
          checks,
          passed: checks.every((c) => c.passed),
        });
      } else if (b.action === "promote") {
        const suite = await tx.implementationEvidence.findFirst({
          where: { projectId: id, kind: "Suite", configHash: hash },
          orderBy: { createdAt: "desc" },
        });
        if (!suite || !JSON.parse(suite.result).passed)
          throw new LabError(
            "Run a passing acceptance suite for this exact saved configuration before promotion.",
          );
        const completedHires = await tx.implementationHire.findMany({
          where: {
            projectId: id,
            environment: "Development",
            status: "Completed",
          },
          include: { worker: true },
        });
        const hire = completedHires.find(
          (h) =>
            h.worker &&
            hireConfigurationHash(JSON.parse(h.config)) ===
              hireConfigurationHash(c),
        );
        if (!hire?.worker)
          throw new LabError(
            "Complete a Development sandbox Hire with the current Hire configuration first.",
          );
        if (
          !(await tx.implementationWorker.findFirst({
            where: {
              projectId: id,
              environment: "Development",
              source: "Import",
            },
          }))
        )
          throw new LabError(
            "Commit a validated worker conversion before promotion.",
          );
        const exchange = await tx.implementationEvidence.findFirst({
          where: { projectId: id, kind: "Exchange", configHash: hash },
          orderBy: { createdAt: "desc" },
        });
        if (
          !exchange ||
          JSON.parse(exchange.result).environment !== "Development" ||
          JSON.parse(exchange.result).count < 1
        )
          throw new LabError(
            "Run a nonempty Development exchange with the current configuration before promotion.",
          );
        if (b.stage === "Production") {
          const testRelease = await tx.implementationRelease.findFirst({
            where: { projectId: id, stage: "Test" },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          });
          if (testRelease?.configHash !== hash)
            throw new LabError(
              "Promote this exact configuration to Test before Production.",
            );
        }
        result = await tx.implementationRelease.create({
          data: {
            projectId: id,
            stage: b.stage,
            config: p.config,
            configHash: hash,
            sourceVersion: p.version,
          },
        });
      } else if (b.action === "restore") {
        const release = await tx.implementationRelease.findFirst({
          where: { id: b.releaseId, projectId: id },
        });
        if (!release) throw new LabError("Release snapshot not found", 404);
        const restored = configSchema.parse(JSON.parse(release.config));
        await protectReferences(tx, id, restored);
        result = await tx.implementationProject.update({
          where: { id },
          data: { config: release.config },
        });
      } else if (b.action === "hire") {
        const existing = await tx.implementationHire.findUnique({
          where: {
            projectId_requestKey: { projectId: id, requestKey: b.requestKey },
          },
        });
        if (existing) {
          if (
            existing.environment !== b.environment ||
            existing.initiator !== b.actorId ||
            existing.payload !== JSON.stringify(b.input)
          )
            throw new LabError(
              "Request key was already used for a different Hire",
              409,
            );
          return existing;
        }
        const config = await environmentConfig(tx, p, b.environment);
        const access = sandboxAccess(config, b.actorId, b.input.orgId);
        if (!access.initiate)
          throw new LabError(
            "Sandbox access denied: this identity lacks Hire initiation permission or an organization assignment.",
            403,
          );
        validateSandboxHire(config, b.input);
        await assertVacancy(tx, id, b.environment, b.input);
        const route = hireRoute(config, b.input, b.actorId);
        result = await tx.implementationHire.create({
          data: {
            projectId: id,
            environment: b.environment,
            requestKey: b.requestKey,
            config: JSON.stringify(config),
            configHash: configurationHash(config),
            payload: JSON.stringify(b.input),
            initiator: b.actorId,
            assignee: route[0].actorId,
            status: "Pending",
            history: JSON.stringify([
              {
                actor: b.actorId,
                action: "Submit",
                detail: `Assigned to ${route[0].label}`,
                at: new Date().toISOString(),
              },
            ]),
          },
        });
      } else if (b.action === "act") {
        const h = await tx.implementationHire.findFirst({
          where: { id: b.hireId, projectId: id },
        });
        if (!h) throw new LabError("Hire not found", 404);
        if (h.status !== "Pending")
          throw new LabError("This Hire is no longer pending.");
        const config = configSchema.parse(JSON.parse(h.config)),
          input = sandboxHireSchema.parse(JSON.parse(h.payload));
        const access = sandboxAccess(config, b.actorId, input.orgId),
          route = hireRoute(config, input, h.initiator);
        if (
          b.decision === "cancel"
            ? b.actorId !== h.initiator
            : b.actorId !== h.assignee || !access.approve
        )
          throw new LabError(
            "Sandbox access denied: only the assigned approver can act; only the initiator can cancel.",
            403,
          );
        const next = h.step + 1;
        const status =
          b.decision === "cancel"
            ? "Canceled"
            : b.decision === "deny"
              ? "Denied"
              : next === route.length
                ? "Completed"
                : "Pending";
        const history = [
          ...JSON.parse(h.history),
          {
            actor: b.actorId,
            action: b.decision,
            detail: b.comment,
            at: new Date().toISOString(),
          },
        ];
        if (status === "Completed") {
          await assertVacancy(tx, id, h.environment, input, h.id);
          await tx.implementationWorker.create({
            data: {
              projectId: id,
              hireId: h.id,
              environment: h.environment,
              ...input,
              positionId: input.positionId || null,
              source: "Hire",
              onboarding: JSON.stringify(
                config.hire.onboarding.map((label) => ({
                  label,
                  completed: false,
                })),
              ),
            },
          });
        }
        result = await tx.implementationHire.update({
          where: { id: h.id },
          data: {
            status,
            step: b.decision === "approve" ? next : h.step,
            assignee: status === "Pending" ? route[next].actorId : null,
            history: JSON.stringify(history),
          },
        });
      } else if (b.action === "onboard") {
        const w = await tx.implementationWorker.findFirst({
          where: { id: b.workerId, projectId: id },
        });
        if (!w) throw new LabError("Worker not found", 404);
        const config = await environmentConfig(tx, p, w.environment);
        if (
          !sandboxAccess(config, b.actorId, w.orgId).workers ||
          b.actorId !== "hr"
        )
          throw new LabError(
            "Only the scoped sandbox HR Admin can complete onboarding in this capstone.",
            403,
          );
        const tasks = JSON.parse(w.onboarding) as {
          label: string;
          completed: boolean;
        }[];
        if (!tasks.some((t) => t.label === b.label && !t.completed))
          throw new LabError("Pending onboarding task not found.");
        result = await tx.implementationWorker.update({
          where: { id: w.id },
          data: {
            onboarding: JSON.stringify(
              tasks.map((t) =>
                t.label === b.label ? { ...t, completed: true } : t,
              ),
            ),
          },
        });
      } else if (b.action === "import") {
        const rawRows = parseWorkerCsv(b.csv, b.mapping),
          errors: { row: number; message: string }[] = [],
          rows: SandboxHireInput[] = [];
        for (let i = 0; i < rawRows.length; i++) {
          try {
            const row = sandboxHireSchema.parse(rawRows[i]);
            validateSandboxHire(c, row);
            if (
              rows.some(
                (x) =>
                  x.externalId === row.externalId ||
                  (row.positionId && x.positionId === row.positionId),
              )
            )
              throw new LabError(
                "Duplicate worker ID or occupied position within this batch.",
              );
            await assertVacancy(tx, id, "Development", row);
            rows.push(row);
          } catch (e) {
            errors.push({
              row: i + 2,
              message:
                e instanceof z.ZodError
                  ? e.issues
                      .map((x) => `${x.path.join(".")}: ${x.message}`)
                      .join("; ")
                  : (e as Error).message,
            });
          }
        }
        if (b.commit && errors.length)
          throw new LabError(
            `Import rejected atomically: ${errors.map((x) => `row ${x.row}: ${x.message}`).join("; ")}`,
          );
        if (b.commit)
          for (const row of rows)
            await tx.implementationWorker.create({
              data: {
                projectId: id,
                environment: "Development",
                ...row,
                positionId: row.positionId || null,
                source: "Import",
                onboarding: "[]",
              },
            });
        result = {
          total: rawRows.length,
          valid: rows.length,
          errors,
          committed: b.commit ? rows.length : 0,
          rows,
        };
        await record(b.commit ? "Import" : "Import preview", result);
      } else if (b.action === "exchange") {
        const config = await environmentConfig(tx, p, b.environment);
        if (!config.integration.enabled)
          throw new LabError(
            "Enable the outbound exchange in the saved configuration first.",
          );
        const rows = await projectedWorkers(
          tx,
          id,
          config,
          "integration",
          b.environment,
          b.asOf,
          config.integration.includeSalary,
        );
        const fields = [
          "externalId",
          "name",
          "orgId",
          "profileId",
          "effectiveDate",
          ...(config.integration.includeSalary ? ["salary"] : []),
        ];
        const output =
          config.integration.format === "JSON"
            ? JSON.stringify(rows, null, 2)
            : [fields, ...rows.map((r) => fields.map((k) => r[k]))]
                .map((row) => row.map(csvCell).join(","))
                .join("\r\n");
        result = {
          environment: b.environment,
          asOf: b.asOf,
          count: rows.length,
          format: config.integration.format,
          output,
          identity: "Integration User",
          log: [
            `Validated local identity and field permissions`,
            `Read ${rows.length} visible workers as of ${b.asOf}`,
            "Generated local preview; no external delivery",
          ],
        };
        await tx.implementationEvidence.create({
          data: {
            projectId: id,
            kind: "Exchange",
            configHash: configurationHash(config),
            result: JSON.stringify(result),
          },
        });
      } else if (b.action === "interview") {
        result = {
          answers: b.answers,
          responses: implementationChapters.map((ch) => ({
            chapter: ch.id,
            question: ch.question,
            answered: (b.answers[ch.id]?.trim().length ?? 0) >= 80,
            reflection: ch.hint,
          })),
          note: "Reflection coverage only. An 80-character response counts as attempted; this is not an expert or AI correctness grade.",
        };
        await record("Interview", result);
      }
      await audit(
        tx,
        u,
        `Implementation: ${b.action}`,
        id,
        {
          version,
          hash,
          ...(b.action === "save" || b.action === "restore"
            ? { config: JSON.parse(p.config) }
            : {}),
        },
        {
          version: version + 1,
          ...(b.action === "save"
            ? { config: c }
            : b.action === "progress"
              ? { mode: b.mode, step: b.step }
              : { command: b, result }),
        },
      );
      return result;
    },
    { timeout: 20000 },
  );
}
async function assertVacancy(
  tx: Tx,
  projectId: string,
  environment: string,
  x: SandboxHireInput,
  ignoreHire?: string,
) {
  const worker = await tx.implementationWorker.findFirst({
    where: {
      projectId,
      environment,
      OR: [
        { externalId: x.externalId },
        ...(x.positionId ? [{ positionId: x.positionId }] : []),
      ],
    },
  });
  if (worker)
    throw new LabError(
      "Worker ID already exists or the position is occupied in this environment.",
    );
  const pending = await tx.implementationHire.findMany({
    where: {
      projectId,
      environment,
      status: "Pending",
      ...(ignoreHire ? { id: { not: ignoreHire } } : {}),
    },
    select: { payload: true },
  });
  if (
    pending.some((h) => {
      const p = JSON.parse(h.payload);
      return (
        p.externalId === x.externalId ||
        (x.positionId && p.positionId === x.positionId)
      );
    })
  )
    throw new LabError(
      "Another pending Hire reserves this worker ID or position.",
    );
}
function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
async function projectedWorkers(
  tx: Tx,
  id: string,
  c: ImplementationConfig,
  actorId: string,
  environment: string,
  asOf: string,
  includeSalary: boolean,
  orgId?: string,
) {
  const scopedOrgs = c.orgs.filter(
    (o) =>
      (!orgId || o.id === orgId) && sandboxAccess(c, actorId, o.id).workers,
  );
  if (!scopedOrgs.length)
    throw new LabError(
      "Sandbox report denied: identity has no worker visibility in the requested scope.",
      403,
    );
  if (
    includeSalary &&
    scopedOrgs.some((o) => !sandboxAccess(c, actorId, o.id).salary)
  )
    throw new LabError(
      "Sandbox report denied: salary field requires a separate domain grant.",
      403,
    );
  const rows = await tx.implementationWorker.findMany({
    where: {
      projectId: id,
      environment,
      orgId: { in: scopedOrgs.map((o) => o.id) },
      effectiveDate: { lte: asOf },
      ...(actorId === "employee" ? { externalId: "SELF-001" } : {}),
    },
    orderBy: { externalId: "asc" },
  });
  return rows.map((w) => ({
    externalId: w.externalId,
    name: w.name,
    orgId: w.orgId,
    profileId: w.profileId,
    effectiveDate: w.effectiveDate,
    ...(includeSalary ? { salary: w.salary } : {}),
  })) as Record<string, unknown>[];
}
export async function implementationReport(u: Actor, id: string, raw: unknown) {
  const b = z
    .object({
      actorId: actorSchema,
      environment: environmentSchema,
      asOf: date,
      orgId: z.string().max(40).optional(),
    })
    .strict()
    .parse(raw);
  const p = await owned(db, u, id),
    c = await environmentConfig(db, p, b.environment);
  return {
    name: c.report.name,
    rows: await projectedWorkers(
      db,
      id,
      c,
      b.actorId,
      b.environment,
      b.asOf,
      c.report.includeSalary,
      b.orgId,
    ),
    environment: b.environment,
    asOf: b.asOf,
  };
}
