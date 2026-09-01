import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { mobile: { contains: q.replace(/\D/g, "") } },
        ],
      }
    : {};

  const customers = await db.customer.findMany({
    where,
    orderBy: [{ lastOrderAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ customers });
}


/**
 * Removes someone from the customer list.
 *
 * This deletes the marketing record only — their name, contact details and
 * running totals. Their orders are untouched: those are sales records, and
 * HMRC expects them kept for six years.
 *
 * If they order again they'll reappear, built fresh from that order. To stop
 * emails permanently, unsubscribing is the better tool — deleting loses the
 * record that they asked to be left alone.
 */
export async function DELETE(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const email = new URL(req.url).searchParams.get("email");
  if (!email) return new NextResponse("No email", { status: 400 });

  const existing = await db.customer.findUnique({ where: { email } });
  if (!existing)
    return NextResponse.json({ error: "No such customer." }, { status: 404 });

  await db.customer.delete({ where: { email } });
  return NextResponse.json({ ok: true });
}


/**
 * Unsubscribe someone on their behalf.
 *
 * People do ask by message rather than clicking the link — and if they've
 * asked, the request stands however it arrived. Doing it here records that
 * they asked, which deleting them wouldn't: a later order with the box
 * ticked would otherwise put them straight back on the list.
 *
 * Re-subscribing is possible but only for correcting a mistake. Adding
 * someone back who hasn't asked would be sending marketing without consent.
 */
export async function PATCH(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const { email, unsubscribed } = (await req.json()) as {
    email: string;
    unsubscribed: boolean;
  };

  if (!email)
    return NextResponse.json({ error: "No email given." }, { status: 400 });

  const existing = await db.customer.findUnique({ where: { email } });
  if (!existing)
    return NextResponse.json({ error: "No such customer." }, { status: 404 });

  const updated = await db.customer.update({
    where: { email },
    data: unsubscribed
      ? { unsubscribedAt: new Date(), marketingOptIn: false }
      : { unsubscribedAt: null, marketingOptIn: true },
  });

  return NextResponse.json({ ok: true, customer: updated });
}
