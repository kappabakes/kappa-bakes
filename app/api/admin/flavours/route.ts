import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, midnightUtc, todayUk } from "@/lib/stock";
import { dayLabel } from "@/lib/config";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const [flavours, dayStock, days] = await Promise.all([
    db.flavour.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    db.dayFlavourStock.findMany(),
    // Upcoming dates, so the editor can offer them as tick boxes.
    db.collectionDay.findMany({
      where: { day: { gte: todayUk() } },
      orderBy: { day: "asc" },
      select: { day: true, capacity: true },
    }),
  ]);

  return NextResponse.json({
    flavours: flavours.map((f) => ({
      ...f,
      dateStock: dayStock
        .filter((d) => d.flavourId === f.id)
        .map((d) => ({ iso: d.day.toISOString(), stock: d.stock })),
    })),
    days: days.map((d) => ({
      iso: d.day.toISOString(),
      label: dayLabel(d.day),
      capacity: d.capacity,
    })),
  });
}

/** Create or update. Omit id to create. */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const b = (await req.json()) as {
    id?: string;
    name: string;
    description?: string;
    pricePence: number;
    hasToppings: boolean;
    allergens: string[];
    image?: string;
    nameImage?: string;
    maxPerOrder?: number | null;
    stockPerDay?: number | null;
    serving?: "CHOICE" | "ON_SLICE" | "IN_TUB";
    selectedDatesOnly?: boolean;
    /// Which dates it's offered on, and how many. Only sent when the flavour
    /// is limited to selected dates.
    dateStock?: { iso: string; stock: number }[];
    hasExtraSauce?: boolean;
    sauceIds?: string[];
    toppingIds?: string[];
    maxSauces?: number;
    maxToppings?: number;
    active?: boolean;
    sortOrder?: number;
  };

  if (!b.name?.trim()) return NextResponse.json({ error: "Needs a name." }, { status: 400 });
  if (!Number.isFinite(b.pricePence) || b.pricePence <= 0)
    return NextResponse.json({ error: "Needs a price." }, { status: 400 });

  const data = {
    name: b.name.trim(),
    description: b.description?.trim() ?? "",
    pricePence: Math.round(b.pricePence),
    hasToppings: b.hasToppings,
    allergens: b.allergens ?? [],
    image: b.image?.trim() || null,
    nameImage: b.nameImage?.trim() || null,
    maxPerOrder:
      b.maxPerOrder && Number(b.maxPerOrder) > 0
        ? Math.floor(Number(b.maxPerOrder))
        : null,
    stockPerDay:
      b.stockPerDay && Number(b.stockPerDay) > 0
        ? Math.floor(Number(b.stockPerDay))
        : null,
    serving: b.serving ?? "CHOICE",
    selectedDatesOnly: b.selectedDatesOnly ?? false,
    hasExtraSauce: b.hasExtraSauce ?? true,
    sauceIds: b.sauceIds ?? [],
    toppingIds: b.toppingIds ?? [],
    maxSauces: Math.max(1, Math.floor(Number(b.maxSauces) || 1)),
    maxToppings: Math.max(1, Math.floor(Number(b.maxToppings) || 2)),
    active: b.active ?? true,
    sortOrder: b.sortOrder ?? 0,
  };

  const flavour = b.id
    ? await db.flavour.update({ where: { id: b.id }, data })
    : await db.flavour.create({ data });

  // Replace the date list wholesale: what you saved is what it's offered on.
  if (b.dateStock) {
    await db.dayFlavourStock.deleteMany({ where: { flavourId: flavour.id } });
    if (b.dateStock.length)
      await db.dayFlavourStock.createMany({
        data: b.dateStock.map((d) => ({
          day: midnightUtc(d.iso),
          flavourId: flavour.id,
          stock: Math.max(0, Math.floor(d.stock)),
        })),
      });
  }

  return NextResponse.json({ ok: true, flavour });
}

/**
 * ?id=       archive — comes off the menu, keeps everything, can come back
 * ?id=&hard=true  delete — gone for good
 *
 * Deleting is safe for past orders because each order stores its own copy of
 * the flavour name, price and allergens at the time it was placed. The record
 * never changes underneath you.
 */
export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  if (url.searchParams.get("hard") === "true") {
    await db.flavour.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  await db.flavour.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
