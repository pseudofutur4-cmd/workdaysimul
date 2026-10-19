import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { implementationFixture } from "../implementation-fixture";
import { sampleWorkerCsv } from "../../lib/implementation-catalog";

async function login(request: APIRequestContext, userId = "hr") {
  expect(
    (
      await request.post("/api/session", {
        data: { userId, password: "Practice123!" },
      })
    ).ok(),
  ).toBe(true);
}
async function create(request: APIRequestContext, name: string) {
  const response = await request.post("/api/implementation", {
    data: { action: "create", name },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).result;
}
async function command(request: APIRequestContext, id: string, command: any) {
  const p = await (await request.get("/api/implementation?id=" + id)).json();
  const r = await request.post("/api/implementation", {
    data: { id, version: p.version, command },
  });
  expect(await r.text()).not.toContain('"error"');
  return r;
}
async function chapter(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Implementation chapters" })
    .getByRole("link", { name, exact: false })
    .click();
}

test("mode switch opens empty implementation projects, guided chapters and editable foundations", async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page.request);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/home");
  await page
    .getByRole("navigation", { name: "Lab mode" })
    .getByRole("link", { name: "Implementation Lab", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Build the environment/ }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (await new AxeBuilder({ page }).include(".impl-page").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/implementation-projects-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("My first implementation");
  await page.getByRole("button", { name: "Create empty project" }).click();
  await expect(
    page.getByRole("heading", { name: "My first implementation" }),
  ).toBeVisible();
  await expect(page.locator(".impl-project-heading")).toContainText(
    "0 / 8 chapters evidenced",
  );
  await page.getByRole("button", { name: "Guide this chapter" }).click();
  await expect(page.getByRole("dialog")).toContainText("Step 1 of 16");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("dialog")).toContainText("Step 2 of 16");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const fixture = implementationFixture();
  await page
    .getByLabel("Organization design and rationale")
    .fill(fixture.design.organization);
  await page
    .getByLabel("Access boundaries and responsible roles")
    .fill(fixture.design.security);
  await page
    .getByLabel("Acceptance criteria and evidence")
    .fill(fixture.design.acceptance);
  await page.getByRole("button", { name: "Save design decisions" }).click();
  await expect(page.locator(".impl-project-heading")).toContainText(
    "1 / 8 chapters evidenced",
  );
  await chapter(page, "Organizations");
  await page.getByRole("button", { name: "Add company", exact: true }).click();
  await expect(page.getByLabel("Reference ID")).toHaveValue("CO-FR");
  await page.getByRole("button", { name: "Save object" }).click();
  await expect(page.getByRole("button", { name: "Edit CO-FR" })).toBeVisible();
  await page.getByRole("button", { name: "Add company", exact: true }).click();
  await expect(page.getByLabel("Reference ID")).toHaveValue("CO-SE");
  await page.getByRole("button", { name: "Save object" }).click();
  await expect(page.getByRole("button", { name: "Edit CO-SE" })).toBeVisible();
  for (const [name, ids] of [
    ["location", ["LOC-FR", "LOC-SE"]],
    ["cost center", ["CC-FR", "CC-SE"]],
    ["organization", ["SUP-FR", "SUP-SE"]],
  ] as const) {
    for (const id of ids) {
      await page
        .getByRole("button", { name: `Add ${name}`, exact: true })
        .click();
      await expect(page.getByLabel("Reference ID")).toHaveValue(id);
      await page.getByRole("button", { name: "Save object" }).click();
      await expect(
        page.getByRole("button", { name: `Edit ${id}` }),
      ).toBeVisible();
    }
  }
  await expect(page.locator(".impl-project-heading")).toContainText(
    "2 / 8 chapters evidenced",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Edit SUP-SE" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".impl-page").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/implementation-foundations-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include(".impl-page").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/implementation-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("learner configures policies and Hire, converts data, completes approvals and releases a company", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page.request);
  const p = await create(page.request, "Company implementation capstone");
  const c = implementationFixture();
  c.assignments = [];
  c.policies = c.policies.map((p) => ({
    ...p,
    workers: false,
    salary: false,
    initiate: false,
    approve: false,
  }));
  c.hire = {
    firstApprover: "Manager",
    partnerThreshold: 0,
    finalReview: false,
    onboarding: [],
  };
  c.integration.enabled = false;
  await command(page.request, p.id, { action: "save", config: c });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Simulate the API surface exposed by a friend's LAN HTTP browser.
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto(`/implementation/${p.id}/security`);
  for (const org of ["SUP-FR", "SUP-SE"])
    for (const role of [
      "HR Admin",
      "Manager",
      "HR Partner",
      "Integration User",
    ])
      await page
        .getByRole("checkbox", {
          name: `${role} assigned to ${org}`,
          exact: true,
        })
        .check();
  for (const [role, grants] of [
    ["HR Admin", ["workers", "salary", "initiate", "approve"]],
    ["Manager", ["workers", "approve"]],
    ["HR Partner", ["workers", "approve"]],
    ["Integration User", ["workers"]],
  ] as const)
    for (const grant of grants)
      await page
        .getByRole("checkbox", { name: `${role} ${grant}`, exact: true })
        .check();
  await page
    .getByRole("button", { name: "Save security configuration" })
    .click();
  await expect(page.locator(".impl-project-heading")).toContainText(
    "All configuration saved",
  );
  await chapter(page, "Business process");
  await page
    .getByLabel("Additional HR Partner review at annual salary")
    .fill("55000");
  await page.getByRole("checkbox", { name: "Require final HR review" }).check();
  await page
    .getByRole("textbox", { name: "Onboarding tasks" })
    .fill("Confirm personal details\nReview welcome checklist\n");
  await page.getByRole("button", { name: "Save Hire definition" }).click();
  await expect(page.locator(".notice")).toContainText(
    "Saved to your implementation project",
  );
  await chapter(page, "Reports & integrations");
  await page
    .getByRole("checkbox", { name: "Enable local worker exchange" })
    .check();
  await page
    .getByRole("button", { name: "Save report & exchange configuration" })
    .click();
  await expect(page.locator(".impl-project-heading")).toContainText(
    "All configuration saved",
  );
  await chapter(page, "Data migration");
  await page
    .getByRole("textbox", { name: "Source CSV" })
    .fill(
      sampleWorkerCsv.replace(
        "CONV-002,Casey Park,SUP-SE",
        "CONV-002,Casey Park,MISSING",
      ),
    );
  await page.getByRole("button", { name: "Validate import" }).click();
  await expect(page.locator(".impl-import-result")).toContainText("1 rejected");
  await expect(
    page.getByRole("button", { name: "Commit validated import" }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Source CSV" }).fill(sampleWorkerCsv);
  await page.getByRole("button", { name: "Validate import" }).click();
  await expect(page.locator(".impl-import-result")).toContainText("0 rejected");
  await page.getByRole("button", { name: "Commit validated import" }).click();
  await expect(page.locator(".impl-import-result")).toContainText(
    "2 committed",
  );
  await page
    .getByRole("link", { name: "Company sandbox", exact: false })
    .click();
  await page.getByRole("button", { name: "Submit sandbox Hire" }).click();
  await expect(page.locator(".impl-hire")).toContainText("Assigned to Manager");
  for (const [actor, next] of [
    ["manager", "HR Partner"],
    ["partner", "HR Admin"],
    ["hr", "Completed"],
  ]) {
    await page.getByLabel("Sandbox identity").selectOption(actor);
    await page.getByRole("button", { name: "Approve sandbox Hire" }).click();
    await expect(page.locator(".impl-hire .impl-status")).toContainText(next);
  }
  await expect(page.locator(".impl-onboarding")).toContainText("Riley Brooks");
  await page
    .getByRole("checkbox", { name: "Confirm personal details" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Confirm personal details" }),
  ).toBeChecked();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (await new AxeBuilder({ page }).include(".impl-page").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/implementation-sandbox-completed.png",
    fullPage: true,
    animations: "disabled",
  });
  await chapter(page, "Reports & integrations");
  await page.getByRole("button", { name: "Run scoped report" }).click();
  await expect(
    page.getByRole("heading", { name: "Worker reconciliation · 3 rows" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run outbound exchange" }).click();
  await expect(
    page.getByRole("button", { name: "Download local output" }),
  ).toBeVisible();
  await chapter(page, "Testing & go-live");
  await page.getByRole("button", { name: "Run acceptance suite" }).click();
  await expect(page.locator(".impl-check-results .pass")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Promote to Test", exact: true })
    .click();
  await expect(page.locator(".notice")).toContainText(
    "Test configuration snapshot created",
  );
  await page
    .getByRole("button", { name: "Promote to Production", exact: true })
    .click();
  await expect(page.locator(".impl-project-heading")).toContainText(
    "8 / 8 chapters evidenced",
  );
  await page.screenshot({
    path: "docs/screenshots/implementation-release-evidence.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Architecture map" }).click();
  await expect(page.locator(".impl-blueprint")).toContainText(
    "SUP-FR → SUP-SE",
  );
  await page.screenshot({
    path: "docs/screenshots/implementation-architecture.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("link", { name: "Interview room", exact: false })
    .click();
  await page
    .getByRole("textbox", { name: "Answer 1", exact: true })
    .fill(
      "I would clarify legal entities, supervisory hierarchy, the staffing models, data visibility, approval responsibility and the acceptance evidence before configuring the tenant.",
    );
  await page.getByRole("button", { name: "Save interview responses" }).click();
  await expect(
    page.getByRole("heading", { name: "Saved response coverage" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Answer 1", exact: true }),
  ).toHaveValue(/legal entities/);
  await page
    .getByRole("link", { name: "Troubleshooting", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Create troubleshooting copy: routing" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Troubleshooting: Hire cannot route",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Manager assigned to SUP-FR",
      exact: true,
    }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: "Manager assigned to SUP-FR", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save security configuration" })
    .click();
  await expect(page.locator(".impl-project-heading")).toContainText(
    "All configuration saved",
  );
  expect(errors).toEqual([]);
});

test("implementation APIs require a session, valid origin and project ownership", async ({
  page,
  playwright,
}) => {
  await login(page.request);
  const p = await create(page.request, "Ownership boundary test");
  const anonymous = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3001",
  });
  expect((await anonymous.get("/api/implementation?id=" + p.id)).status()).toBe(
    401,
  );
  expect(
    (
      await page.request.post("/api/implementation", {
        headers: { Origin: "https://unrelated.example" },
        data: { action: "create", name: "Cross origin" },
      })
    ).status(),
  ).toBe(403);
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3001",
  });
  await login(other, "security");
  expect((await other.get("/api/implementation?id=" + p.id)).status()).toBe(
    404,
  );
  expect(
    (
      await other.post("/api/implementation", {
        data: { id: p.id, version: 1, command: { action: "suite" } },
      })
    ).status(),
  ).toBe(404);
  await anonymous.dispose();
  await other.dispose();
});
