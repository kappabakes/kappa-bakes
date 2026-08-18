import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, midnightUtc, flavourStock } from "@/lib/stock";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

/** What each flavour's stock is for one date, and how much has gone. */
export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const iso = new URL(req.url).searchParams.get("iso");
  if (!iso) return new NextResponse("No date", { status: 400 });

  const day = midnightUtc(iso);
  const [flavours, overrides, live] = await Promise.all([
    db.flavour.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.dayFlavourStock.findMany({ where: { day } }),
    flavourStock(day),
  ]);

  const set = new Map(overrides.map((o) => [o.flavourId, o.stock]));

  return NextResponse.json({
    flavours: flavours.map((f) => ({
      id: f.id,
      name: f.name,
      // What's set for this date, if anything
      dayStock: set.has(f.id) ? set.get(f.id) : null,
      // The flavour's own default, used when the above is blank
      defaultStock: f.stockPerDay,
      sold: live[f.id]?.sold ?? 0,
      left: live[f.id]?.left ?? null,
    })),
  });
}

/** Set or clear one flavour's stock for one date. */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const { iso, flavourId, stock } = (await req.json()) as {
    iso: string;
    flavourId: string;
    stock: number | null;
  };

  const day = midnightUtc(iso);
  if (isNaN(day.getTime()) || !flavourId)
    return NextResponse.json({ error: "Missing date or flavour." }, { status: 400 });

  // Blank means "no figure for this date" — fall back to the flavour default.
  if (stock === null || stock === undefined || Number(stock) < 0) {
    await db.dayFlavourStock.deleteMany({ where: { day, flavourId } });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const value = Math.floor(Number(stock));
  await db.dayFlavourStock.upsert({
    where: { day_flavourId: { day, flavourId } },
    create: { day, flavourId, stock: value },
    update: { stock: value },
  });

  return NextResponse.json({ ok: true, stock: value });
}
