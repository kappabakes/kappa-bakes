import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const flavours = await db.flavour.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ flavours });
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
    allowSeparate?: boolean;
    hasExtraSauce?: boolean;
    sauceIds?: string[];
    toppingIds?: string[];
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
    allowSeparate: b.allowSeparate ?? true,
    hasExtraSauce: b.hasExtraSauce ?? true,
    sauceIds: b.sauceIds ?? [],
    toppingIds: b.toppingIds ?? [],
    maxToppings: Math.max(1, Math.floor(Number(b.maxToppings) || 2)),
    active: b.active ?? true,
    sortOrder: b.sortOrder ?? 0,
  };

  const flavour = b.id
    ? await db.flavour.update({ where: { id: b.id }, data })
    : await db.flavour.create({ data });

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
