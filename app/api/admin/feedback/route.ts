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
