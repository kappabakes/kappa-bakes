import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import {
  db,
  midnightUtc,
  nextOrderNo,
  slicesTaken,
  dayWindow,
} from "@/lib/stock";
import { normaliseMobile, notifyCustomer, SliceLine } from "@/lib/notify";
import { collectionAddress } from "@/lib/settings";
import { priceSlices } from "@/lib/extras";
import { NO_SHOW_SHORT, ALLERGEN_NOTICE } from "@/lib/config";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * An order you add yourself: a friend, a cash sale, a freebie.
 *
 * Deliberately ignores the cut-off, a paused date and a closed one — you're
 * standing in the kitchen and you know what you can make. Capacity is still
 * checked, but you can go over it knowingly.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    firstName: string;
    lastName: string;
    mobile?: string;
    email?: string;
    dayIso: string;
    slices: {
      flavourId: string;
      toppings: string | null;
      extraSauce?: string | null;
      addedSauceId?: string | null;
      addedToppingIds?: string[];
    }[];
    paymentMethod: string;
    chargePence?: number;
    note?: string;
    notify?: boolean;
    force?: boolean;
  };

  if (!b.firstName?.trim() || !b.lastName?.trim())
    return NextResponse.json({ error: "Needs a name." }, { status: 400 });
  if (!b.slices?.length)
    return NextResponse.json({ error: "Pick at least one slice." }, { status: 400 });

  const day = midnightUtc(b.dayIso);
  if (isNaN(day.getTime()))
    return NextResponse.json({ error: "Pick a collection day." }, { status: 400 });

  const dayRow = await db.collectionDay.findUnique({ where: { day } });
  if (!dayRow)
    return NextResponse.json({ error: "That date doesn't exist." }, { status: 404 });

  // Capacity is a warning, not a wall — but you have to mean it.
  const taken = await slicesTaken(day);
  const wouldBe = taken + b.slices.length;
  if (wouldBe > dayRow.capacity && !b.force)
    return NextResponse.json(
      {
        error: `That takes the day to ${wouldBe} slices, over its capacity of ${dayRow.capacity}. Confirm to add it anyway.`,
        needsForce: true,
        wouldBe,
        capacity: dayRow.capacity,
      },
      { status: 409 }
    );

  const { lines, error: priceError } = await priceSlices(b.slices);
  if (priceError)
    return NextResponse.json({ error: priceError }, { status: 409 });

  // A freebie is worth £0; a cash sale is worth what you took.
  const listPrice = lines.reduce((n, l) => n + l.pricePence, 0);
  const totalPence =
    b.paymentMethod === "Free" ? 0 : (b.chargePence ?? listPrice);

  const orderNo = await nextOrderNo();
  const order = await db.order.create({
    data: {
      orderNo,
      firstName: b.firstName.trim(),
      lastName: b.lastName.trim(),
      mobile: b.mobile ? normaliseMobile(b.mobile) : "",
      email: b.email?.trim() ?? "",
      day,
      slices: lines,
      sliceCount: lines.length,
      totalPence,
      status: OrderStatus.PAID,
      isManual: true,
      paymentMethod: b.paymentMethod,
      adminNotes: b.note?.trim() || null,
      confirmSentAt: null,
      // Recorded on your behalf, so the order record reads the same as any
      // other. You're taking the order, so you're confirming both.
      policyAcceptedAt: new Date(),
      policyText: NO_SHOW_SHORT,
      allergenAcceptedAt: new Date(),
      allergenText: ALLERGEN_NOTICE,
    },
  });

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      kind: "Added by hand",
      detail: `${b.paymentMethod}. ${lines.length} slice(s), list price £${(listPrice / 100).toFixed(2)}, recorded as £${(totalPence / 100).toFixed(2)}.`,
    },
  });

  // Only if there's somewhere to send it, and only if you asked.
  if (b.notify && (order.email || order.mobile)) {
    const [window, address] = await Promise.all([
      dayWindow(day),
      collectionAddress(),
    ]);
    const { emailStatus, smsStatus } = await notifyCustomer({
      orderNo: order.orderNo,
      firstName: order.firstName,
        lastName: order.lastName,
      email: order.email,
      mobile: order.mobile,
      day: order.day,
      window,
      slices: lines as unknown as SliceLine[],
      totalPence,
      address,
    });
    await db.order.update({
      where: { id: order.id },
      data: { confirmSentAt: new Date(), emailStatus, smsStatus },
    });
  }

  return NextResponse.json({ ok: true, orderNo, totalPence });
}
