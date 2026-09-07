import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";
import { collectionAddress } from "@/lib/settings";
import { ALLERGEN_NOTICE } from "@/lib/config";
import { normaliseItem, WholeItem } from "@/lib/whole";
import { notifyWhole } from "@/lib/notify-whole";
import { WholeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

/**
 * Whole-cheesecake orders. Entirely separate from slice orders: no order
 * numbers, no stock, no collection-day capacity.
 *
 * `?archive=1` returns everything past, `?q=` searches by name, mobile or
 * email across the lot.
 */
export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  const url = new URL(req.url);
  const archive = url.searchParams.get("archive") === "1";
  const q = (url.searchParams.get("q") ?? "").trim();

  const now = new Date();

  const orders = await db.wholeOrder.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { mobile: { contains: q } },
            ],
          }
        : {}),
      // Upcoming is anything not yet collected or cancelled that's still to
      // come. Everything else belongs in the archive.
      ...(q
        ? {}
        : archive
          ? {
              OR: [
                { collectAt: { lt: now } },
                { status: { in: [WholeStatus.COLLECTED, WholeStatus.CANCELLED] } },
              ],
            }
          : {
              collectAt: { gte: now },
              status: WholeStatus.CONFIRMED,
            }),
    },
    orderBy: { collectAt: archive || q ? "desc" : "asc" },
    take: 200,
  });

  return NextResponse.json({ orders });
}

/** Create, or update when an id is given. */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    collectAtIso: string;
    items: WholeItem[];
    totalPence: number;
    depositPence: number;
    notes?: string;
    allergensDiscussed?: boolean;
    notify?: boolean;
  };

  if (!b.firstName?.trim() || !b.lastName?.trim())
    return NextResponse.json({ error: "Name is needed." }, { status: 400 });
  if (!b.email?.trim())
    return NextResponse.json({ error: "Email is needed." }, { status: 400 });
  if (!b.mobile?.trim())
    return NextResponse.json({ error: "Mobile is needed." }, { status: 400 });
  if (!b.collectAtIso)
    return NextResponse.json(
      { error: "Collection date and time are needed." },
      { status: 400 }
    );

  const items = (b.items ?? []).filter((i) => i.flavour).map(normaliseItem);
  if (!items.length)
    return NextResponse.json(
      { error: "Add at least one cheesecake." },
      { status: 400 }
    );

  if (b.depositPence > b.totalPence)
    return NextResponse.json(
      { error: "The deposit can't be more than the order total." },
      { status: 400 }
    );

  const data = {
    firstName: b.firstName.trim(),
    lastName: b.lastName.trim(),
    email: b.email.trim(),
    mobile: b.mobile.trim(),
    collectAt: new Date(b.collectAtIso),
    items: items as unknown as object,
    totalPence: Math.max(0, Math.round(b.totalPence)),
    depositPence: Math.max(0, Math.round(b.depositPence)),
    notes: b.notes?.trim() || null,
    ...(b.allergensDiscussed
      ? { allergensDiscussedAt: new Date(), allergenText: ALLERGEN_NOTICE }
      : {}),
  };

  const order = b.id
    ? await db.wholeOrder.update({ where: { id: b.id }, data })
    : await db.wholeOrder.create({ data });

  // Confirmation goes out on request — on by default when creating, off by
  // default when editing, so a typo fix doesn't email them again.
  if (b.notify !== false) {
    const { emailStatus, smsStatus } = await notifyWhole({
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.email,
      mobile: order.mobile,
      collectAt: order.collectAt,
      items: order.items as unknown as WholeItem[],
      totalPence: order.totalPence,
      depositPence: order.depositPence,
      address: await collectionAddress(),
    });

    await db.wholeOrder.update({
      where: { id: order.id },
      data: { emailStatus, smsStatus, confirmSentAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, order });
}

/** Collected, cancelled, or back to confirmed. */
export async function PATCH(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    id: string;
    status?: "CONFIRMED" | "COLLECTED" | "CANCELLED";
    cancelReason?: string;
    cancelNote?: string;
  };

  const existing = await db.wholeOrder.findUnique({ where: { id: b.id } });
  if (!existing)
    return NextResponse.json({ error: "No such order." }, { status: 404 });

  const order = await db.wholeOrder.update({
    where: { id: b.id },
    data: {
      ...(b.status
        ? {
            status: b.status as WholeStatus,
            collectedAt: b.status === "COLLECTED" ? new Date() : null,
            cancelledAt: b.status === "CANCELLED" ? new Date() : null,
            cancelReason: b.status === "CANCELLED" ? (b.cancelReason ?? null) : null,
            cancelNote: b.status === "CANCELLED" ? (b.cancelNote ?? null) : null,
          }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, order });
}

export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  await db.wholeOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
