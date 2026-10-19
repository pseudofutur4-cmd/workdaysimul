import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { academyAction, academyWorkspace } from "@/lib/academy-engine";
import { academyModules } from "@/lib/academy-catalog";
import { db } from "@/lib/db";
import { audit } from "@/lib/engine";
import { LabError, requirePermission } from "@/lib/policy";
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    return NextResponse.json(await academyWorkspace(u));
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
    const b = await req.json();
    if (b.action !== "progress")
      return NextResponse.json({ result: await academyAction(u, b) });
    await requirePermission(u, "practice.use");
    const p = z
      .object({
        action: z.literal("progress"),
        lesson: z.enum(
          academyModules.map((m) => m.id) as [string, ...string[]],
        ),
        step: z.number().int().min(0).max(50),
        caseId: z.string().nullable().optional(),
        processId: z.string().nullable().optional(),
        completed: z.boolean(),
      })
      .strict()
      .parse(b);
    if (p.completed) {
      let passed = false;
      if (p.caseId) {
        const c = await db.academyCase.findUnique({
          where: { id: p.caseId },
          include: { purchase: true },
        });
        passed =
          !!c &&
          c.ownerId === u.id &&
          c.module === p.lesson &&
          c.status === "Completed" &&
          (c.module !== "scm" || !!c.purchase?.received);
      } else if (p.lesson === "hcm" && p.processId)
        passed = !!(await db.process.findFirst({
          where: {
            id: p.processId,
            kind: "Hire",
            initiatorId: u.id,
            status: "Completed",
          },
        }));
      else if (p.lesson === "absence" && p.processId)
        passed = !!(await db.process.findFirst({
          where: {
            id: p.processId,
            kind: "Time Off",
            initiatorId: u.id,
            status: "Completed",
          },
        }));
      else if (p.lesson === "lms" && u.workerId)
        passed = !!(await db.learningEnrollment.findFirst({
          where: { workerId: u.workerId, completed: true },
        }));
      if (!passed)
        throw new LabError(
          "Finish the workflow first. Completion is checked against saved records.",
        );
    }
    const result = await db.tutorialProgress.upsert({
      where: { userId_lesson: { userId: u.id, lesson: p.lesson } },
      create: {
        userId: u.id,
        lesson: p.lesson,
        step: p.step,
        completed: p.completed,
        caseId: p.caseId,
        processId: p.processId,
      },
      update: {
        step: p.step,
        completed: p.completed,
        caseId: p.caseId,
        processId: p.processId,
      },
    });
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof LabError && e.status === 403)
      await audit(
        db,
        u,
        "Denied academy action",
        "academy-access",
        null,
        { reason: e.message },
        u.orgId ?? undefined,
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
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  console.error(e);
  return NextResponse.json(
    { error: "The practice action failed. No partial changes were saved." },
    { status: 400 },
  );
}
