import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const base of ["http://127.0.0.1:3000", "http://192.168.0.14:3002"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const signed = await context.request.post(base + "/api/session", {
      data: { userId: "hr", password: "Practice123!" },
    });
    if (!signed.ok()) throw new Error(`Sign-in failed: ${signed.status()}`);
    await Promise.all([
      page.waitForResponse((r) => new URL(r.url()).pathname === "/api/lab"),
      page.goto(base + "/staffing"),
    ]);
    const environment = await page.evaluate(() => ({
      secureContext: window.isSecureContext,
      randomUUID: typeof crypto.randomUUID,
      getRandomValues: typeof crypto.getRandomValues,
    }));
    // A request key is initialized in the Hire form's mount effect.
    await page
      .waitForFunction(
        () =>
          !!document.querySelector(".hire-form") ||
          document.body.textContent?.includes("Application error"),
        { timeout: 10000 },
      )
      .catch(() => {});
    console.log(
      JSON.stringify({
        base,
        ...environment,
        errors,
        hireForm: await page.locator(".hire-form").count(),
      }),
    );
    if (errors.length || (await page.locator(".hire-form").count()) !== 1)
      throw new Error(`Hire form failed at ${base}: ${errors.join("; ")}`);
    await context.close();
  }
} finally {
  await browser.close();
}
