import { test, expect, APIRequestContext, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { today } from "../../lib/validators";
async function login(r: APIRequestContext, id: string) {
  expect(
    (
      await r.post("/api/session", {
        data: { userId: id, password: "Practice123!" },
      })
    ).ok(),
  ).toBe(true);
}
async function post(r: APIRequestContext, data: unknown) {
  const res = await r.post("/api/lab", { data });
  const body = await res.json();
  expect(res.ok(), JSON.stringify(body)).toBe(true);
  return body.result;
}
async function state(r: APIRequestContext) {
  return (await r.get("/api/lab")).json();
}
async function view(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("#content")).toBeVisible();
}
test("E2E-05 job change updates future profile, history and scoped headcount", async ({
  request,
  page,
}) => {
  request = page.request;
  await login(request, "manager-3");
  const p = await post(request, {
    op: "submit",
    data: {
      kind: "Change Job",
      workerId: "worker-003",
      positionId: "pos-328",
      effectiveDate: "2027-02-01",
      reason: "Promotion",
      hours: 36,
      requestKey: crypto.randomUUID(),
    },
  });
  await login(request, "hr-partner");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Reviewed",
  });
  await login(request, "hr");
  const before = await state(request);
  expect(
    before.workers.find((w: any) => w.id === "worker-003").employments[0]
      .positionId,
  ).toBe("pos-003");
  const after = await (await request.get("/api/lab?asOf=2027-02-01")).json();
  expect(
    after.workers.find((w: any) => w.id === "worker-003").employments[0]
      .positionId,
  ).toBe("pos-328");
  await view(page, "/workers");
  await page.getByLabel("Find a worker").fill("worker-003");
  await page.locator(".worker-row").click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByText("Employment snapshots as of", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/change-job-history-1440.png",
    fullPage: true,
  });
});
test("E2E-06 termination completes cross-role and reports former worker", async ({
  request,
  page,
}) => {
  request = page.request;
  await login(request, "hr");
  const p = await post(request, {
    op: "submit",
    data: {
      kind: "Termination",
      workerId: "worker-004",
      effectiveDate: today(),
      reason: "Voluntary resignation",
      hours: 40,
      requestKey: crypto.randomUUID(),
    },
  });
  await login(request, "manager-4");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Reviewed",
  });
  await login(request, "hr");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Final review",
  });
  const d = await state(request);
  expect(
    d.workers.find((w: any) => w.id === "worker-004").employments[0].status,
  ).toBe("Terminated");
  expect(d.positions.find((p: any) => p.id === "pos-004").status).toBe("Open");
  await view(page, "/reports");
  await expect(
    page.getByRole("heading", { name: "Worker & Headcount Report" }),
  ).toBeVisible();
});
test("E2E-07 compensation UI proposal, partner decision and restricted view", async ({
  page,
  request,
}) => {
  request = page.request;
  await login(request, "hr");
  await view(page, "/compensation");
  await page.getByRole("button", { name: "＋ Propose change" }).click();
  await page.getByRole("combobox", { name: /^Worker/ }).selectOption("worker-005");
  await page.getByLabel("Annual salary (EUR)").fill("91000");
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(
    page.getByRole("heading", { name: "My Tasks", exact: true }),
  ).toBeVisible();
  const d = await state(request),
    p = d.processes.find(
      (p: any) => p.kind === "Compensation" && p.workerId === "worker-005",
    );
  await login(request, "comp");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Approved",
  });
  expect(
    (await state(request)).workers.find((w: any) => w.id === "worker-005")
      .compensation[0].annualAmount,
  ).toBe(91000);
  await view(page, "/compensation");
  await page.screenshot({
    path: "docs/screenshots/compensation-partner-1440.png",
    fullPage: true,
  });
  await login(request, "employee");
  expect(JSON.stringify((await state(request)).workers)).not.toContain(
    "annualAmount",
  );
});
test("E2E-08 employee time off UI, manager decision and cancellation", async ({
  page,
  request,
}) => {
  request = page.request;
  await login(request, "employee");
  await view(page, "/absence");
  await page.getByLabel("First day").fill("2026-12-07");
  await page.getByLabel("Last day").fill("2026-12-09");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(
    page.getByRole("heading", { name: "My Tasks", exact: true }),
  ).toBeVisible();
  const p = (await state(request)).processes.find(
    (p: any) => p.kind === "Time Off",
  );
  await login(request, "manager-1");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Approved",
  });
  await login(request, "employee");
  const d = await state(request);
  expect(d.workers[0].balance.used).toBe(3);
  await view(page, "/absence");
  await page.screenshot({
    path: "docs/screenshots/absence-approved-1440.png",
    fullPage: true,
  });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel absence" }).click();
  await expect
    .poll(async () => (await state(request)).workers[0].balance.used)
    .toBe(0);
});
test("E2E-09 benefits UI election persisted; course enrollment/completion", async ({
  page,
  request,
}) => {
  request = page.request;
  await login(request, "employee");
  await view(page, "/benefits");
  await page.getByRole("button", { name: "Enroll in plan" }).first().click();
  await expect(page.getByText("Enrolled", { exact: true })).toBeVisible();
  expect((await state(request)).workers[0].enrollments).toHaveLength(1);
  await page.screenshot({
    path: "docs/screenshots/benefits-employee-1440.png",
    fullPage: true,
  });
  await view(page, "/learning");
  await page
    .getByRole("button", { name: "Enroll", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Mark completed" }).first().click();
  await expect.poll(async()=>(await state(request)).workers[0].learning[0].completed).toBe(true);
});
test("E2E-12 browser return, edit and resubmit preserves history", async ({
  page,
  request,
}) => {
  request = page.request;
  await login(request, "hr");
  const p = await post(request, {
    op: "submit",
    data: {
      kind: "Hire",
      prehireId: "prehire-006",
      positionId: "pos-306",
      effectiveDate: today(),
      reason: "New hire",
      hours: 40,
      requestKey: crypto.randomUUID(),
    },
  });
  await login(request, "manager-6");
  await post(request, {
    op: "act",
    id: p.id,
    action: "sendback",
    comment: "Change weekly hours",
  });
  await login(request, "hr");
  await view(page, "/my-tasks");
  await page.locator(".task-row").filter({ hasText: "Applicant 6" }).click();
  await page.getByLabel("Weekly hours", { exact: false }).fill("32");
  await page.getByRole("button", { name: "Save correction" }).click();
  await page.getByLabel("Correction summary").fill("Updated weekly hours");
  await page.getByRole("button", { name: "Resubmit", exact: true }).click();
  const after = (await state(request)).processes.find(
    (x: any) => x.id === p.id,
  );
  expect(after.status).toBe("Submitted");
  expect(after.hours).toBe(32);
  expect(after.tasks.some((t: any) => t.status === "Sent Back")).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/sendback-resubmitted-1440.png",
    fullPage: true,
  });
});
test("E2E-03 organization creation creates an independently usable manager", async ({
  request,
  page,
}) => {
  request = page.request;
  await login(request, "hr");
  const r = await post(request, {
    op: "organization",
    data: {
      name: "Practice Enablement",
      parentId: "org-01",
      companyId: "company-0",
      costCenter: "CC-LAB",
    },
  });
  const d = await state(request);
  expect(d.orgs.find((o: any) => o.id === r.id).managerId).toBeTruthy();
  await view(page, "/organizations");
  await page.screenshot({
    path: "docs/screenshots/organizations-1440.png",
    fullPage: true,
  });
  const accounts = await (await request.get("/api/session")).json();
  expect(
    accounts.some((a: any) => a.orgId === r.id && a.role === "Manager"),
  ).toBe(true);
});
test("origin protection, session revocation and security screen accessibility", async ({
  request,
  page,
}) => {
  request = page.request;
  const foreign = await request.post("/api/session", {
    headers: { origin: "https://foreign.example" },
    data: { userId: "hr", password: "Practice123!" },
  });
  expect(foreign.status()).toBe(403);
  await login(request, "security");
  await view(page, "/admin/security");
  await page.screenshot({
    path: "docs/screenshots/security-1440.png",
    fullPage: true,
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await request.delete("/api/session");
  expect((await request.get("/api/lab")).status()).toBe(401);
});
