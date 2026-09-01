import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import {
  db,
  slicesTaken,
  generateFromSlots,
  midnightUtc,
  defaultCutoff,
  DEFAULTS,
  todayUk,
  flavourStock,
} from "@/lib/stock";
import { dayLabel } from "@/lib/config";
import { windowOpensAt } from "@/lib/status";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

type Slice = {
  flavour: string;
  toppings: string | null;
  placement?: string | null;
  extraSauce?: string | null;
  addedSauce?: { name: string } | null;
  addedSauces?: { name: string; warm?: boolean }[] | null;
  addedToppings?: { name: string }[] | null;
};

/** What to bake, and how it's dressed. Rebuilt on every load so edits show. */
/**
 * What you're actually making for a day, flavour by flavour.
 *
 * Tubs are split by what's going in them, because "3 tubs" tells you nothing
 * when one is a topping, one is extra sauce, and one is both. Added sauces
 * and toppings are counted by name, so the shopping is on one screen.
 */
async function breakdown(day: Date) {
  const orders = await db.order.findMany({
    where: {
      day,
      // A cancelled order isn't being made, so it shouldn't be on the list.
      status: {
        in: [OrderStatus.PAID, OrderStatus.COLLECTED, OrderStatus.NO_SHOW],
      },
    },
    select: { slices: true },
  });

  type Row = {
    total: number;
    /// The flavour's own toppings, in a tub rather than on the slice
    separate: number;
    /// Extra of the sauce it comes with, split by where it goes
    extraOnSlice: number;
    extraInTub: number;
    /// Sauces and toppings added on, counted by name
    sauces: Record<string, number>;
    toppings: Record<string, number>;
  };

  const rows = new Map<string, Row>();

  for (const o of orders) {
    for (const s of o.slices as unknown as Slice[]) {
      const r =
        rows.get(s.flavour) ??
        {
          total: 0,
          separate: 0,
          extraOnSlice: 0,
          extraInTub: 0,
          sauces: {},
          toppings: {},
        };

      r.total++;
      // A flavour with no toppings of its own still needs a tub if the sauce
      // or toppings added to it are going separately.
      if (s.toppings === "separately" || s.placement === "in a tub")
        r.separate++;
      if (s.extraSauce === "in a tub") r.extraInTub++;
      else if (s.extraSauce) r.extraOnSlice++;

      // Warm counted separately: it's a different job at the counter, and
      // "2 warm" is the number you need while packing.
      for (const x of s.addedSauces ?? []) {
        const key = x.warm ? `${x.name} (warm)` : x.name;
        r.sauces[key] = (r.sauces[key] ?? 0) + 1;
      }
      if (!s.addedSauces?.length && s.addedSauce)
        r.sauces[s.addedSauce.name] = (r.sauces[s.addedSauce.name] ?? 0) + 1;
      for (const t of s.addedToppings ?? [])
        r.toppings[t.name] = (r.toppings[t.name] ?? 0) + 1;

      rows.set(s.flavour, r);
    }
  }

  return [...rows]
    .map(([flavour, r]) => ({
      flavour,
      ...r,
      // How many tubs you'll need for this flavour in total.
      tubs: r.separate + r.extraInTub,
    }))
    .sort((a, b) => b.total - a.total);
}

async function shape(d: {
  day: Date;
  capacity: number;
  startTime: string;
  endTime: string;
  cutoff: Date | null;
  archivedAt: Date | null;
  maxPerOrder: number | null;
  confirmed: boolean;
  open: boolean;
  note: string | null;
  fromSlot: string | null;
}) {
  const taken = await slicesTaken(d.day);

  // Flavours with their own stock sit outside the day's pool, so report them
  // separately — otherwise the admin says nothing's left while the shop is
  // still selling specials.
  const perFlavour = await flavourStock(d.day);
  let specialLeft = 0;
  let specialCapacity = 0;
  for (const row of Object.values(perFlavour)) {
    // A special not offered on this date contributes nothing. Its stock
    // figure still exists — it's what the flavour makes on a date it IS
    // offered — but counting it here would show slices that can't be sold.
    if (!row.offered) continue;
    if (row.stock === null || row.stock === undefined) continue;
    specialLeft += row.left ?? 0;
    specialCapacity += row.stock;
  }

  return {
    ...d,
    iso: d.day.toISOString(),
    label: dayLabel(d.day),
    cutoffIso: d.cutoff ? d.cutoff.toISOString() : null,
    closed: Boolean(d.cutoff && d.cutoff <= new Date()),
    taken,
    left: Math.max(0, d.capacity - taken),
    archived: Boolean(d.archivedAt),
    // Orders still waiting on you. Zero means the day can be archived early
    // without losing sight of anything.
    outstanding: await db.order.count({
      where: { day: d.day, status: OrderStatus.PAID },
    }),
    // Slices held by someone part-way through paying. They come back on their
    // own when the checkout expires — this is here so a counter that's gone
    // down with no orders to show for it isn't a mystery.
    held: await db.order.count({
      where: {
        day: d.day,
        status: OrderStatus.PENDING,
        reservedUntil: { gt: new Date() },
      },
    }),
    specialLeft,
    specialCapacity,
    breakdown: await breakdown(d.day),
  };
}

export async function GET(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });

  // Generating the week's dates is a convenience. If it fails, the dates you
  // already have must still load — an error here used to blank the screen.
  let warning: string | null = null;
  try {
    await generateFromSlots();
  } catch (e) {
    warning = `Couldn't create this week's dates: ${(e as Error).message}`;
  }

  const today = todayUk();

  const [upcoming, past] = await Promise.all([
    db.collectionDay.findMany({
      where: { day: { gte: today }, archivedAt: null },
      orderBy: { day: "asc" },
    }),
    // Anything before today archives on its own — no flag to maintain — and
    // anything you've archived by hand joins it early.
    db.collectionDay.findMany({
      where: { OR: [{ day: { lt: today } }, { archivedAt: { not: null } }] },
      orderBy: { day: "desc" },
      take: 60,
    }),
  ]);

  const [days, archive, slots] = await Promise.all([
    Promise.all(upcoming.map(shape)),
    Promise.all(past.map(shape)),
    db.recurringSlot.findMany({ orderBy: { weekday: "asc" } }),
  ]);

  return NextResponse.json({ days, archive, slots, defaults: DEFAULTS, warning });
}

export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const b = (await req.json()) as {
    iso: string;
    capacity?: number;
    startTime?: string;
    endTime?: string;
    cutoffIso?: string | null;
    archived?: boolean;
    maxPerOrder?: number | null;
    confirmed?: boolean;
    open?: boolean;
    note?: string;
  };

  const day = midnightUtc(b.iso);
  if (isNaN(day.getTime()))
    return NextResponse.json({ error: "That date didn't parse." }, { status: 400 });

  const existing = await db.collectionDay.findUnique({ where: { day } });

  const cutoff =
    b.cutoffIso !== undefined
      ? b.cutoffIso
        ? new Date(b.cutoffIso)
        : null
      : (existing?.cutoff ?? defaultCutoff(day));

  const confirmed = b.confirmed ?? existing?.confirmed ?? false;

  // A confirmed day without a cut-off would take orders right up to
  // collection morning, which you can't bake for.
  if (confirmed && !cutoff)
    return NextResponse.json(
      { error: "Set a cut-off before confirming this date." },
      { status: 400 }
    );
  // The only real limit is the start of the collection window — after that
  // someone could order a slice for a slot already under way. Up to a minute
  // before is fine: it's your call how late you're willing to bake.
  if (cutoff) {
    const startTime = b.startTime ?? existing?.startTime ?? DEFAULTS.start;
    const windowOpens = windowOpensAt(day, startTime);
    if (cutoff >= windowOpens)
      return NextResponse.json(
        {
          error: `The cut-off has to be before collection starts at ${startTime}.`,
        },
        { status: 400 }
      );
  }

  const data = {
    archivedAt:
      b.archived === undefined
        ? (existing?.archivedAt ?? null)
        : b.archived
          ? (existing?.archivedAt ?? new Date())
          : null,
    capacity: b.capacity ?? existing?.capacity ?? DEFAULTS.capacity,
    maxPerOrder:
      b.maxPerOrder !== undefined
        ? b.maxPerOrder && b.maxPerOrder > 0
          ? Math.floor(b.maxPerOrder)
          : null
        : (existing?.maxPerOrder ?? null),
    startTime: b.startTime ?? existing?.startTime ?? DEFAULTS.start,
    endTime: b.endTime ?? existing?.endTime ?? DEFAULTS.end,
    cutoff,
    confirmed,
    open: b.open ?? existing?.open ?? true,
    note: b.note?.trim() || null,
  };

  await db.collectionDay.upsert({
    where: { day },
    create: { day, ...data },
    update: data,
  });

  // Adding a date back by hand un-deletes it.
  try {
    await db.suppressedDate.deleteMany({ where: { day } });
  } catch {
    /* table not there yet */
  }

  return NextResponse.json({ ok: true });
}

/**
 * Remove a date. Refused if real orders exist — the sales record has to stay.
 * Test orders are cleared out with it, since they aren't a record of anything.
 */
export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const iso = new URL(req.url).searchParams.get("iso");
  if (!iso) return new NextResponse("No date", { status: 400 });
  const day = midnightUtc(iso);

  const orders = await db.order.findMany({
    where: {
      day,
      status: {
        in: [OrderStatus.PAID, OrderStatus.COLLECTED, OrderStatus.NO_SHOW],
      },
    },
    select: { id: true, isTest: true },
  });

  const real = orders.filter((o) => !o.isTest);
  if (real.length > 0)
    return NextResponse.json(
      {
        error: `That day has ${real.length} real order${real.length === 1 ? "" : "s"} against it. Close it rather than deleting — the record needs to stay.`,
      },
      { status: 409 }
    );

  if (orders.length > 0)
    await db.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });

  const existing = await db.collectionDay.findUnique({ where: { day } });
  await db.collectionDay.delete({ where: { day } });

  // Without this the weekly schedule would recreate it on the next load.
  let remembered = false;
  try {
    await db.suppressedDate.upsert({
      where: { day },
      create: { day },
      update: {},
    });
    remembered = true;
  } catch {
    // Table missing — the delete happened, but the pattern will put it back.
  }

  // If it came from a weekly slot, say which, so the pattern can be switched
  // off rather than the same date being deleted every week.
  let fromWeekday: number | null = null;
  if (existing?.fromSlot) {
    const slot = await db.recurringSlot.findFirst({
      where: { id: existing.fromSlot },
    });
    fromWeekday = slot?.active ? slot.weekday : null;
  }

  return NextResponse.json({
    ok: true,
    remembered,
    fromWeekday,
    testOrdersRemoved: orders.length,
  });
}
