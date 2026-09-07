import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db, nextOrderNo, midnightUtc } from "@/lib/stock";
import { normaliseMobile } from "@/lib/notify";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Dummy orders for testing, and a way to clear them out. Guarded twice: an
 * admin session AND TEST_MODE. Set TEST_MODE to false before you go live and
 * every route here stops existing as far as the browser is concerned.
 */
const enabled = () => process.env.TEST_MODE?.trim() === "true";
const authed = () => Boolean(currentAdmin());
const allowed = () => authed() && enabled();

const NAMES = [
  ["Test", "Customer"],
  ["Dummy", "Order"],
  ["Sample", "Buyer"],
  ["Practice", "Run"],
];

export async function GET() {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });
  const count = await db.order.count({ where: { isTest: true } });
  return NextResponse.json({ enabled: enabled(), count });
}

export async function POST(req: Request) {
  if (!allowed()) return new NextResponse("Nope", { status: 403 });

  const { dayIso, slices, count } = (await req.json()) as {
    dayIso: string;
    slices?: { flavourId: string; toppings: string | null }[];
    count?: number;
  };

  const day = midnightUtc(dayIso);
  const howMany = Math.min(Math.max(1, count ?? 1), 20);

  // No slices given? Grab whatever's on the menu.
  let lines = slices;
  if (!lines?.length) {
    const f = await db.flavour.findFirst({ where: { active: true } });
    if (!f)
      return NextResponse.json(
        { error: "Add a flavour to the menu first." },
        { status: 400 }
      );
    lines = [{ flavourId: f.id, toppings: f.hasToppings ? "on the slice" : null }];
  }

  const flavours = await db.flavour.findMany({
    where: { id: { in: [...new Set(lines.map((l) => l.flavourId))] } },
  });

  const made: string[] = [];
  for (let i = 0; i < howMany; i++) {
    const detail = lines.map((l) => {
      const f = flavours.find((x) => x.id === l.flavourId)!;
      return {
        flavourId: f.id,
        flavour: f.name,
        toppings: f.hasToppings ? l.toppings : null,
        pricePence: f.pricePence,
        allergens: f.allergens,
      };
    });
    const total = detail.reduce((n, l) => n + l.pricePence, 0);
    const [first, last] = NAMES[i % NAMES.length];
    const orderNo = await nextOrderNo();

    const order = await db.order.create({
      data: {
        orderNo,
        firstName: first,
        lastName: `${last}${i + 1}`,
        mobile: normaliseMobile("07700900123"), // Ofcom's reserved test range
        email: "test@example.com",
        day,
        slices: detail,
        sliceCount: detail.length,
        totalPence: total,
        // Straight to PAID — the point is to rehearse everything after payment
        // without going near Stripe.
        status: OrderStatus.PAID,
        isTest: true,
        policyAcceptedAt: new Date(),
        policyText: "TEST ORDER — no policy was shown",
        allergenAcceptedAt: new Date(),
        allergenText: "TEST ORDER — no notice was shown",
      },
    });
    await db.orderEvent.create({
      data: { orderId: order.id, kind: "Test order created", detail: "No payment taken" },
    });
    made.push(orderNo);
  }

  return NextResponse.json({ ok: true, made });
}

/** ?id= one order, or ?all=true for every test order at once. */
/**
 * Reset the order numbering back to KB001.
 *
 * The counter is deliberately separate from the orders, so clearing test data
 * doesn't renumber anything — an order number is a permanent reference once a
 * customer has it. This exists for the one moment it makes sense: starting
 * real trading with a clean sequence.
 *
 * Refuses if any real order exists, because two orders sharing a number would
 * make the record ambiguous.
 */
export async function PUT() {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  if (!enabled())
    return NextResponse.json(
      { error: "Only available while TEST_MODE is on." },
      { status: 403 }
    );

  const real = await db.order.count({ where: { isTest: false } });
  if (real > 0)
    return NextResponse.json(
      {
        error: `There ${real === 1 ? "is" : "are"} ${real} real order${real === 1 ? "" : "s"} on record. Numbering can't be reset while those exist — delete or archive them first.`,
      },
      { status: 409 }
    );

  await db.counter.upsert({
    where: { id: 1 },
    create: { id: 1, value: 0 },
    update: { value: 0 },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!allowed()) return new NextResponse("Nope", { status: 403 });
  const url = new URL(req.url);

  if (url.searchParams.get("all") === "true") {
    const { count } = await db.order.deleteMany({ where: { isTest: true } });
    return NextResponse.json({ ok: true, deleted: count });
  }

  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  // Real orders are never deletable here — the sales record has to stay.
  const order = await db.order.findUnique({ where: { id } });
  if (!order?.isTest)
    return NextResponse.json(
      { error: "Only test orders can be deleted. Cancel a real one instead." },
      { status: 409 }
    );

  await db.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}


/**
 * Sets the order-number counter back to zero, so the next order is KB001.
 *
 * The counter is deliberately independent of the orders themselves — numbers
 * have to keep climbing even as old orders are archived or removed, or two
 * customers could end up sharing one. That means clearing test orders doesn't
 * reset it, which is right almost always and wrong exactly once: the moment
 * before you start trading for real.
 *
 * Refuses if any real order exists, since renumbering over a live sequence
 * would give two customers the same number.
 */
export async function PATCH() {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  if (!enabled())
    return NextResponse.json(
      { error: "Only available while TEST_MODE is on." },
      { status: 403 }
    );

  const real = await db.order.count({
    where: { isTest: false, status: { not: OrderStatus.PENDING } },
  });

  if (real > 0)
    return NextResponse.json(
      {
        error: `There ${real === 1 ? "is" : "are"} still ${real} real order${real === 1 ? "" : "s"} on the system — renumbering now could give two customers the same number. The Orders screen only shows today onwards, so check the Archive for past dates and delete ${real === 1 ? "it" : "them"} there.`,
      },
      { status: 409 }
    );

  await db.counter.upsert({
    where: { id: 1 },
    create: { id: 1, value: 0 },
    update: { value: 0 },
  });

  return NextResponse.json({ ok: true });
}
