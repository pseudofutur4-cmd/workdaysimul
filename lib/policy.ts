import type { User, Prisma } from "@prisma/client";
import { db } from "./db";
export class LabError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type Actor = User;
export async function allowed(
  u: Actor,
  domain: string,
  tx: Prisma.TransactionClient = db,
) {
  return (
    (
      await tx.policy.findUnique({
        where: { role_domain: { role: u.role, domain } },
      })
    )?.granted === true
  );
}
export async function requirePermission(
  u: Actor,
  domain: string,
  tx: Prisma.TransactionClient = db,
) {
  if (!(await allowed(u, domain, tx)))
    throw new LabError(`Access denied: ${domain}`, 403);
}
export function requireScope(u: Actor, orgId: string) {
  if (u.orgId && u.orgId !== orgId)
    throw new LabError("This organization is outside your practice scope", 403);
}
export async function workerAccess(
  u: Actor,
  workerId: string,
  tx: Prisma.TransactionClient = db,
  asOf = "9999-12-31",
) {
  await requirePermission(u, "workers.view", tx);
  const w = await tx.worker.findUnique({
    where: { id: workerId },
    include: {
      employments: {
        where: { effectiveDate: { lte: asOf } },
        orderBy: { effectiveDate: "desc" },
        take: 1,
      },
    },
  });
  if (!w) throw new LabError("Worker not found", 404);
  if (u.role === "Employee" && u.workerId !== workerId)
    throw new LabError("Employee as Self only", 403);
  if (!w.employments[0])
    throw new LabError("Worker not effective on this date", 404);
  requireScope(u, w.employments[0].orgId);
  if (
    await tx.process.findFirst({
      where: { workerId, kind: "Hire", status: "Rescinded" },
    })
  )
    return {
      ...w,
      employments: w.employments.map((e) => ({ ...e, status: "Rescinded" })),
    };
  return w;
}
