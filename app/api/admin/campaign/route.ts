import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";
import { audience, sendCampaign, Segment, SEGMENTS } from "@/lib/marketing";

export const dynamic = "force-dynamic";

const authed = () => Boolean(currentAdmin());

/** Segment sizes and the last few sends, for the composer. */
export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  const sizes = await Promise.all(
    SEGMENTS.map(async (s) => ({
      ...s,
      size: (await audience(s.id)).length,
    }))
  );
  const [total, optedOut] = await Promise.all([
    db.customer.count(),
    db.customer.count({ where: { unsubscribedAt: { not: null } } }),
  ]);
  const history = await db.campaign.findMany({
    orderBy: { sentAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ segments: sizes, total, optedOut, history });
}

export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const { segment, subject, body } = (await req.json()) as {
    segment: Segment;
    subject: string;
    body: string;
  };
  if (!subject?.trim() || !body?.trim())
    return NextResponse.json(
      { error: "A campaign needs a subject and a message." },
      { status: 400 }
    );

  const result = await sendCampaign(segment, subject.trim(), body.trim());
  return NextResponse.json(result);
}
