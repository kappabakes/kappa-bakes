import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, dayWindow } from "@/lib/stock";
import { SliceLine } from "@/lib/notify";
import { money, shortDay, SHOP, dayLabel } from "@/lib/config";
import { collectionAddress } from "@/lib/settings";

export const dynamic = "force-dynamic";

const authed = () => Boolean(currentAdmin());

export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  const order = await db.order.findUnique({
    where: { id },
    include: { events: { orderBy: { at: "asc" } } },
  });
  if (!order) return new NextResponse("No such order", { status: 404 });

  const window = await dayWindow(order.day);
  const slices = order.slices as unknown as (SliceLine & {
    pricePence: number;
  })[];

  return NextResponse.json({
    shop: SHOP,
    orderNo: order.orderNo,
    status: order.status,
    customer: {
      name: `${order.firstName} ${order.lastName}`,
      email: order.email,
      mobile: order.mobile,
    },
    collection: {
      day: dayLabel(order.day),
      shortDay: shortDay(order.day),
      window,
      address: await collectionAddress(),
    },
    slices: slices.map((s) => ({
      flavour: s.flavour,
      toppings: s.toppings ?? "—",
      price: money(s.pricePence),
    })),
    total: money(order.totalPence),
    customerNote: order.notes,
    adminNote: order.adminNotes,
    payment: {
      stripeSessionId: order.stripeSessionId,
      stripePaymentId: order.stripePaymentId,
      placedAt: order.createdAt,
      confirmSentAt: order.confirmSentAt,
      emailStatus: order.emailStatus,
      smsStatus: order.smsStatus,
    },
    allergens: {
      acceptedAt: order.allergenAcceptedAt,
      text: order.allergenText,
    },
    cancellation: order.cancelledAt
      ? {
          at: order.cancelledAt,
          reason: order.cancelReason,
          note: order.cancelNote,
        }
      : null,
    policy: {
      acceptedAt: order.policyAcceptedAt,
      text: order.policyText,
      ipAddress: order.ipAddress,
      userAgent: order.userAgent,
    },
    events: order.events.map((e) => ({
      kind: e.kind,
      detail: e.detail,
      at: e.at,
    })),
  });
}
