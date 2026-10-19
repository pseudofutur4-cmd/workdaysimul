import { positionStates } from "@/lib/positions";
import { rescindHire } from "@/lib/rescind";
import { validOrigin } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, passwordHash } from "@/lib/auth";
import { workspace } from "@/lib/read";
import {
  allowed,
  requirePermission,
  requireScope,
  workerAccess,
  LabError,
} from "@/lib/policy";
import {
  act,
  submit,
  editReturned,
  audit,
  contactChange,
  cancelAbsence,
  enrollBenefit,
} from "@/lib/engine";
import { date, today } from "@/lib/validators";
import { scenarios } from "@/lib/scenarios";
import { scoreAttempt } from "@/lib/scoring";
export async function GET(req: NextRequest) {
  try {
    const u = await currentUser();
    if (!u)
      return NextResponse.json(
        { error: "Sign in to a practice account" },
        { status: 401 },
      );
    return NextResponse.json(
      await workspace(u, req.nextUrl.searchParams.get("asOf") ?? today()),
    );
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  if (e instanceof z.ZodError)
    return NextResponse.json(
      {
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (e instanceof LabError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e && typeof e === "object" && "code" in e && e.code === "P2002")
    return NextResponse.json(
      { error: "This record or effective date already exists" },
      { status: 409 },
    );
  console.error(e);
  return NextResponse.json(
    {
      error:
        "The operation could not be completed. No partial changes were saved.",
    },
    { status: 400 },
  );
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  let op = "unknown";
  try {
    const b = await req.json();
    op = b.op;
    let result: unknown;
    switch (op) {
      case "rescind-hire":
        result = await rescindHire(
          u,
          z.string().parse(b.id),
          z.string().parse(b.reason),
        );
        break;
      case "submit":
        result = await submit(u, b.data);
        break;
      case "act":
        result = await act(
          u,
          z.string().parse(b.id),
          z.string().parse(b.action),
          z
            .string()
            .max(1000)
            .parse(b.comment ?? ""),
        );
        break;
      case "edit-returned":
        result = await editReturned(u, b.id, b.data);
        break;
      case "contact":
        result = await contactChange(
          u,
          z.string().parse(b.workerId),
          z.email().parse(b.email),
        );
        break;
      case "prehire": {
        await requirePermission(u, "staffing.initiate");
        if (u.role !== "HR Administrator") throw new LabError("HR only", 403);
        const x = z
          .object({
            name: z.string().trim().min(2).max(100),
            email: z.email(),
            orgId: z.string(),
          })
          .parse(b.data);
        requireScope(u, x.orgId);
        result = await db.$transaction(async (tx) => {
          const r = await tx.preHire.create({ data: x });
          await audit(tx, u, "Create pre-hire", r.id, null, r, x.orgId);
          return r;
        });
        break;
      }
      case "profile": {
        await requirePermission(u, "foundations.modify");
        const x = z
          .object({
            name: z.string().trim().min(2).max(100),
            familyId: z.string(),
            effectiveDate: date,
          })
          .parse(b.data);
        result = await db.$transaction(async (tx) => {
          const r = await tx.jobProfile.create({ data: x });
          await audit(tx, u, "Create job profile", r.id, null, r);
          return r;
        });
        break;
      }
      case "position": {
        await requirePermission(u, "foundations.modify");
        const x = z
          .object({
            title: z.string().trim().min(2).max(100),
            orgId: z.string(),
            profileId: z.string(),
            locationId: z.string(),
            earliestDate: date,
          })
          .parse(b.data);
        requireScope(u, x.orgId);
        result = await db.$transaction(async (tx) => {
          const profile = await tx.jobProfile.findUniqueOrThrow({
            where: { id: x.profileId },
          });
          if (x.earliestDate < profile.effectiveDate)
            throw new LabError("Profile is not yet effective");
          const r = await tx.position.create({ data: x });
          await audit(tx, u, "Create position", r.id, null, r, x.orgId);
          return r;
        });
        break;
      }
      case "organization": {
        await requirePermission(u, "foundations.modify");
        const x = z
          .object({
            name: z.string().trim().min(2).max(100),
            parentId: z.string(),
            companyId: z.string(),
            costCenter: z.string().min(2),
          })
          .parse(b.data);
        requireScope(u, x.parentId);
        result = await db.$transaction(async (tx) => {
          const r = await tx.organization.create({
            data: { ...x, id: crypto.randomUUID() },
          });
          const manager = await tx.user.create({
            data: {
              id: "manager-" + r.id,
              name: "Manager • " + r.name,
              role: "Manager",
              orgId: r.id,
              passwordHash: passwordHash("Practice123!"),
            },
          });
          await tx.organization.update({
            where: { id: r.id },
            data: { managerId: manager.id },
          });
          await audit(tx, u, "Create organization", r.id, null, r, r.id);
          return r;
        });
        break;
      }
      case "requisition": {
        await requirePermission(u, "recruiting.modify");
        const x = z
          .object({
            title: z.string().min(3),
            positionId: z.string(),
            effectiveDate: date,
            requestKey: z.string().min(8),
          })
          .parse(b.data);
        // Create both the requisition and approval atomically; submit's validation rules are replicated here for this aggregate.
        result = await db.$transaction(async (tx) => {
          const existing = await tx.process.findUnique({
            where: { requestKey: x.requestKey },
          });
          if (existing) {
            if (existing.initiatorId !== u.id)
              throw new LabError("Request key conflict", 409);
            return existing;
          }
          const p = await tx.position.findUniqueOrThrow({
            where: { id: x.positionId },
          });
          requireScope(u, p.orgId);
          if ((await positionStates(x.effectiveDate, tx)).get(p.id) !== "Open")
            throw new LabError("Select an open position");
          if (x.effectiveDate < p.earliestDate)
            throw new LabError("Position is not available");
          if (
            await tx.requisition.findFirst({
              where: { positionId: p.id, status: { in: ["Draft", "Open"] } },
            })
          )
            throw new LabError(
              "An active requisition already exists for this position",
            );
          const def = await tx.processDefinition.findUniqueOrThrow({
            where: { kind: "Requisition" },
          });
          if (!def.initiatorRoles.split(",").includes(u.role))
            throw new LabError("Initiator role is not permitted", 403);
          const manager = await tx.user.findFirstOrThrow({
            where: {
              role: def.approvalRole,
              orgId: p.orgId,
              id: { not: u.id },
            },
          });
          const r = await tx.requisition.create({
            data: { title: x.title, positionId: p.id },
          });
          const event = await tx.process.create({
            data: {
              kind: "Requisition",
              version: def.version,
              initiatorId: u.id,
              orgId: p.orgId,
              requisitionId: r.id,
              positionId: p.id,
              effectiveDate: x.effectiveDate,
              reason: "New requisition",
              status: "Submitted",
              requestKey: x.requestKey,
            },
          });
          await tx.approvalTask.create({
            data: {
              processId: event.id,
              assigneeId: manager.id,
              step: "Manager Approval",
            },
          });
          await audit(
            tx,
            u,
            "Submit Requisition",
            r.id,
            null,
            r,
            p.orgId,
            event.id,
            x.effectiveDate,
          );
          return r;
        });
        break;
      }
      case "publish": {
        await requirePermission(u, "recruiting.modify");
        result = await db.$transaction(async (tx) => {
          const r = await tx.requisition.findUniqueOrThrow({
            where: { id: b.id },
            include: { position: true },
          });
          requireScope(u, r.position.orgId);
          if (r.status !== "Open")
            throw new LabError(
              "Only an approved open requisition may be posted",
            );
          const x = await tx.requisition.update({
            where: { id: r.id },
            data: { posted: !r.posted },
          });
          await audit(
            tx,
            u,
            "Posting SIMULATED",
            r.id,
            { posted: r.posted },
            { posted: x.posted },
            r.position.orgId,
          );
          return x;
        });
        break;
      }
      case "candidate": {
        await requirePermission(u, "recruiting.modify");
        const x = z
          .object({
            name: z.string().min(2),
            email: z.email(),
            requisitionId: z.string(),
          })
          .parse(b.data);
        result = await db.$transaction(async (tx) => {
          const r = await tx.requisition.findUniqueOrThrow({
            where: { id: x.requisitionId },
            include: { position: true },
          });
          requireScope(u, r.position.orgId);
          if (r.status !== "Open" || !r.posted)
            throw new LabError("Requisition must be open and posted");
          const c = await tx.candidate.create({ data: x });
          await audit(
            tx,
            u,
            "Create candidate",
            c.id,
            null,
            c,
            r.position.orgId,
          );
          return c;
        });
        break;
      }
      case "advance": {
        const action = z
          .enum(["advance", "approve-offer", "deny-offer", "accept", "decline"])
          .parse(b.action);
        if (action === "approve-offer" || action === "deny-offer") {
          const event = await db.process.findFirst({
            where: {
              kind: "Offer",
              candidateId: z.string().parse(b.id),
              status: "Submitted",
            },
          });
          if (!event) throw new LabError("No pending offer approval");
          await act(
            u,
            event.id,
            action === "approve-offer" ? "approve" : "deny",
            "Recruiting offer decision",
          );
          result = await db.candidate.findUniqueOrThrow({
            where: { id: b.id },
          });
          break;
        }
        result = await db.$transaction(async (tx) => {
          const c = await tx.candidate.findUniqueOrThrow({
            where: { id: b.id },
            include: { requisition: { include: { position: true } } },
          });
          const orgId = c.requisition.position.orgId;
          requireScope(u, orgId);
          let stage = c.stage;
          {
            await requirePermission(u, "recruiting.modify", tx);
            if (c.requisition.status !== "Open")
              throw new LabError("Requisition is closed");
            if (action === "advance") {
              const next: Record<string, string> = {
                Applied: "Review",
                Review: "Interview",
                Interview: "Offer Pending",
              };
              stage = next[c.stage];
              if (!stage) throw new LabError("No forward transition available");
            } else if (action === "accept" && c.stage === "Offer Approved")
              stage = "Accepted";
            else if (action === "decline" && c.stage === "Offer Approved")
              stage = "Declined";
            else throw new LabError("Offer is not approved");
          }
          let prehireId = c.prehireId;
          if (stage === "Accepted") {
            const p = await tx.preHire.create({
              data: { name: c.name, email: c.email, orgId },
            });
            prehireId = p.id;
          }
          const r = await tx.candidate.update({
            where: { id: c.id },
            data: { stage, prehireId },
          });
          if (stage === "Offer Pending") {
            const definition = await tx.processDefinition.findUniqueOrThrow({
              where: { kind: "Offer" },
            });
            if (!definition.initiatorRoles.split(",").includes(u.role))
              throw new LabError("Offer initiator role required", 403);
            const manager = await tx.user.findFirstOrThrow({
              where: {
                role: definition.approvalRole,
                orgId,
                id: { not: u.id },
              },
            });
            const event = await tx.process.create({
              data: {
                kind: "Offer",
                candidateId: c.id,
                requisitionId: c.requisitionId,
                version: definition.version,
                initiatorId: u.id,
                orgId,
                status: "Submitted",
                effectiveDate: today(),
                reason: "Candidate offer approval",
                requestKey: "offer-" + c.id,
              },
            });
            await tx.approvalTask.create({
              data: {
                processId: event.id,
                assigneeId: manager.id,
                step: "Manager Offer Approval",
              },
            });
            await audit(
              tx,
              u,
              "Submit Offer",
              c.id,
              { stage: c.stage },
              { stage },
              orgId,
              event.id,
              today(),
            );
          }
          await audit(
            tx,
            u,
            stage === "Accepted" ? "Accept offer SIMULATED" : "Candidate stage",
            c.id,
            { stage: c.stage },
            { stage, prehireId },
            orgId,
          );
          return r;
        });
        break;
      }
      case "onboarding": {
        result = await db.$transaction(async (tx) => {
          const t = await tx.onboardingTask.findUniqueOrThrow({
            where: { id: b.id },
          });
          if (u.workerId !== t.workerId)
            throw new LabError("Assigned employee only", 403);
          await workerAccess(u, t.workerId, tx, today());
          const r = await tx.onboardingTask.update({
            where: { id: t.id },
            data: { completed: true },
          });
          await audit(
            tx,
            u,
            "Complete onboarding task",
            t.workerId,
            { completed: t.completed },
            { completed: true, label: t.label },
            u.orgId ?? undefined,
          );
          return r;
        });
        break;
      }
      case "enroll-benefit":
        result = await enrollBenefit(
          u,
          z.string().parse(b.planId),
          date.parse(b.effectiveDate),
        );
        break;
      case "cancel-absence":
        result = await cancelAbsence(u, b.id);
        break;
      case "learning": {
        await requirePermission(u, "learning.self");
        const action = z.enum(["enroll", "complete"]).parse(b.action);
        if (!u.workerId) throw new LabError("Employee account required");
        await workerAccess(u, u.workerId, db, today());
        result = await db.$transaction(async (tx) => {
          const old = await tx.learningEnrollment.findUnique({
            where: {
              workerId_courseId: { workerId: u.workerId!, courseId: b.id },
            },
          });
          if (action === "complete" && !old)
            throw new LabError("Enroll before completing a course");
          const r = await tx.learningEnrollment.upsert({
            where: {
              workerId_courseId: { workerId: u.workerId!, courseId: b.id },
            },
            create: { workerId: u.workerId!, courseId: b.id },
            update: action === "complete" ? { completed: true } : {},
          });
          await audit(
            tx,
            u,
            action === "complete" ? "Complete learning" : "Enroll learning",
            u.workerId!,
            old,
            r,
            u.orgId ?? undefined,
          );
          return r;
        });
        break;
      }
      case "policy": {
        await requirePermission(u, "security.modify");
        const x = z
          .object({
            role: z.string(),
            domain: z.string(),
            granted: z.boolean(),
            confirmed: z.literal(true),
          })
          .parse(b.data);
        const domainList = [
          "workers.view",
          "contact.view",
          "contact.modify",
          "staffing.initiate",
          "foundations.modify",
          "process.approve",
          "compensation.view",
          "compensation.modify",
          "reports.view",
          "audit.view",
          "practice.use",
          "recruiting.modify",
          "absence.request",
          "benefits.self",
          "learning.self",
        ];
        if (
          !domainList.includes(x.domain) ||
          x.role === "Security Administrator"
        )
          throw new LabError("Unsupported policy change");
        result = await db.$transaction(async (tx) => {
          const before = await tx.policy.findUnique({
            where: { role_domain: { role: x.role, domain: x.domain } },
          });
          const after = await tx.policy.upsert({
            where: { role_domain: { role: x.role, domain: x.domain } },
            create: { role: x.role, domain: x.domain, granted: x.granted },
            update: { granted: x.granted },
          });
          await audit(tx, u, "Activate policy", after.id, before, after);
          return after;
        });
        break;
      }
      case "definition": {
        await requirePermission(u, "security.modify");
        const x = z
          .object({
            kind: z.string(),
            approvalRole: z.enum(["Manager", "HR Partner"]),
            finalReview: z.boolean(),
            confirmed: z.literal(true),
          })
          .parse(b.data);
        if (!["Hire", "Change Job", "Termination"].includes(x.kind))
          throw new LabError("Only staffing routes are editable");
        if (
          await db.process.count({
            where: {
              kind: x.kind,
              status: { in: ["Submitted", "In Progress", "Sent Back"] },
            },
          })
        )
          throw new LabError(
            "Complete pending processes before changing this route",
          );
        result = await db.$transaction(async (tx) => {
          const before = await tx.processDefinition.findUniqueOrThrow({
            where: { kind: x.kind },
          });
          const after = await tx.processDefinition.update({
            where: { kind: x.kind },
            data: {
              approvalRole: x.approvalRole,
              finalReview: x.finalReview,
              version: { increment: 1 },
            },
          });
          await audit(
            tx,
            u,
            "Configure business process",
            x.kind,
            before,
            after,
          );
          return after;
        });
        break;
      }
      case "practice-start": {
        await requirePermission(u, "practice.use");
        if (!scenarios.some((s) => s.id === b.id))
          throw new LabError("Scenario not found");
        const latest = await db.auditEvent.findFirst({
          orderBy: { id: "desc" },
        });
        result = await db.practiceAttempt.create({
          data: {
            userId: u.id,
            scenario: b.id,
            baselineAudit: latest?.id ?? 0,
          },
        });
        break;
      }
      case "practice-score": {
        await requirePermission(u, "practice.use");
        const attempt = await db.practiceAttempt.findUniqueOrThrow({
          where: { id: b.id },
        });
        if (attempt.userId !== u.id)
          throw new LabError("Your attempt only", 403);
        result = await scoreAttempt(b.id, u.id);
        break;
      }
      default:
        throw new LabError("Unknown operation");
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e instanceof LabError && e.status === 403)
      await audit(
        db,
        u,
        "Denied " + op,
        "access",
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
