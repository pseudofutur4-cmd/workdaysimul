import { beforeAll, afterAll, describe, test, expect } from "vitest";
import { db } from "../lib/db";
import { seed } from "../prisma/seed";
import {
  submit,
  act,
  audit,
  editReturned,
  enrollBenefit,
  cancelAbsence,
  contactChange,
} from "../lib/engine";
import { workerAccess, allowed } from "../lib/policy";
import { workspace } from "../lib/read";
import { weekdays, today, hireSchema } from "../lib/validators";
import type { User } from "@prisma/client";
import { rescindHire } from "../lib/rescind";
import { scoreAttempt } from "../lib/scoring";
import { positionStates } from "../lib/positions";
let hr: User, manager: User, employee: User, partner: User, comp: User;
const hire = (n = 1) => ({
  kind: "Hire",
  prehireId: "prehire-" + String(n).padStart(3, "0"),
  positionId: "pos-" + String(300 + n).padStart(3, "0"),
  effectiveDate: today(),
  reason: "New hire",
  hours: 40,
  requestKey: crypto.randomUUID(),
});
beforeAll(async () => {
  await seed();
  [hr, manager, employee, partner, comp] = await Promise.all(
    ["hr", "manager-1", "employee", "hr-partner", "comp"].map((id) =>
      db.user.findUniqueOrThrow({ where: { id } }),
    ),
  );
});
afterAll(() => db.$disconnect());
describe("Phase 1–2: staffing lifecycle and security", () => {
  test("deterministic fixture integrity", async () => {
    expect(await db.worker.count()).toBe(300);
    expect(await db.organization.count()).toBe(25);
    expect(await db.position.count({ where: { status: "Open" } })).toBe(50);
    expect(await db.employment.count()).toBe(300);
  });
  test("E2E-01 hire crosses separate accounts and posts atomic consequences", async () => {
    const p = await submit(hr, hire());
    expect(await db.worker.count()).toBe(300);
    await expect(act(employee, p.id, "approve", "")).rejects.toMatchObject({
      status: 403,
    });
    await expect(act(hr, p.id, "approve", "")).rejects.toMatchObject({
      status: 403,
    });
    await act(manager, p.id, "approve", "Manager reviewed");
    expect(await db.worker.count()).toBe(300);
    await act(hr, p.id, "approve", "Final review");
    const done = await db.process.findUniqueOrThrow({ where: { id: p.id } });
    expect(done.status).toBe("Completed");
    expect(done.workerId).toBeTruthy();
    expect(
      await db.onboardingTask.count({ where: { workerId: done.workerId! } }),
    ).toBe(3);
    expect(
      (await db.preHire.findUniqueOrThrow({ where: { id: p.prehireId! } }))
        .workerId,
    ).toBe(done.workerId);
    expect(
      (await db.position.findUniqueOrThrow({ where: { id: p.positionId! } }))
        .status,
    ).toBe("Filled");
    expect(await db.auditEvent.count({ where: { processId: p.id } })).toBe(4);
    await expect(act(hr, p.id, "approve", "")).rejects.toBeTruthy();
  });
  test("duplicate request key is idempotent", async () => {
    const x = hire(2);
    const p = await submit(hr, x);
    const again = await submit(hr, x);
    expect(again.id).toBe(p.id);
    expect(await db.approvalTask.count({ where: { processId: p.id } })).toBe(1);
    await act(hr, p.id, "cancel", "Withdraw");
  });
  test("position reservation blocks competing submissions", async () => {
    const a = await submit(hr, hire(3));
    await expect(submit(hr, hire(3))).rejects.toThrow();
    expect(
      (await db.position.findUniqueOrThrow({ where: { id: "pos-303" } }))
        .status,
    ).toBe("Reserved");
    await act(hr, a.id, "cancel", "Withdraw");
    expect(
      (await db.position.findUniqueOrThrow({ where: { id: "pos-303" } }))
        .status,
    ).toBe("Open");
    expect(await db.worker.count()).toBe(301);
  });
  test("E2E-12 send back, persist correction and reroute", async () => {
    const p = await submit(hr, hire(4));
    const m = await db.user.findUniqueOrThrow({ where: { id: "manager-4" } });
    await act(m, p.id, "sendback", "Please correct hours");
    expect(
      (await db.process.findUniqueOrThrow({ where: { id: p.id } })).status,
    ).toBe("Sent Back");
    await editReturned(hr, p.id, { ...hire(4), hours: 32 });
    await act(hr, p.id, "resubmit", "Corrected weekly hours");
    expect(
      await db.approvalTask.count({
        where: { processId: p.id, status: "Pending" },
      }),
    ).toBe(1);
    await act(m, p.id, "approve", "Reviewed");
    await act(hr, p.id, "approve", "Final");
    expect(
      (await db.employment.findUniqueOrThrow({ where: { processId: p.id } }))
        .hours,
    ).toBe(32);
  });
  test("denial never creates a worker", async () => {
    const before = await db.worker.count();
    const p = await submit(hr, hire(5));
    const m = await db.user.findUniqueOrThrow({ where: { id: "manager-5" } });
    await expect(act(m, p.id, "deny", "")).rejects.toThrow("reason");
    await act(m, p.id, "deny", "Not approved");
    expect(await db.worker.count()).toBe(before);
    expect(
      (await db.position.findUniqueOrThrow({ where: { id: "pos-305" } }))
        .status,
    ).toBe("Open");
  });
  test("backend rejects invalid required values/dates and occupied positions", async () => {
    expect(
      hireSchema.safeParse({ ...hire(), effectiveDate: "2026-02-31" }).success,
    ).toBe(false);
    await expect(submit(hr, { ...hire(6), hours: 50 })).rejects.toThrow();
    await expect(
      submit(hr, { ...hire(6), positionId: "pos-001" }),
    ).rejects.toThrow("filled");
    expect(
      await db.process.count({ where: { prehireId: "prehire-006" } }),
    ).toBe(0);
  });
  test("E2E-02 contact data mutates with audited before/after", async () => {
    await contactChange(employee, "worker-001", "alex+updated@home.example");
    expect(
      (
        await db.contact.findUniqueOrThrow({
          where: { workerId: "worker-001" },
        })
      ).personalEmail,
    ).toBe("alex+updated@home.example");
    expect(
      await db.auditEvent.count({
        where: { action: "Contact change", objectId: "worker-001" },
      }),
    ).toBe(1);
    await expect(
      contactChange(employee, "worker-002", "bad@home.example"),
    ).rejects.toMatchObject({ status: 403 });
  });
  test("E2E-05 future job change preserves as-of state", async () => {
    const p = await submit(manager, {
      kind: "Change Job",
      workerId: "worker-001",
      positionId: "pos-326",
      effectiveDate: "2027-01-01",
      reason: "Promotion",
      hours: 40,
      requestKey: crypto.randomUUID(),
    });
    await act(partner, p.id, "approve", "Approved");
    const before = await workspace(hr, "2026-10-14");
    expect(
      before.workers.find((w) => w.id === "worker-001")?.employments[0]
        .positionId,
    ).toBe("pos-001");
    const after = await workspace(hr, "2027-01-01");
    expect(
      after.workers.find((w) => w.id === "worker-001")?.employments[0]
        .positionId,
    ).toBe("pos-326");
  });
  test("E2E-06 termination preserves history and vacates position", async () => {
    const p = await submit(hr, {
      kind: "Termination",
      workerId: "worker-026",
      effectiveDate: today(),
      reason: "Voluntary resignation",
      hours: 40,
      requestKey: crypto.randomUUID(),
    });
    await act(manager, p.id, "approve", "Reviewed");
    await act(hr, p.id, "approve", "Complete");
    expect(
      (await db.employment.findUniqueOrThrow({ where: { processId: p.id } }))
        .status,
    ).toBe("Terminated");
    expect(
      (await db.position.findUniqueOrThrow({ where: { id: "pos-026" } }))
        .status,
    ).toBe("Open");
    expect(
      await db.employment.count({ where: { workerId: "worker-026" } }),
    ).toBe(2);
  });
  test("audit rows reject update and delete", async () => {
    const e = await db.auditEvent.findFirstOrThrow();
    await expect(
      db.auditEvent.update({
        where: { id: e.id },
        data: { action: "Tampered" },
      }),
    ).rejects.toThrow();
    await expect(
      db.auditEvent.delete({ where: { id: e.id } }),
    ).rejects.toThrow();
  });
  test("E2E-13 scoped worker, salary and personal contact enforcement", async () => {
    await expect(workerAccess(manager, "worker-002")).rejects.toMatchObject({
      status: 403,
    });
    const d = await workspace(manager);
    expect(d.workers.every((w) => w.employments[0].orgId === "org-01")).toBe(
      true,
    );
    expect(JSON.stringify(d.workers)).not.toContain("annualAmount");
    expect(JSON.stringify(d.workers)).not.toContain("personalEmail");
    const e = await workspace(employee);
    expect(e.workers).toHaveLength(1);
    expect(e.workers[0].id).toBe("worker-001");
  });
});
describe("Phase 3–4: cross-module effects", () => {
  test("future staffing resolves both target reservation and original vacancy as-of", async () => {
    const current = await positionStates("2026-10-14"),
      future = await positionStates("2027-01-01");
    expect(current.get("pos-001")).toBe("Filled");
    expect(current.get("pos-326")).toBe("Reserved");
    expect(future.get("pos-001")).toBe("Open");
    expect(future.get("pos-326")).toBe("Filled");
  });
  test("hiring into a future vacated position uses effective availability", async () => {
    const p = await submit(hr, {
      ...hire(26),
      positionId: "pos-001",
      effectiveDate: "2027-01-02",
    });
    expect(p.status).toBe("Submitted");
    await act(hr, p.id, "cancel", "Practice withdrawal");
    expect((await positionStates("2026-10-14")).get("pos-001")).toBe("Filled");
  });
  test("completed unchanged hire can be rescinded without deleting history", async () => {
    const p = await submit(hr, hire(8));
    const m = await db.user.findUniqueOrThrow({ where: { id: "manager-8" } });
    await act(m, p.id, "approve", "Approved");
    await act(hr, p.id, "approve", "Final");
    const completed = await db.process.findUniqueOrThrow({
      where: { id: p.id },
    });
    const prior = await db.auditEvent.count({ where: { processId: p.id } });
    await rescindHire(hr, p.id, "Recorded in error");
    expect(
      (await db.preHire.findUniqueOrThrow({ where: { id: p.prehireId! } }))
        .eligible,
    ).toBe(true);
    expect(
      (await db.position.findUniqueOrThrow({ where: { id: p.positionId! } }))
        .status,
    ).toBe("Open");
    expect(
      await db.employment.count({ where: { workerId: completed.workerId! } }),
    ).toBe(1);
    expect(
      (await workspace(hr)).workers.find((w) => w.id === completed.workerId)
        ?.employments[0].status,
    ).toBe("Rescinded");
    expect(await db.auditEvent.count({ where: { processId: p.id } })).toBe(
      prior + 1,
    );
    await expect(rescindHire(hr, p.id, "Again")).rejects.toMatchObject({
      status: 409,
    });
  });
  test("practice scoring checks current contact domain state and attempt ownership", async () => {
    const latest = await db.auditEvent.findFirst({ orderBy: { id: "desc" } });
    const a = await db.practiceAttempt.create({
      data: {
        userId: employee.id,
        scenario: "contact",
        baselineAudit: latest?.id ?? 0,
      },
    });
    expect((await scoreAttempt(a.id, employee.id)).score).toBe(0);
    await contactChange(employee, "worker-001", "scored.contact@home.example");
    expect((await scoreAttempt(a.id, employee.id)).score).toBe(100);
    await expect(scoreAttempt(a.id, manager.id)).rejects.toThrow(
      "Your attempt",
    );
    // Restore prior fixture value used by rollback assertions.
    await contactChange(employee, "worker-001", "alex+updated@home.example");
  });
  test("E2E-07 salary changes only after compensation partner approval", async () => {
    const p = await submit(hr, {
      kind: "Compensation",
      workerId: "worker-002",
      effectiveDate: today(),
      reason: "Annual review",
      amount: 88000,
      requestKey: crypto.randomUUID(),
    });
    expect(
      (
        await db.compensation.findFirstOrThrow({
          where: { workerId: "worker-002" },
          orderBy: { effectiveDate: "desc" },
        })
      ).annualAmount,
    ).not.toBe(88000);
    await expect(act(manager, p.id, "approve", "")).rejects.toMatchObject({
      status: 403,
    });
    await act(comp, p.id, "approve", "Approved");
    expect(
      (await db.compensation.findUniqueOrThrow({ where: { processId: p.id } }))
        .annualAmount,
    ).toBe(88000);
    const d = await workspace(manager);
    expect(
      d.processes.some((p) => p.id === p.id && p.kind === "Compensation"),
    ).toBe(false);
  });
  test("weekday calculation validates ranges", () => {
    expect(weekdays("2026-10-16", "2026-10-19")).toBe(2);
    expect(() => weekdays("2026-11-01", "2026-10-01")).toThrow();
    expect(weekdays("2026-10-17", "2026-10-18")).toBe(0);
  });
  test("E2E-08 absence approval debits bank and cancellation restores it", async () => {
    const p = await submit(employee, {
      kind: "Time Off",
      workerId: "worker-001",
      effectiveDate: "2026-11-02",
      endDate: "2026-11-04",
      reason: "Annual leave",
      requestKey: crypto.randomUUID(),
    });
    expect(
      (
        await db.timeOffBalance.findUniqueOrThrow({
          where: { workerId: "worker-001" },
        })
      ).used,
    ).toBe(0);
    await act(manager, p.id, "approve", "Approved");
    expect(
      (
        await db.timeOffBalance.findUniqueOrThrow({
          where: { workerId: "worker-001" },
        })
      ).used,
    ).toBe(3);
    await expect(
      submit(employee, {
        kind: "Time Off",
        workerId: "worker-001",
        effectiveDate: "2026-11-03",
        endDate: "2026-11-05",
        reason: "Overlap",
        requestKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow("overlaps");
    const a = await db.timeOffRequest.findUniqueOrThrow({
      where: { processId: p.id },
    });
    await cancelAbsence(employee, a.id);
    expect(
      (
        await db.timeOffBalance.findUniqueOrThrow({
          where: { workerId: "worker-001" },
        })
      ).used,
    ).toBe(0);
    await expect(cancelAbsence(employee, a.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  test("E2E-09 benefits enrollment applies eligibility and prevents duplicates", async () => {
    const r = await enrollBenefit(employee, "benefit-0", today());
    expect(r.workerId).toBe("worker-001");
    await expect(
      enrollBenefit(employee, "benefit-0", today()),
    ).rejects.toThrow();
    await expect(
      enrollBenefit(manager, "benefit-1", today()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      enrollBenefit(employee, "benefit-1", "2031-01-01"),
    ).rejects.toThrow("window");
  });
  test("E2E-11 activated policy affects actual server projection", async () => {
    expect(await allowed(manager, "compensation.view")).toBe(false);
    await db.policy.create({
      data: { role: "Manager", domain: "compensation.view", granted: true },
    });
    expect(await allowed(manager, "compensation.view")).toBe(true);
    const d = await workspace(manager);
    expect(JSON.stringify(d.workers)).toContain("annualAmount");
    await db.policy.update({
      where: { role_domain: { role: "Manager", domain: "compensation.view" } },
      data: { granted: false },
    });
    expect(JSON.stringify((await workspace(manager)).workers)).not.toContain(
      "annualAmount",
    );
  });
  test("independent actors and scopes cannot use another request key", async () => {
    const p = await submit(hr, hire(7));
    await expect(
      submit(manager, { ...hire(7), requestKey: p.requestKey }),
    ).rejects.toMatchObject({ status: 409 });
    await act(hr, p.id, "cancel", "Withdraw");
  });
  test("transaction rollback leaves neither audit nor domain changes", async () => {
    const n = await db.auditEvent.count();
    await expect(
      db.$transaction(async (tx) => {
        await audit(tx, hr, "Rollback test", "none", null, { test: true });
        await tx.contact.update({
          where: { workerId: "worker-001" },
          data: { personalEmail: "should-rollback@home.example" },
        });
        throw Error("Abort");
      }),
    ).rejects.toThrow("Abort");
    expect(await db.auditEvent.count()).toBe(n);
    expect(
      (
        await db.contact.findUniqueOrThrow({
          where: { workerId: "worker-001" },
        })
      ).personalEmail,
    ).not.toContain("should-rollback");
  });
});
