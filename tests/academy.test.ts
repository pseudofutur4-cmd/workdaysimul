import { beforeAll, afterAll, test, expect } from "vitest";
import { db } from "../lib/db";
import { seed } from "../prisma/seed";
import {
  academyAction,
  academyWorkspace,
  academySchemas,
} from "../lib/academy-engine";
import type { User } from "@prisma/client";
let hr: User, employee: User, manager: User, security: User, other: User;
beforeAll(async () => {
  await seed();
  [hr, employee, manager, security, other] = await Promise.all(
    ["hr", "employee", "manager-1", "security", "manager-2"].map((id) =>
      db.user.findUniqueOrThrow({ where: { id } }),
    ),
  );
});
afterAll(() => db.$disconnect());
const fixtures: Record<string, any> = {
  finance: {
    memo: "Teaching accrual",
    date: "2026-10-19",
    debit: 250,
    credit: 250,
  },
  scm: {
    item: "Training laptop",
    quantity: 2,
    price: 600,
    supplier: "Aster Office Supplies (fictional)",
  },
  payroll: { hours: 40, rate: 25, deduction: 50 },
  time: { date: "2026-10-19", hours: 9, code: "Regular work" },
  talent: {
    goal: "Complete three plans",
    due: "2026-12-31",
    measure: "Three plans approved",
    progress: 25,
  },
  integration: {
    name: "Teaching export",
    direction: "Outbound",
    format: "CSV",
  },
  studio: {
    name: "Teaching assembly",
    transform: "Uppercase names",
    destination: "Local preview",
  },
  security: { role: "Employee", domain: "Compensation Data", grant: "Deny" },
};
async function create(module: string, actor = hr) {
  return academyAction(actor, {
    action: "create",
    module,
    orgId: "org-01",
    data: fixtures[module],
  });
}
async function complete(module: string, actor = hr) {
  const c = await create(module, actor);
  const submitted = await academyAction(actor, {
    action: "submit",
    id: c.id,
    version: c.version,
  });
  return academyAction(manager, {
    action: "approve",
    id: c.id,
    version: submitted.version,
    feedback: "Reviewed against the teaching rules",
    ...(module === "talent" ? { rating: 4 } : {}),
  });
}
test("balanced journal posts two lines atomically with immutable audit", async () => {
  await expect(
    academyAction(hr, {
      action: "create",
      module: "finance",
      orgId: "org-01",
      data: { ...fixtures.finance, credit: 249 },
    }),
  ).rejects.toThrow(/balance/);
  const c = await complete("finance");
  expect(c.ledgerLines).toHaveLength(2);
  expect(
    c.ledgerLines.reduce((n, l) => n + l.debitCents - l.creditCents, 0),
  ).toBe(0);
  expect(await db.auditEvent.count({ where: { objectId: c.id } })).toBe(3);
  await expect(
    academyAction(manager, {
      action: "approve",
      id: c.id,
      version: c.version,
      feedback: "Repeat",
    }),
  ).rejects.toThrow(/submitted/);
  expect(await db.academyLedgerLine.count({ where: { caseId: c.id } })).toBe(2);
});
test("self approval, unrelated reviewer, missing policy and scope are rejected", async () => {
  const c = await create("finance");
  const s = await academyAction(hr, {
    action: "submit",
    id: c.id,
    version: c.version,
  });
  for (const actor of [hr, employee, other])
    await expect(
      academyAction(actor, {
        action: "approve",
        id: c.id,
        version: s.version,
        feedback: "Unauthorized review",
      }),
    ).rejects.toMatchObject({ status: 403 });
  expect((await academyWorkspace(other)).cases.some((x) => x.id === c.id)).toBe(
    false,
  );
  await expect(create("finance", employee)).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    academyAction(employee, {
      action: "create",
      module: "time",
      orgId: "org-02",
      data: fixtures.time,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await db.policy.update({
    where: { role_domain: { role: "Manager", domain: "process.approve" } },
    data: { granted: false },
  });
  try {
    await expect(
      academyAction(manager, {
        action: "approve",
        id: c.id,
        version: s.version,
        feedback: "Policy revoked",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await academyWorkspace(manager)).cases.some((x) => x.id === c.id),
    ).toBe(false);
  } finally {
    await db.policy.update({
      where: { role_domain: { role: "Manager", domain: "process.approve" } },
      data: { granted: true },
    });
  }
});
test("send back, correct, resubmit, approve, receive, and version conflict", async () => {
  let c = await create("scm");
  c = await academyAction(hr, {
    action: "submit",
    id: c.id,
    version: c.version,
  });
  c = await academyAction(manager, {
    action: "sendback",
    id: c.id,
    version: c.version,
    feedback: "Please request three laptops",
  });
  const stale = c.version;
  c = await academyAction(hr, {
    action: "save",
    id: c.id,
    version: c.version,
    data: { ...fixtures.scm, quantity: 3 },
  });
  await expect(
    academyAction(hr, {
      action: "save",
      id: c.id,
      version: stale,
      data: fixtures.scm,
    }),
  ).rejects.toMatchObject({ status: 409 });
  c = await academyAction(hr, {
    action: "submit",
    id: c.id,
    version: c.version,
  });
  c = await academyAction(manager, {
    action: "approve",
    id: c.id,
    version: c.version,
    feedback: "Quantity confirmed",
  });
  expect(c.purchase?.totalCents).toBe(180000);
  c = await academyAction(hr, {
    action: "receive",
    id: c.id,
    version: c.version,
  });
  expect(c.purchase?.received).toBe(true);
  await expect(
    academyAction(hr, { action: "receive", id: c.id, version: c.version }),
  ).rejects.toMatchObject({ status: 409 });
});
test("time entry validates increments, saves overtime, and rejects duplicate dates atomically", async () => {
  expect(
    academySchemas.time.safeParse({ ...fixtures.time, hours: 9.1 }).success,
  ).toBe(false);
  const c = await complete("time", employee);
  expect(c.timeEntry).toMatchObject({
    regularMinutes: 480,
    overtimeMinutes: 60,
  });
  const duplicate = await create("time", employee);
  const submitted = await academyAction(employee, {
    action: "submit",
    id: duplicate.id,
    version: duplicate.version,
  });
  await expect(
    academyAction(manager, {
      action: "approve",
      id: duplicate.id,
      version: submitted.version,
      feedback: "Duplicate teaching date",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await db.academyCase.findUniqueOrThrow({ where: { id: duplicate.id } }))
      .status,
  ).toBe("Submitted");
});
test("goal review persists rating, feedback and progress", async () => {
  const c = await complete("talent", employee);
  expect(c.goal).toMatchObject({
    progress: 25,
    managerRating: 4,
    goal: "Complete three plans",
  });
});
test("payroll cents arithmetic and negative net validation", async () => {
  expect(
    academySchemas.payroll.safeParse({ ...fixtures.payroll, deduction: 900 })
      .success,
  ).toBe(false);
  const c = await complete("payroll");
  expect(c.payslip).toMatchObject({
    grossCents: 100000,
    taxCents: 20000,
    deductionCents: 5000,
    netCents: 75000,
  });
});
test.each(["integration", "studio", "security"])(
  "%s executes a real local effect once",
  async (module) => {
    const c = await create(module, security);
    const done = await academyAction(security, {
      action: "execute",
      id: c.id,
      version: c.version,
    });
    expect(done.status).toBe("Completed");
    if (module === "integration")
      expect(done.run?.output).toContain("DEMO-001,Alex Rowan");
    if (module === "studio") expect(done.run?.output).toContain("ALEX ROWAN");
    if (module === "security")
      expect(done.accessTest).toMatchObject({
        decision: "Denied",
        approvalAllowed: false,
      });
    await expect(
      academyAction(security, {
        action: "execute",
        id: c.id,
        version: done.version,
      }),
    ).rejects.toThrow(/draft/);
  },
);
test("denial and cancellation never post domain effects", async () => {
  let c = await create("finance");
  c = await academyAction(hr, {
    action: "submit",
    id: c.id,
    version: c.version,
  });
  const denied = await academyAction(manager, {
    action: "deny",
    id: c.id,
    version: c.version,
    feedback: "No supporting rationale",
  });
  expect(denied.status).toBe("Denied");
  expect(denied.ledgerLines).toHaveLength(0);
  c = await create("payroll");
  const cancelled = await academyAction(hr, {
    action: "cancel",
    id: c.id,
    version: c.version,
  });
  expect(cancelled.status).toBe("Cancelled");
  expect(cancelled.payslip).toBe(null);
});
