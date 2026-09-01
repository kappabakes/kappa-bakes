import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, generateFromSlots } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * Undoes deletions. A date you delete is remembered so the weekly schedule
 * can't put it back — which is right, until you change your mind. This clears
 * that memory and regenerates from your weekly pattern.
 */
export async function POST() {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  let cleared = 0;
  try {
    const result = await db.suppressedDate.deleteMany({});
    cleared = result.count;
  } catch {
    // Table isn't there yet — nothing was suppressed, so nothing to clear.
  }

  try {
    const made = await generateFromSlots();
    return NextResponse.json({ ok: true, cleared, made });
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't regenerate: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
