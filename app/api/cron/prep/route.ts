import { NextResponse } from "next/server";
import { db } from "@/lib/stock";
import { PREP_DAYS_AHEAD, sendPrepEmail } from "@/lib/prep";

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

  const ukHour = Number(
    new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    })
  );

  if (!manual && ukHour !== 7)
    return NextResponse.json({ skipped: `It's ${ukHour}:00 in London` });

  const target = new Date(
    Date.now() + PREP_DAYS_AHEAD * 24 * 60 * 60 * 1000
  ).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

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
