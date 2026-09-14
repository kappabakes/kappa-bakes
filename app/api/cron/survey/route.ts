import { NextResponse } from "next/server";
import { db } from "@/lib/stock";
import { newSurveyToken } from "@/lib/survey";
import { sendSurveyEmail } from "@/lib/notify-survey";
import { OrderStatus, WholeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Asks yesterday's customers how it was. Runs at noon (see vercel.json) —
 * early enough to catch the day, late enough that people are awake.
 *
 * Only orders actually collected. Nobody who cancelled or didn't turn up
 * gets asked how their cheesecake was.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const manual = new URL(req.url).searchParams.get("manual") === "true";

  if (!manual && auth !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Nope", { status: 401 });

  // Yesterday, in UK terms.
  const { ukWallTimeToUtc } = await import("@/lib/whole");
  const yesterdayUk = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  const start = ukWallTimeToUtc(yesterdayUk, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [slices, wholes] = await Promise.all([
    db.order.findMany({
      where: {
        day: { gte: start, lt: end },
        status: OrderStatus.COLLECTED,
        surveySentAt: null,
        email: { not: "" },
      },
      select: { id: true, firstName: true, email: true },
    }),
    db.wholeOrder.findMany({
      where: {
        collectAt: { gte: start, lt: end },
        status: WholeStatus.COLLECTED,
        surveySentAt: null,
      },
      select: { id: true, firstName: true, email: true },
    }),
  ]);

  let sent = 0;

  for (const o of slices) {
    const token = newSurveyToken();
    await db.order.update({
      where: { id: o.id },
      data: { surveyToken: token, surveySentAt: new Date() },
    });
    if ((await sendSurveyEmail(o.email, o.firstName, token)) === "Sent") sent++;
  }

  for (const o of wholes) {
    const token = newSurveyToken();
    await db.wholeOrder.update({
      where: { id: o.id },
      data: { surveyToken: token, surveySentAt: new Date() },
    });
    if ((await sendSurveyEmail(o.email, o.firstName, token)) === "Sent") sent++;
  }

  /*
   * When nothing qualifies, say what's actually on that date and how it
   * failed the test — "asked: 0" on its own sends you hunting.
   */
  let why: string | undefined;
  if (slices.length + wholes.length === 0) {
    const onDate = await db.order.count({
      where: { day: { gte: start, lt: end } },
    });
    const collected = await db.order.count({
      where: {
        day: { gte: start, lt: end },
        status: OrderStatus.COLLECTED,
      },
    });
    // Whole orders were the omission last time: reporting the slice count
    // only sends you looking in the wrong place.
    const [wholeOnDate, wholeCollected, wholeAlreadyAsked, sliceAlreadyAsked] =
      await Promise.all([
        db.wholeOrder.count({ where: { collectAt: { gte: start, lt: end } } }),
        db.wholeOrder.count({
          where: {
            collectAt: { gte: start, lt: end },
            status: WholeStatus.COLLECTED,
          },
        }),
        db.wholeOrder.count({
          where: {
            collectAt: { gte: start, lt: end },
            surveySentAt: { not: null },
          },
        }),
        db.order.count({
          where: { day: { gte: start, lt: end }, surveySentAt: { not: null } },
        }),
      ]);

    why =
      `On ${yesterdayUk}: ` +
      `slices — ${onDate} order(s), ${collected} collected, ${sliceAlreadyAsked} already asked. ` +
      `Whole cakes — ${wholeOnDate} order(s), ${wholeCollected} collected, ${wholeAlreadyAsked} already asked. ` +
      `Only collected orders are asked, and only once each.`;
  }

  return NextResponse.json({
    asked: slices.length + wholes.length,
    sent,
    for: yesterdayUk,
    ...(why ? { why } : {}),
  });
}
