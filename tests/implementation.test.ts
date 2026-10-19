import { beforeAll, afterAll, test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { seed } from "../prisma/seed";
import { db } from "../lib/db";
import { workspace } from "../lib/read";
import {
  acceptanceSuite,
  configurationFindings,
  createImplementationProject,
  implementationAction,
  implementationDetail,
  implementationReport,
  parseWorkerCsv,
} from "../lib/implementation-engine";
import {
  configSchema,
  defaultMapping,
  emptyConfig,
  sampleWorkerCsv,
} from "../lib/implementation-catalog";
import {
  implementationFixture,
  implementationHireFixture,
} from "./implementation-fixture";
let hr: User, other: User;
beforeAll(async () => {
  await seed();
  hr = await db.user.findUniqueOrThrow({ where: { id: "hr" } });
  other = await db.user.findUniqueOrThrow({ where: { id: "security" } });
});
afterAll(() => db.$disconnect());
async function setup() {
  const p = await createImplementationProject(hr, {
    name: "Implementation service test",
  });
  await implementationAction(hr, p.id, p.version, {
    action: "save",
    config: implementationFixture(),
  });
  return p.id;
}
async function action(id: string, command: any, actor = hr) {
  const p = await db.implementationProject.findUniqueOrThrow({ where: { id } });
  return implementationAction(actor, id, p.version, command) as Promise<any>;
}
async function hire(id: string, extra = {}) {
  return action(id, {
    action: "hire",
    actorId: "hr",
    environment: "Development",
    input: implementationHireFixture(),
    requestKey: randomUUID(),
    ...extra,
  });
}
async function complete(id: string) {
  let h = await hire(id);
  for (const actorId of ["manager", "partner", "hr"])
    h = await action(id, {
      action: "act",
      actorId,
      hireId: h.id,
      decision: "approve",
      comment: "Validated against client requirements",
    });
  return h;
}

test("empty project is isolated, account-owned and protects concurrent edits", async () => {
  const before = await db.worker.count();
  const p = await createImplementationProject(hr, {
    name: "Empty architecture",
  });
  expect(JSON.parse(p.config)).toEqual(emptyConfig());
  expect(
    (await implementationDetail(hr, p.id)).chapters.every((c) => !c.complete),
  ).toBe(true);
  await expect(implementationDetail(other, p.id)).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    implementationAction(other, p.id, 1, { action: "suite" }),
  ).rejects.toMatchObject({ status: 404 });
  await implementationAction(hr, p.id, 1, {
    action: "progress",
    mode: "Assessment",
    step: 3,
  });
  await expect(
    implementationAction(hr, p.id, 1, {
      action: "save",
      config: implementationFixture(),
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await db.worker.count()).toBe(before);
  expect(await db.auditEvent.count({ where: { objectId: p.id } })).toBe(2);
  expect(
    (await workspace(other, "2026-10-19")).audits.some(
      (a) => a.objectId === p.id,
    ),
  ).toBe(false);
  expect(
    (await workspace(hr, "2026-10-19")).audits.some((a) => a.objectId === p.id),
  ).toBe(false);
});
test("configuration graph catches dangling references, cycles and duplicate IDs", () => {
  const c = implementationFixture();
  expect(configurationFindings(c)).toEqual([]);
  c.orgs[0].parentId = "SUP-SE";
  expect(configurationFindings(c).some((f) => /cycle/.test(f.message))).toBe(
    true,
  );
  c.positions[0].profileId = "UNKNOWN";
  expect(configurationFindings(c).some((f) => /profile/.test(f.message))).toBe(
    true,
  );
  c.companies.push(c.companies[0]);
  expect(configSchema.safeParse(c).success).toBe(false);
  expect(acceptanceSuite(emptyConfig()).some((c) => !c.passed)).toBe(true);
  expect(acceptanceSuite(implementationFixture()).every((c) => c.passed)).toBe(
    true,
  );
});
test("Hire requires separate process permission, assigned scope and resolvable approval roles", async () => {
  const id = await setup();
  await expect(hire(id, { actorId: "employee" })).rejects.toMatchObject({
    status: 403,
  });
  const c = implementationFixture();
  c.assignments = c.assignments.filter((a) => a.actorId !== "manager");
  await action(id, { action: "save", config: c });
  await expect(hire(id)).rejects.toThrow(/no assignment/);
  c.assignments = implementationFixture().assignments;
  c.policies.find((p) => p.role === "Manager")!.approve = false;
  await action(id, { action: "save", config: c });
  await expect(hire(id)).rejects.toThrow(/approval permission/);
  expect(await db.implementationHire.count({ where: { projectId: id } })).toBe(
    0,
  );
});
test("conditional approvals snapshot configuration and create one worker plus onboarding atomically", async () => {
  const id = await setup(),
    h = await hire(id);
  expect(h.assignee).toBe("manager");
  await expect(
    action(id, {
      action: "act",
      actorId: "hr",
      hireId: h.id,
      decision: "approve",
      comment: "Attempted self approval",
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    hire(id, {
      input: { ...implementationHireFixture(), externalId: "OTHER-001" },
    }),
  ).rejects.toThrow(/reserves/);
  const changed = implementationFixture();
  changed.hire.finalReview = false;
  changed.hire.partnerThreshold = 0;
  await action(id, { action: "save", config: changed });
  let current = await action(id, {
    action: "act",
    actorId: "manager",
    hireId: h.id,
    decision: "approve",
    comment: "Manager approved",
  });
  expect(current.assignee).toBe("partner");
  expect(
    await db.implementationWorker.count({ where: { projectId: id } }),
  ).toBe(0);
  current = await action(id, {
    action: "act",
    actorId: "partner",
    hireId: h.id,
    decision: "approve",
    comment: "Partner reviewed salary",
  });
  expect(current.assignee).toBe("hr");
  await action(id, {
    action: "act",
    actorId: "hr",
    hireId: h.id,
    decision: "approve",
    comment: "Final review completed",
  });
  const w = await db.implementationWorker.findFirstOrThrow({
    where: { projectId: id },
  });
  expect(w.salary).toBe(60000);
  expect(JSON.parse(w.onboarding)).toHaveLength(2);
  await expect(
    action(id, {
      action: "act",
      actorId: "hr",
      hireId: h.id,
      decision: "approve",
      comment: "Duplicate review",
    }),
  ).rejects.toThrow(/no longer pending/);
  expect(
    await db.implementationWorker.count({ where: { projectId: id } }),
  ).toBe(1);
  await action(id, {
    action: "onboard",
    actorId: "hr",
    workerId: w.id,
    label: "Confirm personal details",
  });
  expect(
    JSON.parse(
      (await db.implementationWorker.findUniqueOrThrow({ where: { id: w.id } }))
        .onboarding,
    )[0].completed,
  ).toBe(true);
  const broken = implementationFixture();
  broken.orgs = [];
  await expect(action(id, { action: "save", config: broken })).rejects.toThrow(
    /referenced/,
  );
});
test("denied and canceled Hires release seats without completion effects", async () => {
  const id = await setup();
  const h = await hire(id);
  await action(id, {
    action: "act",
    actorId: "manager",
    hireId: h.id,
    decision: "deny",
    comment: "Not approved for hiring",
  });
  const next = await hire(id);
  await action(id, {
    action: "act",
    actorId: "hr",
    hireId: next.id,
    decision: "cancel",
    comment: "Client withdrew request",
  });
  expect(
    await db.implementationWorker.count({ where: { projectId: id } }),
  ).toBe(0);
});
test("imports validate mapping, quoted fields, duplicate IDs and commit all or nothing", async () => {
  const id = await setup();
  expect(
    parseWorkerCsv(
      sampleWorkerCsv.replace("Morgan Lane", '"Morgan, Lane"'),
      defaultMapping,
    )[0].name,
  ).toBe("Morgan, Lane");
  expect(() => parseWorkerCsv('id,name\n"bad', defaultMapping)).toThrow(
    /unclosed/,
  );
  const broken = sampleWorkerCsv.replace(
    "CONV-002,Casey Park,SUP-SE",
    "CONV-002,Casey Park,MISSING",
  );
  const preview = await action(id, {
    action: "import",
    csv: broken,
    mapping: defaultMapping,
    commit: false,
  });
  expect(preview.errors).toHaveLength(1);
  expect(preview.committed).toBe(0);
  await expect(
    action(id, {
      action: "import",
      csv: broken,
      mapping: defaultMapping,
      commit: true,
    }),
  ).rejects.toThrow(/atomically/);
  expect(
    await db.implementationWorker.count({ where: { projectId: id } }),
  ).toBe(0);
  await action(id, {
    action: "import",
    csv: sampleWorkerCsv,
    mapping: defaultMapping,
    commit: true,
  });
  expect(
    await db.implementationWorker.count({ where: { projectId: id } }),
  ).toBe(2);
  await expect(
    action(id, {
      action: "import",
      csv: sampleWorkerCsv,
      mapping: defaultMapping,
      commit: true,
    }),
  ).rejects.toThrow(/already exists/);
  expect(
    await db.implementationWorker.count({ where: { projectId: id } }),
  ).toBe(2);
});
test("report and exchange projections enforce org scope, dates and salary grants before serialization", async () => {
  const id = await setup();
  await complete(id);
  await action(id, {
    action: "import",
    csv: sampleWorkerCsv.replaceAll("2026-10-01", "2027-01-01"),
    mapping: defaultMapping,
    commit: true,
  });
  const c = implementationFixture();
  c.assignments = c.assignments.filter(
    (a) => a.actorId !== "manager" || a.orgId === "SUP-FR",
  );
  await action(id, { action: "save", config: c });
  const args = {
    actorId: "manager",
    environment: "Development",
    asOf: "2028-01-01",
  };
  const report = await implementationReport(hr, id, args);
  expect(report.rows).toHaveLength(1);
  expect(JSON.stringify(report)).not.toContain('"salary"');
  expect(
    (
      await implementationReport(hr, id, {
        ...args,
        actorId: "hr",
        asOf: "2026-10-19",
      })
    ).rows,
  ).toHaveLength(1);
  c.report.includeSalary = true;
  await action(id, { action: "save", config: c });
  await expect(implementationReport(hr, id, args)).rejects.toMatchObject({
    status: 403,
  });
  expect(
    (await implementationReport(hr, id, { ...args, actorId: "hr" })).rows[0]
      .salary,
  ).toBeDefined();
  c.integration.includeSalary = true;
  await action(id, { action: "save", config: c });
  await expect(
    action(id, {
      action: "exchange",
      environment: "Development",
      asOf: "2028-01-01",
    }),
  ).rejects.toMatchObject({ status: 403 });
  c.integration.includeSalary = false;
  await action(id, { action: "save", config: c });
  const exchange = await action(id, {
    action: "exchange",
    environment: "Development",
    asOf: "2028-01-01",
  });
  expect(exchange.count).toBe(3);
  expect(exchange.output).not.toContain("salary");
});
test("release gates require current suite and actual Hire; config-only promotion and restore preserve data", async () => {
  const id = await setup();
  await expect(
    action(id, { action: "promote", stage: "Test" }),
  ).rejects.toThrow(/passing acceptance/);
  await action(id, { action: "suite" });
  await expect(
    action(id, { action: "promote", stage: "Test" }),
  ).rejects.toThrow(/Complete a Development/);
  await complete(id);
  await expect(
    action(id, { action: "promote", stage: "Test" }),
  ).rejects.toThrow(/conversion/);
  await action(id, {
    action: "import",
    csv: sampleWorkerCsv,
    mapping: defaultMapping,
    commit: true,
  });
  await expect(
    action(id, { action: "promote", stage: "Test" }),
  ).rejects.toThrow(/exchange/);
  await action(id, {
    action: "exchange",
    environment: "Development",
    asOf: "2028-01-01",
  });
  await expect(
    action(id, { action: "promote", stage: "Production" }),
  ).rejects.toThrow(/Test before/);
  const release = await action(id, { action: "promote", stage: "Test" });
  await action(id, { action: "promote", stage: "Production" });
  const c = implementationFixture();
  c.report.name = "New report design";
  await action(id, { action: "save", config: c });
  await expect(
    action(id, { action: "promote", stage: "Production" }),
  ).rejects.toThrow(/passing acceptance/);
  await action(id, { action: "suite" });
  await action(id, {
    action: "exchange",
    environment: "Development",
    asOf: "2028-01-01",
  });
  await action(id, { action: "promote", stage: "Test" });
  await action(id, { action: "restore", releaseId: release.id });
  expect((await implementationDetail(hr, id)).config.report.name).toBe(
    "Worker reconciliation",
  );
  expect(
    await db.implementationWorker.count({
      where: { projectId: id, environment: "Production" },
    }),
  ).toBe(0);
  expect(
    await db.implementationWorker.count({
      where: { projectId: id, environment: "Development" },
    }),
  ).toBe(3);
  await expect(
    db.auditEvent.updateMany({
      where: { objectId: id },
      data: { action: "tampered" },
    }),
  ).rejects.toThrow();
});
test("request keys prevent duplicate Hires and persisted progress cannot forge chapter evidence", async () => {
  const id = await setup(),
    requestKey = randomUUID();
  const h = await hire(id, { requestKey }),
    replay = await hire(id, { requestKey });
  expect(replay.id).toBe(h.id);
  await expect(
    hire(id, {
      requestKey,
      input: { ...implementationHireFixture(), name: "Different Person" },
    }),
  ).rejects.toMatchObject({ status: 409 });
  await action(id, { action: "progress", mode: "Independent", step: 15 });
  const p = await implementationDetail(hr, id);
  expect(p.guideStep).toBe(15);
  expect(p.chapters.find((c) => c.id === "process")!.complete).toBe(false);
  await action(id, {
    action: "interview",
    answers: { brief: "My explanation ".repeat(10) },
  });
  expect(
    (await implementationDetail(hr, id)).evidence
      .find((e) => e.kind === "Interview")!
      .result.responses.filter((r: any) => r.answered),
  ).toHaveLength(1);
});

test("troubleshooting copies introduce one fault and preserve the baseline", async () => {
  const id = await setup();
  const before = await implementationDetail(hr, id);
  for (const fault of ["routing", "privacy", "reference"]) {
    const result = await action(id, { action: "drill", fault });
    const copy = await implementationDetail(hr, result.id);
    expect(copy.name).toMatch(/Troubleshooting/);
    expect(acceptanceSuite(copy.config).some((c) => !c.passed)).toBe(true);
    await action(copy.id, { action: "save", config: implementationFixture() });
    expect(
      acceptanceSuite((await implementationDetail(hr, copy.id)).config).every(
        (c) => c.passed,
      ),
    ).toBe(true);
  }
  expect((await implementationDetail(hr, id)).config).toEqual(before.config);
  expect(
    await db.implementationWorker.count({ where: { projectId: id } }),
  ).toBe(0);
});
