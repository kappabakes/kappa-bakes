import { NextResponse } from "next/server";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

/** One click, no login, no "are you sure". That's the point of it. */
export async function POST(req: Request) {
  const { token } = (await req.json()) as { token: string };
  const person = await db.customer.findUnique({ where: { unsubToken: token } });
  if (!person)
    return NextResponse.json({ error: "That link has expired." }, { status: 404 });

  await db.customer.update({
    where: { unsubToken: token },
    data: { marketingOptIn: false, unsubscribedAt: new Date() },
  });
  return NextResponse.json({ ok: true, email: person.email });
}
