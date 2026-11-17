import { test, expect } from "@playwright/test";

test("HTTP security headers, malformed login and cross-site checks protect the session boundary", async ({
  request,
}) => {
  const page = await request.get("/home");
  expect(page.headers()["x-frame-options"]).toBe("DENY");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  expect(page.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  const invalid = await request.post("/api/session", {
    data: "{",
    headers: { "content-type": "application/json" },
  });
  expect(invalid.status()).toBe(400);
  expect(
    (
      await request.post("/api/session", {
        data: { userId: "hr", password: "Practice123!" },
        headers: { origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/session", {
        data: { userId: "hr", password: "Practice123!" },
      })
    ).ok(),
  ).toBe(true);
  expect((await request.get("/api/lab")).headers()["cache-control"]).toContain(
    "no-store",
  );
  await request.delete("/api/session");
  expect((await request.get("/api/lab")).status()).toBe(401);
});
