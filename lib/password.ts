import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  const modern = parts.length === 3 && parts[0] === "scrypt";
  const salt = modern ? parts[1] : "hcm-local-synthetic-v1";
  const digest = modern ? parts[2] : stored;
  if (
    !/^[a-f0-9]{128}$/.test(digest) ||
    (modern && !/^[a-f0-9]{32}$/.test(salt))
  )
    return false;
  const expected = Buffer.from(digest, "hex");
  return timingSafeEqual(scryptSync(password, salt, 64), expected);
}
