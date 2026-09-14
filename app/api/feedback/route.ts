import { NextResponse } from "next/server";
import { db } from "@/lib/stock";
import { flavoursFromSlices, flavoursFromWholeItems } from "@/lib/survey";
import { WholeItem } from "@/lib/whole";
import { FeedbackScore } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Looks up what someone ordered, so the page can offer only those flavours.
 *
 * The token identifies the order for this request and nothing more — what
 * gets stored later holds no reference to it.
 */
async function findByToken(token: string) {
  const slice = await db.order.findUnique({ where: { surveyToken: token } });
  if (slice)
    return {
      kind: "SLICE" as const,
      responded: slice.surveyResponded,
      forDate: slice.day,
      flavours: flavoursFromSlices(
        slice.slices as unknown as { flavour: string }[]
      ),
      update: (data: { surveyResponded: boolean }) =>
        db.order.update({ where: { id: slice.id }, data }),
    };

  const whole = await db.wholeOrder.findUnique({
    where: { surveyToken: token },
  });
  if (whole)
    return {
      kind: "WHOLE" as const,
      responded: whole.surveyResponded,
      forDate: whole.collectAt,
      flavours: flavoursFromWholeItems(whole.items as unknown as WholeItem[]),
      update: (data: { surveyResponded: boolean }) =>
        db.wholeOrder.update({ where: { id: whole.id }, data }),
    };

  return null;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });

  const order = await findByToken(token);
  if (!order)
    return NextResponse.json({ error: "Link not found" }, { status: 404 });

  return NextResponse.json({
    kind: order.kind,
    flavours: order.flavours,
    alreadyAnswered: order.responded,
  });
}

/**
 * Records an answer.
 *
 * Two writes that don't reference each other: the feedback row, and a flag on
 * the order saying it's been answered. Nothing joins them — which is what
 * makes the anonymity real rather than a promise.
 */
export async function POST(req: Request) {
  const b = (await req.json()) as {
    token: string;
    rating: FeedbackScore;
    flavours?: string[];
    comment?: string;
  };

  if (!b.token || !b.rating)
    return NextResponse.json({ error: "Missing details" }, { status: 400 });

  const order = await findByToken(b.token);
  if (!order)
    return NextResponse.json({ error: "Link not found" }, { status: 404 });

  // Only what they actually ordered, whatever was submitted.
  const flavours = (b.flavours ?? []).filter((f) => order.flavours.includes(f));

  await db.feedback.create({
    data: {
      rating: b.rating,
      flavours,
      comment: b.comment?.trim()?.slice(0, 2000) || null,
      kind: order.kind,
      forDate: order.forDate,
    },
  });

  // Boolean, not a timestamp — a time here could be matched against the
  // feedback row and would undo the anonymity.
  await order.update({ surveyResponded: true });

  return NextResponse.json({ ok: true });
}
