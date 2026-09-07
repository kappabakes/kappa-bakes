import { NextResponse } from "next/server";
import { db, dayWindow, midnightUtc,
  todayUk,
} from "@/lib/stock";
import { currentStage, STAGES, stageIndex } from "@/lib/status";
import { summarise, SliceLine } from "@/lib/notify";
import {
  money,
  dayLabel,
  NO_SHOW_POLICY,
  SOCIALS,
  orderQuery,
} from "@/lib/config";
import { collectionAddress } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Order number alone would be guessable — they run KB001 to KB999. Surname is
 * asked for as well so a stranger can't read someone else's order.
 *
 * Only orders for a collection date that hasn't passed can be found. Numbers
 * wrap at 999, so an archived KB001 and a live KB001 can both exist; without
 * this, the wrong one could surface. Past orders are yours to find in the
 * admin, not the customer's.
 */
export async function POST(req: Request) {
  const { orderNo, lastName } = (await req.json()) as {
    orderNo: string;
    lastName: string;
  };

  const order = await db.order.findFirst({
    where: {
      orderNo: { equals: orderNo?.trim().toUpperCase(), mode: "insensitive" },
      lastName: { equals: lastName?.trim(), mode: "insensitive" },
      status: { in: ["PAID", "COLLECTED", "NO_SHOW", "CANCELLED"] },
      day: { gte: todayUk() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!order)
    return NextResponse.json(
      {
        error:
          "No current order matches that number and surname. Orders can only be tracked up to their collection day.",
      },
      { status: 404 }
    );

  const window = await dayWindow(order.day);
  const dayRow = await db.collectionDay.findUnique({
    where: { day: order.day },
  });
  const stage = currentStage(
    order.status,
    order.day,
    dayRow?.startTime ?? "2:00 PM"
  );

  return NextResponse.json({
    orderNo: order.orderNo,
    name: order.firstName,
    lastName: order.lastName,
    stage,
    stageIndex: stageIndex(stage),
    stages: STAGES,
    day: dayLabel(order.day),
    window,
    address: await collectionAddress(),
    lines: summarise(order.slices as unknown as SliceLine[]),
    total: money(order.totalPence),
    policy: NO_SHOW_POLICY,
    isTest: order.isTest,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    cancelNote: order.cancelNote,
    links: {
      instagram: SOCIALS.instagram.url,
      snapchat: SOCIALS.snapchat.url,
      whatsapp: orderQuery({
        orderNo: order.orderNo,
        lastName: order.lastName,
        day: order.day,
      }),
    },
  });
}
