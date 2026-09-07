import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, midnightUtc, slicesTaken } from "@/lib/stock";
import { SLICES_PER_CAKE } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Sell the spares.
 *
 * Cakes come out in eights, so 33 slices ordered means five cakes baked and
 * seven going spare. This raises the day's capacity to the whole cakes you're
 * actually making and reopens ordering for a set number of hours — long
 * enough to shift them, short enough that nobody orders after you've left the
 * kitchen.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const { iso, hours, release } = (await req.json()) as {
    iso: string;
    hours: number;
    /// How many slices to put back on sale. Added to what's already ordered,
    /// so existing orders are never disturbed.
    release?: number;
  };
  const day = midnightUtc(iso);
  const open = Math.min(Math.max(Number(hours) || 2, 1), 48);

  const existing = await db.collectionDay.findUnique({ where: { day } });
  if (!existing)
    return NextResponse.json({ error: "No such date." }, { status: 404 });

  const taken = await slicesTaken(day);

  // Two reasons to reopen:
  //   spares  — cakes come out in eights, so 33 ordered leaves 7 going spare
  //   unsold  — the cut-off passed with slices still unsold
  const wholeCakes = Math.ceil(taken / SLICES_PER_CAKE);
  const rounded = wholeCakes * SLICES_PER_CAKE;

  // Capacity becomes what's already sold plus what you're releasing — so the
  // number you type is the number that goes on sale. Never below what's
  // already ordered, so no existing order is affected.
  // No ceiling: a cancellation or a no-show frees slices, and you might bake
  // more. The number you type is what goes on sale.
  const wanted = Number(release);
  const capacity =
    Number.isFinite(wanted) && wanted > 0
      ? taken + Math.floor(wanted)
      : Math.max(rounded, existing.capacity, taken + 1);

  const available = capacity - taken;


  const cutoff = new Date(Date.now() + open * 3_600_000);

  await db.collectionDay.update({
    where: { day },
    data: {
      capacity,
      cutoff,
      confirmed: true,
      open: true,
      note: `${available} slice${available === 1 ? "" : "s"} left — first come, first served.`,
    },
  });

  return NextResponse.json({
    ok: true,
    available,
    capacity,
    wholeCakes,
    cutoff,
  });
}

/** What a reopen would do, without doing it. */
export async function GET(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });
  const iso = new URL(req.url).searchParams.get("iso");
  if (!iso) return new NextResponse("No date", { status: 400 });

  const day = midnightUtc(iso);
  const existing = await db.collectionDay.findUnique({ where: { day } });
  const taken = await slicesTaken(day);
  const wholeCakes = Math.ceil(taken / SLICES_PER_CAKE);
  const rounded = wholeCakes * SLICES_PER_CAKE;
  const capacity = Math.max(rounded, existing?.capacity ?? rounded);

  return NextResponse.json({
    taken,
    wholeCakes,
    capacity,
    available: capacity - taken,
    // How many of those only exist because cakes come out in eights.
    spares: rounded - taken,
  });
}
