import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db, dayWindow } from "@/lib/stock";
import { notifyCustomer, SliceLine } from "@/lib/notify";
import { OrderStatus } from "@prisma/client";
import { recordCustomer } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/**
 * Money is the source of truth. An order only becomes real here, never in the
 * browser — someone closing the tab mid-payment must not lose their slices,
 * and someone faking a success URL must not gain any.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      raw,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e) {
    return new NextResponse(`Bad signature: ${(e as Error).message}`, {
      status: 400,
    });
  }

  const session = event.data.object as {
    metadata?: { orderId?: string; marketingOptIn?: string };
    payment_intent?: string;
  };
  const orderId = session.metadata?.orderId;

  if (event.type === "checkout.session.completed" && orderId) {
    await confirm(
      orderId,
      session.payment_intent ?? null,
      session.metadata?.marketingOptIn === "1"
    );
  }

  if (
    orderId &&
    (event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed")
  ) {
    // Release the hold immediately rather than waiting it out.
    await db.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED, reservedUntil: null },
    });
  }

  return NextResponse.json({ received: true });
}

async function confirm(
  orderId: string,
  paymentIntent: string | null,
  marketingOptIn: boolean
) {
  const { markPaid } = await import("@/lib/confirm");
  await markPaid(orderId, paymentIntent, marketingOptIn);
}
