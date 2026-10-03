import { NextResponse } from "next/server";
import { db } from "@/lib/stock";
import { PREP_DAYS_AHEAD, sendPrepEmail } from "@/lib/prep";
import { isUkHour, ukHourNow, ukDateIn } from "@/lib/uk-time";

export const dynamic = "force-dynamic";

/**
 * Your shopping list, two days before a collection date.
 *
 * Scheduled twice — 06:00 and 07:00 UTC — and does nothing unless it's
 * actually 7am in London. Vercel's scheduler only speaks UTC, and 7am shifts
 * by an hour when the clocks change; two cheap runs is simpler than getting
 * it wrong for half the year.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const manual = url.searchParams.get("manual") === "true";
  const auth = req.headers.get("authorization");

  if (!manual && auth !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Nope", { status: 401 });

  // 7am in London, all year.
  if (!isUkHour(7, manual))
    return NextResponse.json({ skipped: `It's ${ukHourNow()}:00 in London` });

  /*
   * Normally two days ahead. `?date=YYYY-MM-DD` overrides it, which is the
   * only sane way to test — otherwise you'd have to have an order sitting
   * exactly two days out.
   */
  const target =
    url.searchParams.get("date") ??
    ukDateIn(PREP_DAYS_AHEAD);

  // Once per date, however many times this runs.
  const key = `prepSent:${target}`;
  const already = await db.setting.findUnique({ where: { key } });
  if (already && !manual)
    return NextResponse.json({ skipped: "Already sent for that date" });

  const result = await sendPrepEmail(target);

  if (result.sent)
    await db.setting.upsert({
      where: { key },
      create: { key, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });

  return NextResponse.json({ for: target, ...result });
}
