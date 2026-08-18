import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * Sets the order flavours appear in, everywhere they're listed — the menu,
 * the ordering page, the admin. Send the ids in the order you want them.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 });

  await db.$transaction(
    ids.map((id, index) =>
      db.flavour.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
