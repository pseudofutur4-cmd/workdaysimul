import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("chapters show saved progress, filter sections, and keep the library free of active coaching", async ({
  page,
}) => {
  await page.request.post("/api/session", {
    data: { userId: "security", password: "Practice123!" },
  });
  await page.goto("/academy");
  await expect(page.locator(".academy-roadmap button")).toHaveCount(5);
  await expect(page.locator(".academy-course")).toHaveCount(11);
  await expect(page.locator(".academy-summary")).toContainText(
    "chapters completed",
  );
  await page.getByRole("button", { name: "View chapters" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const technology = page
    .getByRole("group", { name: "Choose a chapter" })
    .getByRole("button", { name: /Security & integrations/ });
  const d = await (await page.request.get("/api/academy")).json();
  const done = d.progress.filter(
    (p: any) =>
      p.completed && ["security", "integration", "studio"].includes(p.lesson),
  ).length;
  await expect(technology).toContainText(`${done} / 3 sections completed`);
  await technology.click();
  await expect(technology).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".academy-course")).toHaveCount(3);
  await expect(page.locator(".academy-chapter")).toHaveCount(1);
  await expect(page.locator(".academy-section-label").first()).toContainText(
    "Section 5.1",
  );
  await page
    .locator(".academy-course")
    .filter({
      has: page.getByRole("heading", { name: "Security", exact: true }),
    })
    .getByRole("button", { name: /Start lesson|Resume lesson|Practice again/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Section 5.1");
  await page.goto("/academy");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Resume tutorial" }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (await new AxeBuilder({ page }).include(".academy-page").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/academy-chapters-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/academy-chapters-mobile.png",
    animations: "disabled",
  });
});
test("collapsed rail explains icons on hover and focus, supports Escape, and marks the current page", async ({
  page,
}) => {
  await page.request.post("/api/session", {
    data: { userId: "hr", password: "Practice123!" },
  });
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Workspace" });
  const workers = nav.getByRole("link", {
    name: "Worker Directory",
    exact: true,
  });
  await workers.hover();
  const popup = page.getByRole("tooltip");
  await expect(popup).toContainText("Worker Directory");
  await expect(popup).toContainText("Find workers");
  expect(
    await popup.evaluate((el) => el.getBoundingClientRect().left),
  ).toBeGreaterThan(
    await workers.evaluate((el) => el.getBoundingClientRect().right),
  );
  await popup.hover();
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await workers.focus();
  await expect(popup).toBeVisible();
  await expect(workers).toHaveAttribute("aria-describedby", /.+/);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await nav.getByRole("link", { name: "Home", exact: true }).hover();
  await expect(popup).toContainText("YOU ARE HERE");
  await page.screenshot({
    path: "docs/screenshots/sidebar-hover-explainer.png",
    animations: "disabled",
  });
  await expect(page.locator(".navigation-open")).toHaveCount(0);
  await workers.click();
  await expect(page).toHaveURL(/\/workers$/);
  await expect(popup).toHaveCount(0);
  await expect(workers).toHaveAttribute("aria-current", "page");
  await page.goto("/modules/finance");
  const modules = nav.getByRole("link", {
    name: "Practice Modules",
    exact: true,
  });
  await expect(modules).toHaveAttribute("aria-current", "page");
  await modules.hover();
  await expect(popup).toContainText("YOU ARE HERE");
});
