"use client";

import { useCallback, useEffect, useState } from "react";
import { money, shortDay, extraSaucePence } from "@/lib/config";
import { PageHead, readError } from "./ui";
import { ManualOrder } from "./ManualOrder";

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z" />
  </svg>
);

const WhatsAppMark = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .5.4l.8 1.8c.1.2 0 .4-.1.5l-.4.5c-.1.1-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.3Z" />
  </svg>
);

type Slice = {
  flavourId: string;
  flavour: string;
  toppings: string | null;
  placement?: string | null;
  extraSauce?: string | null;
  addedSauce?: { name: string; pricePence: number } | null;
  addedSauceId?: string | null;
  addedToppings?: { name: string; pricePence: number }[] | null;
  addedToppingIds?: string[];
};

type Extra = {
  id: string;
  kind: "SAUCE" | "TOPPING";
  name: string;
  pricePence: number;
  active: boolean;
};
type Order = {
  id: string;
  orderNo: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  day: string;
  slices: Slice[];
  sliceCount: number;
  totalPence: number;
  status: "PAID" | "COLLECTED" | "NO_SHOW" | "CANCELLED";
  notes: string | null;
  adminNotes: string | null;
  emailStatus: string | null;
  smsStatus: string | null;
  isTest: boolean;
  isManual: boolean;
  paymentMethod: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelNote: string | null;
};
type Flavour = {
  id: string;
  name: string;
  hasToppings: boolean;
  pricePence: number;
  /// Which extras this flavour offers, so the editor shows the same choices
  /// the customer had.
  sauceIds?: string[];
  toppingIds?: string[];
  maxToppings?: number;
};
type Day = {
  iso: string;
  label: string;
  capacity: number;
  taken: number;
  left: number;
  startTime: string;
  endTime: string;
  breakdown: {
    flavour: string;
    total: number;
    separate: number;
    extraOnSlice: number;
    extraInTub: number;
    tubs: number;
    sauces: Record<string, number>;
    toppings: Record<string, number>;
  }[];
};

/** 09/08/2026 — the day alone isn't enough to tell two weekends apart. */
const ukDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

/** Group identical lines: "2x Plain Jane". Key is flavour + toppings. */
function summarise(slices: Slice[]) {
  const counts = new Map<string, number>();
  for (const s of slices) {
    let key = s.toppings
      ? `${s.flavour} — ${s.toppings}`
      : s.placement
        ? `${s.flavour} — ${s.placement}`
        : s.flavour;
    if (s.extraSauce) key += ` + EXTRA SAUCE (${s.extraSauce})`;
    if (s.addedSauce) key += ` + SAUCE: ${s.addedSauce.name}`;
    if (s.addedToppings?.length)
      key += ` + TOPPINGS: ${s.addedToppings.map((t) => t.name).join(", ")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([label, n]) => `${n}x ${label}`);
}

export function Orders({ flash }: { flash: (m: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /// Tap a flavour in the breakdown to see only the orders containing it.
  const [flavourFilter, setFlavourFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [o, f, d, x] = await Promise.all([
      fetch("/api/admin/orders"),
      fetch("/api/admin/flavours"),
      fetch("/api/admin/days"),
      fetch("/api/admin/extras"),
    ]);
    if (o.ok) setOrders((await o.json()).orders);
    else flash(await readError(o));
    if (f.ok)
      setFlavours(
        (await f.json()).flavours.filter(
          (y: Flavour & { active: boolean }) => y.active
        )
      );
    if (d.ok) setDays((await d.json()).days);
    if (x.ok)
      setExtras((await x.json()).extras.filter((e: Extra) => e.active));
  }, []);

  // Live: reload on mount, every 20 seconds, and when the tab regains focus.
  // Covers both a new order landing and an edit you've just made.
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  async function save(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error ?? "Couldn't save that.");
    flash(d.emailStatus ? `Resent — email ${d.emailStatus}, SMS ${d.smsStatus}` : "Saved");
    load();
  }

  const byDay = orders.reduce<Record<string, Order[]>>((acc, o) => {
    const key = new Date(o.day).toISOString();
    (acc[key] ??= []).push(o);
    return acc;
  }, {});

  // Only dates that still have orders to work through, newest first.
  const dayKeys = Object.keys(byDay).sort();

  // Default to the first date rather than showing everything at once.
  useEffect(() => {
    if (!pickedDay && dayKeys.length) setPickedDay(dayKeys[0]);
  }, [dayKeys, pickedDay]);

  /**
   * Filters within the chosen day. Matches order number, either name, email
   * or mobile — and ignores how the number was typed, so 07712, +447712 and
   * 7712 all find the same person.
   */
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^0/, "").replace(/^44/, "");

  const all = pickedDay ? (byDay[pickedDay] ?? []) : [];

  // The flavour filter and the search stack: filter to Special K, then search
  // within it.
  const byFlavour = flavourFilter
    ? all.filter((o) => o.slices.some((sl) => sl.flavour === flavourFilter))
    : all;

  const shown = !q
    ? byFlavour
    : byFlavour.filter((o) => {
        const text = [
          o.orderNo,
          o.firstName,
          o.lastName,
          `${o.firstName} ${o.lastName}`,
          o.email,
        ]
          .join(" ")
          .toLowerCase();
        const mobileMatch =
          digits.length >= 3 && o.mobile.replace(/\D/g, "").includes(digits);
        return text.includes(q) || mobileMatch;
      });

  return (
    <section>
      <PageHead
        title="Orders"
        note="Pick a collection date to work through it."
      />

      <div className="mb-5">
        <ManualOrder onDone={load} flash={flash} />
      </div>

      {orders.length === 0 && (
        <p className="mt-4 text-ink2">
          No paid orders yet. They appear the moment someone pays.
        </p>
      )}

      {/* pick a date, then work through it */}
      {dayKeys.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {dayKeys.map((key) => {
            const list = byDay[key];
            const info = days.find(
              (d) => new Date(d.iso).getTime() === new Date(key).getTime()
            );
            const on = pickedDay === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setPickedDay(key);
                  setEditing(null);
                  setQuery("");
                  setFlavourFilter(null);
                }}
                className={[
                  "rounded-card border px-4 py-3 text-left transition-colors",
                  on
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-paper text-ink hover:border-gold",
                ].join(" ")}
              >
                <span className="block font-semibold">
                  {shortDay(key)} {ukDate(key)}
                </span>
                <span
                  className={[
                    "mt-0.5 block text-[12px]",
                    on ? "text-white/80" : "text-ink2",
                  ].join(" ")}
                >
                  {list.length} order{list.length === 1 ? "" : "s"} ·{" "}
                  {list.reduce((n, o) => n + o.sliceCount, 0)} slices
                  {info && ` · ${info.startTime}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {(() => {
        if (!pickedDay) return null;
        const info = days.find(
          (d) => new Date(d.iso).getTime() === new Date(pickedDay).getTime()
        );
        const list = shown;
        return (
        <div>
          {/* the day at a glance */}
          {info && (
            <div className="mb-4 rounded-card border border-line bg-paper p-5 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl text-ink">
                  {shortDay(pickedDay)} {ukDate(pickedDay)}
                </h3>
                <span className="text-[13px] text-ink2">
                  {info.startTime} – {info.endTime}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                <Stat label="Capacity" value={info.capacity} />
                <Stat label="Sold" value={info.taken} accent />
                <Stat label="Left" value={info.left} />
                <Stat label="Orders" value={list.length} />
                </div>

                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        "Email everyone still to collect on this day? Anyone already reminded, collected or marked no-show is skipped."
                      )
                    )
                      return;
                    const r = await fetch(
                      "/api/cron/collection-reminder?manual=true"
                    );
                    const d = await r.json();
                    flash(
                      r.ok
                        ? d.reason ?? `Reminder sent to ${d.sent} of ${d.total}`
                        : "Couldn't send reminders"
                    );
                    load();
                  }}
                  className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
                >
                  Send collection reminders
                </button>
              </div>

              {info.breakdown.length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-line pt-3">
                  {info.breakdown.map((b) => {
                    const on = flavourFilter === b.flavour;
                    return (
                      <li key={b.flavour}>
                        {/* Tap a flavour to see only the orders with it in. */}
                        <button
                          onClick={() =>
                            setFlavourFilter(on ? null : b.flavour)
                          }
                          className={[
                            "flex w-full items-baseline justify-between gap-4 rounded-btn px-2 py-1.5 text-left text-[15px] transition-colors",
                            on
                              ? "bg-navy text-white"
                              : "hover:bg-cream-warm",
                          ].join(" ")}
                        >
                          <span
                            className={on ? "font-semibold" : "text-ink"}
                          >
                            {b.flavour}
                            {on && <span className="ml-2 text-[12px]">✕</span>}
                          </span>

                          <span
                            className={[
                              "text-[13px]",
                              on ? "text-white/80" : "text-ink2",
                            ].join(" ")}
                          >
                            {b.total} slice{b.total === 1 ? "" : "s"}
                            {b.tubs > 0 && (
                              <span className={on ? "" : "text-gold"}>
                                {" "}
                                · {b.tubs} tub{b.tubs === 1 ? "" : "s"}
                              </span>
                            )}
                          </span>
                        </button>

                        {/* The detail behind the tub count, so you know what
                            each one is for. */}
                        {(b.separate > 0 ||
                          b.extraOnSlice > 0 ||
                          b.extraInTub > 0 ||
                          Object.keys(b.sauces).length > 0 ||
                          Object.keys(b.toppings).length > 0) && (
                          <p className="px-2 pb-1 text-[12px] leading-relaxed text-ink2">
                            {[
                              b.separate > 0 &&
                                `${b.separate} × toppings in a tub`,
                              b.extraOnSlice > 0 &&
                                `${b.extraOnSlice} × extra sauce on the slice`,
                              b.extraInTub > 0 &&
                                `${b.extraInTub} × extra sauce in a tub`,
                              ...Object.entries(b.sauces).map(
                                ([name, n]) => `${n} × ${name}`
                              ),
                              ...Object.entries(b.toppings).map(
                                ([name, n]) => `${n} × ${name}`
                              ),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {flavourFilter && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-navy bg-navy px-4 py-2.5 text-white">
              <span className="text-[15px]">
                Showing orders with{" "}
                <strong>{flavourFilter}</strong> in them
              </span>
              <button
                onClick={() => setFlavourFilter(null)}
                className="rounded-btn bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                ✕ Show all orders
              </button>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this day — name, order number, mobile or email"
              className="grow rounded-btn border border-field bg-paper px-4 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="rounded-btn border border-navy bg-paper px-4 py-2.5 text-sm font-semibold text-navy"
              >
                Clear
              </button>
            )}
          </div>

          {(query || flavourFilter) && (
            <p className="mb-3 text-[13px] text-ink2">
              Showing {list.length} of {all.length} order
              {all.length === 1 ? "" : "s"}
            </p>
          )}

          <ul className="divide-y divide-line">
            {list.length === 0 && (query || flavourFilter) && (
              <li className="py-6 text-center text-sm text-ink2">
                Nothing matches
                {flavourFilter && ` for ${flavourFilter}`}
                {query && " with that search"}. Clear it and try again.
              </li>
            )}
            {list.map((o) => (
              <li
                key={o.id}
                // The outcome is visible at a glance: green once collected,
                // red for a no-show, plain while it's still to happen.
                className={[
                  "border-l-4 px-4 py-4 transition-colors",
                  o.status === "COLLECTED"
                    ? "border-good bg-good-light/40"
                    : o.status === "NO_SHOW" || o.status === "CANCELLED"
                      ? "border-bad bg-bad-light/40"
                      : "border-transparent bg-paper",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-sm text-gold">
                    {o.orderNo}
                  </span>
                  <span className="grow font-semibold text-[17px]">
                    {o.firstName} {o.lastName}
                  </span>
                  {/* A customer who has paid and had no confirmation is the
                    one failure worth interrupting you for. */}
                {o.emailStatus && o.emailStatus !== "Sent" && (
                  <p className="mt-2 flex flex-wrap items-center gap-3 rounded-card border border-bad/40 bg-bad-light px-3 py-2 text-[13px] text-ink">
                    <span>
                      <strong>No confirmation email sent.</strong> They&apos;ve
                      paid but have no collection details.
                    </span>
                    <button
                      onClick={() => save({ id: o.id, resendEmail: true })}
                      className="rounded-btn bg-bad px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Send it now
                    </button>
                  </p>
                )}

                {o.status === "CANCELLED" && (
                    <span className="rounded-md bg-bad px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Cancelled
                    </span>
                  )}
                  {o.isManual && (
                    <span className="rounded-md bg-cream-beige px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink2">
                      {o.paymentMethod ?? "by hand"}
                    </span>
                  )}
                  <span className="font-mono text-sm">
                    {money(o.totalPence)}
                  </span>
                </div>

                <ul className="mt-2 text-sm text-ink2">
                  {summarise(o.slices).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>

                {o.notes && (
                  <p className="mt-2 text-sm text-gold">“{o.notes}”</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink2">
                  <a
                    href={`tel:${o.mobile}`}
                    className="inline-flex items-center gap-1.5 hover:text-ink"
                  >
                    <PhoneIcon />
                    {o.mobile}
                  </a>
                  <a
                    href={`mailto:${o.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-ink"
                  >
                    <MailIcon />
                    {o.email}
                  </a>
                  <span>
                    email {o.emailStatus ?? "—"} · sms {o.smsStatus ?? "—"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                  {/* what happened on the day */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        save({
                          id: o.id,
                          status: o.status === "COLLECTED" ? "PAID" : "COLLECTED",
                        })
                      }
                      className={[
                        "rounded-btn border border-navy px-3 py-1.5 text-xs font-semibold transition-colors",
                        o.status === "COLLECTED"
                          ? "bg-good text-white"
                          : "bg-good-light text-good hover:bg-good hover:text-white",
                      ].join(" ")}
                    >
                      {o.status === "COLLECTED" ? "Collected ✓" : "Collected"}
                    </button>

                    <button
                      onClick={() =>
                        save({
                          id: o.id,
                          status: o.status === "NO_SHOW" ? "PAID" : "NO_SHOW",
                        })
                      }
                      className={[
                        "rounded-btn border border-navy px-3 py-1.5 text-xs font-semibold transition-colors",
                        o.status === "NO_SHOW"
                          ? "bg-bad text-white"
                          : "bg-bad-light text-bad hover:bg-bad hover:text-white",
                      ].join(" ")}
                    >
                      {o.status === "NO_SHOW" ? "No-show ✓" : "No-show"}
                    </button>
                  </div>

                  <span className="hidden h-6 w-px bg-line sm:block" />

                  {/* send it again */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => save({ id: o.id, resendEmail: true })}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
                    >
                      <MailIcon />
                      Resend email
                    </button>
                    <button
                      onClick={() => save({ id: o.id, resendSms: true })}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
                    >
                      <PhoneIcon />
                      Resend SMS
                    </button>
                    <button
                      onClick={() => {
                        // WhatsApp can't be sent from a server without the
                        // paid Business API, so this opens the chat with the
                        // message already written.
                        const lines = summarise(o.slices).join(", ");
                        const text = encodeURIComponent(
                          `Hi ${o.firstName}, your Kappa Bakes order ${o.orderNo} is confirmed. ` +
                            `${shortDay(o.day)} collection. ${lines}. Total ${money(o.totalPence)}.`
                        );
                        window.open(
                          `https://wa.me/${o.mobile.replace(/\D/g, "")}?text=${text}`,
                          "_blank"
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-navy bg-whatsapp px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <WhatsAppMark />
                      WhatsApp
                    </button>
                  </div>

                  <span className="hidden h-6 w-px bg-line sm:block" />

                  {/* the record itself */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditing(editing === o.id ? null : o.id)}
                      className="rounded-btn border border-navy bg-cream-beige px-3 py-1.5 text-xs font-semibold text-ink2 transition-colors hover:bg-line"
                    >
                      {editing === o.id ? "Close" : "Edit"}
                    </button>
                    <button
                      onClick={() => window.open(`/admin/receipt/${o.id}`, "_blank")}
                      className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
                    >
                      Order record
                    </button>
                    {o.status !== "CANCELLED" && (
                      <button
                        onClick={() =>
                          setCancelling(cancelling === o.id ? null : o.id)
                        }
                        className="rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        {cancelling === o.id ? "Close" : "Cancel"}
                      </button>
                    )}
                    {/* Available on any order. A Stripe one takes a stronger
                        warning, because deleting it removes your only record
                        of a real payment. */}
                    <button
                      onClick={async () => {
                        const paid = !o.isTest && !o.isManual;
                        if (
                          !confirm(
                            paid
                              ? `Delete ${o.orderNo}?\n\nThis was paid through Stripe. Deleting removes your record of it — the order, both policy acceptances and its history — permanently. Stripe keeps its own record of the payment.\n\nRefunding and cancelling is usually the better option.`
                              : `Delete ${o.isTest ? "test" : "manual"} order ${o.orderNo}? This can't be undone.`
                          )
                        )
                          return;
                        const r = await fetch(
                          `/api/admin/orders?id=${o.id}`,
                          { method: "DELETE" }
                        );
                        if (!r.ok) return flash(await readError(r));
                        flash(`${o.orderNo} deleted`);
                        load();
                      }}
                      className="rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {cancelling === o.id && (
                  <CancelPanel
                    order={o}
                    onClose={() => setCancelling(null)}
                    onDone={() => {
                      setCancelling(null);
                      load();
                    }}
                    flash={flash}
                  />
                )}

                {o.status === "CANCELLED" && (
                  <p className="mt-3 rounded-card border border-bad/40 bg-bad-light px-4 py-2.5 text-[13px] text-ink">
                    <strong>
                      Cancelled{" "}
                      {o.cancelledAt &&
                        new Date(o.cancelledAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    </strong>
                    <span className="block text-ink2">
                      {o.cancelReason === "CUSTOMER"
                        ? "At the customer's request."
                        : "By Kappa Bakes."}
                      {o.cancelNote && ` ${o.cancelNote}`}
                    </span>
                    <span className="mt-1 block text-[12px] text-ink2">
                      The slices are back on sale.
                    </span>
                  </p>
                )}

                {editing === o.id && (
                  <EditOrder
                    order={o}
                    days={days}
                    flavours={flavours}
                    onSave={(body) => {
                      save({ id: o.id, ...body });
                      setEditing(null);
                    }}
                    extras={extras}
                    onClose={() => setEditing(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
        );
      })()}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink2">
        {label}
      </span>
      <span
        className={[
          "block font-display text-2xl leading-tight",
          accent ? "text-gold" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </span>
  );
}

function EditOrder({
  order,
  days,
  flavours,
  extras,
  onSave,
  onClose,
}: {
  order: Order;
  days: Day[];
  flavours: Flavour[];
  extras: Extra[];
  onSave: (body: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    firstName: order.firstName,
    lastName: order.lastName,
    mobile: order.mobile,
    email: order.email,
    dayIso: new Date(order.day).toISOString(),
    adminNotes: order.adminNotes ?? "",
  });
  // Carries the chosen extras through, or editing an order would quietly
  // strip the sauce and toppings someone paid for.
  const [slices, setSlices] = useState(
    order.slices.map((s) => ({
      flavourId: s.flavourId,
      toppings: s.toppings,
      extraSauce: s.extraSauce ?? null,
      addedSauceId: s.addedSauceId ?? null,
      addedToppingIds: s.addedToppingIds ?? [],
    }))
  );

  // Extra sauce is charged on top, so leaving it out here made an untouched
  // order look like it had dropped in price.
  const priceOf = (id: string) =>
    extras.find((e) => e.id === id)?.pricePence ?? 0;

  const total = slices.reduce(
    (n, s) =>
      n +
      (flavours.find((x) => x.id === s.flavourId)?.pricePence ?? 0) +
      (s.extraSauce ? extraSaucePence(s.extraSauce) : 0) +
      (s.addedSauceId ? priceOf(s.addedSauceId) : 0) +
      s.addedToppingIds.reduce((m, id) => m + priceOf(id), 0),
    0
  );

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["firstName", "lastName", "mobile", "email"] as const).map((k) => (
          <label key={k} className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink2">
              {k === "firstName" ? "First name" : k === "lastName" ? "Last name" : k}
            </span>
            <input
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              className="mt-1 w-full border-b border-line bg-transparent pb-1.5 text-sm text-ink focus:border-gold"
            />
          </label>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink2">
          Collection day
        </span>
        <select
          value={f.dayIso}
          onChange={(e) => setF({ ...f, dayIso: e.target.value })}
          className="mt-1 w-full bg-cream px-3 py-2 text-sm text-ink"
        >
          {days.map((d) => (
            <option key={d.iso} value={d.iso}>
              {d.label} — {d.left} free
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink2">
          Slices
        </span>
        <ul className="mt-2 space-y-2">
          {slices.map((s, i) => {
            const fl = flavours.find((x) => x.id === s.flavourId);
            return (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={s.flavourId}
                  onChange={(e) =>
                    setSlices(slices.map((x, j) => (j === i ? { ...x, flavourId: e.target.value } : x)))
                  }
                  className="bg-cream px-2 py-1.5 text-sm text-ink"
                >
                  {flavours.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                {fl?.hasToppings && (
                  <select
                    value={s.toppings ?? "on the slice"}
                    onChange={(e) =>
                      setSlices(slices.map((x, j) => (j === i ? { ...x, toppings: e.target.value } : x)))
                    }
                    className="bg-cream px-2 py-1.5 text-sm text-ink"
                  >
                    <option value="on the slice">On the slice</option>
                    <option value="separately">Separately</option>
                  </select>
                )}
                {fl?.hasToppings && (
                  <select
                    value={s.extraSauce ?? ""}
                    onChange={(e) =>
                      setSlices(
                        slices.map((x, j) =>
                          j === i
                            ? { ...x, extraSauce: e.target.value || null }
                            : x
                        )
                      )
                    }
                    className="rounded-btn border border-field bg-paper px-2 py-1.5 text-sm text-ink"
                  >
                    <option value="">No extra sauce</option>
                    <option value="in a tub">Extra sauce — tub</option>
                    <option value="on the slice">Extra sauce — on slice</option>
                  </select>
                )}
                {(fl?.sauceIds?.length ?? 0) > 0 && (
                  <select
                    value={s.addedSauceId ?? ""}
                    onChange={(e) =>
                      setSlices(
                        slices.map((x, j) =>
                          j === i
                            ? { ...x, addedSauceId: e.target.value || null }
                            : x
                        )
                      )
                    }
                    className="rounded-btn border border-field bg-paper px-2 py-1.5 text-sm text-ink"
                  >
                    <option value="">No added sauce</option>
                    {extras
                      .filter(
                        (e) =>
                          e.kind === "SAUCE" && fl?.sauceIds?.includes(e.id)
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} (+{money(e.pricePence)})
                        </option>
                      ))}
                  </select>
                )}

                {(fl?.toppingIds?.length ?? 0) > 0 &&
                  // Never more boxes than toppings available on this flavour.
                  Array.from(
                    {
                      length: Math.min(
                        fl?.maxToppings ?? 2,
                        extras.filter(
                          (e) =>
                            e.kind === "TOPPING" &&
                            fl?.toppingIds?.includes(e.id)
                        ).length
                      ),
                    },
                    (_, n) => {
                    const taken = s.addedToppingIds.filter((_, j) => j !== n);
                    return (
                      <select
                        key={n}
                        value={s.addedToppingIds[n] ?? ""}
                        onChange={(e) => {
                          const next = [...s.addedToppingIds];
                          if (e.target.value) next[n] = e.target.value;
                          else next.splice(n, 1);
                          setSlices(
                            slices.map((x, j) =>
                              j === i
                                ? { ...x, addedToppingIds: next.filter(Boolean) }
                                : x
                            )
                          );
                        }}
                        className="rounded-btn border border-field bg-paper px-2 py-1.5 text-sm text-ink"
                      >
                        <option value="">Topping {n + 1}</option>
                        {extras
                          .filter(
                            (e) =>
                              e.kind === "TOPPING" &&
                              fl?.toppingIds?.includes(e.id) &&
                              !taken.includes(e.id)
                          )
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name} (+{money(e.pricePence)})
                            </option>
                          ))}
                      </select>
                    );
                    }
                  )}

                <button
                  onClick={() => setSlices(slices.filter((_, j) => j !== i))}
                  className="text-xs text-ink2 underline underline-offset-4"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        {flavours.length > 0 && (
          <button
            onClick={() =>
              setSlices([
                ...slices,
                {
                  flavourId: flavours[0].id,
                  toppings: null,
                  extraSauce: null,
                  addedSauceId: null,
                  addedToppingIds: [],
                },
              ])
            }
            className="mt-2 text-xs text-gold underline underline-offset-4"
          >
            Add a slice
          </button>
        )}
      </div>

      <label className="mt-4 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink2">
          Your note
        </span>
        <input
          value={f.adminNotes}
          onChange={(e) => setF({ ...f, adminNotes: e.target.value })}
          className="mt-1 w-full border-b border-line bg-transparent pb-1.5 text-sm text-ink focus:border-gold"
        />
      </label>

      {total !== order.totalPence && (
        <p className="mt-4 rounded-card border border-gold/40 bg-gold-light px-4 py-3 text-[13px] leading-relaxed text-ink">
          <strong>
            Total changes from {money(order.totalPence)} to {money(total)}
          </strong>{" "}
          — a difference of {money(Math.abs(total - order.totalPence))}.
          <span className="mt-1 block text-ink2">
            {total > order.totalPence
              ? "They owe you the difference. Take a bank transfer, or send a Stripe payment link."
              : "You owe them the difference. Refund it in Stripe, or send a bank transfer — whichever they'd prefer."}{" "}
            Stripe isn&apos;t touched by saving this.
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn onClick={() => onSave({ ...f, slices })}>Save</Btn>
        <Btn onClick={() => onSave({ ...f, slices, resend: true })}>
          Save and resend
        </Btn>
        <Btn variant="ghost" onClick={onClose}>
          Close without saving
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "outline",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "outline" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-btn border border-navy px-3 py-1.5 text-xs font-semibold transition-colors",
        variant === "ghost"
          ? "bg-cream-beige text-ink2 hover:bg-line"
          : "bg-paper text-navy hover:bg-cream-beige",
      ].join(" ")}
    >
      {children}
    </button>
  );
}


/** Why an order was cancelled. The reason reaches the customer, so it's
 *  worth a moment's thought before saving. */
function CancelPanel({
  order,
  onClose,
  onDone,
  flash,
}: {
  order: Order;
  onClose: () => void;
  onDone: () => void;
  flash: (m: string) => void;
}) {
  const [reason, setReason] = useState<"CUSTOMER" | "OTHER">("CUSTOMER");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const r = await fetch("/api/admin/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, reason, note }),
    });
    setBusy(false);
    if (!r.ok) return flash(await readError(r));
    flash(`${order.orderNo} cancelled — slices back on sale`);
    onDone();
  }

  return (
    <div className="mt-3 rounded-card border border-bad/40 bg-bad-light p-4">
      <p className="font-semibold text-ink">Cancel {order.orderNo}</p>
      <p className="mt-0.5 text-[12px] text-ink2">
        The order stays on this day and in the archive. Its slices go back on
        sale immediately. Refunding, if any, is done in Stripe.
      </p>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">
          Reason
        </span>
        <select
          value={reason}
          onChange={(e) =>
            setReason(e.target.value as "CUSTOMER" | "OTHER")
          }
          className="w-full max-w-sm rounded-btn border border-field bg-paper px-3 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
        >
          <option value="CUSTOMER">Requested by customer</option>
          <option value="OTHER">Other (please specify)</option>
        </select>
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">
          {reason === "CUSTOMER"
            ? "Their message (optional)"
            : "Why it was cancelled"}
        </span>
        <textarea
          value={note}
          rows={3}
          placeholder={
            reason === "CUSTOMER"
              ? "Paste what they sent, if you like"
              : "Kept for your records and shown to the customer"
          }
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-btn border border-field bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={go}
          disabled={busy || (reason === "OTHER" && !note.trim())}
          className="rounded-btn border border-navy bg-bad px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Cancelling…" : "Cancel this order"}
        </button>
        <button
          onClick={onClose}
          className="rounded-btn border border-navy bg-paper px-4 py-2 text-sm font-semibold text-navy"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
