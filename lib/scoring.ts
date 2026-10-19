import { db } from "./db";
import { scenarios } from "./scenarios";
export async function scoreAttempt(attemptId: string, userId: string) {
  const a = await db.practiceAttempt.findUniqueOrThrow({
    where: { id: attemptId },
  });
  if (a.userId !== userId) throw Error("Your attempt only");
  const s = scenarios.find((s) => s.id === a.scenario);
  if (!s) throw Error("Unknown scenario");
  const events = await db.auditEvent.findMany({
    where: {
      id: { gt: a.baselineAudit },
      action: s.action,
      permission: "Allowed",
    },
  });
  let passed = false;
  for (const event of events) {
    const after = JSON.parse(event.after);
    if (s.id === "hire") {
      const p = event.processId
        ? await db.process.findUnique({
            where: { id: event.processId },
            include: {
              tasks: true,
              worker: { include: { onboarding: true, employments: true } },
              prehire: true,
              position: true,
            },
          })
        : null;
      if (
        p?.status === "Completed" &&
        p.prehire?.workerId === p.workerId &&
        p.position?.status === "Filled" &&
        p.worker?.onboarding.length === 3 &&
        p.worker.employments.some((e) => e.processId === p.id) &&
        p.tasks.filter((t) => t.status === "Completed").length >= 2
      )
        passed = true;
    } else if (
      [
        "change",
        "termination",
        "compensation",
        "absence",
        "requisition",
      ].includes(s.id)
    ) {
      const p = event.processId
        ? await db.process.findUnique({ where: { id: event.processId } })
        : null;
      if (p?.status !== "Completed") continue;
      if (s.id === "change")
        passed = !!(await db.employment.findFirst({
          where: {
            processId: p.id,
            positionId: p.positionId!,
            status: "Active",
          },
        }));
      if (s.id === "termination")
        passed = !!(await db.employment.findFirst({
          where: { processId: p.id, status: "Terminated" },
        }));
      if (s.id === "compensation")
        passed = !!(await db.compensation.findFirst({
          where: { processId: p.id, annualAmount: p.amount! },
        }));
      if (s.id === "absence") {
        const r = await db.timeOffRequest.findUnique({
            where: { processId: p.id },
          }),
          b = await db.timeOffBalance.findUnique({
            where: { workerId: p.workerId! },
          });
        const total = await db.timeOffRequest.aggregate({
          where: { workerId: p.workerId!, canceled: false },
          _sum: { days: true },
        });
        passed = !!r && !r.canceled && b?.used === total._sum.days;
      }
      if (s.id === "requisition")
        passed = !!(await db.requisition.findFirst({
          where: { id: p.requisitionId!, status: "Open" },
        }));
    } else if (s.id === "contact") {
      const c = await db.contact.findUnique({
        where: { workerId: event.objectId },
      });
      passed = c?.personalEmail === after.personalEmail;
    } else if (s.id === "profile")
      passed = !!(await db.jobProfile.findUnique({
        where: { id: event.objectId },
      }));
    else if (s.id === "position")
      passed = !!(await db.position.findUnique({
        where: { id: event.objectId },
      }));
    else if (s.id === "org") {
      const o = await db.organization.findUnique({
        where: { id: event.objectId },
      });
      passed =
        !!o?.managerId &&
        !!(await db.user.findUnique({ where: { id: o.managerId } }));
    } else if (s.id === "offer") {
      const c = await db.candidate.findUnique({
        where: { id: event.objectId },
        include: { prehire: true },
      });
      passed = c?.stage === "Accepted" && !!c.prehire;
    } else if (s.id === "benefits")
      passed = !!(await db.benefitEnrollment.findFirst({
        where: { workerId: event.objectId, planId: after.planId },
      }));
    else if (s.id === "security") {
      const p = await db.policy.findUnique({ where: { id: event.objectId } });
      passed = p?.granted === after.granted;
    } else if (s.id === "report")
      passed =
        typeof after.rows === "number" &&
        after.rows >= 0 &&
        event.actorId === userId;
    else if (s.id === "sendback") {
      const p = event.processId
        ? await db.process.findUnique({
            where: { id: event.processId },
            include: { tasks: true },
          })
        : null;
      passed =
        !!p &&
        ["Submitted", "In Progress", "Completed"].includes(p.status) &&
        p.tasks.some((t) => t.status === "Sent Back");
    }
    if (passed) break;
  }
  return db.practiceAttempt.update({
    where: { id: a.id },
    data: { score: passed ? 100 : 0 },
  });
}
