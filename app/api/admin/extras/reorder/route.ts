import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * Sets the display order for one kind of extra from a list of ids.
 *
 * Takes the whole list rather than a single move, so the result is exactly
 * what's on screen — no chance of two quick taps leaving positions tied.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids) || !ids.length)
    return NextResponse.json({ error: "Nothing to order." }, { status: 400 });

  await db.$transaction(
    ids.map((id, i) =>
      db.extra.update({ where: { id }, data: { sortOrder: i } })
    )
  );

  return NextResponse.json({ ok: true });
}
