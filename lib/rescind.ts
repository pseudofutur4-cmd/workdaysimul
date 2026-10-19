import { db } from "./db";
import { Actor, requirePermission, requireScope, LabError } from "./policy";
import { audit } from "./engine";
import { today } from "./validators";
export async function rescindHire(u: Actor, id: string, reason: string) {
  if (reason.trim().length < 3)
    throw new LabError("Explain the rescind reason");
  return db.$transaction(async (tx) => {
    await requirePermission(u, "staffing.initiate", tx);
    if (u.role !== "HR Administrator")
      throw new LabError("HR Administrator required", 403);
    const p = await tx.process.findUniqueOrThrow({ where: { id } });
    requireScope(u, p.orgId);
    if (p.kind !== "Hire" || p.status !== "Completed" || !p.workerId)
      throw new LabError("Only a completed Hire can be rescinded", 409);
    if (
      (await tx.process.count({
        where: {
          workerId: p.workerId,
          id: { not: p.id },
          status: { notIn: ["Canceled", "Denied"] },
        },
      })) ||
      (await tx.benefitEnrollment.count({ where: { workerId: p.workerId } })) ||
      (await tx.timeOffRequest.count({ where: { workerId: p.workerId } })) ||
      (await tx.compensation.count({ where: { workerId: p.workerId } }))
    )
      throw new LabError(
        "Downstream records exist. This preview only rescinds an unchanged hire.",
      );
    const e = await tx.employment.findUniqueOrThrow({
      where: { processId: p.id },
    });
    // Keep the original snapshot. A separate marker supersedes it only for as-of projections.
    await tx.process.update({
      where: { id },
      data: { status: "Rescinded", comment: reason },
    });
    await tx.position.update({
      where: { id: e.positionId },
      data: { status: "Open" },
    });
    await tx.requisition.updateMany({
      where: { positionId: e.positionId, status: "Filled" },
      data: { status: "Open", posted: false },
    });
    await tx.preHire.update({
      where: { id: p.prehireId! },
      data: { workerId: null, eligible: true },
    });
    await tx.session.deleteMany({ where: { user: { workerId: p.workerId } } });
    await tx.onboardingTask.updateMany({
      where: { workerId: p.workerId },
      data: { completed: true },
    });
    await audit(
      tx,
      u,
      "Rescind Hire",
      p.workerId,
      { status: "Completed", positionId: e.positionId },
      { status: "Rescinded", reason },
      p.orgId,
      id,
      today(),
    );
  });
}
