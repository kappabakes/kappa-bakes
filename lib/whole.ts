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
