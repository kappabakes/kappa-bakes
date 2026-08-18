import { NextResponse } from "next/server";
import { db, openDays } from "@/lib/stock";
import { SHOP, NUDGE_HOURS_BEFORE_CUTOFF } from "@/lib/config";
import { sendCampaign } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/**
 * Runs hourly (see vercel.json) and decides for itself whether there's
 * anything worth saying.
 *
 * The trigger is the CUT-OFF, not a day of the week. A nudge is only useful
 * while someone can still act on it, and how long that is depends entirely on
 * when you closed ordering — which changes date to date. So: fires in the few
 * hours before orders close, and only if enough slices remain that "running
 * low" is honest.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Nope", { status: 401 });

  const rows = await openDays();

  const nudgeable = rows.filter((r) => {
    if (r.left <= 0) return false;
    if (!r.cutoffIso) return false;

    // Hours until ordering closes for that date.
    const hours = (new Date(r.cutoffIso).getTime() - Date.now()) / 3_600_000;

    // The window: late enough to be urgent, early enough to be actionable.
    // Hourly runs mean this catches each date once as it passes through.
    const inWindow = hours > 0 && hours <= NUDGE_HOURS_BEFORE_CUTOFF;

    // And only when it's true. A nudge about a half-empty day is just noise.
    const runningLow = r.left <= r.capacity * 0.4;

    return inWindow && runningLow;
  });

  if (!nudgeable.length)
    return NextResponse.json({ sent: false, reason: "Nothing worth saying" });

  // Hourly runs would otherwise send the same nudge five times. One per date,
  // ever.
  const already = await db.collectionDay.findMany({
    where: {
      day: { in: nudgeable.map((r) => new Date(r.iso)) },
      nudgeSentAt: { not: null },
    },
    select: { day: true },
  });
  const done = new Set(already.map((d) => d.day.getTime()));
  const toSend = nudgeable.filter((r) => !done.has(new Date(r.iso).getTime()));

  if (!toSend.length)
    return NextResponse.json({ sent: false, reason: "Already nudged" });

  const lines = toSend.map(
    (r) => `${r.label}: ${r.left} slice${r.left === 1 ? "" : "s"} left`
  );

  const result = await sendCampaign(
    "all",
    "Last few slices left",
    [
      "Hi {name},",
      "",
      "We're down to the last few:",
      "",
      ...lines,
      "",
      // No address here — that goes out with the confirmation, once someone
      // has actually ordered.
      `Order at ${process.env.NEXT_PUBLIC_SITE_URL} — collection only.`,
      "",
      SHOP.name,
    ].join("\n")
  );

  await db.collectionDay.updateMany({
    where: { day: { in: toSend.map((r) => new Date(r.iso)) } },
    data: { nudgeSentAt: new Date() },
  });

  return NextResponse.json({ sent: true, ...result });
}
