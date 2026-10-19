import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function expectAlignedHighlight(page: any, selector: string) {
  await expect
    .poll(async () =>
      page.evaluate((target: string) => {
        const a = document.querySelector(target)?.getBoundingClientRect();
        const b = document
          .querySelector(".coach-spotlight")
          ?.getBoundingClientRect();
        if (!a || !b) return 9999;
        return Math.max(
          Math.abs(a.left - 6 - b.left),
          Math.abs(a.top - 6 - b.top),
          Math.abs(a.width + 12 - b.width),
          Math.abs(a.height + 12 - b.height),
        );
      }, selector),
    )
    .toBeLessThan(2);
}
const signIn = async (page: any, userId: string) => {
  expect(
    (
      await page.request.post("/api/session", {
        data: { userId, password: "Practice123!" },
      })
    ).ok(),
  ).toBe(true);
};
const next = async (page: any) => {
  const button = page
    .getByRole("dialog")
    .getByRole("button", { name: "Next step" });
  await expect(button).toBeEnabled();
  await button.click();
};
const switchAccount = async (page: any, id: string) => {
  await page.getByRole("button", { name: "Switch Practice Persona" }).click();
  await page.getByLabel("Practice account", { exact: true }).selectOption(id);
  await page
    .getByLabel("Local demo password", { exact: true })
    .fill("Practice123!");
  await page
    .getByRole("button", { name: /Switch practice persona.*→/ })
    .click();
  await expect(page.locator(".switch-panel")).toHaveCount(0);
};
test("guided integration highlights actions, waits, executes, persists completion, and resumes", async ({
  page,
}) => {
  await signIn(page, "security");
  await page.goto("/academy");
  await expect(page.locator(".academy-course")).toHaveCount(11);
  await page.screenshot({
    path: "docs/screenshots/academy-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const course = page.locator(".academy-course").filter({
    has: page.getByRole("heading", { name: "Integrations", exact: true }),
  });
  await course.getByRole("button", { name: "Start lesson" }).click();
  await expect(page.getByRole("dialog")).toContainText("Step 1 of");
  await next(page);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Next step" }),
  ).toBeDisabled();
  await page.locator('[data-coach="new"]').click();
  await next(page);
  await expect(page.locator(".coach-spotlight")).toBeVisible();
  await expectAlignedHighlight(page, '[data-coach="field-name"]');
  await page.locator('[data-coach="field-name"]').fill("Guided fixture export");
  await next(page);
  await page.locator('[data-coach="field-direction"]').selectOption("Outbound");
  await next(page);
  await page.locator('[data-coach="field-format"]').selectOption("CSV");
  await next(page);
  await page.locator('[data-coach="save"]').click();
  await next(page);
  await page.getByRole("button", { name: "Pause tutorial" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Resume guide" }).click();
  await expect(page.getByRole("dialog")).toContainText("Run the exercise");
  await page.locator('[data-coach="submit"]').click();
  await next(page);
  await expect(page.locator('[data-coach="outcome"]')).toContainText(
    "DEMO-001,Alex Rowan",
  );
  await expectAlignedHighlight(page, '[data-coach="outcome"]');
  await page.screenshot({
    path: "docs/screenshots/academy-guided-run.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Check and finish" }).click();
  await expect(page).toHaveURL(/\/academy$/);
  await expect(course).toContainText("Passed");
  await page.reload();
  await expect(course).toContainText("Passed");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const violations = (
    await new AxeBuilder({ page }).include(".academy-page").analyze()
  ).violations;
  expect(violations).toEqual([]);
});
test("guided finance crosses owner and manager accounts and posts a balanced ledger", async ({
  page,
}) => {
  await signIn(page, "hr");
  await page.goto("/academy");
  await page
    .locator(".academy-course")
    .filter({
      has: page.getByRole("heading", { name: "Finance", exact: true }),
    })
    .getByRole("button", { name: "Start lesson" })
    .click();
  await next(page);
  await page.locator('[data-coach="new"]').click();
  await next(page);
  for (const [key, value] of [
    ["memo", "Guided finance journal"],
    ["date", "2026-10-19"],
    ["debit", "250"],
    ["credit", "250"],
  ]) {
    await page.locator(`[data-coach="field-${key}"]`).fill(value);
    await next(page);
  }
  await page.locator('[data-coach="save"]').click();
  await next(page);
  await page.locator('[data-coach="submit"]').click();
  await next(page);
  await switchAccount(page, "manager-1");
  await next(page);
  await page
    .locator('[data-coach="feedback"]')
    .fill("Reviewed balance and accounting purpose");
  await next(page);
  await page.locator('[data-coach="approve"]').click();
  await next(page);
  await switchAccount(page, "hr");
  await next(page);
  await expect(page.locator('[data-coach="outcome"]')).toContainText(
    "6100 Teaching expense",
  );
  await page.getByRole("button", { name: "Check and finish" }).click();
  await expect(
    page.locator(".academy-course").filter({
      has: page.getByRole("heading", { name: "Finance", exact: true }),
    }),
  ).toContainText("Passed");
});
test("academy authorization, completion proof, mobile layout and keyboard pause", async ({
  page,
}) => {
  await signIn(page, "employee");
  const denied = await page.request.post("/api/academy", {
    data: {
      action: "create",
      module: "finance",
      orgId: "org-01",
      data: { memo: "Fake journal", date: "2026-10-19", debit: 10, credit: 10 },
    },
  });
  expect(denied.status()).toBe(403);
  const unearned = await page.request.post("/api/academy", {
    data: { action: "progress", lesson: "payroll", step: 20, completed: true },
  });
  expect(unearned.status()).toBe(400);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/academy");
  await expect(page.locator(".academy-course")).toHaveCount(11);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/academy-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".academy-course")
    .filter({
      has: page.getByRole("heading", { name: "Time Tracking", exact: true }),
    })
    .getByRole("button", { name: "Start lesson" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Resume guide" }),
  ).toBeVisible();
});
test("native Hire tutorial guides manager and final HR approval against a specific process", async ({
  page,
}) => {
  await signIn(page, "hr");
  await page.goto("/academy");
  await page
    .locator(".academy-course")
    .filter({
      has: page.getByRole("heading", { name: "Core HCM", exact: true }),
    })
    .getByRole("button", { name: "Start lesson" })
    .click();
  await next(page);
  await next(page);
  await page
    .locator('.hire-form select[name="prehireId"]')
    .selectOption("prehire-026");
  await next(page);
  await page
    .locator('.hire-form select[name="positionId"]')
    .selectOption("pos-326");
  await next(page);
  await next(page);
  await page.locator(".hire-form .sticky-actions button.primary").click();
  await next(page);
  await expect(page.getByRole("dialog")).toContainText(
    "Open your submitted process",
  );
  await next(page);
  await switchAccount(page, "manager-1");
  await next(page);
  await page.locator('[data-coach="native-approve"]').click();
  await next(page);
  await switchAccount(page, "hr");
  await next(page);
  await page.locator('[data-coach="native-approve"]').click();
  await next(page);
  await page.getByRole("button", { name: "Check and finish" }).click();
  await expect(page).toHaveURL(/\/academy$/);
  await expect(
    page.locator(".academy-course").filter({
      has: page.getByRole("heading", { name: "Core HCM", exact: true }),
    }),
  ).toContainText("Passed");
});
test("native absence tutorial and LMS tutorial complete saved employee outcomes", async ({
  page,
}) => {
  await signIn(page, "employee");
  await page.goto("/academy");
  await page
    .locator(".academy-course")
    .filter({
      has: page.getByRole("heading", { name: "Leave & Absence", exact: true }),
    })
    .getByRole("button", { name: "Start lesson" })
    .click();
  await next(page);
  await next(page);
  await page.locator('input[name="effectiveDate"]').fill("2027-03-15");
  await next(page);
  await page.locator('input[name="endDate"]').fill("2027-03-15");
  await next(page);
  await page.getByRole("button", { name: "Submit request" }).click();
  await next(page);
  await next(page);
  await switchAccount(page, "manager-1");
  await next(page);
  await page.locator('[data-coach="native-approve"]').click();
  await next(page);
  await switchAccount(page, "employee");
  await next(page);
  await page.getByRole("button", { name: "Check and finish" }).click();
  await expect(page).toHaveURL(/\/academy$/);
  // Restore the balance so the existing absence scenarios keep their own baseline.
  const saved = await (await page.request.get("/api/lab")).json();
  const absence = saved.workers
    .find((w: any) => w.id === saved.user.workerId)
    .absences.find((a: any) => a.startDate === "2027-03-15" && !a.canceled);
  expect(
    (
      await page.request.post("/api/lab", {
        data: { op: "cancel-absence", id: absence.id },
      })
    ).ok(),
  ).toBe(true);
  await page
    .locator(".academy-course")
    .filter({
      has: page.getByRole("heading", { name: "Learning / LMS", exact: true }),
    })
    .getByRole("button", { name: "Start lesson" })
    .click();
  await next(page);
  await next(page);
  await page.locator('[data-coach="learning-action"]').first().click();
  await next(page);
  await page.locator('[data-coach="learning-action"]').first().click();
  await next(page);
  await page.getByRole("button", { name: "Check and finish" }).click();
  await expect(page).toHaveURL(/\/academy$/);
});
