import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import {
  db,
  dayWindow,
  slicesLeft,
  midnightUtc,
  todayUk,
} from "@/lib/stock";
import { notifyCustomer, normaliseMobile, SliceLine } from "@/lib/notify";
import { collectionAddress } from "@/lib/settings";
import { priceSlices } from "@/lib/extras";

import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const authed = () => Boolean(currentAdmin());

export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  // ?day=ISO returns one date, including past ones — that's how the archive
  // opens a finished day. Without it you get today onwards only, so a
  // collection date drops out of Orders the moment its day is over.
  const wanted = new URL(req.url).searchParams.get("day");

  const orders = await db.order.findMany({
    where: {
      status: {
        in: [
          OrderStatus.PAID,
          OrderStatus.COLLECTED,
          OrderStatus.NO_SHOW,
          OrderStatus.CANCELLED,
        ],
      },
      day: wanted ? midnightUtc(wanted) : { gte: todayUk() },
    },
    orderBy: [{ day: "asc" }, { orderNo: "asc" }],
  });
  return NextResponse.json({ orders });
}

type Patch = {
  id: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  email?: string;
  dayIso?: string;
  status?: OrderStatus;
  adminNotes?: string;
  slices?: {
    flavourId: string;
    toppings: string | null;
    extraSauce?: string | null;
  }[];
  /// Send both, or just one — a wrong mobile shouldn't mean re-emailing.
  resend?: boolean;
  resendEmail?: boolean;
  resendSms?: boolean;
  /// Cancelling needs a reason, so the record explains itself later.
  cancel?: { reason: string; note?: string } | null;
};

/**
 * One endpoint for every change you make by hand. Editing slices recalculates
 * the total but does NOT touch Stripe — if the price moves, refund or take the
 * difference yourself and note it. Automating money movement from an admin
 * page guarded by a single password isn't worth the risk.
 */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const b = (await req.json()) as Patch;

  const existing = await db.order.findUnique({ where: { id: b.id } });
  if (!existing) return new NextResponse("No such order", { status: 404 });

  const data: Record<string, unknown> = {};
  if (b.firstName !== undefined) data.firstName = b.firstName.trim();
  if (b.lastName !== undefined) data.lastName = b.lastName.trim();
  if (b.email !== undefined) data.email = b.email.trim();
  if (b.mobile !== undefined) data.mobile = normaliseMobile(b.mobile);
  if (b.adminNotes !== undefined) data.adminNotes = b.adminNotes.trim() || null;
  if (b.status !== undefined) {
    data.status = b.status;
    // Undoing a cancellation clears the reason with it.
    if (b.status !== "CANCELLED") {
      data.cancelledAt = null;
      data.cancelReason = null;
      data.cancelNote = null;
    }
  }

  if (b.cancel) {
    if (!b.cancel.reason)
      return NextResponse.json(
        { error: "Say why it's being cancelled." },
        { status: 400 }
      );
    data.status = OrderStatus.CANCELLED;
    data.cancelledAt = new Date();
    data.cancelReason = b.cancel.reason;
    data.cancelNote = b.cancel.note?.trim() || null;
  }

  // Moving a day: check the destination can take it, so fixing someone's
  // Saturday can't quietly oversell Sunday.
  if (b.dayIso) {
    const newDay = midnightUtc(b.dayIso);
    if (newDay.getTime() !== existing.day.getTime()) {
      const need = b.slices?.length ?? existing.sliceCount;
      const left = await slicesLeft(newDay);
      if (left < need)
        return NextResponse.json(
          { error: `Only ${left} slice(s) free that day — can't move ${need}.` },
          { status: 409 }
        );
      data.day = newDay;
    }
  }

  if (b.slices) {
    const { lines, error: priceError } = await priceSlices(b.slices);
    if (priceError)
      return NextResponse.json({ error: priceError }, { status: 409 });

    data.slices = lines;
    data.sliceCount = lines.length;
    data.totalPence = lines.reduce((n, l) => n + l.pricePence, 0);
  }

  const order = await db.order.update({ where: { id: b.id }, data });

  if (b.cancel)
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        kind: "Cancelled",
        detail: [b.cancel.reason, b.cancel.note?.trim()]
          .filter(Boolean)
          .join(" — "),
      },
    });

  // Append-only trail. What changed, in plain words, so the receipt reads
  // like a record rather than a database dump.
  const changes: string[] = [];
  for (const k of ["firstName", "lastName", "email", "mobile"] as const) {
    if (data[k] !== undefined && data[k] !== existing[k])
      changes.push(`${k}: "${existing[k]}" to "${data[k]}"`);
  }
  if (data.day)
    changes.push(
      `collection day: ${existing.day.toDateString()} to ${(data.day as Date).toDateString()}`
    );
  if (data.sliceCount !== undefined)
    changes.push(
      `slices: ${existing.sliceCount} to ${data.sliceCount}, total ${(existing.totalPence / 100).toFixed(2)} to ${((data.totalPence as number) / 100).toFixed(2)} GBP`
    );
  if (data.status && data.status !== existing.status)
    changes.push(`status: ${existing.status} to ${data.status}`);

  if (changes.length)
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        kind:
          data.status && changes.length === 1
            ? `Marked ${String(data.status).toLowerCase().replace("_", "-")}`
            : "Edited",
        detail: changes.join("; "),
      },
    });

  const wantsEmail = Boolean(b.resend || b.resendEmail);
  const wantsSms = Boolean(b.resend || b.resendSms);

  if (wantsEmail || wantsSms) {
    const window = await dayWindow(order.day);
    const address = await collectionAddress();
    const { emailStatus, smsStatus } = await notifyCustomer(
      {
        orderNo: order.orderNo,
        firstName: order.firstName,
        lastName: order.lastName,
        email: order.email,
        mobile: order.mobile,
        day: order.day,
        window,
        slices: order.slices as unknown as SliceLine[],
        totalPence: order.totalPence,
        address,
      },
      true,
      { email: wantsEmail, sms: wantsSms }
    );
    await db.order.update({
      where: { id: order.id },
      data: {
        confirmSentAt: new Date(),
        ...(wantsEmail ? { emailStatus } : {}),
        ...(wantsSms ? { smsStatus } : {}),
      },
    });
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        kind: wantsEmail && wantsSms
          ? "Confirmation resent"
          : wantsEmail
            ? "Email resent"
            : "SMS resent",
        detail: [
          wantsEmail ? `Email ${emailStatus}.` : null,
          wantsSms ? `SMS ${smsStatus}.` : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
    return NextResponse.json({ ok: true, emailStatus, smsStatus });
  }

  return NextResponse.json({ ok: true });
}


/**
 * Delete an order you created yourself — a manual order or a test one.
 *
 * A real Stripe order is never deletable: money changed hands and the record
 * has to stand. Cancel those instead, and refund in Stripe.
 */
export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  const order = await db.order.findUnique({ where: { id } });
  if (!order)
    return NextResponse.json({ error: "No such order." }, { status: 404 });

  /*
   * Deleting is permanent, and for a Stripe order it removes the only record
   * on this side of a real payment — Stripe keeps its own, but your order
   * record, the policy acceptances and the event trail all go.
   *
   * It's your business and your call, so the button exists. The warning lives
   * in the admin, where you can read it before confirming.
   */
  await db.orderEvent.deleteMany({ where: { orderId: id } });
  await db.order.delete({ where: { id } });

  return NextResponse.json({ ok: true, orderNo: order.orderNo });
}
