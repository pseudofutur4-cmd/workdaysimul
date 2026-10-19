// Production browser smoke: no project, worker or configuration mutations.
import { chromium } from "@playwright/test";
const bases = process.argv.slice(2);
if (!bases.length)
  bases.push("http://127.0.0.1:3000", "http://192.168.0.14:3002");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const base of bases) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const login = await context.request.post(base + "/api/session", {
      data: { userId: "hr", password: "Practice123!" },
    });
    if (!login.ok())
      throw new Error(`Sign-in failed: ${base} ${login.status()}`);
    await page.goto(base + "/implementation");
    await page.getByRole("button", { name: "Create empty project" }).waitFor();
    if ((await page.locator(".impl-path-preview > div").count()) !== 8)
      throw new Error("Expected eight implementation chapters.");
    const response = await context.request.get(base + "/api/implementation");
    if (!response.ok()) throw new Error("Implementation project API failed.");
    const state = await page.evaluate(() => ({
      secureContext: isSecureContext,
      randomUUID: typeof crypto.randomUUID,
    }));
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      JSON.stringify({
        base,
        implementationChapters: 8,
        projectApi: response.status(),
        ...state,
        errors,
      }),
    );
    if (base.includes("127.0.0.1"))
      await page.screenshot({
        path: "docs/screenshots/implementation-production.png",
        animations: "disabled",
      });
    await context.close();
  }
} finally {
  await browser.close();
}
