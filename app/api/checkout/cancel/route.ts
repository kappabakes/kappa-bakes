import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Called when someone lands back on the order page after backing out of
 * Stripe. Closes the session immediately instead of waiting out its
 * thirty-minute expiry, so the slices they were holding go back on sale in
 * seconds rather than looking sold for half an hour.
 *
 * The `checkout.session.expired` webhook does the database side. This route
 * only tells Stripe the session is finished.
 */
export async function POST(req: Request) {
  const { sessionId } = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
  };
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Only ever close a session that's still open. A completed or processing
    // one is a real payment, and this route must never be able to cancel it —
    // the session id travels in a URL, so treat it as something anyone could
    // send.
    if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
  } catch (e) {
    // Not worth surfacing: the sweep below catches anything missed, and the
    // customer is only trying to get back to the order page.
    console.error("Couldn't expire checkout session", e);
  }

  return NextResponse.json({ ok: true });
}
