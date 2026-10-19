import { positionStates } from "./positions";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  Actor,
  allowed,
  requirePermission,
  requireScope,
  workerAccess,
  LabError,
} from "./policy";
import { processSchema, hireSchema, today, weekdays, date } from "./validators";
import { passwordHash } from "./auth";
type Tx = Prisma.TransactionClient;
export async function audit(
  tx: Tx,
  u: Actor,
  action: string,
  objectId: string,
  before: unknown,
  after: unknown,
  orgId?: string,
  processId?: string,
  effectiveDate?: string,
  permission = "Allowed",
) {
  return tx.auditEvent.create({
    data: {
      actorId: u.id,
      action,
      objectId,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      orgId,
      processId,
      effectiveDate,
      permission,
    },
  });
}
const domainFor: Record<string, string> = {
  Hire: "staffing.initiate",
  "Change Job": "staffing.initiate",
  Termination: "staffing.initiate",
  Compensation: "compensation.modify",
  "Time Off": "absence.request",
  Requisition: "recruiting.modify",
  Offer: "recruiting.modify",
};
async function resolveApprover(
  tx: Tx,
  role: string,
  orgId: string,
  initiatorId: string,
) {
  const a = await tx.user.findFirst({
    where: {
      role,
      id: { not: initiatorId },
      ...(role === "Manager"
        ? { orgId }
        : { OR: [{ orgId: null }, { orgId }] }),
    },
    orderBy: { id: "asc" },
  });
  if (!a)
    throw new LabError(
      `No independent ${role} is configured for this organization`,
    );
  return a;
}
async function validateInput(tx: Tx, u: Actor, raw: unknown) {
  const x = processSchema.parse(raw);
  if (x.kind === "Hire") hireSchema.parse(x);
  await requirePermission(u, domainFor[x.kind], tx);
  const def = await tx.processDefinition.findUniqueOrThrow({
    where: { kind: x.kind },
  });
  if (!def.initiatorRoles.split(",").includes(u.role))
    throw new LabError("Your role cannot initiate this business process", 403);
  let orgId = u.orgId ?? "org-01";
  if (x.workerId) {
    const w = await workerAccess(u, x.workerId, tx, today());
    const e = w.employments[0];
    orgId = e.orgId;
    if (e.status !== "Active")
      throw new LabError("An active employment is required");
    if (x.effectiveDate < e.effectiveDate)
      throw new LabError("Event cannot precede current employment");
    if (
      ["Change Job", "Termination"].includes(x.kind) &&
      (await tx.employment.findFirst({
        where: {
          workerId: x.workerId,
          effectiveDate: { gte: x.effectiveDate },
        },
      }))
    )
      throw new LabError(
        "Conflicting effective-dated employment; choose a later date",
      );
  }
  if (
    ["Change Job", "Termination", "Compensation", "Time Off"].includes(
      x.kind,
    ) &&
    !x.workerId
  )
    throw new LabError("Select a worker");
  if (x.kind === "Time Off" && x.workerId !== u.workerId)
    throw new LabError("Request time off as self", 403);
  if (
    x.kind === "Hire" ||
    x.kind === "Change Job" ||
    x.kind === "Requisition"
  ) {
    if (!x.positionId) throw new LabError("Select an open position");
    const p = await tx.position.findUnique({ where: { id: x.positionId } });
    if (!p) throw new LabError("Position not found");
    requireScope(u, p.orgId);
    if ((await positionStates(x.effectiveDate, tx)).get(p.id) !== "Open")
      throw new LabError("Position is already filled or reserved", 409);
    if (x.effectiveDate < p.earliestDate)
      throw new LabError("Effective date precedes position availability");
    orgId = p.orgId;
  }
  if (x.kind === "Hire") {
    const ph = await tx.preHire.findUnique({ where: { id: x.prehireId } });
    if (!ph || !ph.eligible || ph.workerId)
      throw new LabError("Pre-hire is not eligible");
    requireScope(u, ph.orgId);
    if (ph.orgId !== orgId)
      throw new LabError(
        "Pre-hire and position must belong to the same organization",
      );
    if (
      await tx.process.findFirst({
        where: {
          prehireId: ph.id,
          status: { in: ["Submitted", "In Progress", "Sent Back"] },
        },
      })
    )
      throw new LabError("A hire is already in progress", 409);
  }
  if (
    x.workerId &&
    (await tx.process.findFirst({
      where: {
        workerId: x.workerId,
        kind: { in: ["Change Job", "Termination", "Compensation", "Time Off"] },
        status: { in: ["Submitted", "In Progress", "Sent Back"] },
      },
    }))
  )
    throw new LabError("Another worker event is in progress", 409);
  if (x.kind === "Compensation" && !x.amount)
    throw new LabError("Enter annual salary");
  let days: number | undefined;
  if (x.kind === "Time Off") {
    if (!x.endDate) throw new LabError("Select an end date");
    if (x.effectiveDate < today())
      throw new LabError("Time off must start today or later");
    days = weekdays(x.effectiveDate, x.endDate);
    if (!days) throw new LabError("Select at least one weekday");
    const b = await tx.timeOffBalance.findUnique({
      where: { workerId: x.workerId! },
    });
    if (!b || days > b.entitlement - b.used)
      throw new LabError("Insufficient available time off");
    if (
      await tx.timeOffRequest.findFirst({
        where: {
          workerId: x.workerId!,
          canceled: false,
          startDate: { lte: x.endDate },
          endDate: { gte: x.effectiveDate },
        },
      })
    )
      throw new LabError("Time off overlaps an existing absence");
  }
  requireScope(u, orgId);
  return { x, orgId, def, days };
}
export async function submit(u: Actor, raw: unknown) {
  return db.$transaction(
    async (tx) => {
      const parsed = processSchema.parse(raw);
      if (["Requisition", "Offer"].includes(parsed.kind))
        throw new LabError("Use the requisition aggregate endpoint");
      const old = await tx.process.findUnique({
        where: { requestKey: parsed.requestKey },
      });
      if (old) {
        if (old.initiatorId !== u.id)
          throw new LabError("Request key conflict", 409);
        return old;
      }
      const { x, orgId, def, days } = await validateInput(tx, u, raw);
      const approver = await resolveApprover(tx, def.approvalRole, orgId, u.id);
      const p = await tx.process.create({
        data: {
          ...x,
          orgId,
          days,
          initiatorId: u.id,
          version: def.version,
          status: "Submitted",
        },
      });
      if (["Hire", "Change Job"].includes(x.kind))
        await tx.position.update({
          where: { id: x.positionId },
          data: { status: "Reserved" },
        });
      await tx.approvalTask.create({
        data: {
          processId: p.id,
          assigneeId: approver.id,
          step: def.approvalRole + " Approval",
        },
      });
      await audit(
        tx,
        u,
        "Submit " + x.kind,
        p.id,
        null,
        p,
        orgId,
        p.id,
        x.effectiveDate,
      );
      return p;
    },
    { timeout: 15000 },
  );
}
async function domainSnapshot(tx: Tx, p: Prisma.ProcessGetPayload<{}>) {
  if (p.kind === "Offer")
    return tx.candidate.findUnique({
      where: { id: p.candidateId! },
      select: { id: true, stage: true, prehireId: true },
    });
  if (p.kind === "Hire") {
    const prehire = await tx.preHire.findUnique({
      where: { id: p.prehireId! },
      select: { id: true, workerId: true, eligible: true },
    });
    return {
      prehire,
      position: await tx.position.findUnique({
        where: { id: p.positionId! },
        select: { id: true, status: true },
      }),
      employment: await tx.employment.findUnique({
        where: { processId: p.id },
      }),
      onboardingTasks: prehire?.workerId
        ? await tx.onboardingTask.count({
            where: { workerId: prehire.workerId },
          })
        : 0,
    };
  }
  if (p.kind === "Compensation")
    return tx.compensation.findFirst({
      where: { workerId: p.workerId!, effectiveDate: { lte: p.effectiveDate } },
      orderBy: { effectiveDate: "desc" },
    });
  if (p.kind === "Time Off")
    return {
      balance: await tx.timeOffBalance.findUnique({
        where: { workerId: p.workerId! },
      }),
      request: await tx.timeOffRequest.findUnique({
        where: { processId: p.id },
      }),
    };
  if (p.kind === "Requisition")
    return tx.requisition.findUnique({ where: { id: p.requisitionId! } });
  return tx.employment.findFirst({
    where: { workerId: p.workerId!, effectiveDate: { lte: p.effectiveDate } },
    orderBy: { effectiveDate: "desc" },
  });
}
async function complete(tx: Tx, u: Actor, p: Prisma.ProcessGetPayload<{}>) {
  const before = await domainSnapshot(tx, p);
  if (p.kind === "Hire") {
    const ph = await tx.preHire.findUniqueOrThrow({
        where: { id: p.prehireId! },
      }),
      pos = await tx.position.findUniqueOrThrow({
        where: { id: p.positionId! },
      });
    if (ph.workerId || pos.status !== "Reserved")
      throw new LabError("Hire prerequisites changed", 409);
    const w = await tx.worker.create({
      data: {
        name: ph.name,
        contact: {
          create: {
            workEmail: ph.email.replace("@", "+work@"),
            personalEmail: ph.email,
          },
        },
        employments: {
          create: {
            positionId: pos.id,
            orgId: pos.orgId,
            title: pos.title,
            status: "Active",
            hours: p.hours,
            effectiveDate: p.effectiveDate,
            processId: p.id,
          },
        },
        balance: { create: {} },
      },
    });
    await tx.preHire.update({
      where: { id: ph.id },
      data: { workerId: w.id, eligible: false },
    });
    await tx.position.update({
      where: { id: pos.id },
      data: { status: "Filled" },
    });
    await tx.requisition.updateMany({
      where: { positionId: pos.id, status: "Open" },
      data: { status: "Filled", posted: false },
    });
    await tx.user.create({
      data: {
        id: "employee-" + w.id,
        name: ph.name,
        role: "Employee",
        orgId: pos.orgId,
        workerId: w.id,
        passwordHash: passwordHash("Practice123!"),
      },
    });
    await tx.onboardingTask.createMany({
      data: [
        "Confirm contact information",
        "Acknowledge synthetic handbook",
        "Meet your manager",
      ].map((label) => ({ workerId: w.id, label })),
    });
    await tx.process.update({ where: { id: p.id }, data: { workerId: w.id } });
  }
  if (p.kind === "Change Job" || p.kind === "Termination") {
    const e = await tx.employment.findFirstOrThrow({
      where: { workerId: p.workerId! },
      orderBy: { effectiveDate: "desc" },
    });
    if (
      await tx.employment.findFirst({
        where: {
          workerId: p.workerId!,
          effectiveDate: { gte: p.effectiveDate },
        },
      })
    )
      throw new LabError("Conflicting employment snapshot", 409);
    const target =
      p.kind === "Change Job"
        ? await tx.position.findUniqueOrThrow({ where: { id: p.positionId! } })
        : null;
    if (target && target.status !== "Reserved")
      throw new LabError("Target position is unavailable", 409);
    await tx.employment.create({
      data: {
        workerId: e.workerId,
        positionId: target?.id ?? e.positionId,
        orgId: target?.orgId ?? e.orgId,
        title: target?.title ?? e.title,
        status: target ? "Active" : "Terminated",
        hours: p.hours,
        effectiveDate: p.effectiveDate,
        processId: p.id,
      },
    });
    // Future events preserve current occupancy; reports resolve dates independently.
    if (p.effectiveDate <= today())
      await tx.position.update({
        where: { id: e.positionId },
        data: { status: "Open" },
      });
    if (target)
      await tx.position.update({
        where: { id: target.id },
        data: { status: "Filled" },
      });
    if (p.kind === "Termination" && p.effectiveDate <= today()) {
      await tx.session.deleteMany({
        where: { user: { workerId: p.workerId! } },
      });
      await tx.onboardingTask.updateMany({
        where: { workerId: p.workerId! },
        data: { completed: true },
      });
    }
  }
  if (p.kind === "Compensation")
    await tx.compensation.create({
      data: {
        workerId: p.workerId!,
        annualAmount: p.amount!,
        effectiveDate: p.effectiveDate,
        processId: p.id,
      },
    });
  if (p.kind === "Requisition")
    await tx.requisition.update({
      where: { id: p.requisitionId! },
      data: { status: "Open" },
    });
  if (p.kind === "Offer")
    await tx.candidate.update({
      where: { id: p.candidateId! },
      data: { stage: "Offer Approved" },
    });
  if (p.kind === "Time Off") {
    const b = await tx.timeOffBalance.findUniqueOrThrow({
      where: { workerId: p.workerId! },
    });
    if (p.days! > b.entitlement - b.used)
      throw new LabError("Balance changed; request cannot complete");
    if (
      await tx.timeOffRequest.findFirst({
        where: {
          workerId: p.workerId!,
          canceled: false,
          startDate: { lte: p.endDate! },
          endDate: { gte: p.effectiveDate },
        },
      })
    )
      throw new LabError("Conflicting absence");
    await tx.timeOffRequest.create({
      data: {
        workerId: p.workerId!,
        processId: p.id,
        startDate: p.effectiveDate,
        endDate: p.endDate!,
        days: p.days!,
      },
    });
    await tx.timeOffBalance.update({
      where: { workerId: p.workerId! },
      data: { used: { increment: p.days! } },
    });
  }
  const completed = await tx.process.update({
    where: { id: p.id },
    data: { status: "Completed" },
  });
  await audit(
    tx,
    u,
    "Complete " + p.kind,
    completed.workerId ?? p.prehireId ?? p.id,
    { status: p.status, domain: before },
    { status: "Completed", domain: await domainSnapshot(tx, completed) },
    p.orgId,
    p.id,
    p.effectiveDate,
  );
}
export async function act(
  u: Actor,
  id: string,
  action: string,
  comment: string,
) {
  return db.$transaction(
    async (tx) => {
      const p = await tx.process.findUnique({
        where: { id },
        include: { definition: true, tasks: { where: { status: "Pending" } } },
      });
      if (!p) throw new LabError("Process not found", 404);
      requireScope(u, p.orgId);
      if (action === "cancel") {
        if (p.initiatorId !== u.id)
          throw new LabError("Only the initiator can cancel", 403);
        if (!["Submitted", "In Progress", "Sent Back"].includes(p.status))
          throw new LabError("Process cannot be canceled", 409);
      } else if (action === "resubmit") {
        if (p.initiatorId !== u.id || p.status !== "Sent Back")
          throw new LabError(
            "Only the initiator can resubmit a returned process",
            403,
          );
        await requirePermission(u, domainFor[p.kind], tx);
        if (comment.trim().length < 3)
          throw new LabError("Explain your correction");
        const a = await resolveApprover(
          tx,
          p.definition.approvalRole,
          p.orgId,
          u.id,
        );
        await tx.approvalTask.create({
          data: {
            processId: p.id,
            assigneeId: a.id,
            step: p.definition.approvalRole + " Approval",
          },
        });
        await tx.process.update({
          where: { id },
          data: { status: "Submitted", comment },
        });
        await audit(
          tx,
          u,
          "Resubmit",
          id,
          p.status,
          { comment, status: "Submitted" },
          p.orgId,
          id,
          p.effectiveDate,
        );
        return;
      } else {
        if (!["approve", "deny", "sendback"].includes(action))
          throw new LabError("Unknown action");
        await requirePermission(u, "process.approve", tx);
        if (
          p.initiatorId === u.id &&
          !(
            ["Hire", "Termination"].includes(p.kind) &&
            p.status === "In Progress" &&
            u.role === "HR Administrator"
          )
        )
          throw new LabError("Independent approval required", 403);
        const task = p.tasks.find((t) => t.assigneeId === u.id);
        if (!task)
          throw new LabError("This task is assigned to another account", 403);
        if (!["Submitted", "In Progress"].includes(p.status))
          throw new LabError("Process is no longer actionable", 409);
        if (action !== "approve" && comment.trim().length < 3)
          throw new LabError("A reason is required");
        await tx.approvalTask.update({
          where: { id: task.id },
          data: {
            status:
              action === "approve"
                ? "Completed"
                : action === "deny"
                  ? "Denied"
                  : "Sent Back",
            actedAt: new Date(),
          },
        });
        if (action === "approve") {
          if (p.definition.finalReview && p.status === "Submitted") {
            const hr = await tx.user.findFirst({
              where: {
                role: "HR Administrator",
                OR: [{ orgId: null }, { orgId: p.orgId }],
              },
              orderBy: { id: "asc" },
            });
            if (!hr) throw new LabError("No HR reviewer configured");
            await tx.approvalTask.create({
              data: {
                processId: id,
                assigneeId: hr.id,
                step: "HR Final Review",
              },
            });
            await tx.process.update({
              where: { id },
              data: { status: "In Progress" },
            });
          } else await complete(tx, u, p);
          await audit(
            tx,
            u,
            "Approve " + p.kind,
            id,
            p.status,
            { comment },
            p.orgId,
            id,
            p.effectiveDate,
          );
          return;
        }
      }
      const status =
        action === "sendback"
          ? "Sent Back"
          : action === "deny"
            ? "Denied"
            : "Canceled";
      await tx.process.update({ where: { id }, data: { status, comment } });
      await tx.approvalTask.updateMany({
        where: { processId: id, status: "Pending" },
        data: { status: "Withdrawn" },
      });
      if (status !== "Sent Back" && ["Hire", "Change Job"].includes(p.kind))
        await tx.position.update({
          where: { id: p.positionId! },
          data: { status: "Open" },
        });
      if (p.kind === "Requisition" && status !== "Sent Back")
        await tx.requisition.update({
          where: { id: p.requisitionId! },
          data: { status: "Closed" },
        });
      if (p.kind === "Offer" && status !== "Sent Back")
        await tx.candidate.update({
          where: { id: p.candidateId! },
          data: { stage: "Declined" },
        });
      await audit(
        tx,
        u,
        action,
        id,
        p.status,
        { status, comment },
        p.orgId,
        id,
        p.effectiveDate,
      );
    },
    { timeout: 15000 },
  );
}
export async function editReturned(u: Actor, id: string, raw: unknown) {
  const x = processSchema.parse(
    raw && typeof raw === "object"
      ? Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null))
      : raw,
  );
  return db.$transaction(async (tx) => {
    const p = await tx.process.findUniqueOrThrow({ where: { id } });
    if (p.initiatorId !== u.id || p.status !== "Sent Back")
      throw new LabError("Only returned processes may be corrected", 403);
    await requirePermission(u, domainFor[p.kind], tx);
    if (x.kind !== p.kind) throw new LabError("Process type cannot change");
    if (
      p.positionId &&
      x.effectiveDate <
        (await tx.position.findUniqueOrThrow({ where: { id: p.positionId } }))
          .earliestDate
    )
      throw new LabError("Date precedes availability");
    const after = await tx.process.update({
      where: { id },
      data: {
        effectiveDate: x.effectiveDate,
        reason: x.reason,
        hours: x.hours,
      },
    });
    await audit(
      tx,
      u,
      "Correct returned request",
      id,
      { date: p.effectiveDate, reason: p.reason },
      { date: after.effectiveDate, reason: after.reason },
      p.orgId,
      id,
      x.effectiveDate,
    );
    return after;
  });
}
export async function cancelAbsence(u: Actor, id: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.timeOffRequest.findUniqueOrThrow({ where: { id } });
    if (a.workerId !== u.workerId) throw new LabError("Self only", 403);
    await requirePermission(u, "absence.request", tx);
    if (a.canceled) throw new LabError("Already canceled", 409);
    await tx.timeOffRequest.update({ where: { id }, data: { canceled: true } });
    await tx.timeOffBalance.update({
      where: { workerId: a.workerId },
      data: { used: { decrement: a.days } },
    });
    await audit(
      tx,
      u,
      "Cancel time off",
      id,
      { canceled: false },
      { canceled: true },
      u.orgId ?? undefined,
      a.processId,
    );
  });
}
export async function enrollBenefit(
  u: Actor,
  planId: string,
  effectiveDate: string,
) {
  date.parse(effectiveDate);
  return db.$transaction(async (tx) => {
    await requirePermission(u, "benefits.self", tx);
    if (!u.workerId) throw new LabError("Employee account required");
    const w = await workerAccess(u, u.workerId, tx, today());
    const p = await tx.benefitPlan.findUniqueOrThrow({ where: { id: planId } });
    if (
      today() < p.windowStart ||
      today() > p.windowEnd ||
      effectiveDate < today() ||
      effectiveDate > p.windowEnd
    )
      throw new LabError("Outside the synthetic enrollment window");
    if (
      w.employments[0].status !== "Active" ||
      (p.employeeOnly && w.workerType !== "Employee")
    )
      throw new LabError("Not eligible for this plan");
    const r = await tx.benefitEnrollment.create({
      data: { workerId: w.id, planId, effectiveDate },
    });
    await audit(
      tx,
      u,
      "Benefit enrollment",
      w.id,
      null,
      r,
      w.employments[0].orgId,
      undefined,
      effectiveDate,
    );
    return r;
  });
}
export async function contactChange(u: Actor, workerId: string, email: string) {
  return db.$transaction(async (tx) => {
    const w = await workerAccess(u, workerId, tx, today());
    await requirePermission(u, "contact.modify", tx);
    if (u.role !== "HR Administrator" && u.workerId !== workerId)
      throw new LabError("Self or HR only", 403);
    const before = await tx.contact.findUniqueOrThrow({ where: { workerId } });
    const after = await tx.contact.update({
      where: { workerId },
      data: { personalEmail: email },
    });
    await audit(
      tx,
      u,
      "Contact change",
      workerId,
      before,
      after,
      w.employments[0].orgId,
    );
  });
}
