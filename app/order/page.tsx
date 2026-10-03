"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { NotifyMe } from "./NotifyMe";
import Image from "next/image";
import {
  money,
  extraSaucePence,
  allergenLabel,
  NO_SHOW_HEADING,
  NO_SHOW_SHORT_BODY,
  ALLERGEN_HEADING,
  ALLERGEN_BODY,
  SHOP,
  whatsappLink,
} from "@/lib/config";
import { Countdown } from "../components/Countdown";
import { StockDot } from "../SliceCounter";

type Flavour = {
  id: string;
  name: string;
  description: string;
  pricePence: number;
  hasToppings: boolean;
  serving: "CHOICE" | "ON_SLICE" | "IN_TUB";
  hasExtraSauce: boolean;
  allergens: string[];
  image: string | null;
  /// A limit of its own — a special with only a few going. Null means the
  /// day's limit is the only one that applies.
  maxPerOrder: number | null;
  /// How many are made per date. Null means no separate stock.
  stockPerDay: number | null;
  /// Which sauces can be added. Empty means the option doesn't appear.
  sauceIds: string[];
  /// Which toppings can be added, and how many at once.
  toppingIds: string[];
  maxSauces: number;
  maxToppings: number;
  /// Poured over the top, after any toppings.
  drizzleIds: string[];
  maxDrizzles: number;
  /// Sauce chosen first and required, toppings after. First sauce included.
  buildYourOwn?: boolean;
};

/** How many of each flavour are left, for the chosen date. */
type Stock = Record<
  string,
  Record<
    string,
    {
      sold: number;
      stock: number | null;
      left: number | null;
      offered: boolean;
      /// Set when this flavour's count comes from a cake shared with others.
      group?: { id: string; name: string; stock: number; left: number };
    }
  >
>;
type Day = {
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
 * One entry per slice of that flavour.
 *   separate  — the flavour's own toppings go in a tub rather than on
 *   extra     — null for none, otherwise where the extra pot goes
 */
type Extra = {
  id: string;
  kind: "SAUCE" | "TOPPING" | "DRIZZLE";
  name: string;
  pricePence: number;
  warm: "NEVER" | "CHOICE" | "ALWAYS";
  allergens: string[];
};

/**
 * One entry per slice.
 *   separate   the flavour's own toppings go in a tub rather than on
 *   extra      more of the sauce it comes with — priced by placement
 *   sauceIds   sauces chosen for this slice, up to the flavour's limit
 *   toppingIds toppings chosen from the list allowed for that flavour
 *
 * Added sauce and toppings follow `separate`, so it's only asked once.
 */
type Slice = {
  /// Where everything on this slice goes. On a flavour with its own toppings
  /// that's the toppings choice; on one without, it's chosen for the sauce.
  separate: boolean;
  /// null for none, otherwise where the extra sauce goes. A slice whose
  /// toppings are in a tub can only have the extra in a tub too.
  extra: string | null;
  sauceIds: string[];
  /// The subset of those they've asked to have warmed.
  warmSauceIds: string[];
  toppingIds: string[];
  /// Poured over the top, after any toppings.
  drizzleIds: string[];
};
type Picks = Record<string, Slice[]>;

export default function OrderPage() {
  return (
    <Suspense
      fallback={<main className="p-10 text-sm text-ink2">One moment…</main>}
    >
      <OrderPageInner />
    </Suspense>
  );
}

function OrderPageInner() {
  const params = useSearchParams();
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [days, setDays] = useState<Day[] | null>(null);
  const [stock, setStock] = useState<Stock>({});
  /// How much of each day's general pool is left, keyed by date.
  const [general, setGeneral] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
  });
  const [dayIso, setDayIso] = useState("");
  const [picks, setPicks] = useState<Picks>({});
  const [policyOk, setPolicyOk] = useState(false);
  const [allergenOk, setAllergenOk] = useState(false);
  const [marketingOptIn, setMarketing] = useState(true);
  const [zoom, setZoom] = useState<Flavour | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/menu");
    if (!r.ok) {
      // Better a stated problem than a page that looks like it has nothing
      // for sale.
      setDays([]);
      setError(
        "Couldn't load what's available. Refresh the page, or try again in a moment."
      );
      return;
    }
    const d = await r.json();
    setFlavours(d.flavours);
    setDays(d.days);
    setStock(d.stock ?? {});
    setGeneral(d.general ?? {});
    setExtras(d.extras ?? []);
    setTestMode(Boolean(d.testMode));
    setDayIso((cur) => cur || d.days.find((x: Day) => !x.soldOut)?.iso || "");
  }, []);

  /**
   * Coming back from Stripe without paying. Telling Stripe the session is
   * over releases the slices immediately — otherwise they'd look sold for
   * half an hour to everyone else.
   */
  useEffect(() => {
    // Either Stripe sent them back with the id, or we stashed it on the way
    // out. The second covers the browser's own back button.
    const fromUrl =
      params.get("cancelled") === "1" ? params.get("session_id") : null;

    let stashed: string | null = null;
    try {
      stashed = sessionStorage.getItem("kb-checkout-session");
    } catch {
      /* private browsing */
    }

    const sessionId = fromUrl ?? stashed;

    // Tidy the address bar so a refresh doesn't repeat this.
    if (params.get("cancelled")) window.history.replaceState(null, "", "/order");

    if (!sessionId) return;

    try {
      sessionStorage.removeItem("kb-checkout-session");
    } catch {
      /* private browsing */
    }

    // Safe on a session they actually paid for: the route only closes one
    // that's still open, and leaves a completed payment alone.
    fetch("/api/checkout/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .catch(() => {}) // the sweep catches anything missed
      .finally(refresh);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live stock: on load, every 20 seconds, and when the tab regains focus.
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const day = days?.find((d) => d.iso === dayIso) ?? null;
  const maxSlices = day?.maxPerOrder ?? 0;
  const count = Object.values(picks).reduce((n, a) => n + a.length, 0);
  /** True when this flavour is made in a fixed quantity of its own. */
  const hasOwnStock = (id: string) => {
    const own = dayIso ? stock[dayIso]?.[id] : undefined;
    return Boolean(
      own && own.offered && own.stock !== null && own.stock !== undefined
    );
  };

  /** Slices chosen that come out of the day's general pool. */
  const generalPicked = () =>
    Object.entries(picks).reduce(
      (n, [id, arr]) => n + (hasOwnStock(id) ? 0 : arr.length),
      0
    );

  const priceOf = (id: string) =>
    extras.find((e) => e.id === id)?.pricePence ?? 0;

  /*
   * The flavours to show, with any that share a cake kept next to each other.
   *
   * They have to be adjacent for the shared heading above them to make sense
   * — a heading saying "these two share a count" with something else in
   * between would be worse than no heading at all.
   */
  const shownFlavours = (() => {
    const offered = flavours.filter((f) => {
      // A one-off special simply isn't on the menu for a date it wasn't made
      // for.
      if (!dayIso) return true;
      const row = stock[dayIso]?.[f.id];
      return row ? row.offered : true;
    });

    const groupOf = (f: Flavour) =>
      dayIso ? stock[dayIso]?.[f.id]?.group?.id : undefined;

    const out: Flavour[] = [];
    const done = new Set<string>();

    for (const f of offered) {
      if (done.has(f.id)) continue;
      const g = groupOf(f);

      if (!g) {
        out.push(f);
        done.add(f.id);
        continue;
      }

      for (const other of offered) {
        if (groupOf(other) === g && !done.has(other.id)) {
          out.push(other);
          done.add(other.id);
        }
      }
    }

    return out;
  })();

  /** The shared cake this flavour draws on, if any. */
  const groupFor = (id: string) =>
    dayIso ? stock[dayIso]?.[id]?.group : undefined;

  /** What one slice costs, including everything added to it. */
  const sliceTotal = (flavourId: string, s: Slice) => {
    const f = flavours.find((x) => x.id === flavourId);
    const base = f?.pricePence ?? 0;
    return (
      base +
      (s.extra ? extraSaucePence(s.extra) : 0) +
      // Must match the server: on Create Your Own the first sauce is part of
      // the slice. A mismatch would show one price and charge another.
      s.sauceIds.reduce(
        (n, id, i) => n + (f?.buildYourOwn && i === 0 ? 0 : priceOf(id)),
        0
      ) +
      s.toppingIds.reduce((n, id) => n + priceOf(id), 0) +
      s.drizzleIds.reduce((n, id) => n + priceOf(id), 0)
    );
  };

  const total = Object.entries(picks).reduce(
    (n, [id, arr]) => n + arr.reduce((m, s) => m + sliceTotal(id, s), 0),
    0
  );

  /**
   * What's left of this flavour on the chosen date.
   *
   * A flavour with its own stock has its own pool. One without draws on the
   * day's general pool, so it sells out when that does — even though the
   * headline counter is still showing the specials.
   */
  const leftOf = (id: string) => {
    if (!dayIso) return null;
    const own = stock[dayIso]?.[id];
    if (own && own.stock !== null && own.stock !== undefined) return own.left;
    return general[dayIso] ?? null;
  };

  const add = (f: Flavour) => {
    if (count >= maxSlices) return;
    // A flavour's own limit sits on top of the day's.
    if (f.maxPerOrder && (picks[f.id]?.length ?? 0) >= f.maxPerOrder) return;
    // And the pool it draws on — its own if it has one, the day's if not.
    const left = leftOf(f.id);
    if (left === null) return;
    const alreadyFromSamePool = hasOwnStock(f.id)
      ? (picks[f.id]?.length ?? 0)
      : generalPicked();
    if (alreadyFromSamePool >= left) return;
    const next = [
      ...(picks[f.id] ?? []),
      {
        separate: false,
        extra: null,
        sauceIds: [],
        warmSauceIds: [],
        toppingIds: [],
        drizzleIds: [],
      },
    ];

    setPicks({ ...picks, [f.id]: next });

    // The new one is the draft: it opens, and nothing else does.
    setDraft({ ...draft, [f.id]: next.length - 1 });
    setDraftQty({ ...draftQty, [f.id]: 1 });
    setError(null);
  };

  /** Puts the draft away, duplicated as many times as asked for. */
  const confirmDraft = (f: Flavour) => {
    const i = draft[f.id];
    const arr = picks[f.id] ?? [];
    if (i === undefined || !arr[i]) return;

    const want = Math.max(1, draftQty[f.id] ?? 1);
    const copies = Array.from({ length: want - 1 }, () => ({ ...arr[i] }));

    setPicks({ ...picks, [f.id]: [...arr, ...copies] });

    const { [f.id]: _drop, ...rest } = draft;
    setDraft(rest);
  };

  /** Drops the draft without keeping it. */
  const cancelDraft = (f: Flavour) => {
    const i = draft[f.id];
    if (i === undefined) return;

    const arr = (picks[f.id] ?? []).filter((_, j) => j !== i);
    const next = { ...picks };
    if (arr.length) next[f.id] = arr;
    else delete next[f.id];
    setPicks(next);

    const { [f.id]: _drop, ...rest } = draft;
    setDraft(rest);
  };

  /** Reopens a confirmed line, taking its slices back into the draft. */
  const editLine = (f: Flavour, sig: string) => {
    const arr = picks[f.id] ?? [];
    const matching = arr.filter((s) => signature(s) === sig);
    const kept = arr.filter((s) => signature(s) !== sig);
    if (!matching.length) return;

    setPicks({ ...picks, [f.id]: [...kept, matching[0]] });
    setDraft({ ...draft, [f.id]: kept.length });
    setDraftQty({ ...draftQty, [f.id]: matching.length });
  };

  /** Removes every slice on a confirmed line. */
  const removeLine = (f: Flavour, sig: string) => {
    const arr = (picks[f.id] ?? []).filter((s) => signature(s) !== sig);
    const next = { ...picks };
    if (arr.length) next[f.id] = arr;
    else delete next[f.id];
    setPicks(next);
  };

  /*
   * Which slice of a flavour is still being built, and how many of it are
   * wanted. Everything else in picks is confirmed and shown as a one-line
   * summary — three slices used to mean three open panels and a great deal
   * of scrolling.
   */
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});

  /** A confirmed slice in a few words, for its summary line. */
  const describePick = (f: Flavour, s: Slice) => {
    const nameOf = (id: string) => extras.find((e) => e.id === id)?.name ?? "";
    const bits: string[] = [];

    if (f.hasToppings)
      bits.push(
        f.serving === "IN_TUB"
          ? "Toppings in a tub"
          : f.serving === "ON_SLICE"
            ? "Toppings on the slice"
            : s.separate
              ? "Toppings in a tub"
              : "Toppings on the slice"
      );

    if (s.sauceIds.length)
      bits.push(
        s.sauceIds
          .map((id) =>
            s.warmSauceIds.includes(id) ? `${nameOf(id)} (warm)` : nameOf(id)
          )
          .join(", ")
      );

    if (s.drizzleIds.length)
      bits.push(`${s.drizzleIds.map(nameOf).join(", ")} drizzle`);

    if (s.toppingIds.length) bits.push(s.toppingIds.map(nameOf).join(", "));
    if (s.extra) bits.push(`Extra sauce ${s.extra}`);

    return bits.join(" · ");
  };

  /** Two slices are the same line when every choice on them matches. */
  const signature = (s: Slice) =>
    JSON.stringify([
      s.separate,
      s.extra,
      [...s.sauceIds].sort(),
      [...s.warmSauceIds].sort(),
      [...s.toppingIds].sort(),
      [...s.drizzleIds].sort(),
    ]);

  const setSlice = (id: string, i: number, patch: Partial<Slice>) =>
    setPicks({
      ...picks,
      [id]: picks[id].map((v, j) => (j === i ? { ...v, ...patch } : v)),
    });

  async function pay() {
    setBusy(true);
    setError(null);
    const slices = Object.entries(picks).flatMap(([flavourId, arr]) => {
      const flavour = flavours.find((x) => x.id === flavourId);
      return arr.map((s) => ({
        flavourId,
        // The server decides this too, so it can't be spoofed — but sending
        // the right thing keeps the two in agreement.
        toppings:
          flavour?.serving === "IN_TUB" ||
          (flavour?.serving === "CHOICE" && s.separate)
            ? "separately"
            : "on the slice",
        extraSauce: s.extra,
        addedSauceIds: s.sauceIds,
        warmSauceIds: s.warmSauceIds,
        addedToppingIds: s.toppingIds,
        addedDrizzleIds: s.drizzleIds,
      }));
    });
    // Everything below is wrapped: a server error returns an HTML page, and
    // reading that as JSON throws. Unhandled, that left the button saying
    // "Working…" for ever with no explanation.
    let res: Response;
    try {
      res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dayIso,
          slices,
          policyAccepted: policyOk,
          allergenAccepted: allergenOk,
          marketingOptIn,
          testMode,
        }),
      });
    } catch {
      setBusy(false);
      setError(
        "Couldn't reach the server. Check your connection and try again."
      );
      return;
    }

    const raw = await res.text();
    let data: {
      url?: string;
      orderNo?: string;
      sessionId?: string;
      error?: string;
    } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      // Not JSON — the server fell over rather than answering properly.
      setBusy(false);
      setError(
        "Something went wrong at our end and your order wasn't taken. Nothing has been charged. Please try again, or message us."
      );
      console.error("checkout failed", res.status, raw.slice(0, 500));
      refresh();
      return;
    }

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      refresh();
      return;
    }

    // The order exists either way at this point, so never leave them on the
    // form. A malformed absolute URL (an unset site address) is treated as
    // missing rather than followed.
    const url = data.url;
    const looksUsable =
      typeof url === "string" &&
      (url.startsWith("/") || url.startsWith("http"));

    /*
     * Remember the session before leaving. Stripe's own back link returns the
     * id in the URL, but a browser back button doesn't — and that's how most
     * people come back. Without this their slices sit held until the session
     * expires.
     */
    if (data.sessionId) {
      try {
        sessionStorage.setItem("kb-checkout-session", data.sessionId);
      } catch {
        // Private browsing can refuse. The sweep catches it instead.
      }
    }

    if (looksUsable) window.location.href = url;
    else if (data.orderNo)
      window.location.href = `/order/confirmed?ok=${data.orderNo}`;
    else {
      setBusy(false);
      setError("Your order went through, but we couldn't open the confirmation. Check your email.");
    }
  }

  // A Create Your Own slice with no sauce isn't finished — the server would
  // refuse it, so say so here rather than at checkout.
  const unfinished = flavours.some(
    (f) => f.buildYourOwn && (picks[f.id] ?? []).some((s) => !s.sauceIds.length)
  );

  // A slice left open mid-build hasn't been asked for yet.
  const building = Object.keys(draft).length > 0;

  const missing =
    days?.length === 0 || (days && days.every((d) => d.soldOut))
      ? "Nothing available right now"
      : !form.firstName || !form.lastName || !form.mobile || !form.email
        ? "Fill in your details"
        : !dayIso
          ? "Choose a collection date"
          : count === 0
            ? "Choose your slices"
            : building
              ? "Confirm your slice to continue"
              : unfinished
                ? "Choose a sauce for Create Your Own"
                : !allergenOk || !policyOk
                  ? "Tick both boxes to continue"
                  : null;

  const wa = whatsappLink(`Hi ${SHOP.name}, I have a question about ordering`);

  return (
    <main className="bg-cream py-10">
      <div className="mx-auto max-w-6xl px-5">
        {testMode && (
          <p className="mb-6 rounded-card border border-gold bg-gold-light px-5 py-3 text-center text-[13px] font-semibold text-gold-hover">
            Test mode — no payment is taken. The order is created as paid so
            you can rehearse everything after checkout.
          </p>
        )}

        <h1 className="text-center font-display text-4xl text-ink md:text-5xl">
          Place Your Order
        </h1>
        <p className="mt-2 text-center text-[15px] text-ink2">
          Paid up front, so your slices are held for you. Collection only.
        </p>

        <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ---------- left: the form ---------- */}
          <div className="space-y-5">
            {/* 1 — date */}
            <Card>
              <StepTitle n={1}>Choose Collection Date</StepTitle>
              {!days && <p className="text-sm text-ink2">Checking dates…</p>}
              {days?.length === 0 && (
                <p className="text-sm text-ink2">
                  No dates open at the moment. New ones go up most weeks.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {days?.map((d) => {
                  const on = dayIso === d.iso;
                  return (
                    <button
                      key={d.id}
                      disabled={d.soldOut}
                      onClick={() => {
                        setDayIso(d.iso);
                        setPicks({});
                      }}
                      className={[
                        "rounded-card border px-5 py-4 text-left transition-colors",
                        d.soldOut
                          ? "cursor-not-allowed border-line bg-cream opacity-60"
                          : on
                            ? "border-navy bg-navy text-white"
                            : "border-line bg-cream-warm text-ink hover:border-gold",
                      ].join(" ")}
                    >
                      <span className="block font-semibold">{d.label}</span>
                      <span
                        className={[
                          "mt-0.5 block text-sm",
                          on ? "text-white/80" : "text-ink2",
                        ].join(" ")}
                      >
                        {d.window}
                      </span>
                      {d.soldOut && (
                        <span className="mt-2 block text-[13px] font-semibold text-muted">
                          SOLD OUT
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {day && !day.soldOut && (
                <div className="mt-4 text-center">
                  <span className="inline-flex items-center gap-2 rounded-btn border border-gold bg-paper px-5 py-2 text-sm font-semibold text-ink">
                    <StockDot left={day.left} capacity={day.capacity} />
                    {day.left} SLICE{day.left === 1 ? "" : "S"} AVAILABLE
                  </span>
                  {day.cutoffIso && (
                    <p className="mt-2 text-[13px] font-medium">
                      <Countdown cutoffIso={day.cutoffIso} onExpire={refresh} />
                    </p>
                  )}
                  {day.note && (
                    <p className="mt-1 text-[13px] text-gold">{day.note}</p>
                  )}
                </div>
              )}
            </Card>

            {/* 2 — details */}
            <Card>
              <StepTitle n={2}>Your Details</StepTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} placeholder="Enter your first name" />
                <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} placeholder="Enter your last name" />
                <Field label="Mobile Number" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} placeholder="07" />
                <Field label="Email Address" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="Enter your email address" />
              </div>
              <p className="mt-3 text-[12px] text-muted">
                Your last name is what you&apos;ll use to track your order.
              </p>
            </Card>

            {/* 3 — slices */}
            <Card>
              <StepTitle n={3}>
                Choose Your Slices
                <span className="block font-body text-[14px] font-normal text-ink2">
                  Up to {maxSlices || "—"} slice
                  {maxSlices === 1 ? "" : "s"} for this date
                </span>
              </StepTitle>
              <p className="mb-4 text-sm text-ink2">
                Toppings go on fresh at the door — they slide off if we do it
                early. Tick a slice if you&apos;d rather have them in a tub on
                the side.
              </p>

              <ul className="space-y-3">
                {shownFlavours.map((f, fi) => {
                  const chosen = picks[f.id] ?? [];
                  const left = leftOf(f.id);

                  // Shown once, above the first of the flavours sharing it.
                  const group = groupFor(f.id);
                  const firstOfGroup =
                    group &&
                    groupFor(shownFlavours[fi - 1]?.id ?? "")?.id !== group.id;
                  const sharedCount = group
                    ? shownFlavours.filter(
                        (x) => groupFor(x.id)?.id === group.id
                      ).length
                    : 0;

                  // Air below the last of a group, for the same reason.
                  const lastOfGroup =
                    group &&
                    groupFor(shownFlavours[fi + 1]?.id ?? "")?.id !== group.id;
                  const soldOut = left !== null && left <= 0;
                  return (
                    // Keyed fragment: two list items come out of one flavour
                    // when it's the first of a shared cake.
                    <Fragment key={f.id}>
                      {/* One cake, several finishes: the count belongs to the
                          cake, so it's stated once here rather than repeated
                          on each flavour as though they were separate. */}
                      {firstOfGroup && group && (
                        <li
                          key={`${group.id}-head`}
                          // Air above, so the shared count reads as belonging
                          // to the flavours under it rather than the one
                          // above.
                          className="mt-4 overflow-hidden rounded-card border border-gold/60 bg-gold-light"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                            <span className="text-[12px] font-bold uppercase tracking-wide text-gold-hover">
                              {group.name}
                            </span>
                            <span
                              className={[
                                "text-[12px] font-bold",
                                group.left <= 0
                                  ? "text-bad"
                                  : group.left <= 5
                                    ? "text-bad"
                                    : "text-gold-hover",
                              ].join(" ")}
                            >
                              {group.left <= 0
                                ? "SOLD OUT"
                                : `${group.left} slice${group.left === 1 ? "" : "s"} left`}
                            </span>
                          </div>
                          <p className="px-3.5 pb-2.5 text-[12px] leading-snug text-ink2">
                            The following {sharedCount} flavours share the same
                            stock count.
                          </p>
                        </li>
                      )}

                    <li
                      key={f.id}
                      className={[
                        "overflow-hidden rounded-card border bg-cream-warm",
                        group ? "border-gold/40" : "border-line",
                        lastOfGroup ? "mb-4" : "",
                        soldOut ? "bg-cream-beige/60" : "",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:gap-4">
                        {f.image && (
                          <button
                            onClick={() => setZoom(f)}
                            className={[
                              "relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-cream-beige",
                              // Dimmed individually rather than dimming the
                              // whole card: opacity on a parent can't be
                              // undone by a child, and the notify panel
                              // inside has to stay readable.
                              soldOut ? "opacity-60" : "",
                            ].join(" ")}
                            aria-label={`See a photo of ${f.name}`}
                          >
                            <Image src={f.image} alt="" fill sizes="160px" quality={95}
                  className="object-cover" />
                          </button>
                        )}

                        <div className="min-w-[55%] grow">
                          {/* The name and description dim, the notify panel
                              below them doesn't — opacity on a shared parent
                              would take the panel with it. */}
                          <div className={soldOut ? "opacity-60" : ""}>
                            <p className="font-display text-lg text-ink">
                              {f.name}
                            </p>
                            <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-ink2">
                              {f.description}
                            </p>
                          </div>
                          {soldOut ? (
                            <>
                              <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-bad">
                                Sold out
                              </p>
                              {/* Only on a sold-out flavour — there's nothing
                                  to wait for otherwise. */}
                              {/* Full strength inside a dimmed card: a
                                  greyed-out box reads as "you can't type
                                  here", which is the opposite of true. */}
                              <NotifyMe
                                flavourId={f.id}
                                flavourName={f.name}
                                dayIso={dayIso || null}
                                dayLabel={
                                  days?.find((d) => d.iso === dayIso)?.label ??
                                  null
                                }
                                defaultEmail={form.email}
                              />
                            </>
                          ) : (
                            <>
                              {f.maxPerOrder && (
                                <p className="mt-1 text-[11px] font-semibold text-gold-hover">
                                  Limited to {f.maxPerOrder} per order
                                </p>
                              )}
                              {/*
                                A running count for anything made in a fixed
                                quantity. Always shown rather than only when
                                low: on a special, "6 left" is the reason to
                                order now. It refreshes with the rest of the
                                page every 20 seconds.
                              */}
                              {hasOwnStock(f.id) && left !== null && (
                                <p
                                  className={[
                                    "mt-1 text-[11px] font-semibold",
                                    left <= 5 ? "text-bad" : "text-gold-hover",
                                  ].join(" ")}
                                >
                                  {left} slice{left === 1 ? "" : "s"} left
                                  {left <= 5 && " — going fast"}
                                </p>
                              )}
                            </>
                          )}
                          {f.allergens.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {f.allergens.map((a) => (
                                <li
                                  key={a}
                                  className="rounded-md border border-gold/40 bg-gold-light px-2 py-0.5 text-[11px] font-medium text-ink"
                                >
                                  {allergenLabel(a)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="ml-auto shrink-0 text-right">
                          <p className="font-semibold text-ink">{money(f.pricePence)}</p>
                          {/*
                            One button, not a stepper. How many of a given
                            combination is asked inside the panel, where the
                            choices that distinguish them are being made.
                          */}
                          <button
                            onClick={() => add(f)}
                            disabled={
                              count >= maxSlices ||
                              soldOut ||
                              draft[f.id] !== undefined
                            }
                            className="mt-2 whitespace-nowrap rounded-btn border-[1.5px] border-navy bg-paper px-4 py-2 text-[13px] font-bold text-navy disabled:opacity-30"
                          >
                            {chosen.length ? "+ Add another" : "+ Add a slice"}
                          </button>
                        </div>
                      </div>

                      {/*
                        Confirmed combinations, one line each with how many.
                        Three identical slices are one line rather than three
                        open panels — which is what made this unreadable.
                      */}
                      {(() => {
                        const lines = new Map<string, Slice[]>();
                        chosen.forEach((sl, i) => {
                          if (draft[f.id] === i) return;
                          const sig = signature(sl);
                          lines.set(sig, [...(lines.get(sig) ?? []), sl]);
                        });

                        if (!lines.size) return null;

                        return (
                          <ul className="space-y-1.5 border-t border-line bg-paper px-3 py-2.5">
                            {[...lines].map(([sig, group]) => (
                              <li
                                key={sig}
                                className="flex items-center gap-2.5 rounded-btn bg-cream-warm px-3 py-2"
                              >
                                <span className="shrink-0 rounded-md bg-navy px-1.5 py-0.5 text-[11px] font-bold text-white">
                                  {group.length}×
                                </span>
                                <span className="grow text-[13px] leading-snug text-ink">
                                  {describePick(f, group[0]) || "As it comes"}
                                </span>
                                <button
                                  onClick={() => editLine(f, sig)}
                                  className="shrink-0 text-[11.5px] font-bold text-gold-hover underline underline-offset-4"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => removeLine(f, sig)}
                                  aria-label="Remove"
                                  className="shrink-0 px-1 text-[15px] text-muted"
                                >
                                  ✕
                                </button>
                              </li>
                            ))}
                          </ul>
                        );
                      })()}

                      {/* One row per slice, so two of the same flavour can be
                          dressed differently. Added sauce and toppings follow
                          the same on-slice or in-a-tub choice. */}
                      {(f.hasToppings ||
                        f.sauceIds.length > 0 ||
                        f.toppingIds.length > 0) &&
                        chosen.length > 0 && (
                          <div className="space-y-3 border-t border-line bg-paper p-3">
                            {chosen.map((slice, i) => {
                              // Everything except the one being built is
                              // shown as a line above instead.
                              if (draft[f.id] !== i) return null;
                              // What this slice actually gets, given the
                              // flavour's own rule.
                              const where =
                                f.serving === "IN_TUB"
                                  ? "in a tub"
                                  : f.serving === "ON_SLICE"
                                    ? "on the slice"
                                    : slice.separate
                                      ? "in a tub"
                                      : "on the slice";
                              const sauces = extras.filter(
                                (e) =>
                                  e.kind === "SAUCE" &&
                                  f.sauceIds.includes(e.id)
                              );
                              const tops = extras.filter(
                                (e) =>
                                  e.kind === "TOPPING" &&
                                  f.toppingIds.includes(e.id)
                              );
                              const drizzles = extras.filter(
                                (e) =>
                                  e.kind === "DRIZZLE" &&
                                  f.drizzleIds.includes(e.id)
                              );

                              return (
                                <div
                                  key={i}
                                  className="rounded-btn bg-cream-warm p-2.5"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="w-16 shrink-0 rounded-md bg-navy px-2 py-1 text-center text-[11px] font-semibold text-white">
                                      Slice {i + 1}
                                    </span>

                                    {/* Shown when there's something to place:
                                        the flavour's own toppings, or a sauce
                                        or topping the customer has added. */}
                                    {/* Only when there's a choice to make. */}
                                    {f.serving === "CHOICE" &&
                                      (f.hasToppings ||
                                        slice.sauceIds.length > 0 ||
                                        slice.toppingIds.length > 0) && (
                                      <div className="grid grow grid-cols-2 gap-2">
                                        <ToppingChoice
                                          on={!slice.separate}
                                          onClick={() =>
                                            setSlice(f.id, i, {
                                              separate: false,
                                            })
                                          }
                                          title="On the slice"
                                          note={
                                            f.hasToppings
                                              ? "We'll add it fresh"
                                              : "Poured on at collection"
                                          }
                                        />
                                        <ToppingChoice
                                          on={slice.separate}
                                          onClick={() =>
                                            setSlice(f.id, i, {
                                              separate: true,
                                              // A tub for the toppings means a
                                              // tub for the extra sauce.
                                              extra: slice.extra
                                                ? "in a tub"
                                                : null,
                                            })
                                          }
                                          title="Separate"
                                          note="In a tub on the side"
                                        />
                                      </div>
                                      )}

                                    {f.serving !== "CHOICE" &&
                                      (f.hasToppings ||
                                        slice.sauceIds.length > 0 ||
                                        slice.toppingIds.length > 0) && (
                                        <span className="text-[12px] text-ink2">
                                          {f.serving === "IN_TUB"
                                            ? "Served in a tub on the side"
                                            : "Served on the slice"}
                                        </span>
                                      )}
                                  </div>

                                  {/* more of the sauce it already comes with */}
                                  {f.hasToppings && f.hasExtraSauce && (
                                    <div className="mt-2.5">
                                      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(slice.extra)}
                                          onChange={(e) =>
                                            setSlice(f.id, i, {
                                              // In a tub is the only option
                                              // once the toppings are.
                                              extra: e.target.checked
                                                ? where
                                                : null,
                                            })
                                          }
                                          className="h-4 w-4 accent-gold"
                                        />
                                        Extra sauce
                                      </label>

                                      {slice.extra &&
                                        (f.serving !== "CHOICE" ||
                                        slice.separate ? (
                                          <p className="mt-1.5 rounded-btn border border-gold bg-gold-light px-3 py-2 text-[12px] text-ink">
                                            {f.serving === "CHOICE"
                                              ? "In a tub, since your toppings are separate"
                                              : where === "in a tub"
                                                ? "In a tub"
                                                : "On the slice"}{" "}
                                            ·{" "}
                                            <span className="font-semibold">
                                              +{money(extraSaucePence(where))}
                                            </span>
                                          </p>
                                        ) : (
                                          <div className="mt-1.5 grid grid-cols-2 gap-2">
                                            <ToppingChoice
                                              on={slice.extra === "on the slice"}
                                              onClick={() =>
                                                setSlice(f.id, i, {
                                                  extra: "on the slice",
                                                })
                                              }
                                              title="On the slice"
                                              note={`+${money(extraSaucePence("on the slice"))}`}
                                            />
                                            <ToppingChoice
                                              on={slice.extra === "in a tub"}
                                              onClick={() =>
                                                setSlice(f.id, i, {
                                                  extra: "in a tub",
                                                })
                                              }
                                              title="In a tub"
                                              note={`+${money(extraSaucePence("in a tub"))}`}
                                            />
                                          </div>
                                        ))}
                                    </div>
                                  )}

                                  {/* Create Your Own builds the slice in
                                      steps; every other flavour uses the
                                      usual sauce and topping pickers. */}
                                  {f.buildYourOwn ? (
                                    <BuildYourOwn
                                      flavour={f}
                                      sauces={sauces}
                                      tops={tops}
                                      drizzles={drizzles}
                                      slice={slice}
                                      where={where}
                                      onChange={(patch) => setSlice(f.id, i, patch)}
                                    />
                                  ) : (
                                    <>
                                  {/* sauces — same shape as the toppings
                                      below, since a slice can take more than
                                      one where the flavour allows it */}
                                  {sauces.length > 0 && (
                                    <div className="mt-2.5">
                                      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                                        <input
                                          type="checkbox"
                                          checked={slice.sauceIds.length > 0}
                                          onChange={(e) =>
                                            setSlice(f.id, i, {
                                              sauceIds: e.target.checked
                                                ? [sauces[0].id]
                                                : [],
                                              warmSauceIds: [],
                                            })
                                          }
                                          className="h-4 w-4 accent-gold"
                                        />
                                        Add sauce
                                        {Math.min((f.maxSauces || Infinity), sauces.length) >
                                          1 && (
                                          <span className="text-[11px] text-ink2">
                                            up to{" "}
                                            {Math.min(
                                              (f.maxSauces || Infinity),
                                              sauces.length
                                            )}
                                          </span>
                                        )}
                                      </label>

                                      {slice.sauceIds.length > 0 && (
                                        <div
                                          className={[
                                            "mt-1.5 grid gap-2",
                                            Math.min(
                                              (f.maxSauces || Infinity),
                                              sauces.length
                                            ) > 1
                                              ? "grid-cols-2"
                                              : "grid-cols-1",
                                          ].join(" ")}
                                        >
                                          {/* Never more boxes than there are
                                              sauces to put in them. */}
                                          {Array.from(
                                            {
                                              length: Math.min(
                                                (f.maxSauces || Infinity),
                                                sauces.length
                                              ),
                                            },
                                            (_, n) => {
                                              const taken =
                                                slice.sauceIds.filter(
                                                  (_, j) => j !== n
                                                );
                                              return (
                                                <select
                                                  key={n}
                                                  value={slice.sauceIds[n] ?? ""}
                                                  onChange={(e) => {
                                                    const next = [
                                                      ...slice.sauceIds,
                                                    ];
                                                    if (e.target.value)
                                                      next[n] = e.target.value;
                                                    else next.splice(n, 1);
                                                    const kept =
                                                      next.filter(Boolean);
                                                    setSlice(f.id, i, {
                                                      sauceIds: kept,
                                                      warmSauceIds:
                                                        slice.warmSauceIds.filter(
                                                          (x) =>
                                                            kept.includes(x)
                                                        ),
                                                    });
                                                  }}
                                                  className="w-full rounded-btn border border-field bg-paper px-2 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                                                >
                                                  <option value="">
                                                    Sauce {n + 1}
                                                  </option>
                                                  {sauces
                                                    .filter(
                                                      (e) =>
                                                        !taken.includes(e.id)
                                                    )
                                                    .map((e) => (
                                                      <option
                                                        key={e.id}
                                                        value={e.id}
                                                      >
                                                        {e.name} +
                                                        {money(e.pricePence)}
                                                      </option>
                                                    ))}
                                                </select>
                                              );
                                            }
                                          )}
                                        </div>
                                      )}

                                      {/* Warm is per sauce, not per slice:
                                          one might need warming and another
                                          not. */}
                                      {slice.sauceIds.map((id) => {
                                        const e = extras.find(
                                          (x) => x.id === id
                                        );
                                        if (!e) return null;

                                        if (e.warm === "ALWAYS")
                                          return (
                                            <p
                                              key={id}
                                              className="mt-1.5 text-[11px] text-ink2"
                                            >
                                              {e.name} is served warm.
                                            </p>
                                          );

                                        if (e.warm !== "CHOICE") return null;

                                        return (
                                          <label
                                            key={id}
                                            className="mt-1.5 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={slice.warmSauceIds.includes(
                                                id
                                              )}
                                              onChange={(ev) =>
                                                setSlice(f.id, i, {
                                                  warmSauceIds: ev.target
                                                    .checked
                                                    ? [
                                                        ...slice.warmSauceIds,
                                                        id,
                                                      ]
                                                    : slice.warmSauceIds.filter(
                                                        (x) => x !== id
                                                      ),
                                                })
                                              }
                                              className="h-4 w-4 accent-gold"
                                            />
                                            Warm the {e.name}
                                          </label>
                                        );
                                      })}

                                      {slice.sauceIds.length > 0 && (
                                        <p className="mt-1 text-[11px] text-ink2">
                                          Going {where}
                                          {f.serving === "CHOICE" && " — set that above"}.
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Drizzles go over whatever's already on
                                      the slice, so they sit after the
                                      toppings and read as a separate choice
                                      rather than another sauce. */}
                                  {drizzles.length > 0 && (
                                    <div className="mt-2.5">
                                      <p className="text-[13px] font-semibold text-ink">
                                        Sauce drizzle
                                        {(f.maxDrizzles || Infinity) > 1
                                          ? "s"
                                          : ""}
                                      </p>
                                      <p className="mb-1.5 text-[11px] text-ink2">
                                        Over the top
                                        {f.maxDrizzles > 0
                                          ? ` — up to ${f.maxDrizzles}`
                                          : ""}
                                      </p>

                                      <div className="space-y-1.5">
                                        {drizzles.map((e) => {
                                          const on = slice.drizzleIds.includes(
                                            e.id
                                          );
                                          const full =
                                            !on &&
                                            f.maxDrizzles > 0 &&
                                            slice.drizzleIds.length >=
                                              f.maxDrizzles;
                                          return (
                                            <label
                                              key={e.id}
                                              className={[
                                                "flex cursor-pointer items-center gap-2.5 text-[13px] text-ink",
                                                full ? "opacity-40" : "",
                                              ].join(" ")}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={on}
                                                disabled={full}
                                                onChange={() =>
                                                  setSlice(f.id, i, {
                                                    drizzleIds: on
                                                      ? slice.drizzleIds.filter(
                                                          (x) => x !== e.id
                                                        )
                                                      : [
                                                          ...slice.drizzleIds,
                                                          e.id,
                                                        ],
                                                  })
                                                }
                                                className="h-4 w-4 accent-gold"
                                              />
                                              <span className="grow">
                                                {e.name}
                                              </span>
                                              <span className="text-[12px] text-ink2">
                                                +{money(e.pricePence)}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* toppings, side by side */}
                                  {tops.length > 0 && (
                                    <div className="mt-2.5">
                                      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                                        <input
                                          type="checkbox"
                                          checked={slice.toppingIds.length > 0}
                                          onChange={(e) =>
                                            setSlice(f.id, i, {
                                              toppingIds: e.target.checked
                                                ? [tops[0].id]
                                                : [],
                                            })
                                          }
                                          className="h-4 w-4 accent-gold"
                                        />
                                        Add toppings
                                        <span className="text-[11px] text-ink2">
                                          up to {Math.min((f.maxToppings || Infinity), tops.length)}
                                        </span>
                                      </label>

                                      {slice.toppingIds.length > 0 && (
                                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                                          {/* Never more boxes than there are
                                              toppings to put in them. */}
                                          {Array.from(
                                            {
                                              length: Math.min(
                                                (f.maxToppings || Infinity),
                                                tops.length
                                              ),
                                            },
                                            (_, n) => {
                                              const value =
                                                slice.toppingIds[n] ?? "";
                                              // Anything already chosen on
                                              // another dropdown is hidden, so
                                              // the same topping can't be
                                              // picked twice.
                                              const taken =
                                                slice.toppingIds.filter(
                                                  (_, j) => j !== n
                                                );
                                              return (
                                                <select
                                                  key={n}
                                                  value={value}
                                                  onChange={(e) => {
                                                    const next = [
                                                      ...slice.toppingIds,
                                                    ];
                                                    if (e.target.value)
                                                      next[n] = e.target.value;
                                                    else next.splice(n, 1);
                                                    setSlice(f.id, i, {
                                                      toppingIds: next.filter(
                                                        Boolean
                                                      ),
                                                    });
                                                  }}
                                                  className="w-full rounded-btn border border-field bg-paper px-2 py-2 text-[13px] text-ink focus:border-gold focus:outline-none"
                                                >
                                                  <option value="">
                                                    Topping {n + 1}
                                                  </option>
                                                  {tops
                                                    .filter(
                                                      (e) =>
                                                        !taken.includes(e.id)
                                                    )
                                                    .map((e) => (
                                                      <option
                                                        key={e.id}
                                                        value={e.id}
                                                      >
                                                        {e.name} +
                                                        {money(e.pricePence)}
                                                      </option>
                                                    ))}
                                                </select>
                                              );
                                            }
                                          )}
                                        </div>
                                      )}

                                      {slice.toppingIds.length > 0 && (
                                        <p className="mt-1 text-[11px] text-ink2">
                                          Going {where}
                                          {f.serving === "CHOICE" && " — set that above"}.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                    </>
                                  )}

                                  {/*
                                    How many of this exact combination. Asking
                                    here rather than afterwards means the
                                    price is settled before it collapses into
                                    a line.
                                  */}
                                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                                    <span className="text-[13px] font-semibold text-ink">
                                      How many like this?
                                    </span>
                                    <span className="flex items-center gap-3">
                                      <button
                                        onClick={() =>
                                          setDraftQty({
                                            ...draftQty,
                                            [f.id]: Math.max(
                                              1,
                                              (draftQty[f.id] ?? 1) - 1
                                            ),
                                          })
                                        }
                                        disabled={(draftQty[f.id] ?? 1) <= 1}
                                        className="h-8 w-8 rounded-btn border border-field bg-paper text-lg text-ink disabled:opacity-25"
                                        aria-label="One fewer"
                                      >
                                        −
                                      </button>
                                      <span className="w-5 text-center text-[16px] font-bold">
                                        {draftQty[f.id] ?? 1}
                                      </span>
                                      <button
                                        onClick={() =>
                                          setDraftQty({
                                            ...draftQty,
                                            [f.id]: (draftQty[f.id] ?? 1) + 1,
                                          })
                                        }
                                        // Stops at whatever would be refused
                                        // at checkout, rather than letting
                                        // someone pick 5 and find out later.
                                        disabled={
                                          count + (draftQty[f.id] ?? 1) - 1 >=
                                            maxSlices ||
                                          (f.maxPerOrder
                                            ? chosen.length +
                                                (draftQty[f.id] ?? 1) -
                                                1 >=
                                              f.maxPerOrder
                                            : false) ||
                                          (left !== null &&
                                            (hasOwnStock(f.id)
                                              ? chosen.length
                                              : generalPicked()) +
                                              (draftQty[f.id] ?? 1) -
                                              1 >=
                                              left)
                                        }
                                        className="h-8 w-8 rounded-btn border border-navy bg-navy text-lg text-white disabled:opacity-25"
                                        aria-label="One more"
                                      >
                                        +
                                      </button>
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => confirmDraft(f)}
                                    className="mt-2.5 w-full rounded-btn bg-navy py-3 text-[14px] font-bold text-white"
                                  >
                                    Confirm ·{" "}
                                    {draftQty[f.id] ?? 1} slice
                                    {(draftQty[f.id] ?? 1) === 1 ? "" : "s"} ·{" "}
                                    {money(
                                      sliceTotal(f.id, slice) *
                                        (draftQty[f.id] ?? 1)
                                    )}
                                  </button>

                                  <button
                                    onClick={() => cancelDraft(f)}
                                    className="mt-1.5 w-full py-1.5 text-center text-[12px] text-ink2 underline underline-offset-4"
                                  >
                                    Cancel this slice
                                  </button>

                                  <p className="mt-1 text-center text-[11.5px] leading-snug text-muted">
                                    You can add another slice with different
                                    choices after.
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </li>
                    </Fragment>
                  );
                })}
              </ul>
            </Card>

            {/* 4 — review and pay */}
            <Card>
              <StepTitle n={4}>Review &amp; Pay</StepTitle>

              {/* Directly above the tick boxes, so it's the last thing read
                  before agreeing. */}
              <SelectionAllergens
                flavours={flavours}
                extras={extras}
                picks={picks}
              />

              <label className="flex gap-3 rounded-card border border-line bg-cream-warm px-4 py-3 text-[13px] leading-relaxed text-ink2">
                <input
                  type="checkbox"
                  checked={allergenOk}
                  onChange={(e) => setAllergenOk(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                />
                <span>
                  <span className="block font-semibold text-ink">
                    {ALLERGEN_HEADING}
                  </span>
                  {ALLERGEN_BODY}{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    className="underline underline-offset-2 hover:text-ink"
                  >
                    Read more
                  </a>
                </span>
              </label>

              <label className="mt-3 flex gap-3 rounded-card border border-line bg-cream-warm px-4 py-3 text-[13px] leading-relaxed text-ink2">
                <input
                  type="checkbox"
                  checked={policyOk}
                  onChange={(e) => setPolicyOk(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                />
                <span>
                  <span className="block font-semibold text-ink">
                    {NO_SHOW_HEADING}
                  </span>
                  {NO_SHOW_SHORT_BODY}{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    className="underline underline-offset-2 hover:text-ink"
                  >
                    Read the full policy
                  </a>
                </span>
              </label>

              <label className="mt-3 flex gap-3 px-4 text-[13px] leading-relaxed text-ink2">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                />
                <span>
                  Email me when a new flavour lands or slices are running low.
                  One click to stop, any time.
                </span>
              </label>

              {error && (
                <p className="mt-4 rounded-card border border-bad/30 bg-bad-light px-4 py-3 text-sm text-ink">
                  {error}
                </p>
              )}

              <button
                onClick={pay}
                disabled={Boolean(missing) || busy}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-btn bg-navy px-6 py-4 font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? "Working…"
                  : missing
                    ? missing
                    : testMode
                      ? `Place test order · ${money(total)}`
                      : `Pay Now · ${money(total)}`}
              </button>
              <p className="mt-2 text-center text-[12px] text-muted">
                Secure payments powered by Stripe
              </p>
            </Card>
          </div>

          {/* ---------- right: summary ---------- */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-card border border-line bg-paper p-6 shadow-soft">
              <h2 className="font-display text-2xl text-ink">Order Summary</h2>

              {count === 0 ? (
                <p className="mt-4 text-sm text-ink2">
                  Nothing chosen yet. Pick a date and your slices.
                </p>
              ) : (
                <ul className="mt-4 space-y-2 text-[15px]">
                  {Object.entries(picks).map(([id, arr]) => {
                    const f = flavours.find((x) => x.id === id)!;
                    const sep = arr.filter((x) => x.separate).length;
                    const withExtra = arr.filter((x) => x.extra).length;
                    const withSauce = arr.filter((x) => x.sauceIds.length > 0).length;
                    const withTops = arr.filter(
                      (x) => x.toppingIds.length > 0
                    ).length;

                    return (
                      <li key={id} className="flex justify-between gap-3">
                        <span>
                          {arr.length} × {f.name}
                          {f.hasToppings && f.serving === "CHOICE" && (
                            <span className="block text-[12px] text-gold">
                              {sep === 0
                                ? "All on collection"
                                : sep === arr.length
                                  ? "All separate"
                                  : `${sep} separate, ${arr.length - sep} on collection`}
                            </span>
                          )}
                          {withExtra > 0 && (
                            <span className="block text-[12px] text-gold">
                              {withExtra} × extra sauce
                            </span>
                          )}
                          {withSauce > 0 && (
                            <span className="block text-[12px] text-gold">
                              {arr
                                .flatMap((x) => x.sauceIds)
                                .map((id) => extras.find((e) => e.id === id)?.name)
                                .join(", ")}
                            </span>
                          )}
                          {withTops > 0 && (
                            <span className="block text-[12px] text-gold">
                              {arr
                                .flatMap((x) => x.toppingIds)
                                .map(
                                  (t) => extras.find((e) => e.id === t)?.name
                                )
                                .join(", ")}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium">
                          {money(
                            arr.reduce((n, x) => n + sliceTotal(id, x), 0)
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="mt-4 flex items-center justify-between border-t border-line pt-4 font-semibold text-ink">
                <span>Total</span>
                <span className="font-display text-xl">{money(total)}</span>
              </p>

              {day && (
                <>
                  <h3 className="mt-6 font-semibold text-ink">
                    Collection Details
                  </h3>
                  <p className="mt-1 text-sm text-ink2">{day.label}</p>
                  <p className="text-sm text-ink2">{day.window}</p>
                  <p className="mt-1 text-sm text-ink2">
                    Full address comes with your confirmation.
                  </p>
                </>
              )}

              {(form.firstName || form.email) && (
                <>
                  <h3 className="mt-6 font-semibold text-ink">Your Details</h3>
                  <dl className="mt-1 space-y-0.5 text-sm text-ink2">
                    {form.firstName && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 text-muted">Name</dt>
                        <dd>{form.firstName} {form.lastName}</dd>
                      </div>
                    )}
                    {form.mobile && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 text-muted">Mobile</dt>
                        <dd>{form.mobile}</dd>
                      </div>
                    )}
                    {form.email && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 text-muted">Email</dt>
                        <dd className="break-all">{form.email}</dd>
                      </div>
                    )}
                  </dl>
                </>
              )}

              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 block rounded-card bg-[#E6EEF7] px-4 py-3"
                >
                  <span className="block text-sm font-semibold text-ink">
                    Need help? Contact us on WhatsApp
                  </span>
                  <span className="block text-[12px] text-ink2">
                    We&apos;re here to help with any enquiries.
                  </span>
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* sticky basket on mobile */}
      {count > 0 && (
        <div className="sticky bottom-0 z-30 mt-6 border-t border-navy/20 bg-navy-dark px-5 py-3 text-white lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <span className="text-sm">
              {count} slice{count === 1 ? "" : "s"} · {money(total)}
            </span>
            <button
              onClick={pay}
              disabled={Boolean(missing) || busy}
              className="rounded-btn bg-gold px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {missing ?? "Pay now"}
            </button>
          </div>
        </div>
      )}

      {/* photo viewer */}
      {zoom?.image && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6"
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-card bg-paper"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square w-full">
              <Image src={zoom.image} alt={zoom.name} fill sizes="768px" quality={95}
                  className="object-cover" />
            </div>
            <div className="p-5">
              <h3 className="font-display text-2xl text-ink">{zoom.name}</h3>
              <p className="mt-1 text-sm text-ink2">{zoom.description}</p>
              <button
                onClick={() => setZoom(null)}
                className="mt-4 w-full rounded-btn border border-navy py-2.5 text-sm font-semibold text-navy"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------- bits ---------- */

const Card = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-card border border-line bg-paper p-5 shadow-soft sm:p-6">
    {children}
  </section>
);

const StepTitle = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <h2 className="mb-4 flex items-center gap-3 font-display text-2xl text-ink">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-body text-sm font-semibold text-white">
      {n}
    </span>
    <span>{children}</span>
  </h2>
);

function ToppingChoice({
  on,
  onClick,
  title,
  note,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-btn border px-3 py-2 text-left transition-colors",
        on ? "border-gold bg-gold-light" : "border-field bg-paper hover:border-gold/60",
      ].join(" ")}
    >
      <span className="block text-[13px] font-semibold text-ink">{title}</span>
      <span className="block text-[11px] text-ink2">{note}</span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="mt-4 block sm:mt-0">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-btn border border-field bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
      />
    </label>
  );
}


/**
 * Create Your Own, built one step at a time.
 *
 * Sauce first, because the slice is built on it and one is required. Only
 * then do the toppings open — someone scrolling past a wall of toppings
 * before they've picked a sauce is the thing this avoids.
 *
 * Tick lists rather than dropdowns: with no limit on toppings, a dropdown
 * per topping would be unusable on a phone. Each option shows its own
 * allergens, so the combined list at checkout loses nothing.
 */
function BuildYourOwn({
  flavour,
  sauces,
  tops,
  drizzles,
  slice,
  where,
  onChange,
}: {
  flavour: Flavour;
  sauces: Extra[];
  tops: Extra[];
  drizzles: Extra[];
  slice: Slice;
  where: string;
  onChange: (patch: Partial<Slice>) => void;
}) {
  // Straight to toppings when coming back to a slice that already has a
  // sauce, so re-opening it doesn't lose their place.
  const [step, setStep] = useState<1 | 2>(slice.sauceIds.length ? 2 : 1);

  const sauceLimit = flavour.maxSauces > 0 ? flavour.maxSauces : Infinity;
  const toppingLimit = flavour.maxToppings > 0 ? flavour.maxToppings : Infinity;
  const drizzleLimit = flavour.maxDrizzles > 0 ? flavour.maxDrizzles : Infinity;

  const toggle = (
    list: string[],
    id: string,
    limit: number
  ): string[] =>
    list.includes(id)
      ? list.filter((x) => x !== id)
      : list.length >= limit
        ? list
        : [...list, id];

  const label = (e: Extra) =>
    e.allergens?.length
      ? e.allergens.map((a) => allergenLabel(a)).join(", ")
      : null;

  const Option = ({
    e,
    on,
    locked,
    note,
    onClick,
  }: {
    e: Extra;
    on: boolean;
    locked: boolean;
    note: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      disabled={locked}
      className={[
        "flex w-full items-start gap-2.5 rounded-btn border px-3 py-2.5 text-left transition-colors",
        on
          ? "border-navy bg-navy/5"
          : "border-field bg-paper hover:bg-cream-warm",
        locked ? "opacity-40" : "",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] text-white",
          on ? "border-navy bg-navy" : "border-field",
        ].join(" ")}
      >
        {on ? "✓" : ""}
      </span>
      <span className="grow">
        <span className="block text-[14px] text-ink">{e.name}</span>
        {label(e) && (
          <span className="block text-[11px] text-ink2">
            Contains: {label(e)}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[12px] text-ink2">{note}</span>
    </button>
  );

  return (
    <div className="mt-2.5">
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setStep(1)}
          className={[
            "rounded-btn py-2 text-[11px] font-bold uppercase tracking-wide",
            step === 1
              ? "bg-navy text-white"
              : "bg-good-light text-good",
          ].join(" ")}
        >
          {step === 1 ? "1 · Sauce" : "✓ Sauce"}
        </button>
        <span
          className={[
            "rounded-btn py-2 text-center text-[11px] font-bold uppercase tracking-wide",
            step === 2 ? "bg-navy text-white" : "bg-cream-beige text-muted",
          ].join(" ")}
        >
          2 · Toppings
        </span>
      </div>

      {step === 1 ? (
        <>
          <p className="text-[13px] font-semibold text-ink">
            Choose your sauce
          </p>
          <p className="mb-2 text-[12px] text-ink2">
            At least one
            {Number.isFinite(sauceLimit) ? `, up to ${sauceLimit}` : ""}
          </p>

          <div className="space-y-1.5">
            {sauces.map((e) => {
              const on = slice.sauceIds.includes(e.id);
              const isFirst = slice.sauceIds[0] === e.id;
              const locked = !on && slice.sauceIds.length >= sauceLimit;
              return (
                <Option
                  key={e.id}
                  e={e}
                  on={on}
                  locked={locked}
                  // The first sauce is part of the slice, so only the
                  // second is charged.
                  note={
                    isFirst || (!on && slice.sauceIds.length === 0)
                      ? "included"
                      : `+${money(e.pricePence)}`
                  }
                  onClick={() => {
                    const next = toggle(slice.sauceIds, e.id, sauceLimit);
                    onChange({
                      sauceIds: next,
                      warmSauceIds: slice.warmSauceIds.filter((x) =>
                        next.includes(x)
                      ),
                    });
                  }}
                />
              );
            })}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={slice.sauceIds.length === 0}
            className="mt-3 w-full rounded-btn bg-navy py-3 text-[14px] font-bold text-white transition-colors disabled:bg-cream-beige disabled:text-muted"
          >
            {slice.sauceIds.length === 0
              ? "Choose a sauce to continue"
              : "Next: toppings →"}
          </button>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {slice.sauceIds.map((id) => {
              const e = sauces.find((x) => x.id === id);
              return e ? (
                <span
                  key={id}
                  className="rounded-full bg-navy px-2.5 py-1 text-[12px] text-white"
                >
                  {e.name}
                </span>
              ) : null;
            })}
          </div>

          <p className="text-[13px] font-semibold text-ink">Add toppings</p>
          <p className="mb-2 text-[12px] text-ink2">
            Optional
            {Number.isFinite(toppingLimit)
              ? ` — up to ${toppingLimit}`
              : " — add as many as you like"}
          </p>

          <div className="space-y-1.5">
            {tops.map((e) => {
              const on = slice.toppingIds.includes(e.id);
              const locked = !on && slice.toppingIds.length >= toppingLimit;
              return (
                <Option
                  key={e.id}
                  e={e}
                  on={on}
                  locked={locked}
                  note={`+${money(e.pricePence)}`}
                  onClick={() =>
                    onChange({
                      toppingIds: toggle(slice.toppingIds, e.id, toppingLimit),
                    })
                  }
                />
              );
            })}
            {tops.length === 0 && (
              <p className="text-[12px] text-muted">No toppings offered.</p>
            )}
          </div>

          {/* Same step as toppings: a drizzle goes over them, so choosing
              both together is how you'd actually describe it. */}
          {drizzles.length > 0 && (
            <>
              <p className="mt-4 text-[13px] font-semibold text-ink">
                Sauce drizzle over the top
              </p>
              <p className="mb-2 text-[12px] text-ink2">
                Optional
                {drizzleLimit !== Infinity ? ` — up to ${drizzleLimit}` : ""}
              </p>

              <div className="space-y-1.5">
                {drizzles.map((e) => {
                  const on = slice.drizzleIds.includes(e.id);
                  const locked =
                    !on && slice.drizzleIds.length >= drizzleLimit;
                  return (
                    <Option
                      key={e.id}
                      e={e}
                      on={on}
                      locked={locked}
                      note={`+${money(e.pricePence)}`}
                      onClick={() =>
                        onChange({
                          drizzleIds: toggle(
                            slice.drizzleIds,
                            e.id,
                            drizzleLimit
                          ),
                        })
                      }
                    />
                  );
                })}
              </div>
            </>
          )}

          {(slice.toppingIds.length > 0 || slice.drizzleIds.length > 0) && (
            <p className="mt-2 text-[11px] text-ink2">Going {where}.</p>
          )}

          <button
            onClick={() => setStep(1)}
            className="mt-2 text-[12px] font-semibold text-gold-hover underline underline-offset-4"
          >
            ← Change sauce
          </button>
        </>
      )}
    </div>
  );
}


/**
 * Every allergen in what they've chosen, before they tick to agree.
 *
 * A normal flavour lists separately from anything added to it, so it's clear
 * what an addition brought. Create Your Own is one thing they built, so its
 * sauces and toppings fold into a single entry under its name.
 */
function SelectionAllergens({
  flavours,
  extras,
  picks,
}: {
  flavours: Flavour[];
  extras: Extra[];
  picks: Picks;
}) {
  const find = (id: string) => extras.find((e) => e.id === id);

  const rows = new Map<
    string,
    { name: string; kind: string; allergens: Set<string> }
  >();
  const add = (key: string, name: string, kind: string, list: string[] = []) => {
    const row = rows.get(key) ?? { name, kind, allergens: new Set<string>() };
    list.forEach((a) => row.allergens.add(a));
    rows.set(key, row);
  };

  for (const f of flavours) {
    const slices = picks[f.id] ?? [];
    if (!slices.length) continue;

    for (const sl of slices) {
      const sauces = sl.sauceIds.map(find).filter(Boolean) as Extra[];
      const toppings = sl.toppingIds.map(find).filter(Boolean) as Extra[];
      const drizzles = sl.drizzleIds.map(find).filter(Boolean) as Extra[];

      if (f.buildYourOwn) {
        add(`f:${f.id}`, f.name, "Flavour", [
          ...f.allergens,
          ...sauces.flatMap((e) => e.allergens ?? []),
          ...toppings.flatMap((e) => e.allergens ?? []),
          ...drizzles.flatMap((e) => e.allergens ?? []),
        ]);
        continue;
      }

      add(`f:${f.id}`, f.name, "Flavour", f.allergens);
      for (const e of sauces) add(`e:${e.id}`, e.name, "Sauce", e.allergens);
      for (const e of toppings) add(`e:${e.id}`, e.name, "Topping", e.allergens);
      for (const e of drizzles) add(`e:${e.id}`, e.name, "Drizzle", e.allergens);
    }
  }

  if (!rows.size) return null;

  const list = [...rows.values()];
  const everything = [...new Set(list.flatMap((r) => [...r.allergens]))].sort();

  return (
    <div className="mb-4 overflow-hidden rounded-card border-2 border-bad bg-paper">
      <p className="bg-bad px-4 py-2.5 text-[13px] font-extrabold uppercase leading-snug tracking-wide text-white">
        ⚠ Please read all the allergens for your selection below
      </p>

      <div className="px-4 py-3">
        <ul className="divide-y divide-bad/10">
          {list.map((r) => (
            <li key={r.name + r.kind} className="py-2">
              <p className="text-[14px] font-bold text-ink">
                {r.name}
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {r.kind}
                </span>
              </p>
              {r.allergens.size ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {[...r.allergens].sort().map((a) => (
                    <span
                      key={a}
                      className="rounded bg-bad-light px-1.5 py-0.5 text-[12px] font-semibold text-bad"
                    >
                      {allergenLabel(a)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 text-[12px] italic text-muted">
                  No allergens listed
                </p>
              )}
            </li>
          ))}
        </ul>

        {everything.length > 0 && (
          <div className="mt-3 rounded-btn bg-bad-light px-3 py-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-bad">
              Your order contains
            </p>
            <p className="mt-0.5 text-[14px] font-bold text-ink">
              {everything.map((a) => allergenLabel(a)).join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
