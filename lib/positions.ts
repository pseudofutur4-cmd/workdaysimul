import { Prisma } from "@prisma/client";
import { db } from "./db";
// Availability is derived from effective employment, never from a stale status cache.
// Future commitments are conservatively reserved; overlap staffing is unsupported.
export async function positionStates(
  asOf: string,
  tx: Prisma.TransactionClient = db,
) {
  const [snapshots, events, positions] = await Promise.all([
    tx.employment.findMany({
      where: { effectiveDate: { lte: asOf } },
      orderBy: { effectiveDate: "desc" },
      select: { workerId: true, positionId: true, status: true },
    }),
    tx.process.findMany({
      where: {
        kind: { in: ["Hire", "Change Job"] },
        status: { notIn: ["Denied", "Canceled", "Rescinded"] },
      },
      select: {
        workerId: true,
        positionId: true,
        status: true,
        effectiveDate: true,
      },
    }),
    tx.position.findMany({ select: { id: true, earliestDate: true } }),
  ]);
  const rescinded = await tx.process.findMany({
    where: { kind: "Hire", status: "Rescinded" },
    select: { workerId: true },
  });
  const invalid = new Set(rescinded.map((e) => e.workerId));
  const seen = new Set<string>(),
    occupied = new Set<string>();
  for (const e of snapshots) {
    if (seen.has(e.workerId) || invalid.has(e.workerId)) continue;
    seen.add(e.workerId);
    if (e.status === "Active") occupied.add(e.positionId);
  }
  const reserved = new Set(
    events
      .filter(
        (e) =>
          e.positionId && (e.status !== "Completed" || e.effectiveDate > asOf),
      )
      .map((e) => e.positionId),
  );
  return new Map(
    positions.map((p) => [
      p.id,
      occupied.has(p.id)
        ? "Filled"
        : reserved.has(p.id)
          ? "Reserved"
          : p.earliestDate > asOf
            ? "Unavailable"
            : "Open",
    ]),
  );
}
