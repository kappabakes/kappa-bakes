/**
 * Whole-cheesecake orders.
 *
 * A cake is either one flavour throughout, or split half and half. A halved
 * cake is stored with its two flavours in a fixed order, so "Special K +
 * Berry Bliss" and "Berry Bliss + Special K" are the same thing rather than
 * two records that look different on a prep list.
 */
export type WholeItem = {
  /// Whole cake in one flavour, or two halves.
  kind: "WHOLE" | "HALF";
  flavour: string;
  /// The second half. Only when kind is HALF.
  flavourB?: string;
  qty: number;
};

/** Alphabetical, so a pairing always reads and stores the same way. */
export function normaliseItem(item: WholeItem): WholeItem {
  if (item.kind !== "HALF" || !item.flavourB) {
    return { kind: "WHOLE", flavour: item.flavour, qty: Math.max(1, item.qty) };
  }

  const [a, b] = [item.flavour, item.flavourB].sort((x, y) =>
    x.localeCompare(y)
  );
  return { kind: "HALF", flavour: a, flavourB: b, qty: Math.max(1, item.qty) };
}

/** "Berry Bliss (whole)" or "Half Berry Bliss / Half Special K". */
export function describeItem(item: WholeItem): string {
  return item.kind === "HALF" && item.flavourB
    ? `Half ${item.flavour} / Half ${item.flavourB}`
    : `${item.flavour} (whole)`;
}

/** The order's lines, ready to print. */
export function describeItems(items: WholeItem[]): string[] {
  // Identical cakes collapse into one line, which is why normalising the
  // pairing matters: two halves ordered in different orders are one line.
  const counts = new Map<string, number>();
  for (const raw of items) {
    const item = normaliseItem(raw);
    const key = describeItem(item);
    counts.set(key, (counts.get(key) ?? 0) + item.qty);
  }
  return [...counts].map(([label, n]) => `${n}x ${label}`);
}

export const cakeCount = (items: WholeItem[]) =>
  items.reduce((n, i) => n + Math.max(1, i.qty), 0);

/** What's still to pay when they collect. */
export const balancePence = (totalPence: number, depositPence: number) =>
  Math.max(0, totalPence - depositPence);


/**
 * Turns "2026-09-10" and "20:00" into the right moment in time.
 *
 * `new Date("2026-09-10T20:00:00")` has no timezone in it, so it's read as
 * UTC on the server — and 20:00 UTC is 21:00 in British Summer Time, which
 * is how a saved time gained an hour.
 *
 * This works out what UTC instant actually reads as 20:00 in London on that
 * date, so it's right either side of the clocks changing, and right wherever
 * the admin happens to be.
 */
export function ukWallTimeToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);

  // Start by assuming the wall time is UTC, then correct by however far
  // London is from UTC at that moment.
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);

  const london = new Date(guess).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // "10/09/2026, 21:00"
  const [datePart, timePart] = london.split(", ");
  const [ld, lm, ly] = datePart.split("/").map(Number);
  const [lh, lmin] = timePart.split(":").map(Number);

  const asShown = Date.UTC(ly, lm - 1, ld, lh, lmin, 0);
  const offset = asShown - guess;

  return new Date(guess - offset);
}

/** The stored instant, back as the date and time you typed. */
export function utcToUkWallTime(d: Date | string) {
  const date = new Date(d);
  const parts = date.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const [datePart, timePart] = parts.split(", ");
  const [dd, mm, yyyy] = datePart.split("/");

  return { date: `${yyyy}-${mm}-${dd}`, time: timePart };
}
