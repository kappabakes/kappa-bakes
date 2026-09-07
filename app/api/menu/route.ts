import { NextResponse } from "next/server";
import { db, openDays, flavourStock, slicesTaken } from "@/lib/stock";

export const dynamic = "force-dynamic";

/** Everything the order page needs, in one call. */
export async function GET() {
  const [flavours, days] = await Promise.all([
    db.flavour.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    openDays(),
  ]);
  // Stock is per date, so send it keyed by date rather than per flavour.
  const stock: Record<string, Awaited<ReturnType<typeof flavourStock>>> = {};
  // And the day's general pool separately: a flavour without its own stock
  // draws on that, so it sells out when the pool does even though the
  // headline counter still shows the specials.
  const general: Record<string, number> = {};
  for (const d of days) {
    const iso = d.iso;
    stock[iso] = await flavourStock(new Date(iso));
    const taken = await slicesTaken(new Date(iso));
    const row = await db.collectionDay.findUnique({
      where: { day: new Date(iso) },
    });
    general[iso] = Math.max(0, (row?.capacity ?? 0) - taken);
  }

  const extras = await db.extra.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(
    {
      flavours,
      days,
      stock,
      general,
      extras,
      testMode: process.env.TEST_MODE?.trim() === "true",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
