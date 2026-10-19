import { test, expect } from "@playwright/test";

test("signed-in bootstrap and client navigation never mount the login screen", async ({
  page,
}) => {
  const signedIn = await page.request.post("/api/session", {
    data: { userId: "hr", password: "Practice123!" },
  });
  expect(signedIn.ok()).toBe(true);
  await page.addInitScript(() => {
    (window as any).__loginMounts = 0;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches("main.login") || node.querySelector("main.login"))
          ) {
            (window as any).__loginMounts++;
          }
        }
    }).observe(document, { childList: true, subtree: true });
  });
  let release!: () => void;
  const sessionGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/lab?*", async (route) => {
    await sessionGate;
    await route.continue();
  });
  try {
    await page.goto("/home");
    await expect(page.getByRole("status")).toHaveText(
      "Checking your practice session…",
    );
    await expect(page.locator("main.login")).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.unroute("**/api/lab?*");
  const shell = await page.locator(".app-shell").elementHandle();
  await page.getByLabel("As-of date").fill("2025-06-01");
  await expect(page.getByLabel("As-of date")).toHaveValue("2025-06-01");
  for (const [label, url] of [
    ["Reports", "/reports"],
    ["Audit History", "/audit"],
    ["Worker Directory", "/workers"],
    ["Organizations", "/organizations"],
    ["My Tasks", "/my-tasks"],
  ]) {
    await page
      .getByRole("navigation", { name: "Workspace" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(url + "$"));
    expect(await shell!.evaluate((el) => el.isConnected)).toBe(true);
    await expect(page.getByLabel("As-of date")).toHaveValue("2025-06-01");
    await expect(page.locator("main.login")).toHaveCount(0);
  }
  expect(await page.evaluate(() => (window as any).__loginMounts)).toBe(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your lab" }),
  ).toBeVisible();
  expect((await page.request.get("/api/lab")).status()).toBe(401);
});

test("session lookup errors offer retry; confirmed expiration still requires login", async ({
  page,
}) => {
  await page.request.post("/api/session", {
    data: { userId: "hr", password: "Practice123!" },
  });
  let failing = true;
  await page.route("**/api/lab?*", async (route) => {
    if (failing) {
      await route.fulfill({
        status: 503,
        json: { error: "Temporary session lookup failure" },
      });
    } else await route.continue();
  });
  await page.goto("/audit");
  await expect(page.locator(".session-check").getByRole("alert")).toContainText(
    "Temporary session lookup failure",
  );
  await expect(page.locator("main.login")).toHaveCount(0);
  failing = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit History", exact: true }),
  ).toBeVisible();
  await page.request.delete("/api/session");
  await page.getByLabel("As-of date").fill("2025-06-01");
  await expect(
    page.getByRole("heading", { name: "Welcome to your lab" }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
});
