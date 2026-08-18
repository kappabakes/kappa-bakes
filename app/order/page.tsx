"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  allowSeparate: boolean;
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
  maxToppings: number;
};

/** How many of each flavour are left, for the chosen date. */
type Stock = Record<
  string,
  Record<string, { sold: number; stock: number | null; left: number | null }>
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
  kind: "SAUCE" | "TOPPING";
  name: string;
  pricePence: number;
};

/**
 * One entry per slice.
 *   separate   the flavour's own toppings go in a tub rather than on
 *   extra      more of the sauce it comes with — priced by placement
 *   sauceId    a sauce chosen for a flavour that comes without one
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
  sauceId: string | null;
  toppingIds: string[];
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
    if (params.get("cancelled") !== "1") return;
    const sessionId = params.get("session_id");

    // Tidy the address bar either way, so a refresh doesn't repeat this.
    window.history.replaceState(null, "", "/order");

    if (!sessionId) return;
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
    return Boolean(own && own.stock !== null && own.stock !== undefined);
  };

  /** Slices chosen that come out of the day's general pool. */
  const generalPicked = () =>
    Object.entries(picks).reduce(
      (n, [id, arr]) => n + (hasOwnStock(id) ? 0 : arr.length),
      0
    );

  const priceOf = (id: string) =>
    extras.find((e) => e.id === id)?.pricePence ?? 0;

  /** What one slice costs, including everything added to it. */
  const sliceTotal = (flavourId: string, s: Slice) => {
    const base = flavours.find((f) => f.id === flavourId)?.pricePence ?? 0;
    return (
      base +
      (s.extra ? extraSaucePence(s.extra) : 0) +
      (s.sauceId ? priceOf(s.sauceId) : 0) +
      s.toppingIds.reduce((n, id) => n + priceOf(id), 0)
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
    setPicks({
      ...picks,
      [f.id]: [
        ...(picks[f.id] ?? []),
        { separate: false, extra: null, sauceId: null, toppingIds: [] },
      ],
    });
    setError(null);
  };

  const removeOne = (f: Flavour) => {
    const arr = (picks[f.id] ?? []).slice(0, -1);
    const next = { ...picks };
    if (arr.length) next[f.id] = arr;
    else delete next[f.id];
    setPicks(next);
  };

  const setSlice = (id: string, i: number, patch: Partial<Slice>) =>
    setPicks({
      ...picks,
      [id]: picks[id].map((v, j) => (j === i ? { ...v, ...patch } : v)),
    });

  async function pay() {
    setBusy(true);
    setError(null);
    const slices = Object.entries(picks).flatMap(([flavourId, arr]) =>
      arr.map((s) => ({
        flavourId,
        toppings: s.separate ? "separately" : "on the slice",
        extraSauce: s.extra,
        addedSauceId: s.sauceId,
        addedToppingIds: s.toppingIds,
      }))
    );
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
    let data: { url?: string; orderNo?: string; error?: string } = {};
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

    if (looksUsable) window.location.href = url;
    else if (data.orderNo)
      window.location.href = `/order/confirmed?ok=${data.orderNo}`;
    else {
      setBusy(false);
      setError("Your order went through, but we couldn't open the confirmation. Check your email.");
    }
  }

  const missing =
    days?.length === 0 || (days && days.every((d) => d.soldOut))
      ? "Nothing available right now"
      : !form.firstName || !form.lastName || !form.mobile || !form.email
        ? "Fill in your details"
        : !dayIso
          ? "Choose a collection date"
          : count === 0
            ? "Choose your slices"
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
                {flavours.map((f) => {
                  const chosen = picks[f.id] ?? [];
                  const left = leftOf(f.id);
                  const soldOut = left !== null && left <= 0;
                  return (
                    <li
                      key={f.id}
                      className={[
                        "overflow-hidden rounded-card border border-line bg-cream-warm",
                        soldOut ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:gap-4">
                        {f.image && (
                          <button
                            onClick={() => setZoom(f)}
                            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-cream-beige"
                            aria-label={`See a photo of ${f.name}`}
                          >
                            <Image src={f.image} alt="" fill sizes="160px" quality={95}
                  className="object-cover" />
                          </button>
                        )}

                        <div className="min-w-[55%] grow">
                          <p className="font-display text-lg text-ink">{f.name}</p>
                          <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-ink2">
                            {f.description}
                          </p>
                          {soldOut ? (
                            <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-bad">
                              Sold out
                            </p>
                          ) : (
                            <>
                              {f.maxPerOrder && (
                                <p className="mt-1 text-[11px] font-semibold text-gold-hover">
                                  Limited to {f.maxPerOrder} per order
                                </p>
                              )}
                              {hasOwnStock(f.id) &&
                                left !== null &&
                                left <= 5 && (
                                  <p className="mt-1 text-[11px] font-semibold text-gold-hover">
                                    Only {left} left
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
                          <div className="mt-2 flex items-center overflow-hidden rounded-btn border border-field bg-paper">
                            <button
                              onClick={() => removeOne(f)}
                              disabled={!chosen.length}
                              className="px-3 py-1.5 text-lg text-ink disabled:opacity-25"
                              aria-label={`Remove a ${f.name}`}
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-semibold">
                              {chosen.length}
                            </span>
                            <button
                              onClick={() => add(f)}
                              disabled={count >= maxSlices}
                              className="px-3 py-1.5 text-lg text-ink disabled:opacity-25"
                              aria-label={`Add a ${f.name}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* One row per slice, so two of the same flavour can be
                          dressed differently. Added sauce and toppings follow
                          the same on-slice or in-a-tub choice. */}
                      {(f.hasToppings ||
                        f.sauceIds.length > 0 ||
                        f.toppingIds.length > 0) &&
                        chosen.length > 0 && (
                          <div className="space-y-3 border-t border-line bg-paper p-3">
                            {chosen.map((slice, i) => {
                              const where = slice.separate
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
                                    {/* No choice to make when everything has
                                        to go on the slice. */}
                                    {f.allowSeparate &&
                                      (f.hasToppings ||
                                        slice.sauceId ||
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

                                    {!f.allowSeparate &&
                                      (f.hasToppings ||
                                        slice.sauceId ||
                                        slice.toppingIds.length > 0) && (
                                        <span className="text-[12px] text-ink2">
                                          Served on the slice
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
                                                ? slice.separate && f.allowSeparate
                                                  ? "in a tub"
                                                  : "on the slice"
                                                : null,
                                            })
                                          }
                                          className="h-4 w-4 accent-gold"
                                        />
                                        Extra sauce
                                      </label>

                                      {slice.extra &&
                                        (slice.separate || !f.allowSeparate ? (
                                          <p className="mt-1.5 rounded-btn border border-gold bg-gold-light px-3 py-2 text-[12px] text-ink">
                                            {f.allowSeparate
                                              ? "In a tub, since your toppings are separate"
                                              : "On the slice"}{" "}
                                            ·{" "}
                                            <span className="font-semibold">
                                              +
                                              {money(
                                                extraSaucePence(
                                                  f.allowSeparate
                                                    ? "in a tub"
                                                    : "on the slice"
                                                )
                                              )}
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

                                  {/* a sauce for a flavour that comes without */}
                                  {sauces.length > 0 && (
                                    <div className="mt-2.5">
                                      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(slice.sauceId)}
                                          onChange={(e) =>
                                            setSlice(f.id, i, {
                                              sauceId: e.target.checked
                                                ? sauces[0].id
                                                : null,
                                            })
                                          }
                                          className="h-4 w-4 accent-gold"
                                        />
                                        Add sauce
                                      </label>

                                      {slice.sauceId && (
                                        <select
                                          value={slice.sauceId}
                                          onChange={(e) =>
                                            setSlice(f.id, i, {
                                              sauceId: e.target.value,
                                            })
                                          }
                                          className="mt-1.5 w-full rounded-btn border border-field bg-paper px-3 py-2 text-[14px] text-ink focus:border-gold focus:outline-none"
                                        >
                                          {sauces.map((e) => (
                                            <option key={e.id} value={e.id}>
                                              {e.name} +{money(e.pricePence)}
                                            </option>
                                          ))}
                                        </select>
                                      )}

                                      {slice.sauceId && (
                                        <p className="mt-1 text-[11px] text-ink2">
                                          Going {where}
                                          {f.allowSeparate && " — set that above"}.
                                        </p>
                                      )}
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
                                          up to {Math.min(f.maxToppings, tops.length)}
                                        </span>
                                      </label>

                                      {slice.toppingIds.length > 0 && (
                                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                                          {/* Never more boxes than there are
                                              toppings to put in them. */}
                                          {Array.from(
                                            {
                                              length: Math.min(
                                                f.maxToppings,
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
                                          {f.allowSeparate && " — set that above"}.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* 4 — review and pay */}
            <Card>
              <StepTitle n={4}>Review &amp; Pay</StepTitle>

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
                    const withSauce = arr.filter((x) => x.sauceId).length;
                    const withTops = arr.filter(
                      (x) => x.toppingIds.length > 0
                    ).length;

                    return (
                      <li key={id} className="flex justify-between gap-3">
                        <span>
                          {arr.length} × {f.name}
                          {f.hasToppings && f.allowSeparate && (
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
                                .filter((x) => x.sauceId)
                                .map(
                                  (x) =>
                                    extras.find((e) => e.id === x.sauceId)?.name
                                )
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
