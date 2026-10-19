import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { LabError } from "@/lib/policy";
import { audit } from "@/lib/engine";
import { db } from "@/lib/db";
import {
  createImplementationProject,
  implementationAction,
  implementationDetail,
  implementationProjects,
  implementationReport,
} from "@/lib/implementation-engine";

export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const q = req.nextUrl.searchParams,
      id = q.get("id");
    if (q.get("report") === "true" && id)
      return NextResponse.json(
        await implementationReport(u, id, {
          actorId: q.get("actorId"),
          environment: q.get("environment"),
          asOf: q.get("asOf"),
          ...(q.get("orgId") ? { orgId: q.get("orgId") } : {}),
        }),
      );
    return NextResponse.json(
      id
        ? await implementationDetail(u, id)
        : { projects: await implementationProjects(u), userId: u.id },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "create") {
      const b = z
        .object({ action: z.literal("create"), name: z.string() })
        .strict()
        .parse(body);
      return NextResponse.json({
        result: await createImplementationProject(u, { name: b.name }),
      });
    }
    const b = z
      .object({
        id: z.string().min(1),
        version: z.number().int().positive(),
        command: z.unknown(),
      })
      .strict()
      .parse(body);
    return NextResponse.json({
      result: await implementationAction(u, b.id, b.version, b.command),
    });
  } catch (e) {
    if (e instanceof LabError && e.status === 403)
      await audit(
        db,
        u,
        "Denied implementation action",
        "implementation-access",
        null,
        { reason: e.message },
        undefined,
        undefined,
        undefined,
        "Denied",
      );
    return fail(e);
  }
}
function fail(e: unknown) {
  if (e instanceof LabError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError)
    return NextResponse.json(
      {
        error: e.issues
          .map((x) => `${x.path.join(".")}: ${x.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  console.error(e);
  return NextResponse.json(
    {
      error: "The implementation action failed. No partial changes were saved.",
    },
    { status: 400 },
  );
}
