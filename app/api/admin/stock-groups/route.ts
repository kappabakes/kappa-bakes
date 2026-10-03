import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

/**
 * Stock groups — flavours cut from the same cheesecake.
 *
 * A flavour belongs to at most one, which is enforced here rather than left
 * to the screen: a slice can't come from two cakes, and a flavour in two
 * groups would have two different answers for how many are left.
 */
export async function GET() {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  const [groups, flavours] = await Promise.all([
    db.stockGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.flavour.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, stockGroupId: true, stockPerDay: true },
    }),
  ]);

  return NextResponse.json({ groups, flavours });
}

/** Create or rename, and set which flavours are in it. */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    id?: string;
    name: string;
    stock: number;
    active?: boolean;
    flavourIds?: string[];
  };

  if (!b.name?.trim())
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });

  const data = {
    name: b.name.trim(),
    stock: Math.max(1, Math.floor(Number(b.stock) || 8)),
    active: b.active ?? true,
  };

  const group = b.id
    ? await db.stockGroup.update({ where: { id: b.id }, data })
    : await db.stockGroup.create({ data });

  if (b.flavourIds) {
    // Anything dropped from the group goes back to its own stock.
    await db.flavour.updateMany({
      where: { stockGroupId: group.id, id: { notIn: b.flavourIds } },
      data: { stockGroupId: null },
    });
    await db.flavour.updateMany({
      where: { id: { in: b.flavourIds } },
      data: { stockGroupId: group.id },
    });
  }

  return NextResponse.json({ ok: true, group });
}

/**
 * Removes a group. The flavours in it aren't touched beyond losing their
 * share — they go back to their own stock, which is the safe direction.
 */
export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  await db.flavour.updateMany({
    where: { stockGroupId: id },
    data: { stockGroupId: null },
  });
  await db.dayGroupStock.deleteMany({ where: { groupId: id } });
  await db.stockGroup.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
