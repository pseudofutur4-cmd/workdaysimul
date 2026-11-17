import { test, expect } from "vitest";
import { scryptSync } from "node:crypto";
import { passwordHash, verifyPassword } from "../lib/password";
import { consumeLoginAttempt } from "../lib/login-limit";
import { validOrigin } from "../lib/origin";
import { csvCell } from "../lib/csv";
import { requestJson } from "../lib/request-json";

test("JSON body limits count actual bytes and reject malformed input", async () => {
  const req = (body: string) =>
    new Request("http://localhost/api/session", { method: "POST", body });
  expect(await requestJson(req('{"ok":true}'))).toEqual({ ok: true });
  await expect(requestJson(req('{"value":"too long"}'), 4)).rejects.toThrow(
    "size limit",
  );
  await expect(requestJson(req("{"))).rejects.toThrow();
  await expect(requestJson(req('"é"'), 3)).rejects.toThrow("size limit");
});

test("passwords use unique salts and support legacy verification without accepting invalid digests", () => {
  const first = passwordHash("Example password");
  expect(first).not.toBe(passwordHash("Example password"));
  expect(verifyPassword("Example password", first)).toBe(true);
  expect(verifyPassword("Wrong password", first)).toBe(false);
  expect(verifyPassword("anything", "invalid")).toBe(false);
  const legacy = scryptSync(
    "Legacy password",
    "hcm-local-synthetic-v1",
    64,
  ).toString("hex");
  expect(verifyPassword("Legacy password", legacy)).toBe(true);
});
test("login throttle limits one account without blocking another and expires", () => {
  for (let i = 0; i < 20; i++)
    expect(consumeLoginAttempt("test-account", 1000)).toBe(true);
  expect(consumeLoginAttempt("test-account", 1000)).toBe(false);
  expect(consumeLoginAttempt("other-account", 1000)).toBe(true);
  expect(consumeLoginAttempt("test-account", 61001)).toBe(true);
});
test("browser cross-site mutations are rejected even without an Origin header", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/lab", {
      headers: { host: "localhost:3000", ...headers },
    });
  expect(validOrigin(req({ origin: "http://localhost:3000" }))).toBe(true);
  expect(validOrigin(req({ origin: "https://other.example" }))).toBe(false);
  expect(validOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  expect(validOrigin(req({ origin: "null" }))).toBe(false);
});
test("CSV exports neutralize formula and whitespace prefixes while quoting cells", () => {
  for (const value of [
    "=1+1",
    "+1",
    "-1",
    "@SUM(A1)",
    "  =1",
    "\t=1",
    "\r=1",
    "\n=1",
  ])
    expect(csvCell(value).startsWith("\"'")).toBe(true);
  expect(csvCell('A "quoted", name')).toBe('"A ""quoted"", name"');
});
