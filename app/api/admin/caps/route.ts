import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, midnightUtc, flavourStock } from "@/lib/stock";
import { runStockAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/**
 * A flavour's share of a shared cake, for one date.
 *
 * Raising is always allowed. Lowering stops at what's already been sold —
 * those slices exist and belong to someone, so a cap below them would be
 * promising something you'd have to take back.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    dayIso: string;
    /// One or more flavours at once, so reallocating is a single save.
    caps: { flavourId: string; cap: number | null }[];
  };

  if (!b.dayIso || !Array.isArray(b.caps))
    return NextResponse.json({ error: "Missing details." }, { status: 400 });

  const day = midnightUtc(b.dayIso);
  const stock = await flavourStock(day);

  for (const c of b.caps) {
    const sold = stock[c.flavourId]?.sold ?? 0;

    if (c.cap === null) {
      // No cap: it can take whatever the cake has left.
      await db.dayFlavourCap.deleteMany({
        where: { day, flavourId: c.flavourId },
      });
      continue;
    }

    const cap = Math.max(sold, Math.floor(c.cap));

    await db.dayFlavourCap.upsert({
      where: { day_flavourId: { day, flavourId: c.flavourId } },
      create: { day, flavourId: c.flavourId, cap },
      update: { cap },
    });
  }

  // A raised cap can put slices within reach again.
  await runStockAlerts();

  return NextResponse.json({ ok: true, stock: await flavourStock(day) });
}
