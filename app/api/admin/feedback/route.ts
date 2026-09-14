import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [feedback, sliceAsked, wholeAsked] = await Promise.all([
    db.feedback.findMany({
      where: { forDate: { gte: since } },
      orderBy: { forDate: "desc" },
      take: 500,
    }),
    db.order.count({ where: { surveySentAt: { gte: since } } }),
    db.wholeOrder.count({ where: { surveySentAt: { gte: since } } }),
  ]);

  return NextResponse.json({
    feedback,
    asked: sliceAsked + wholeAsked,
  });
}


/** Remove one response. */
export async function DELETE(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  await db.feedback.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/**
 * Clears every response, and lets the same orders be asked again.
 *
 * For clearing out test answers. Resetting the survey flags is the point —
 * without it those orders would be marked as already asked and you couldn't
 * test the flow twice. Only while TEST_MODE is on, so it can't be reached
 * once you're trading.
 */
export async function PUT() {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  if (process.env.TEST_MODE?.trim() !== "true")
    return NextResponse.json(
      { error: "Only available while TEST_MODE is on." },
      { status: 403 }
    );

  const { count } = await db.feedback.deleteMany({});

  await db.order.updateMany({
    where: { surveySentAt: { not: null } },
    data: { surveyToken: null, surveySentAt: null, surveyResponded: false },
  });
  await db.wholeOrder.updateMany({
    where: { surveySentAt: { not: null } },
    data: { surveyToken: null, surveySentAt: null, surveyResponded: false },
  });

  return NextResponse.json({ ok: true, deleted: count });
}
