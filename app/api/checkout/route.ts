import { NextResponse } from "next/server";
import {
  db,
  flavourStock,
  slicesLeft,
  maxOrderSize,
  nextOrderNo,
  midnightUtc,
  pastCutoff,
} from "@/lib/stock";
import { getStripe } from "@/lib/stripe";
import { normaliseMobile } from "@/lib/notify";
import { priceSlices, describeSlice } from "@/lib/extras";
import { maxPerOrder } from "@/lib/settings";
import {
  RESERVATION_MINUTES,
  SHOP,
  shortDay,
  NO_SHOW_SHORT,
  ALLERGEN_NOTICE,
} from "@/lib/config";

export const dynamic = "force-dynamic";

type Incoming = {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  dayIso: string;
  policyAccepted: boolean;
  allergenAccepted: boolean;
  marketingOptIn?: boolean;
  /// Only honoured when TEST_MODE is on. Skips payment entirely.
  testMode?: boolean;
  slices: {
    flavourId: string;
    toppings: string | null;
    extraSauce?: string | null;
    addedSauceId?: string | null;
    addedToppingIds?: string[];
  }[];
};

class Sold extends Error {}
const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    // Anything unexpected still answers in JSON, so the order page can say
    // what happened instead of hanging on a page it can't parse.
    console.error("checkout error", e);
    return NextResponse.json(
      {
        error:
          "Something went wrong at our end and your order wasn't taken. Nothing has been charged.",
      },
      { status: 500 }
    );
  }
}

async function handle(req: Request) {
  const body = (await req.json()) as Incoming;

  if (!body.firstName?.trim() || !body.lastName?.trim())
    return bad("Please give your first and last name.");
  if (!/^\S+@\S+\.\S+$/.test(body.email ?? ""))
    return bad("That email address doesn't look right.");
  const mobile = normaliseMobile(body.mobile ?? "");
  if (!/^\+447\d{9}$/.test(mobile))
    return bad("Please enter a UK mobile number.");
  if (!body.slices?.length) return bad("Pick at least one slice.");
  if (!body.policyAccepted || !body.allergenAccepted)
    return bad("Please tick both boxes before paying.");

  const day = midnightUtc(body.dayIso);
  if (isNaN(day.getTime())) return bad("Pick a collection day.");

  // Prices and allergens come from the database, never from the browser.
  const flavourIds = [...new Set(body.slices.map((s) => s.flavourId))];
  const flavours = await db.flavour.findMany({
    where: { id: { in: flavourIds }, active: true },
  });
  if (flavours.length !== flavourIds.length)
    return bad("One of those flavours is no longer available.");

  // A flavour can carry its own per-order limit — a weekly special, say.
  for (const f of flavours) {
    if (!f.maxPerOrder) continue;
    const wanted = body.slices.filter((s) => s.flavourId === f.id).length;
    if (wanted > f.maxPerOrder)
      return bad(
        `${f.name} is limited to ${f.maxPerOrder} per order.`,
        409
      );
  }

  const { lines, error: priceError } = await priceSlices(body.slices);
  if (priceError) return bad(priceError, 409);

  const totalPence = lines.reduce((n, l) => n + l.pricePence, 0);

  const cap = await maxPerOrder();

  let orderId: string;
  let orderNo: string;
  try {
    const result = await db.$transaction(async (tx) => {
      // LOCK THE DAY FIRST.
      //
      // Without this, two checkouts a millisecond apart can both read "2 left"
      // before either writes, and both succeed — Postgres' default isolation
      // does not stop that. SELECT ... FOR UPDATE makes every checkout for a
      // given day queue behind the one in front, so the count each of them
      // reads already includes the order ahead of it.
      //
      // This is the line that makes double-selling impossible rather than
      // merely unlikely.
      await tx.$queryRaw`SELECT id FROM "CollectionDay" WHERE day = ${day} FOR UPDATE`;

      if (await pastCutoff(day, tx as never))
        throw new Sold(
          "Orders for that day have closed — everything is baked to order the day before. Please pick another date."
        );

      // A flavour with its own stock can sell out while the day still has
      // slices. Checked here, inside the lock, like everything else.
      const stock = await flavourStock(day);
      for (const f of flavours) {
        const wanted = body.slices.filter((s) => s.flavourId === f.id).length;
        const available = stock[f.id]?.left;
        if (available !== null && available !== undefined && wanted > available)
          throw new Sold(
            available === 0
              ? `${f.name} has sold out for that date.`
              : `Only ${available} ${f.name} left for that date.`
          );
      }

      // A flavour with its own stock was checked above, against its own
      // pool. Only the rest count against the day's general pool — otherwise
      // ordering a special would fail on a day whose general slices are gone.
      const generalWanted = lines.filter(
        (l) => stock[l.flavourId]?.stock == null
      ).length;

      const left = await slicesLeft(day, tx as never);
      if (generalWanted > 0 && left <= 0)
        throw new Sold("This day has just sold out.");
      if (generalWanted > left)
        throw new Sold(
          `Only ${left} slice${left === 1 ? "" : "s"} left of that. Please reduce your order.`
        );

      // The date's own limit beats the shop-wide one, and the tail rule still
      // trims it as the day fills up.
      const dayRow = await tx.collectionDay.findUnique({ where: { day } });
      const allowed = maxOrderSize(
        Math.max(left, lines.length),
        dayRow?.maxPerOrder ?? cap
      );
      if (lines.length > allowed)
        throw new Sold(
          `Orders are capped at ${allowed} slice${allowed === 1 ? "" : "s"} for that date. Please reduce your order.`
        );

      const no = await nextOrderNo(tx as never);
      const order = await tx.order.create({
        data: {
          orderNo: no,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          mobile,
          email: body.email.trim(),
          day,
          slices: lines,
          sliceCount: lines.length,
          totalPence,
          // Matches the Stripe session's own expiry, so slices are never
          // released while the customer can still pay for them.
          reservedUntil: new Date(
            Date.now() + Math.max(RESERVATION_MINUTES, 30) * 60_000
          ),
          policyAcceptedAt: new Date(),
          policyText: NO_SHOW_SHORT,
          allergenAcceptedAt: new Date(),
          allergenText: ALLERGEN_NOTICE,
          ipAddress:
            req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
          userAgent: req.headers.get("user-agent") ?? null,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          kind: "Placed",
          detail: `${lines.length} slice(s), ${(totalPence / 100).toFixed(2)} GBP. Collection and allergen notices accepted.`,
        },
      });

      return { id: order.id, no };
    },
    // A checkout should never wait long behind another; if the queue is
    // genuinely that busy, failing fast and asking them to retry is better
    // than a hung page.
    { timeout: 10_000, maxWait: 8_000 });
    orderId = result.id;
    orderNo = result.no;
  } catch (e) {
    if (e instanceof Sold) return bad(e.message, 409);
    throw e;
  }

  // Stripe needs an absolute URL to redirect back to. Our own pages don't —
  // a relative path always works, even if this variable is unset.
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ?? "";

  /**
   * TEST MODE. Marks the order paid on the spot and jumps to the confirmation
   * screen, so the whole flow after payment — tracking, editing, resending,
   * no-show, collected — can be rehearsed without Stripe or a card.
   * Guarded by the environment variable, so it cannot happen in production.
   */
  if (body.testMode && process.env.TEST_MODE?.trim() === "true") {
    const { markPaid } = await import("@/lib/confirm");
    await db.order.update({
      where: { id: orderId },
      data: { isTest: true, reservedUntil: null },
    });
    await markPaid(orderId, null, Boolean(body.marketingOptIn));
    return NextResponse.json({
      url: `/order/confirmed?ok=${orderNo}`,
      orderNo,
    });
  }

  if (!site)
    return bad(
      "The site address isn't configured, so Stripe can't send customers back. Set NEXT_PUBLIC_SITE_URL.",
      500
    );

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: body.email.trim(),
    line_items: lines.map((l) => ({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: l.pricePence,
        product_data: {
          name: l.flavour,
          description:
            describeSlice(l).join(" · ") || "Collection only",
        },
      },
    })),
    metadata: {
      orderId,
      orderNo,
      marketingOptIn: body.marketingOptIn ? "1" : "0",
    },
    // Stripe's own minimum is 30 minutes. Clamped so a shorter reservation
    // window can never produce a session Stripe refuses to create.
    expires_at:
      Math.floor(Date.now() / 1000) + Math.max(RESERVATION_MINUTES, 30) * 60,
    success_url: `${site}/order/confirmed?ok=${orderNo}`,
    // The session id comes back so the order page can tell Stripe the
    // session is over, rather than waiting out its 30-minute expiry with the
    // slices held.
    cancel_url: `${site}/order?cancelled=1&session_id={CHECKOUT_SESSION_ID}`,
    payment_intent_data: {
      description: `${SHOP.name} ${orderNo} — ${shortDay(day)} collection`,
    },
    custom_text: { submit: { message: NO_SHOW_SHORT } },
  });

  await db.order.update({
    where: { id: orderId },
    data: { stripeSessionId: session.id },
  });

  // The session id goes back so the browser can remember it. Stripe's own
  // back link returns it in the URL, but a browser back button doesn't — and
  // that's the more common way out.
  return NextResponse.json({ url: session.url, orderNo, sessionId: session.id });
}
