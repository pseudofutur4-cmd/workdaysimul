import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { Actor, LabError, requirePermission, requireScope } from "./policy";
import { audit } from "./engine";
import { date } from "./validators";
import { fixtureWorkers, moduleById } from "./academy-catalog";
const text = z.string().trim().min(3).max(200);
const amount = z.coerce
  .number()
  .finite()
  .min(0)
  .max(100000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places",
  );
export const academySchemas: Record<string, z.ZodType> = {
  finance: z
    .object({
      memo: text,
      date,
      debit: amount.refine((n) => n > 0),
      credit: amount.refine((n) => n > 0),
    })
    .strict()
    .refine(
      (x) => Math.round(x.debit * 100) === Math.round(x.credit * 100),
      "Debits and credits must balance",
    ),
  scm: z
    .object({
      item: text,
      quantity: z.coerce.number().int().min(1).max(100),
      price: amount.refine((n) => n > 0),
      supplier: z.enum([
        "Aster Office Supplies (fictional)",
        "Vale Equipment (fictional)",
      ]),
    })
    .strict(),
  time: z
    .object({
      date,
      hours: z.coerce.number().min(0.25).max(16).multipleOf(0.25),
      code: z.literal("Regular work"),
    })
    .strict(),
  talent: z
    .object({
      goal: text,
      due: date,
      measure: text,
      progress: z.coerce.number().int().min(0).max(100),
    })
    .strict(),
  payroll: z
    .object({
      hours: z.coerce.number().min(1).max(160),
      rate: amount.refine((n) => n > 0),
      deduction: amount,
    })
    .strict()
    .refine(
      (x) => x.deduction <= (Math.round(x.hours * x.rate * 100) / 100) * 0.8,
      "Deductions exceed the available gross pay after teaching tax",
    ),
  integration: z
    .object({
      name: text,
      direction: z.literal("Outbound"),
      format: z.enum(["CSV", "JSON"]),
    })
    .strict(),
  studio: z
    .object({
      name: text,
      transform: z.enum(["Uppercase names", "Lowercase names"]),
      destination: z.literal("Local preview"),
    })
    .strict(),
  security: z
    .object({
      role: z.enum(["Employee", "Manager"]),
      domain: z.enum(["Worker Data", "Compensation Data"]),
      grant: z.enum(["Deny", "View"]),
    })
    .strict(),
};
const runModules = ["studio", "integration", "security"];
const include = {
  owner: { select: { id: true, name: true, role: true } },
  reviewer: { select: { id: true, name: true, role: true } },
  org: { select: { name: true } },
  ledgerLines: true,
  purchase: true,
  timeEntry: true,
  goal: true,
  payslip: true,
  run: true,
  accessTest: true,
} as const;
type CaseWithOutcome = Prisma.AcademyCaseGetPayload<{
  include: typeof include;
}>;
export async function academyWorkspace(u: Actor) {
  await requirePermission(u, "practice.use");
  const cases = await db.academyCase.findMany({
    where: { OR: [{ ownerId: u.id }, { reviewerId: u.id }] },
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  // Recheck current policy grants and current org scope, including after a role's policy is revoked.
  const grants = new Set(
    (await db.policy.findMany({ where: { role: u.role, granted: true } })).map(
      (p) => p.domain,
    ),
  );
  const visible = cases.filter((c) => {
    if (u.orgId && c.orgId !== u.orgId) return false;
    const m = moduleById(c.module);
    return !!m && grants.has(c.ownerId === u.id ? m.domain : "process.approve");
  });
  return {
    userId: u.id,
    cases: visible,
    progress: await db.tutorialProgress.findMany({ where: { userId: u.id } }),
  };
}
export async function academyAction(
  u: Actor,
  raw: unknown,
): Promise<CaseWithOutcome> {
  await requirePermission(u, "practice.use");
  const b = z
    .object({
      action: z.enum([
        "create",
        "save",
        "submit",
        "approve",
        "sendback",
        "deny",
        "cancel",
        "execute",
        "receive",
      ]),
      module: z.string().optional(),
      id: z.string().optional(),
      version: z.number().int().optional(),
      orgId: z.string().optional(),
      data: z.unknown().optional(),
      feedback: z.string().trim().max(1000).optional(),
      rating: z.number().int().min(1).max(5).optional(),
    })
    .strict()
    .parse(raw);
  return db.$transaction(async (tx): Promise<CaseWithOutcome> => {
    if (b.action === "create") {
      const m = moduleById(b.module ?? "");
      if (!m || m.native)
        throw new LabError("Choose an available practice module");
      if (u.role !== m.role)
        throw new LabError(
          `Use the ${m.role} practice account for this task`,
          403,
        );
      await requirePermission(u, m.domain, tx);
      const orgId = z
        .string()
        .min(1)
        .parse(b.orgId ?? u.orgId);
      requireScope(u, orgId);
      await tx.organization.findUniqueOrThrow({ where: { id: orgId } });
      const payload = academySchemas[m.id].parse(b.data);
      const reviewer = runModules.includes(m.id)
        ? null
        : await tx.user.findFirst({
            where: { role: "Manager", orgId, id: { not: u.id } },
            orderBy: { id: "asc" },
          });
      if (!runModules.includes(m.id) && !reviewer)
        throw new LabError(
          "This organization needs a separate Manager reviewer",
        );
      const c = await tx.academyCase.create({
        data: {
          module: m.id,
          ownerId: u.id,
          orgId,
          reviewerId: reviewer?.id,
          payload: JSON.stringify(payload),
        },
        include,
      });
      await audit(tx, u, "Academy create " + m.id, c.id, null, c, orgId);
      return c;
    }
    const c = await tx.academyCase.findUnique({
      where: { id: z.string().parse(b.id) },
    });
    if (!c) throw new LabError("Practice record not found", 404);
    requireScope(u, c.orgId);
    const m = moduleById(c.module)!;
    const decision = ["approve", "sendback", "deny"].includes(b.action);
    if (decision) {
      if (c.reviewerId !== u.id || c.ownerId === u.id)
        throw new LabError(
          "Only the assigned separate reviewer can decide",
          403,
        );
      await requirePermission(u, "process.approve", tx);
    } else {
      if (c.ownerId !== u.id)
        throw new LabError("Only the owner can change this record", 403);
      await requirePermission(u, m.domain, tx);
      if (u.role !== m.role)
        throw new LabError("Your role no longer permits this task", 403);
    }
    if (b.version !== c.version)
      throw new LabError("This record changed. Refresh and try again.", 409);
    let status = c.status,
      payload = c.payload;
    if (b.action === "save") {
      if (!["Draft", "Sent Back"].includes(c.status))
        throw new LabError("Only a draft or returned task can be edited");
      payload = JSON.stringify(academySchemas[c.module].parse(b.data));
    } else if (b.action === "submit") {
      if (
        runModules.includes(c.module) ||
        !["Draft", "Sent Back"].includes(c.status)
      )
        throw new LabError("This record cannot be submitted");
      academySchemas[c.module].parse(JSON.parse(payload));
      status = "Submitted";
    } else if (decision) {
      if (c.status !== "Submitted")
        throw new LabError("Only a submitted record can be reviewed");
      if (!b.feedback || b.feedback.length < 3)
        throw new LabError(
          "Add a useful review comment (at least 3 characters)",
        );
      if (b.action === "approve" && c.module === "talent" && !b.rating)
        throw new LabError("Choose a manager rating");
      status =
        b.action === "approve"
          ? "Completed"
          : b.action === "sendback"
            ? "Sent Back"
            : "Denied";
    } else if (b.action === "execute") {
      if (!runModules.includes(c.module) || c.status !== "Draft")
        throw new LabError(
          "Only a draft integration or security exercise can run",
        );
      status = "Completed";
    } else if (b.action === "cancel") {
      if (!["Draft", "Sent Back", "Submitted"].includes(c.status))
        throw new LabError("This record cannot be cancelled");
      status = "Cancelled";
    } else if (b.action === "receive") {
      if (c.module !== "scm" || c.status !== "Completed")
        throw new LabError("Receive only an approved purchase order");
      const p = await tx.academyPurchase.findUniqueOrThrow({
        where: { caseId: c.id },
      });
      if (p.received) throw new LabError("Already received", 409);
      await tx.academyPurchase.update({
        where: { caseId: c.id },
        data: { received: true },
      });
    }
    const changed = await tx.academyCase.updateMany({
      where: { id: c.id, version: b.version },
      data: {
        status,
        payload,
        version: { increment: 1 },
        ...(decision ? { feedback: b.feedback, rating: b.rating ?? null } : {}),
      },
    });
    if (changed.count !== 1)
      throw new LabError("This record changed. Refresh and try again.", 409);
    // Domain effects and the immutable audit are committed in the same transaction as completion.
    if (status === "Completed" && c.status !== "Completed") {
      const p = academySchemas[c.module].parse(JSON.parse(payload)) as Record<
        string,
        any
      >;
      const caseId = c.id;
      switch (c.module) {
        case "finance":
          await tx.academyLedgerLine.createMany({
            data: [
              {
                caseId,
                account: "6100 Teaching expense",
                debitCents: Math.round(p.debit * 100),
                creditCents: 0,
                accountingDate: p.date,
              },
              {
                caseId,
                account: "2100 Accrued liability",
                debitCents: 0,
                creditCents: Math.round(p.credit * 100),
                accountingDate: p.date,
              },
            ],
          });
          break;
        case "scm":
          await tx.academyPurchase.create({
            data: {
              caseId,
              item: p.item,
              supplier: p.supplier,
              quantity: p.quantity,
              totalCents: Math.round(p.price * 100) * p.quantity,
            },
          });
          break;
        case "time": {
          if (
            await tx.academyTimeEntry.findUnique({
              where: {
                ownerId_workDate: { ownerId: c.ownerId, workDate: p.date },
              },
            })
          )
            throw new LabError(
              "An approved entry already exists for this date",
              409,
            );
          await tx.academyTimeEntry.create({
            data: {
              caseId,
              ownerId: c.ownerId,
              workDate: p.date,
              regularMinutes: Math.min(8, p.hours) * 60,
              overtimeMinutes: Math.max(0, p.hours - 8) * 60,
            },
          });
          break;
        }
        case "talent":
          await tx.academyGoal.create({
            data: {
              caseId,
              goal: p.goal,
              dueDate: p.due,
              measure: p.measure,
              progress: p.progress,
              managerRating: b.rating!,
              managerFeedback: b.feedback!,
            },
          });
          break;
        case "payroll": {
          const grossCents = Math.round(p.hours * p.rate * 100),
            taxCents = Math.round(grossCents * 0.2),
            deductionCents = Math.round(p.deduction * 100);
          if (grossCents - taxCents - deductionCents < 0)
            throw new LabError("Net pay cannot be negative");
          await tx.academyPayslip.create({
            data: {
              caseId,
              grossCents,
              taxCents,
              deductionCents,
              netCents: grossCents - taxCents - deductionCents,
            },
          });
          break;
        }
        case "integration":
        case "studio": {
          const rows = fixtureWorkers.map((w) => ({
            ...w,
            name:
              c.module === "studio"
                ? p.transform === "Uppercase names"
                  ? w.name.toUpperCase()
                  : w.name.toLowerCase()
                : w.name,
          }));
          const output =
            c.module === "integration" && p.format === "CSV"
              ? "id,name\n" + rows.map((w) => w.id + "," + w.name).join("\n")
              : JSON.stringify(rows, null, 2);
          await tx.academyRun.create({
            data: {
              caseId,
              output,
              log: JSON.stringify([
                "Read bundled fixture: 2 rows",
                "Validate required IDs and names: passed",
                c.module === "studio"
                  ? "Transform: " + p.transform
                  : "Format: " + p.format,
                "Deliver to local preview: completed (no external delivery)",
              ]),
            },
          });
          break;
        }
        case "security":
          await tx.academyAccessTest.create({
            data: {
              caseId,
              role: p.role,
              domain: p.domain,
              decision: p.grant === "View" ? "Allowed" : "Denied",
              approvalAllowed: false,
            },
          });
          break;
      }
    }
    const next = await tx.academyCase.findUniqueOrThrow({
      where: { id: c.id },
      include,
    });
    await audit(
      tx,
      u,
      "Academy " + b.action + " " + c.module,
      c.id,
      { status: c.status, version: c.version },
      { status, version: next.version, feedback: next.feedback },
      c.orgId,
    );
    return next;
  });
}
