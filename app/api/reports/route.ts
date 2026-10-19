import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/policy";
import { workspace } from "@/lib/read";
import { audit } from "@/lib/engine";
import { db } from "@/lib/db";
export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return new NextResponse("Unauthorized", { status: 401 });
  try {
    await requirePermission(u, "reports.view");
    const pay = req.nextUrl.searchParams.get("pay") === "true";
    if (pay) await requirePermission(u, "compensation.view");
    const d = await workspace(
      u,
      req.nextUrl.searchParams.get("asOf") ?? undefined,
    );
    const q = (req.nextUrl.searchParams.get("q") ?? "").toLowerCase();
    const org = req.nextUrl.searchParams.get("org");
    const filtered = d.workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) &&
        (!org || w.employments[0].orgId === org),
    );
    const esc = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Worker ID",
        "Worker",
        "Organization",
        "Title",
        "Status",
        ...(pay ? ["Annual EUR"] : []),
      ],
      ...filtered.map((w) => {
        const e = w.employments[0];
        return [
          w.id,
          w.name,
          e.org.name,
          e.title,
          e.status,
          ...(pay
            ? [
                (w as unknown as { compensation?: { annualAmount: number }[] })
                  .compensation?.[0]?.annualAmount ?? "",
              ]
            : []),
        ];
      }),
    ];
    await audit(
      db,
      u,
      "Export worker report",
      "report",
      null,
      { rows: filtered.length, asOf: d.asOf, pay },
      u.orgId ?? undefined,
    );
    return new NextResponse(
      rows.map((row) => row.map(esc).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="practice-workers.csv"',
        },
      },
    );
  } catch {
    return new NextResponse("Access denied", { status: 403 });
  }
}
