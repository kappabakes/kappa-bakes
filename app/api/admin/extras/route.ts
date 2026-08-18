import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";
import { ExtraKind } from "@prisma/client";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

export async function GET() {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const extras = await db.extra.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ extras });
}

/** Create or update one sauce or topping. */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const b = (await req.json()) as {
    id?: string;
    kind: "SAUCE" | "TOPPING";
    name: string;
    pricePence: number;
    active?: boolean;
    sortOrder?: number;
  };

  if (!b.name?.trim())
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  if (!Number.isFinite(b.pricePence) || b.pricePence < 0)
    return NextResponse.json({ error: "Give it a price." }, { status: 400 });

  const data = {
    kind: b.kind as ExtraKind,
    name: b.name.trim(),
    pricePence: Math.round(b.pricePence),
    active: b.active ?? true,
    sortOrder: b.sortOrder ?? 0,
  };

  const extra = b.id
    ? await db.extra.update({ where: { id: b.id }, data })
    : await db.extra.create({ data });

  return NextResponse.json({ ok: true, extra });
}

/**
 * Deleting removes it from every flavour that allowed it. Past orders keep
 * their own copy of the name and price, so records aren't affected.
 */
export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  const flavours = await db.flavour.findMany();
  for (const f of flavours) {
    const sauceIds = f.sauceIds.filter((x) => x !== id);
    const toppingIds = f.toppingIds.filter((x) => x !== id);
    if (
      sauceIds.length !== f.sauceIds.length ||
      toppingIds.length !== f.toppingIds.length
    )
      await db.flavour.update({
        where: { id: f.id },
        data: { sauceIds, toppingIds },
      });
  }

  await db.extra.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
