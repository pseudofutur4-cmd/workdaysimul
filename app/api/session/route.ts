import { validOrigin } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword, revokeSession } from "@/lib/auth";
import { passwordHash } from "@/lib/password";
import { consumeLoginAttempt } from "@/lib/login-limit";
import { z } from "zod";
import { requestJson } from "@/lib/request-json";
export async function GET() {
  return NextResponse.json(
    await db.user.findMany({
      select: { id: true, name: true, role: true, orgId: true },
      orderBy: { id: "asc" },
    }),
  );
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  let credentials;
  try {
    credentials = z
      .object({
        userId: z.string().min(1).max(128),
        password: z.string().min(1).max(256),
      })
      .strict()
      .parse(await requestJson(req, 4096));
  } catch {
    return NextResponse.json(
      { error: "Invalid sign-in request" },
      { status: 400 },
    );
  }
  const { userId, password } = credentials;
  if (!consumeLoginAttempt(userId))
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in one minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  const user =
    typeof userId === "string"
      ? await db.user.findUnique({ where: { id: userId } })
      : null;
  if (
    !user ||
    typeof password !== "string" ||
    !verifyPassword(password, user.passwordHash)
  )
    return NextResponse.json(
      { error: "Invalid practice account or password" },
      { status: 401 },
    );
  // Migrate existing local databases after a successful legacy-password check.
  if (!user.passwordHash.startsWith("scrypt$"))
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: passwordHash(password) },
    });
  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("hcm_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.nextUrl.protocol === "https:",
    maxAge: 28800,
    path: "/",
  });
  return response;
}
export async function DELETE(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  await revokeSession();
  const r = NextResponse.json({ ok: true });
  r.cookies.delete("hcm_session");
  return r;
}
