import { test, expect } from "@playwright/test";
test("Chapter 1 resumes and submits Hire without the secure-context UUID API", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/session", {
    data: { userId: "hr", password: "Practice123!" },
  });
  await page.goto("/academy");
  await page
    .getByRole("group", { name: "Choose a chapter" })
    .getByRole("button", { name: /People foundations/ })
    .click();
  const core = page
    .locator(".academy-course")
    .filter({
      has: page.getByRole("heading", { name: "Core HCM", exact: true }),
    });
  // Start, return to the course, and use the actual Resume lesson path.
  await core
    .getByRole("button", { name: /Start lesson|Resume lesson|Practice again/ })
    .click();
  await expect(page.locator(".hire-form")).toBeVisible();
  await page.goto("/academy");
  await core.getByRole("button", { name: "Resume lesson" }).click();
  await expect(page.locator(".hire-form")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Pause tutorial" }).click();
  await page
    .getByRole("combobox", { name: /Pre-hire/ })
    .selectOption("prehire-027");
  await page
    .getByRole("combobox", { name: /^Position/ })
    .selectOption("pos-327");
  const submitted = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/lab" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Submit for approval" }).click();
  expect((await submitted).ok()).toBe(true);
  await expect(page).toHaveURL(/\/my-tasks$/);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/lan-hire-resume-fixed.png",
    animations: "disabled",
  });
});
