import { afterEach, expect, test, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { newRequestKey } from "../lib/request-key";
afterEach(() => vi.unstubAllGlobals());
test("uses native UUID when the browser exposes it", () => {
  const randomUUID = vi.fn(() => "00000000-0000-4000-8000-000000000001");
  vi.stubGlobal("crypto", { randomUUID });
  expect(newRequestKey()).toBe("00000000-0000-4000-8000-000000000001");
  expect(randomUUID).toHaveBeenCalledOnce();
});
test("LAN HTTP fallback creates distinct version-4 request keys without randomUUID", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  });
  const keys = Array.from({ length: 100 }, () => newRequestKey());
  expect(new Set(keys).size).toBe(100);
  for (const key of keys)
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
});
