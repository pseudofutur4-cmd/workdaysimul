import { test, expect, Page, APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { today } from "../../lib/validators";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });
async function login(page: Page, id: string) {
  await page.goto("/home");
  if (
    await page
      .getByRole("button", { name: "Switch Practice Persona", exact: true })
      .isVisible()
  ) {
    await page
      .getByRole("button", { name: "Switch Practice Persona", exact: true })
      .click();
  }
  await page.getByLabel("Practice account", { exact: true }).selectOption(id);
  await page.getByLabel("Local demo password").fill("Practice123!");
  await page
    .getByRole("button", {
      name: /Enter practice tenant|Switch practice persona →/,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Switch Practice Persona", exact: true }),
  ).toBeVisible();
}
async function api(ctx: APIRequestContext, id: string) {
  expect(
    (
      await ctx.post("/api/session", {
        data: { userId: id, password: "Practice123!" },
      })
    ).ok(),
  ).toBe(true);
}
async function post(ctx: APIRequestContext, payload: unknown) {
  const r = await ctx.post("/api/lab", { data: payload });
  const b = await r.json();
  expect(r.ok(), JSON.stringify(b)).toBe(true);
  return b.result;
}
test("E2E-01 browser Hire, separate manager, final HR review, employee onboarding", async ({
  page,
  browser,
}) => {
  await login(page, "hr");
  await expect(page.getByText("Good to see you, Sam.")).toBeVisible();
  await page.screenshot({ path: out + "/home-hr-1440.png", fullPage: true });
  await page.getByRole("link", { name: "Staffing", exact: true }).click();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(
    page.getByText("Select a pre-hire", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: out + "/hire-validation-1440.png",
    fullPage: true,
  });
  await page
    .getByLabel("Pre-hire", { exact: false })
    .selectOption("prehire-001");
  await page
    .getByRole("combobox", { name: /^Position/ })
    .selectOption("pos-301");
  await page.getByLabel("Hire date").fill(today());
  await page.screenshot({ path: out + "/hire-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(
    page.getByRole("heading", { name: "Hire: Jamie Rivera" }),
  ).toBeVisible();
  const d = await (await page.request.get("/api/lab")).json();
  const process = d.processes.find((p: any) => p.prehireId === "prehire-001");
  expect(process.status).toBe("Submitted");
  expect(d.workers.some((w: any) => w.name === "Jamie Rivera")).toBe(false);
  const mc = await browser.newContext({
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 1440, height: 900 },
  });
  const mp = await mc.newPage();
  await login(mp, "manager-1");
  await mp
    .getByRole("link", { name: /My Tasks/ })
    .first()
    .click();
  await expect(
    mp.getByRole("heading", { name: "Hire: Jamie Rivera" }),
  ).toBeVisible();
  await mp.screenshot({
    path: out + "/manager-approval-1440.png",
    fullPage: true,
  });
  await mp.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    mp.getByText("In Progress", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Complete HR review", exact: true })
    .click();
  // Wait for this selected hire, not an earlier completed process in the list.
  await expect(page.locator(".task-detail .badge.completed")).toBeVisible();
  const done = await (await page.request.get("/api/lab")).json();
  const event = done.processes.find((p: any) => p.id === process.id);
  expect(event.workerId).toBeTruthy();
  expect(done.workers.some((w: any) => w.id === event.workerId)).toBe(true);
  await page.screenshot({
    path: out + "/hire-completed-1440.png",
    fullPage: true,
  });
  const ec = await browser.newContext({ baseURL: "http://127.0.0.1:3001" });
  const ep = await ec.newPage();
  await login(ep, "employee-" + event.workerId);
  await ep
    .getByRole("link", { name: /My Tasks/ })
    .first()
    .click();
  await expect(
    ep.getByRole("heading", { name: "Your onboarding" }),
  ).toBeVisible();
  await expect(ep.getByRole("button", { name: "Mark completed" })).toHaveCount(
    3,
  );
  await ep.getByRole("button", { name: "Mark completed" }).first().click();
  await expect(ep.getByRole("button", { name: "Mark completed" })).toHaveCount(
    2,
  );
  await ep.screenshot({
    path: out + "/employee-onboarding-1440.png",
    fullPage: true,
  });
  await mc.close();
  await ec.close();
});
test("E2E-02/03 foundations and contact through browser", async ({ page }) => {
  await login(page, "hr");
  await page.goto("/positions");
  await page
    .getByRole("button", { name: "＋ Job profile", exact: true })
    .click();
  await page.getByLabel("Job profile name").fill("Practice Systems Architect");
  await page
    .getByLabel("Job family", { exact: false })
    .selectOption("family-1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create Job Profile" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "＋ Position", exact: true }).click();
  await page.getByLabel("Business title").fill("Practice Systems Architect");
  await page
    .getByLabel("Supervisory organization", { exact: false })
    .selectOption("org-01");
  const d = await (await page.request.get("/api/lab")).json();
  const profile = d.profiles.find(
    (p: any) => p.name === "Practice Systems Architect",
  );
  await page
    .getByLabel("Job profile", { exact: false })
    .selectOption(profile.id);
  await page.getByLabel("Location", { exact: false }).selectOption("loc-0");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.screenshot({ path: out + "/positions-1440.png", fullPage: true });
  await page.goto("/workers");
  await page.getByLabel("Find a worker").fill("Alex Morgan");
  await page.getByRole("button", { name: /Alex Morgan/ }).click();
  await page.getByRole("tab", { name: "Contact", exact: true }).click();
  await page
    .getByLabel("Personal email (synthetic)")
    .fill("alex.browser@home.example");
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByLabel("Personal email (synthetic)")).toHaveValue(
    "alex.browser@home.example",
  );
  await page.screenshot({
    path: out + "/worker-contact-1440.png",
    fullPage: true,
  });
});
test("E2E-04 requisition approval, simulated posting and offer-to-prehire", async ({
  request,
  page,
}) => {
  request = page.request;
  await api(request, "recruiter");
  const r = await post(request, {
    op: "requisition",
    data: {
      title: "Practice requisition",
      positionId: "pos-340",
      effectiveDate: today(),
      requestKey: crypto.randomUUID(),
    },
  });
  const d = await (await request.get("/api/lab")).json();
  const p = d.processes.find((p: any) => p.requisitionId === r.id);
  await api(request, "manager-15");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Approved",
  });
  await api(request, "recruiter");
  await post(request, { op: "publish", id: r.id });
  const c = await post(request, {
    op: "candidate",
    data: {
      name: "Sage Rowan",
      email: "sage.rowan@candidate.example",
      requisitionId: r.id,
    },
  });
  for (let i = 0; i < 3; i++)
    await post(request, { op: "advance", id: c.id, action: "advance" });
  const early = await request.post("/api/lab", {
    data: { op: "advance", id: c.id, action: "accept" },
  });
  expect(early.status()).toBe(400);
  await api(request, "manager-15");
  await page.goto("/my-tasks");
  await expect(
    page.getByRole("heading", { name: "Offer: Sage Rowan" }),
  ).toBeVisible();
  await page.screenshot({
    path: out + "/offer-approval-1440.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".badge.completed").first()).toBeVisible();
  await api(request, "recruiter");
  const accepted = await post(request, {
    op: "advance",
    id: c.id,
    action: "accept",
  });
  expect(accepted.prehireId).toBeTruthy();
  await api(request, "hr");
  const state = await (await request.get("/api/lab")).json();
  expect(
    state.prehires.some((p: any) => p.id === accepted.prehireId && p.eligible),
  ).toBe(true);
  expect(state.workers.some((w: any) => w.name === "Sage Rowan")).toBe(false);
});
test("E2E-10/11/13 exports, live policies and direct API denial", async ({
  request,
}) => {
  await api(request, "manager-1");
  const denied = await request.get("/api/reports?pay=true");
  expect(denied.status()).toBe(403);
  const d = await (await request.get("/api/lab")).json();
  expect(JSON.stringify(d.workers)).not.toContain("annualAmount");
  const csv = await (await request.get("/api/reports")).text();
  expect(csv).not.toContain("annualAmount");
  expect(csv).not.toContain("org-02");
  const bad = await request.post("/api/lab", {
    data: {
      op: "contact",
      workerId: "worker-002",
      email: "intruder@home.example",
    },
  });
  expect(bad.status()).toBe(403);
  await api(request, "security");
  await post(request, {
    op: "policy",
    data: {
      role: "Manager",
      domain: "compensation.view",
      granted: true,
      confirmed: true,
    },
  });
  await api(request, "manager-1");
  expect(
    JSON.stringify((await (await request.get("/api/lab")).json()).workers),
  ).toContain("annualAmount");
  expect((await request.get("/api/reports?pay=true")).status()).toBe(200);
  await api(request, "security");
  await post(request, {
    op: "policy",
    data: {
      role: "Manager",
      domain: "compensation.view",
      granted: false,
      confirmed: true,
    },
  });
});
test("E2E-14 persisted hire checkpoint scores actual state, replay starts fresh", async ({
  request,
}) => {
  await api(request, "hr");
  const a = await post(request, { op: "practice-start", id: "hire" });
  const pending = await post(request, { op: "practice-score", id: a.id });
  expect(pending.score).toBe(0);
  const p = await post(request, {
    op: "submit",
    data: {
      kind: "Hire",
      prehireId: "prehire-002",
      positionId: "pos-302",
      effectiveDate: today(),
      reason: "New hire",
      hours: 40,
      requestKey: crypto.randomUUID(),
    },
  });
  await api(request, "manager-2");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Approved",
  });
  await api(request, "hr");
  await post(request, {
    op: "act",
    id: p.id,
    action: "approve",
    comment: "Final",
  });
  expect((await post(request, { op: "practice-score", id: a.id })).score).toBe(
    100,
  );
  const fresh = await post(request, { op: "practice-start", id: "hire" });
  expect(
    (await post(request, { op: "practice-score", id: fresh.id })).score,
  ).toBe(0);
});
test("desktop/mobile layout, accessibility, keyboard and routes", async ({
  page,
}) => {
  // This checks ten cold routes, full screenshots and axe in one journey.
  test.setTimeout(120000);
  await login(page, "hr");
  await expect(page.getByText("Good to see you, Sam.")).toBeVisible();
  await page.keyboard.press("Tab");
  const a = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    a.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  for (const route of [
    "/search",
    "/workers",
    "/organizations",
    "/positions",
    "/staffing",
    "/my-tasks",
    "/compensation",
    "/reports",
    "/audit",
    "/practice",
  ]) {
    await page.goto(route);
    await expect(page.locator("#content")).toBeVisible();
    await page.screenshot({
      path: out + "/" + route.slice(1).replaceAll("/", "-") + "-1440.png",
      fullPage: true,
    });
  }
  // The reference-style inbox must keep keyboard focus and filter real records.
  await page.goto("/my-tasks");
  const inboxSearch = page.getByRole("textbox", {
    name: "Search process items",
  });
  await inboxSearch.pressSequentially("Practice Newcomer 10");
  await expect(inboxSearch).toBeFocused();
  await expect(page.locator(".task-row")).toHaveCount(1);
  await expect(page.locator(".task-row")).toContainText("Practice Newcomer 10");
  await page.screenshot({
    path: out + "/inbox-search-1440.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect
    .poll(async () => {
      const labels = await page.locator(".task-row .badge").allTextContents();
      return (
        labels.length > 0 && labels.every((label) => label === "Completed")
      );
    })
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");
  await expect(page.getByText("Good to see you, Sam.")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
  ).toBe(true);
  await page.screenshot({ path: out + "/home-mobile-390.png", fullPage: true });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Staffing", exact: true }),
  ).toBeVisible();
});
