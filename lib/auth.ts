import {
  scryptSync,
  timingSafeEqual,
  randomBytes,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { today } from "./validators";
export function passwordHash(password: string) {
  return scryptSync(password, "hcm-local-synthetic-v1", 64).toString("hex");
}
export function verifyPassword(value: string, hash: string) {
  const b = Buffer.from(hash, "hex"),
    a = Buffer.from(passwordHash(value), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      token: createHash("sha256").update(token).digest("hex"),
      userId,
      expiresAt: new Date(Date.now() + 8 * 3600000),
    },
  });
  return token;
}
export async function currentUser() {
  const token = (await cookies()).get("hcm_session")?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { token: createHash("sha256").update(token).digest("hex") },
    include: { user: true },
  });
  if (!s || s.expiresAt <= new Date()) return null;
  if (s.user.workerId) {
    if (
      await db.process.findFirst({
        where: { kind: "Hire", workerId: s.user.workerId, status: "Rescinded" },
      })
    )
      return null;
    const e = await db.employment.findFirst({
      where: { workerId: s.user.workerId, effectiveDate: { lte: today() } },
      orderBy: { effectiveDate: "desc" },
    });
    if (e?.status === "Terminated") return null;
    if (e) return { ...s.user, orgId: e.orgId };
  }
  return s.user;
}
export async function revokeSession() {
  const token = (await cookies()).get("hcm_session")?.value;
  if (token)
    await db.session.deleteMany({
      where: { token: createHash("sha256").update(token).digest("hex") },
    });
}
