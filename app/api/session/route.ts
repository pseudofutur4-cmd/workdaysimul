import { validOrigin } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword, revokeSession } from "@/lib/auth";
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
  const { userId, password } = await req.json();
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
  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("hcm_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
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
