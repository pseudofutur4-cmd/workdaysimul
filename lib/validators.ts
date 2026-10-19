import { z } from "zod";
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Enter a valid date",
  );
export const hireSchema = z.object({
  kind: z.literal("Hire"),
  prehireId: z.string().min(1, "Select a pre-hire"),
  positionId: z.string().min(1, "Select a position"),
  effectiveDate: date,
  reason: z.enum(["New hire", "Rehire"]),
  hours: z.coerce.number().min(1).max(40),
  requestKey: z.string().min(8),
});
export const processSchema = z.object({
  kind: z.enum([
    "Hire",
    "Change Job",
    "Termination",
    "Compensation",
    "Time Off",
    "Requisition",
    "Offer",
  ]),
  workerId: z.string().optional(),
  prehireId: z.string().optional(),
  positionId: z.string().optional(),
  requisitionId: z.string().optional(),
  effectiveDate: date,
  reason: z.string().trim().min(3).max(200),
  hours: z.coerce.number().min(1).max(40).default(40),
  amount: z.coerce.number().int().min(10000).max(500000).optional(),
  endDate: date.optional(),
  requestKey: z.string().min(8),
});
export function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}
export function weekdays(start: string, end: string) {
  let n = 0;
  const d = new Date(start + "T12:00:00Z"),
    e = new Date(end + "T12:00:00Z");
  if (e < d || (e.getTime() - d.getTime()) / 86400000 > 366)
    throw new Error("Choose a date range of at most one year");
  for (; d <= e; d.setUTCDate(d.getUTCDate() + 1))
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++;
  return n;
}
