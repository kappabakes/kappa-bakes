import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";
import {
  buildCancelledEmail,
  refundLine,
  sendStatusEmail,
} from "@/lib/notify-status";
import { OrderStatus } from "@prisma/client";
import { runStockAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/** Shown to the customer on the tracking page, so keep it plain. */
/**
 * Not exported: a route file may only export request handlers, and anything
 * else fails the build. Nothing outside this file needs it.
 */
const CANCEL_REASONS: Record<string, string> = {
  CUSTOMER: "Cancelled at your request",
  OTHER: "Cancelled by Kappa Bakes",
};

/**
 * Cancel an order.
 *
 * The order stays on the day and carries into the archive — you need the
 * record — but its slices go straight back on sale.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    id: string;
    reason?: "CUSTOMER" | "OTHER";
    note?: string;
    undo?: boolean;
    sendEmail?: boolean;
    refund?: "NONE" | "FULL" | "PARTIAL" | "NOTHING_PAID";
    refundPence?: number;
  };
  const { id, reason, note, undo } = b;

  const order = await db.order.findUnique({ where: { id } });
  if (!order)
    return NextResponse.json({ error: "No such order." }, { status: 404 });

  if (undo) {
    await db.order.update({
      where: { id },
      data: {
        status: OrderStatus.PAID,
        cancelledAt: null,
        cancelReason: null,
        cancelNote: null,
      },
    });
    await db.orderEvent.create({
      data: { orderId: id, kind: "Cancellation undone", detail: null },
    });
    return NextResponse.json({ ok: true, undone: true });
  }

  if (!reason || !CANCEL_REASONS[reason])
    return NextResponse.json({ error: "Pick a reason." }, { status: 400 });

  if (reason === "OTHER" && !note?.trim())
    return NextResponse.json(
      { error: "Say why it was cancelled." },
      { status: 400 }
    );

  const at = new Date();
  await db.order.update({
    where: { id },
    data: {
      status: OrderStatus.CANCELLED,
      cancelledAt: at,
      cancelReason: reason,
      cancelNote: note?.trim() || null,
    },
  });

  await db.orderEvent.create({
    data: {
      orderId: id,
      kind: "Cancelled",
      detail: [
        reason === "CUSTOMER" ? "At the customer's request" : "By Kappa Bakes",
        note?.trim() ? `— ${note.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    },
  });

  /*
   * Only when you ask for one. Whether to tell someone depends entirely on
   * why it was cancelled, and a surprise email after you've already sorted
   * it by message is worse than none.
   */
  if (b.sendEmail) {
    const status = await sendStatusEmail(
      order.email,
      buildCancelledEmail(
        order.firstName,
        refundLine(b.refund ?? "NONE", order.totalPence, b.refundPence),
        order.orderNo
      )
    );
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        kind: "Cancellation email sent",
        detail: `Email ${status}.`,
      },
    });
  }

  // The slices are back on sale, so anyone waiting should hear.
  await runStockAlerts();

  return NextResponse.json({ ok: true, cancelledAt: at });
}
