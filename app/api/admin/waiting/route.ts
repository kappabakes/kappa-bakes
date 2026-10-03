import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * Who's waiting on each flavour.
 *
 * Worth more than the emails it drives: it's the one signal that shows
 * demand you didn't meet, where sales only ever show what you made.
 */
export async function GET() {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const [alerts, flavours] = await Promise.all([
    db.stockAlert.findMany(),
    db.flavour.findMany({ select: { id: true, name: true } }),
  ]);

  const names = new Map(flavours.map((f) => [f.id, f.name]));
  const rows = new Map<string, { name: string; total: number; anyDate: number }>();

  for (const a of alerts) {
    const name = names.get(a.flavourId) ?? "Removed flavour";
    const row = rows.get(a.flavourId) ?? { name, total: 0, anyDate: 0 };
    row.total++;
    if (!a.day) row.anyDate++;
    rows.set(a.flavourId, row);
  }

  return NextResponse.json({
    waiting: [...rows.entries()]
      .map(([flavourId, r]) => ({ flavourId, ...r }))
      .sort((a, b) => b.total - a.total),
  });
}
