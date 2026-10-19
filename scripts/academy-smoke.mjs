// Read-only production UI smoke: signs in locally without changing domain data.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const base of ["http://127.0.0.1:3000", "http://192.168.0.14:3002"]) {
    const login = await context.request.post(base + "/api/session", { data: { userId: "hr", password: "Practice123!" } });
    if (!login.ok()) throw new Error(`Sign-in failed: ${base} ${login.status()}`);
    await page.goto(base + "/academy");
    await page.locator(".academy-course").last().waitFor();
    const count = await page.locator(".academy-course").count();
    if (count !== 11) throw new Error(`Expected eleven topics; got ${count}`);
    console.log(`${base}/academy: eleven lesson topics rendered`);
    if (base.includes("127.0.0.1")) await page.screenshot({ path: "docs/screenshots/academy-production-1440.png", animations: "disabled" });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("No browser runtime errors; existing domain records untouched.");
} finally { await browser.close(); }
