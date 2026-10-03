import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

/** Only the two named fields, so a stray value can't reach anything else. */
const fieldOf = (v: string | null) =>
  v === "orderProof" || v === "cancelProof" ? v : null;

/**
 * Screenshots kept against an order.
 *
 * Adds to what's already there rather than replacing, so one can be uploaded
 * now and another later without losing the first.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    id: string;
    kind: "SLICE" | "WHOLE";
    field: string;
    urls: string[];
  };

  const field = fieldOf(b.field);
  if (!b.id || !field)
    return NextResponse.json({ error: "Missing details." }, { status: 400 });

  // Our own uploads only, so a link to anywhere else can't be stored here.
  const urls = (b.urls ?? []).filter((u) => /^https?:\/\//.test(u));
  if (!urls.length)
    return NextResponse.json({ error: "Nothing to add." }, { status: 400 });

  if (b.kind === "WHOLE") {
    const order = await db.wholeOrder.findUnique({ where: { id: b.id } });
    if (!order)
      return NextResponse.json({ error: "No such order." }, { status: 404 });

    const updated = await db.wholeOrder.update({
      where: { id: b.id },
      data: { [field]: [...(order[field] ?? []), ...urls] },
    });
    return NextResponse.json({ ok: true, proof: updated[field] });
  }

  // Slice orders only keep cancellation proof — there's nothing to agree in
  // messages when the website took the order.
  if (field !== "cancelProof")
    return NextResponse.json(
      { error: "Not available on slice orders." },
      { status: 400 }
    );

  const order = await db.order.findUnique({ where: { id: b.id } });
  if (!order)
    return NextResponse.json({ error: "No such order." }, { status: 404 });

  const updated = await db.order.update({
    where: { id: b.id },
    data: { cancelProof: [...order.cancelProof, ...urls] },
  });

  await db.orderEvent.create({
    data: {
      orderId: b.id,
      kind: "Cancellation proof added",
      detail: `${urls.length} image(s)`,
    },
  });

  return NextResponse.json({ ok: true, proof: updated.cancelProof });
}

/** Removes one image, by its address. */
export async function DELETE(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const field = fieldOf(url.searchParams.get("field"));
  const image = url.searchParams.get("image");

  if (!id || !field || !image)
    return NextResponse.json({ error: "Missing details." }, { status: 400 });

  if (url.searchParams.get("kind") === "WHOLE") {
    const order = await db.wholeOrder.findUnique({ where: { id } });
    if (!order)
      return NextResponse.json({ error: "No such order." }, { status: 404 });
    await db.wholeOrder.update({
      where: { id },
      data: { [field]: (order[field] ?? []).filter((u) => u !== image) },
    });
  } else {
    const order = await db.order.findUnique({ where: { id } });
    if (!order)
      return NextResponse.json({ error: "No such order." }, { status: 404 });
    await db.order.update({
      where: { id },
      data: { cancelProof: order.cancelProof.filter((u) => u !== image) },
    });
  }

  return NextResponse.json({ ok: true });
}


/**
 * Sets the order of the images.
 *
 * Takes the full list rather than a single move, so what's stored is exactly
 * what's on screen — two quick taps can't leave it half-applied.
 */
export async function PUT(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const b = (await req.json()) as {
    id: string;
    kind: "SLICE" | "WHOLE";
    field: string;
    urls: string[];
  };

  const field = fieldOf(b.field);
  if (!b.id || !field || !Array.isArray(b.urls))
    return NextResponse.json({ error: "Missing details." }, { status: 400 });

  if (b.kind === "WHOLE") {
    const order = await db.wholeOrder.findUnique({ where: { id: b.id } });
    if (!order)
      return NextResponse.json({ error: "No such order." }, { status: 404 });

    // Only the images already on this order, so nothing can be added here.
    const existing = new Set(order[field] ?? []);
    const urls = b.urls.filter((u) => existing.has(u));
    if (urls.length !== existing.size)
      return NextResponse.json({ error: "That list has changed." }, { status: 409 });

    const updated = await db.wholeOrder.update({
      where: { id: b.id },
      data: { [field]: urls },
    });
    return NextResponse.json({ ok: true, proof: updated[field] });
  }

  const order = await db.order.findUnique({ where: { id: b.id } });
  if (!order)
    return NextResponse.json({ error: "No such order." }, { status: 404 });

  const existing = new Set(order.cancelProof);
  const urls = b.urls.filter((u) => existing.has(u));
  if (urls.length !== existing.size)
    return NextResponse.json({ error: "That list has changed." }, { status: 409 });

  const updated = await db.order.update({
    where: { id: b.id },
    data: { cancelProof: urls },
  });
  return NextResponse.json({ ok: true, proof: updated.cancelProof });
}
