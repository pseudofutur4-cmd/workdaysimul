import { positionStates } from "./positions";
import { db } from "./db";
import { Actor, allowed, workerAccess } from "./policy";
import { today, date } from "./validators";
export async function workspace(u: Actor, asOf = today()) {
  date.parse(asOf);
  const permissions = (
    await db.policy.findMany({ where: { role: u.role, granted: true } })
  ).map((p) => p.domain);
  const can = (s: string) => permissions.includes(s);
  const orgWhere = u.orgId ? { id: u.orgId } : {};
  const orgs = await db.organization.findMany({
    where: orgWhere,
    include: { company: true },
    orderBy: { id: "asc" },
  });
  const workers = can("workers.view")
    ? await db.worker.findMany({
        where:
          u.role === "Employee"
            ? { id: u.workerId ?? "none" }
            : {
                employments: {
                  some: {
                    effectiveDate: { lte: asOf },
                    ...(u.orgId ? { orgId: u.orgId } : {}),
                  },
                },
              },
        include: {
          employments: {
            where: { effectiveDate: { lte: asOf } },
            orderBy: { effectiveDate: "desc" },
            include: {
              position: { include: { location: true, profile: true } },
              org: true,
            },
          },
          ...(can("compensation.view")
            ? {
                compensation: {
                  where: { effectiveDate: { lte: asOf } },
                  orderBy: { effectiveDate: "desc" },
                  take: 1,
                },
              }
            : {}),
          ...(can("contact.view") ? { contact: true } : {}),
          ...(u.role === "Employee"
            ? {
                balance: true,
                onboarding: true,
                enrollments: { include: { plan: true } },
                absences: true,
                learning: true,
              }
            : {}),
        },
        orderBy: { name: "asc" },
      })
    : [];
  const rescinded = await db.process.findMany({
    where: { kind: "Hire", status: "Rescinded" },
    select: { workerId: true },
  });
  const rescindedIds = new Set(rescinded.map((p) => p.workerId));
  const scopedWorkers = workers
    .filter(
      (w) =>
        w.employments[0] && (!u.orgId || w.employments[0].orgId === u.orgId),
    )
    .map((w) =>
      rescindedIds.has(w.id)
        ? {
            ...w,
            employments: w.employments.map((e) => ({
              ...e,
              status: "Rescinded",
            })),
          }
        : w,
    );
  const processes = await db.process.findMany({
    where: {
      ...(u.orgId ? { orgId: u.orgId } : {}),
      ...(u.role === "Employee" ? { initiatorId: u.id } : {}),
      ...(u.role === "Candidate" ? { id: "none" } : {}),
      ...(!can("staffing.initiate") &&
      !can("audit.view") &&
      !can("process.approve") &&
      !can("recruiting.modify") &&
      u.role !== "Employee"
        ? { id: "none" }
        : {}),
    },
    include: {
      initiator: { select: { id: true, name: true } },
      prehire: { select: { name: true } },
      candidate: { select: { name: true } },
      worker: { select: { name: true } },
      position: { select: { title: true } },
      tasks: {
        include: { assignee: { select: { id: true, name: true, role: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const safeProcesses = processes
    .filter((p) => p.kind !== "Compensation" || can("compensation.view"))
    .map((p) => ({
      ...p,
      amount: can("compensation.view") ? p.amount : undefined,
    }));
  const audits = can("audit.view")
    ? await db.auditEvent.findMany({
        where: {
          // Implementation projects have their own owner-scoped evidence API.
          // Never expose their configuration/payload through the shared tenant log.
          AND: [
            {
              NOT: {
                OR: [
                  { action: { startsWith: "Implementation:" } },
                  {
                    action: {
                      in: [
                        "Create implementation project",
                        "Create troubleshooting project",
                      ],
                    },
                  },
                ],
              },
            },
          ],
          ...(u.orgId ? { orgId: u.orgId } : {}),
          ...(!can("compensation.view")
            ? { NOT: { action: { contains: "Compensation" } } }
            : {}),
        },
        include: { actor: { select: { name: true, role: true } } },
        orderBy: { id: "desc" },
        take: 200,
      })
    : [];
  const prehires =
    can("staffing.initiate") && u.role !== "Manager"
      ? await db.preHire.findMany({
          where: u.orgId ? { orgId: u.orgId } : {},
          orderBy: { name: "asc" },
        })
      : [];
  const positionStatus = await positionStates(asOf);
  return {
    user: {
      id: u.id,
      name: u.name,
      role: u.role,
      orgId: u.orgId,
      workerId: u.workerId,
    },
    asOf,
    permissions,
    orgs,
    workers: scopedWorkers,
    processes: safeProcesses,
    audits: audits.map((a) => ({
      ...a,
      before:
        can("contact.view") && can("compensation.view") ? a.before : undefined,
      after:
        can("contact.view") && can("compensation.view") ? a.after : undefined,
    })),
    positions:
      can("workers.view") || can("recruiting.modify")
        ? (
            await db.position.findMany({
              where: u.orgId ? { orgId: u.orgId } : {},
              include: { org: true, profile: true, location: true },
              orderBy: { id: "asc" },
            })
          ).map((p) => ({ ...p, status: positionStatus.get(p.id) ?? p.status }))
        : [],
    prehires,
    profiles: can("workers.view")
      ? await db.jobProfile.findMany({ orderBy: { name: "asc" } })
      : [],
    families: await db.jobFamily.findMany(),
    locations: await db.location.findMany(),
    requisitions:
      can("recruiting.modify") || u.role === "Manager"
        ? await db.requisition.findMany({
            where: u.orgId ? { position: { orgId: u.orgId } } : {},
            include: { position: { include: { org: true } }, candidates: true },
            orderBy: { id: "asc" },
          })
        : [],
    plans: u.role === "Employee" ? await db.benefitPlan.findMany() : [],
    courses: u.role === "Employee" ? await db.learningCourse.findMany() : [],
    policies: can("security.modify")
      ? await db.policy.findMany({
          orderBy: [{ role: "asc" }, { domain: "asc" }],
        })
      : [],
    definitions: can("security.modify")
      ? await db.processDefinition.findMany()
      : [],
    attempts: await db.practiceAttempt.findMany({
      where: { userId: u.id },
      orderBy: { startedAt: "desc" },
    }),
  };
}
