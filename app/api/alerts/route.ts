import { NextResponse } from "next/server";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

/** Join the list for a sold-out flavour. */
export async function POST(req: Request) {
  const b = (await req.json()) as {
    email: string;
    flavourId: string;
    /// Null for any date.
    dayIso?: string | null;
    repeating?: boolean;
  };

  const email = (b.email ?? "").trim().toLowerCase();
  if (!email.includes("@") || !b.flavourId)
    return NextResponse.json(
      { error: "We need an email address." },
      { status: 400 }
    );

  const flavour = await db.flavour.findUnique({
    where: { id: b.flavourId },
    select: { id: true },
  });
  if (!flavour)
    return NextResponse.json({ error: "No such flavour." }, { status: 404 });

  const day = b.dayIso ? new Date(b.dayIso) : null;

  // Asking twice shouldn't mean two emails — the later choice wins.
  const existing = await db.stockAlert.findFirst({
    where: { email, flavourId: b.flavourId, day },
  });

  if (existing) {
    await db.stockAlert.update({
      where: { id: existing.id },
      data: { repeating: b.repeating ?? false },
    });
    return NextResponse.json({ ok: true, already: true });
  }

  await db.stockAlert.create({
    data: {
      email,
      flavourId: b.flavourId,
      day,
      repeating: b.repeating ?? false,
    },
  });

  return NextResponse.json({ ok: true });
}

/** The unsubscribe link in the email. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });

  // Already gone is a success as far as the person is concerned.
  await db.stockAlert.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
