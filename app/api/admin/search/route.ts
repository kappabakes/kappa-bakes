import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, midnightUtc,
  todayUk,
} from "@/lib/stock";
import { OrderStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Archive search. Every parameter is optional and they combine — pass one for
 * a broad look, pass several to narrow it. Empty parameters are ignored rather
 * than matching nothing.
 */
export async function GET(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const q = new URL(req.url).searchParams;
  const orderNo = q.get("orderNo")?.trim();
  const mobile = q.get("mobile")?.trim();
  const name = q.get("name")?.trim();
  const collectionDate = q.get("collectionDate")?.trim(); // YYYY-MM-DD
  const from = q.get("from")?.trim(); // ordered on or after
  const to = q.get("to")?.trim();
  const status = q.get("status")?.trim();
  const scope = q.get("scope") ?? "past"; // past | all

  const where: Prisma.OrderWhereInput = {
    status: {
      in: [
        OrderStatus.PAID,
        OrderStatus.COLLECTED,
        OrderStatus.NO_SHOW,
        OrderStatus.CANCELLED,
      ],
    },
  };

  if (scope === "past") where.day = { lt: todayUk() };

  if (collectionDate) {
    const d = midnightUtc(collectionDate);
    if (!isNaN(d.getTime())) where.day = d;
  }

  if (orderNo)
    where.orderNo = { contains: orderNo.toUpperCase(), mode: "insensitive" };

  if (mobile) {
    // Match however they typed it: 07…, +447…, spaces and all.
    const digits = mobile.replace(/\D/g, "").replace(/^0/, "").replace(/^44/, "");
    where.mobile = { contains: digits };
  }

  if (name)
    where.OR = [
      { firstName: { contains: name, mode: "insensitive" } },
      { lastName: { contains: name, mode: "insensitive" } },
      { email: { contains: name, mode: "insensitive" } },
    ];

  if (status && status !== "any") where.status = status as OrderStatus;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(`${from}T00:00:00Z`);
    if (to) where.createdAt.lte = new Date(`${to}T23:59:59Z`);
  }

  const orders = await db.order.findMany({
    where,
    orderBy: [{ day: "desc" }, { orderNo: "asc" }],
    take: 200,
  });

  return NextResponse.json({ orders, count: orders.length });
}
