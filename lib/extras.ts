import { db } from "./stock";
import { extraSaucePence } from "./config";

/**
 * What one slice can carry, and what it costs.
 *
 *   toppings    where the flavour's own toppings go: on the slice or in a tub
 *   extraSauce  more of the sauce it already comes with — priced by placement
 *   addedSauce  a sauce chosen for a flavour that comes without one
 *   addedTops   toppings chosen from the list you allow for that flavour
 *
 * Added sauce and toppings follow the same placement as the flavour's own
 * toppings, so a customer never has to say it twice.
 */
export type SliceChoice = {
  flavourId: string;
  /// Where everything on this slice goes: "on the slice" or "separately".
  /// On a flavour with its own toppings that's the toppings choice; on one
  /// without, it's the choice made for the sauce they added.
  toppings: string | null;
  /// Where the extra sauce goes, priced accordingly. A slice whose toppings
  /// are in a tub can only have its extra sauce in a tub too.
  extraSauce?: string | null;
  addedSauceId?: string | null;
  addedToppingIds?: string[];
};

export type PricedLine = {
  flavourId: string;
  flavour: string;
  toppings: string | null;
  /// Where everything on this slice goes: "on the slice" or "in a tub".
  /// Recorded even when the flavour has no toppings of its own, because a
  /// sauce or topping added to it still has to go somewhere — and both you
  /// and the customer need to know which.
  placement: string | null;
  extraSauce: string | null;
  /// Name and price are copied in, so a later price change can't rewrite
  /// what someone already paid. The ids come along as well, so the admin can
  /// edit an order without the choices being lost.
  addedSauce: { name: string; pricePence: number } | null;
  addedSauceId: string | null;
  addedToppings: { name: string; pricePence: number }[];
  addedToppingIds: string[];
  pricePence: number;
  allergens: string[];
};

/**
 * Turns what was picked into priced lines. Everything is looked up from the
 * database — nothing about price comes from the browser.
 */
export async function priceSlices(
  choices: SliceChoice[]
): Promise<{ lines: PricedLine[]; error?: string }> {
  const flavourIds = [...new Set(choices.map((c) => c.flavourId))];
  const [flavours, extras] = await Promise.all([
    db.flavour.findMany({ where: { id: { in: flavourIds } } }),
    db.extra.findMany({ where: { active: true } }),
  ]);

  const byId = new Map(extras.map((e) => [e.id, e]));
  const lines: PricedLine[] = [];

  for (const c of choices) {
    const f = flavours.find((x) => x.id === c.flavourId);
    if (!f) return { lines: [], error: "That flavour is no longer available." };

    // Where everything on this slice goes. A flavour that can't be served
    // separately is always on the slice, whatever was submitted — the price
    // and the prep list both depend on this being true.
    const placement =
      f.allowSeparate && c.toppings === "separately"
        ? "in a tub"
        : "on the slice";

    // Extra sauce can go either way when the toppings are on the slice, but
    // once the toppings are in a tub the sauce has to be too.
    let extraSauce: string | null = null;
    if (f.hasToppings && f.hasExtraSauce && c.extraSauce) {
      extraSauce =
        placement === "in a tub"
          ? "in a tub"
          : c.extraSauce === "in a tub"
            ? "in a tub"
            : "on the slice";
    }

    let sauce: PricedLine["addedSauce"] = null;
    if (c.addedSauceId) {
      if (!f.sauceIds.includes(c.addedSauceId))
        return { lines: [], error: `That sauce isn't available on ${f.name}.` };
      const e = byId.get(c.addedSauceId);
      if (!e) return { lines: [], error: "That sauce is no longer available." };
      sauce = { name: e.name, pricePence: e.pricePence };
    }

    const wanted = c.addedToppingIds ?? [];
    if (wanted.length > f.maxToppings)
      return {
        lines: [],
        error: `${f.name} takes up to ${f.maxToppings} topping${f.maxToppings === 1 ? "" : "s"}.`,
      };
    if (new Set(wanted).size !== wanted.length)
      return { lines: [], error: "Each topping can only be chosen once." };

    const addedToppings: PricedLine["addedToppings"] = [];
    for (const id of wanted) {
      if (!f.toppingIds.includes(id))
        return { lines: [], error: `That topping isn't available on ${f.name}.` };
      const e = byId.get(id);
      if (!e)
        return { lines: [], error: "That topping is no longer available." };
      addedToppings.push({ name: e.name, pricePence: e.pricePence });
    }

    const pricePence =
      f.pricePence +
      (extraSauce ? extraSaucePence(extraSauce) : 0) +
      (sauce?.pricePence ?? 0) +
      addedToppings.reduce((n, t) => n + t.pricePence, 0);

    lines.push({
      flavourId: f.id,
      flavour: f.name,
      toppings: f.hasToppings
        ? placement === "in a tub"
          ? "separately"
          : "on the slice"
        : null,
      // Only worth stating when there's something to place.
      placement:
        f.hasToppings || sauce || addedToppings.length > 0 ? placement : null,
      extraSauce,
      addedSauce: sauce,
      addedSauceId: c.addedSauceId ?? null,
      addedToppings,
      addedToppingIds: wanted,
      pricePence,
      allergens: f.allergens,
    });
  }

  return { lines };
}

/** One line of plain text describing everything on a slice. */
export function describeSlice(l: {
  toppings?: string | null;
  placement?: string | null;
  extraSauce?: string | null;
  addedSauce?: { name: string } | null;
  addedToppings?: { name: string }[] | null;
}): string[] {
  const bits: string[] = [];
  if (l.toppings) bits.push(`Toppings ${l.toppings}`);
  else if (l.placement) bits.push(`Served ${l.placement}`);
  if (l.extraSauce) bits.push(`Extra sauce ${l.extraSauce}`);
  if (l.addedSauce) bits.push(`Sauce: ${l.addedSauce.name}`);
  if (l.addedToppings?.length)
    bits.push(`Toppings: ${l.addedToppings.map((t) => t.name).join(", ")}`);
  return bits;
}
