import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/stock";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Picks up abandoned checkouts that never came back — someone who closed the
 * tab, lost signal, or walked away mid-payment. Those never hit the cancel
 * page, so nothing tells Stripe the session is over and the slices stay held
 * until it expires on its own.
 *
 * Runs on a schedule (see vercel.json), and only touches sessions that have
 * been sitting open a while — long enough that a genuinely slow payer isn't
 * cut off part-way through entering their card.
 */
const ABANDONED_AFTER_MINUTES = 3;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const manual = new URL(req.url).searchParams.get("manual") === "true";

  if (!manual && auth !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Nope", { status: 401 });

  const before = new Date(Date.now() - ABANDONED_AFTER_MINUTES * 60_000);

  const stale = await db.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      stripeSessionId: { not: null },
      createdAt: { lt: before },
    },
    select: { id: true, orderNo: true, stripeSessionId: true },
  });

  if (stale.length === 0)
    return NextResponse.json({ checked: 0, released: 0 });

  const stripe = getStripe();
  let released = 0;

  for (const order of stale) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionId!
      );

      if (session.status === "open") {
        // The webhook takes it from here and frees the slices.
        await stripe.checkout.sessions.expire(order.stripeSessionId!);
        released++;
      } else if (session.status === "expired") {
        // Stripe closed it but the webhook never landed. Catch up, rather
        // than leaving slices held indefinitely.
        await db.order.updateMany({
          where: { id: order.id, status: OrderStatus.PENDING },
          data: { status: OrderStatus.CANCELLED, reservedUntil: null },
        });
        released++;
      }
      // "complete" means they paid: leave it entirely alone.
    } catch (e) {
      console.error(`Sweep failed for ${order.orderNo}`, e);
    }
  }

  return NextResponse.json({ checked: stale.length, released });
}
