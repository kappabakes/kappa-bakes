import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, generateFromSlots } from "@/lib/stock";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

/** "Every Saturday, 32 slices, 2-4pm." Generates dates for you to confirm. */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const b = (await req.json()) as {
    weekday: number;
    capacity: number;
    startTime: string;
    endTime: string;
    active: boolean;
  };

  const data = {
    capacity: Math.round(Number(b.capacity)) || 32,
    startTime: b.startTime || "2:00 PM",
    endTime: b.endTime || "4:00 PM",
    active: Boolean(b.active),
  };

  try {
    await db.recurringSlot.upsert({
      where: { weekday: Number(b.weekday) },
      create: { weekday: Number(b.weekday), ...data },
      update: data,
    });

    const made = await generateFromSlots();
    return NextResponse.json({ ok: true, made });
  } catch (e) {
    // A readable message beats a 500 with nothing in it.
    return NextResponse.json(
      { error: `Couldn't save that day: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const weekday = Number(new URL(req.url).searchParams.get("weekday"));
  await db.recurringSlot.delete({ where: { weekday } });
  return NextResponse.json({ ok: true });
}
