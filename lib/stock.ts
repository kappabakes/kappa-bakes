import { PrismaClient, OrderStatus } from "@prisma/client";
import {
  DEFAULT_MAX_PER_ORDER,
  TAIL_RESERVE,
  HORIZON_WEEKS,
  DEFAULT_CAPACITY,
  DEFAULT_START,
  DEFAULT_END,
  CUTOFF_HOUR_BEFORE,
  dayLabel,
} from "./config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export const midnightUtc = (d: Date | string) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
};

/**
 * Today's date as the UK sees it, keyed to midnight UTC like every stored day.
 *
 * Using UTC directly meant that between midnight and 1am on a British Summer
 * Time morning, the server still thought it was yesterday — so a Saturday
 * stayed in the live list well into Sunday.
 */
export function todayUk(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00Z`);
}

/**
 * Slices spoken for: paid, collected and no-show orders, plus checkouts still
 * inside their 15-minute hold. An abandoned checkout stops counting the moment
 * it expires, so nothing needs sweeping up.
 */
/**
 * Statuses that still occupy a slice.
 *
 * A cancelled order frees its slices — it isn't happening. A no-show frees
 * them too: the slice was baked and is sitting there, so it can be sold to
 * someone else. Revenue is counted separately, where a no-show still counts
 * as money kept and a cancellation doesn't.
 */
export const HOLDS_A_SLICE = [OrderStatus.PAID, OrderStatus.COLLECTED];

/**
 * Slices committed for a day, out of the day's general pool.
 *
 * Two things are deliberately excluded:
 *
 *   Cancelled and no-show orders — those slices are back on sale. A cancelled
 *   order was never collected, and a no-show's slices are sitting there.
 *
 *   Flavours with their own stock — a special limited to 8 has its own pool
 *   and doesn't eat into the day's total.
 */
export async function slicesTaken(day: Date, client: PrismaClient = db) {
  const [orders, ownStock, overrides] = await Promise.all([
    client.order.findMany({
      where: {
        day,
        OR: [
          { status: { in: [OrderStatus.PAID, OrderStatus.COLLECTED] } },
          { status: OrderStatus.PENDING, reservedUntil: { gt: new Date() } },
        ],
      },
      select: { slices: true },
    }),
    client.flavour.findMany({
      where: { stockPerDay: { not: null } },
      select: { id: true },
    }),
    client.dayFlavourStock.findMany({ where: { day } }).catch(() => []),
  ]);

  const separate = new Set([
    ...ownStock.map((f) => f.id),
    ...overrides.map((o) => o.flavourId),
  ]);

  let n = 0;
  for (const o of orders)
    for (const sl of o.slices as unknown as { flavourId?: string }[])
      if (!sl.flavourId || !separate.has(sl.flavourId)) n++;

  return n;
}

export async function slicesLeft(day: Date, tx = db): Promise<number> {
  const row = await tx.collectionDay.findUnique({ where: { day } });
  if (!row || !row.confirmed || !row.open) return 0;
  if (row.cutoff && row.cutoff <= new Date()) return 0;
  return Math.max(0, row.capacity - (await slicesTaken(day, tx)));
}

/** Distinguishes "too late" from "sold out" for the checkout error message. */
export async function pastCutoff(day: Date, tx = db): Promise<boolean> {
  const row = await tx.collectionDay.findUnique({ where: { day } });
  return Boolean(row?.cutoff && row.cutoff <= new Date());
}

export async function dayWindow(day: Date): Promise<string> {
  const row = await db.collectionDay.findUnique({ where: { day } });
  return row ? `${row.startTime} – ${row.endTime}` : `${DEFAULT_START} – ${DEFAULT_END}`;
}

/**
 * Creates unconfirmed collection days from the recurring slots, up to the
 * horizon. Never touches a day that already exists, so your edits stick.
 */
export async function generateFromSlots() {
  const slots = await db.recurringSlot.findMany({ where: { active: true } });
  if (!slots.length) return 0;

  const today = todayUk();
  let made = 0;

  // One week only — dates are set each Monday, so anything further is noise.
  for (let i = 0; i < HORIZON_WEEKS * 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const slot = slots.find((s) => s.weekday === d.getUTCDay());
    if (!slot) continue;

    const exists = await db.collectionDay.findUnique({ where: { day: d } });
    if (exists) continue;

    // You deleted this one. Don't put it back.
    // Wrapped because a database that hasn't had `prisma db push` run since
    // this table was added would otherwise take the whole admin down.
    try {
      const suppressed = await db.suppressedDate.findUnique({
        where: { day: d },
      });
      if (suppressed) continue;
    } catch {
      // Table missing — carry on generating rather than failing.
    }

    await db.collectionDay.create({
      data: {
        day: d,
        capacity: slot.capacity,
        startTime: slot.startTime,
        endTime: slot.endTime,
        cutoff: defaultCutoff(d), // a sensible default; you confirm it
        confirmed: false, // you release it, not the schedule
        fromSlot: slot.id,
      },
    });
    made++;
  }
  return made;
}

/** KB001 upward, wrapping back to 001 after 999. */
export async function nextOrderNo(tx = db): Promise<string> {
  const row = await tx.counter.upsert({
    where: { id: 1 },
    create: { id: 1, value: 1 },
    update: { value: { increment: 1 } },
  });
  let n = row.value;
  if (n > 999) {
    await tx.counter.update({ where: { id: 1 }, data: { value: 1 } });
    n = 1;
  }
  return `KB${String(n).padStart(3, "0")}`;
}


/** The evening before, at the configured hour. A sensible default cut-off. */
export function defaultCutoff(day: Date): Date {
  const d = new Date(day);
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(CUTOFF_HOUR_BEFORE, 0, 0, 0);
  return d;
}

/**
 * You can order N slices only while at least N + TAIL_RESERVE remain, so a
 * large order can't leave an unsellable stub at the end of the day.
 * `cap` is the limit for that date, which may differ from the shop default.
 */
export function maxOrderSize(left: number, cap = DEFAULT_MAX_PER_ORDER): number {
  if (left <= 0) return 0;
  return Math.max(1, Math.min(cap, left - TAIL_RESERVE));
}

export type OpenDay = {
  id: string;
  iso: string;
  label: string;
  window: string;
  left: number;
  capacity: number;
  maxPerOrder: number;
  soldOut: boolean;
  note: string | null;
  cutoffIso: string | null;
};

/**
 * Every collection date currently taking orders: confirmed, not paused, not
 * past its cut-off, today or later.
 *
 * `left` and `capacity` are the day's general pool. A flavour with its own
 * stock sits outside this — it has its own count, shown against the flavour —
 * so the two never double-count each other.
 */
export async function openDays(): Promise<OpenDay[]> {
  const { maxPerOrder } = await import("./settings");
  const cap = await maxPerOrder();
  const now = new Date();

  const rows = await db.collectionDay.findMany({
    where: { confirmed: true, open: true, day: { gte: todayUk() } },
    orderBy: { day: "asc" },
  });

  const out: OpenDay[] = [];
  for (const d of rows) {
    if (d.cutoff && d.cutoff <= now) continue; // closed for orders

    const taken = await slicesTaken(d.day);
    const generalLeft = Math.max(0, d.capacity - taken);

    // Flavours with their own stock sit outside the day's pool, so add them
    // in for the public count. A counter reading zero while five specials
    // are still there would cost sales — the number has to mean what it says.
    const perFlavour = await flavourStock(d.day);
    let specialLeft = 0;
    let specialCapacity = 0;
    for (const row of Object.values(perFlavour)) {
      // A special not offered on this date contributes nothing. Its stock
      // figure still exists — it's what the flavour makes on a date it IS
      // offered — but counting it here would advertise slices that can't be
      // bought.
      if (!row.offered) continue;
      if (row.stock === null || row.stock === undefined) continue;
      specialLeft += row.left ?? 0;
      specialCapacity += row.stock;
    }

    const left = generalLeft + specialLeft;

    out.push({
      id: d.id,
      iso: d.day.toISOString(),
      label: dayLabel(d.day),
      window: `${d.startTime} – ${d.endTime}`,
      left,
      capacity: d.capacity + specialCapacity,
      // Based on everything still available, so a special can be ordered on a
      // day whose general slices have gone.
      maxPerOrder: maxOrderSize(left, d.maxPerOrder ?? cap),
      soldOut: left <= 0,
      note: d.note,
      cutoffIso: d.cutoff ? d.cutoff.toISOString() : null,
    });
  }

  return out;
}

export const DEFAULTS = {
  capacity: DEFAULT_CAPACITY,
  start: DEFAULT_START,
  end: DEFAULT_END,
};

/**
 * Per-flavour stock for one date.
 *
 * A flavour with `stockPerDay` set is made in a fixed quantity — a weekly
 * special, say — so it can sell out while the day still has slices left. A
 * flavour without one is limited only by the day's total.
 */
export async function flavourStock(day: Date) {
  const [flavours, orders, overrides] = await Promise.all([
    db.flavour.findMany({ where: { active: true } }),
    db.order.findMany({
      where: {
        day,
        OR: [
          { status: { in: HOLDS_A_SLICE } },
          { status: OrderStatus.PENDING, reservedUntil: { gt: new Date() } },
        ],
      },
      select: { slices: true },
    }),
    db.dayFlavourStock.findMany({ where: { day } }),
  ]);

  // A figure set against this date beats the flavour's own default.
  const perDay = new Map(overrides.map((o) => [o.flavourId, o.stock]));

  const sold = new Map<string, number>();
  for (const o of orders) {
    for (const s of o.slices as unknown as { flavourId?: string }[]) {
      if (!s.flavourId) continue;
      sold.set(s.flavourId, (sold.get(s.flavourId) ?? 0) + 1);
    }
  }

  const out: Record<
    string,
    { sold: number; stock: number | null; left: number | null; offered: boolean }
  > = {};
  for (const f of flavours) {
    const used = sold.get(f.id) ?? 0;
    const stock = perDay.has(f.id) ? perDay.get(f.id)! : f.stockPerDay;
    out[f.id] = {
      sold: used,
      stock,
      left: stock === null || stock === undefined ? null : Math.max(0, stock - used),
      // A one-off special isn't offered on a date you haven't given it stock
      // for. Not sold out — simply not on the menu that day.
      offered: f.selectedDatesOnly ? perDay.has(f.id) : true,
    };
  }
  return out;
}
