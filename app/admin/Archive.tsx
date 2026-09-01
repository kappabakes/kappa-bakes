"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, PageHead, Field, readError, adminBase } from "./ui";

type Day = {
  iso: string;
  label: string;
  capacity: number;
  startTime: string;
  endTime: string;
  taken: number;
  archived: boolean;
};

/**
 * Dates move here on their own once the day has passed — no weekly job, and
 * nothing to remember. A day with orders can't be deleted; the sales record
 * has to stay.
 */
type Slice = {
  flavour: string;
  toppings: string | null;
  placement?: string | null;
  extraSauce?: string | null;
  addedSauces?: { name: string; placement?: string; warm?: boolean }[] | null;
  addedSauce?: { name: string } | null;
  addedToppings?: { name: string }[] | null;
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
  status: string;
};

/** Same grouping as everywhere else: flavour + toppings + extra sauce. */
function summarise(slices: Slice[]) {
  const counts = new Map<string, number>();
  for (const s of slices ?? []) {
    let key = s.toppings
      ? `${s.flavour} — ${s.toppings}`
      : s.placement
        ? `${s.flavour} — ${s.placement}`
        : s.flavour;
    if (s.extraSauce) key += ` + EXTRA SAUCE (${s.extraSauce})`;
    const sauces = s.addedSauces?.length
      ? s.addedSauces.map((x) => (x.warm ? `${x.name} WARM` : x.name))
      : s.addedSauce
        ? [s.addedSauce.name]
        : [];
    if (sauces.length) key += ` + SAUCE: ${sauces.join(", ")}`;
    if (s.addedToppings?.length)
      key += ` + TOPPINGS: ${s.addedToppings.map((t) => t.name).join(", ")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([label, n]) => `${n}x ${label}`);
}

const BLANK = {
  orderNo: "",
  mobile: "",
  name: "",
  collectionDate: "",
  from: "",
  to: "",
  status: "any",
  scope: "past",
};

export function Archive({ flash }: { flash: (m: string) => void }) {
  const [openDay, setOpenDay] = useState<Day | null>(null);
  const [dayOrders, setDayOrders] = useState<Order[] | null>(null);
  const [archive, setArchive] = useState<Day[]>([]);
  const [filters, setFilters] = useState({ ...BLANK });
  const [results, setResults] = useState<Order[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/days");
    if (r.ok) setArchive((await r.json()).archive ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Open a finished date and read its orders. */
  async function view(d: Day) {
    setOpenDay(d);
    setDayOrders(null);
    const r = await fetch(
      `/api/admin/orders?day=${encodeURIComponent(d.iso)}`
    );
    if (r.ok) setDayOrders((await r.json()).orders);
    else flash(await readError(r));
  }

  async function remove(d: Day) {
    if (!confirm(`Delete ${d.label} from the archive?`)) return;
    const r = await fetch(
      `/api/admin/days?iso=${encodeURIComponent(d.iso)}`,
      { method: "DELETE" }
    );
    if (!r.ok) return flash(await readError(r));
    flash("Removed from archive");
    load();
  }

  async function search() {
    setSearching(true);
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== "any") q.set(k, v);
    });
    const r = await fetch(`/api/admin/search?${q.toString()}`);
    setSearching(false);
    if (!r.ok) return flash(await readError(r));
    setResults((await r.json()).orders);
  }

  const set = (k: keyof typeof BLANK, v: string) =>
    setFilters({ ...filters, [k]: v });

  return (
    <>
      <PageHead
        title="Archive"
        note="Past collection dates and orders. Dates arrive here automatically, and only you can see them — customers can't track past orders."
      />

      {/* search — every field optional, all of them combine */}
      <Card className="mb-5">
        <h2 className="font-display text-xl text-ink">Find an order</h2>
        <p className="mt-1 text-[13px] text-ink2">
          Fill in as many or as few as you like — they narrow the search
          together.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Order number" value={filters.orderNo} onChange={(v) => set("orderNo", v)} placeholder="KB014" />
          <Field label="Mobile number" value={filters.mobile} onChange={(v) => set("mobile", v)} placeholder="07712 345678" />
          <Field label="Name or email" value={filters.name} onChange={(v) => set("name", v)} placeholder="Khan" />

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Collection date
            </span>
            <input
              type="date"
              value={filters.collectionDate}
              onChange={(e) => set("collectionDate", e.target.value)}
              className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Ordered from
            </span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => set("from", e.target.value)}
              className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Ordered to
            </span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => set("to", e.target.value)}
              className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
            >
              <option value="any">Any</option>
              <option value="COLLECTED">Collected</option>
              <option value="NO_SHOW">No-show</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PAID">Paid, not collected</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Look in
            </span>
            <select
              value={filters.scope}
              onChange={(e) => set("scope", e.target.value)}
              className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
            >
              <option value="past">Past dates only</option>
              <option value="all">Everything, past and upcoming</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <Btn onClick={search} disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => {
              setFilters({ ...BLANK });
              setResults(null);
            }}
          >
            Clear
          </Btn>
        </div>

        {results && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[13px] text-ink2">
              {results.length} order{results.length === 1 ? "" : "s"} found
              {results.length === 200 && " (showing the first 200)"}
            </p>
            <ul className="mt-3 divide-y divide-line">
              {results.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 py-3 text-[15px]">
                  <span className="w-16 shrink-0 font-semibold text-gold">
                    {o.orderNo}
                  </span>
                  <span className="grow">
                    {o.firstName} {o.lastName}
                    <span className="block text-[12px] text-ink2">
                      {o.mobile} · {new Date(o.day).toLocaleDateString("en-GB")}
                    </span>
                  </span>
                  <span className="text-[13px] text-ink2">{o.sliceCount} sl</span>
                  <span className="w-16 text-right font-semibold">
                    £{(o.totalPence / 100).toFixed(2)}
                  </span>
                  <button
                    onClick={() => window.open(`${adminBase()}/receipt/${o.id}`, "_blank")}
                    className="rounded-btn border border-navy px-3 py-1 text-[12px] font-semibold text-navy"
                  >
                    Record
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          `Delete ${o.orderNo}? This removes your record of it permanently.`
                        )
                      )
                        return;
                      const r = await fetch(`/api/admin/orders?id=${o.id}`, {
                        method: "DELETE",
                      });
                      if (!r.ok) return flash(await readError(r));
                      flash(`${o.orderNo} deleted`);
                      search();
                    }}
                    className="rounded-btn border border-bad bg-bad px-3 py-1 text-[12px] font-semibold text-white"
                  >
                    Delete
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="py-4 text-center text-sm text-ink2">
                  Nothing matched. Try fewer filters.
                </li>
              )}
            </ul>
          </div>
        )}
      </Card>

      {openDay && (
        <Card className="mb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-ink">
              {openDay.label} — {openDay.taken} slice
              {openDay.taken === 1 ? "" : "s"} sold
            </h2>
            <button
              onClick={() => {
                setOpenDay(null);
                setDayOrders(null);
              }}
              className="text-[13px] text-ink2 underline underline-offset-4"
            >
              Close
            </button>
          </div>

          {!dayOrders && (
            <p className="mt-3 text-sm text-ink2">Loading…</p>
          )}

          {dayOrders && (
            <ul className="mt-4 divide-y divide-line">
              {dayOrders.map((o) => (
                <li
                  key={o.id}
                  className={[
                    "border-l-4 py-3 pl-3",
                    o.status === "CANCELLED"
                      ? "border-bad bg-bad-light/40"
                      : "border-transparent",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold text-gold">{o.orderNo}</span>
                    <span className="grow text-ink">
                      {o.firstName} {o.lastName}
                    </span>
                    <span className="text-[13px] text-ink2">
                      {o.status === "COLLECTED"
                        ? "Collected"
                        : o.status === "NO_SHOW"
                          ? "No-show"
                          : o.status === "CANCELLED"
                            ? "Cancelled"
                            : "Not collected"}
                    </span>
                    <span className="w-16 text-right font-semibold text-ink">
                      £{(o.totalPence / 100).toFixed(2)}
                    </span>
                  </div>

                  <ul className="mt-1 text-[13px] text-ink2">
                    {summarise(o.slices).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted">
                    <span>{o.mobile}</span>
                    <span>{o.email}</span>
                    <button
                      onClick={() =>
                        window.open(`${adminBase()}/receipt/${o.id}`, "_blank")
                      }
                      className="text-gold-hover underline underline-offset-4"
                    >
                      Order record
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          !confirm(
                            `Delete ${o.orderNo}?\n\nThis removes your record of it permanently — the order, both policy acceptances and its history. Stripe keeps its own record of any payment.`
                          )
                        )
                          return;
                        const r = await fetch(
                          `/api/admin/orders?id=${o.id}`,
                          { method: "DELETE" }
                        );
                        if (!r.ok) return flash(await readError(r));
                        flash(`${o.orderNo} deleted`);
                        if (openDay) view(openDay);
                        load();
                      }}
                      className="text-bad underline underline-offset-4"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {dayOrders.length === 0 && (
                <li className="py-4 text-center text-sm text-ink2">
                  No orders on that date.
                </li>
              )}
            </ul>
          )}
        </Card>
      )}

      <h2 className="mb-3 font-display text-xl text-ink">Past dates</h2>

      <Card className="p-0">
        <ul className="divide-y divide-line">
          {archive.map((d) => (
            <li key={d.iso} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grow">
                <p className="font-semibold text-ink">{d.label}</p>
                <p className="text-[13px] text-ink2">
                  {d.startTime} – {d.endTime}
                </p>
              </div>
              <p className="text-[15px] text-ink2">
                {d.taken} slice{d.taken === 1 ? "" : "s"} sold
              </p>
              {d.taken > 0 && (
                <Btn variant="outline" onClick={() => view(d)}>
                  View orders
                </Btn>
              )}
              {/* Only for a day archived early — a past date belongs here. */}
              {d.archived && (
                <Btn
                  variant="ghost"
                  onClick={async () => {
                    const r = await fetch("/api/admin/days", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ iso: d.iso, archived: false }),
                    });
                    if (!r.ok) return flash(await readError(r));
                    flash("Back in Orders");
                    load();
                  }}
                >
                  Unarchive
                </Btn>
              )}
              {d.taken === 0 ? (
                <Btn variant="danger" onClick={() => remove(d)}>
                  Delete
                </Btn>
              ) : (
                <span className="text-[12px] text-muted">kept — has orders</span>
              )}
            </li>
          ))}
          {archive.length === 0 && (
            <li className="p-6 text-center text-sm text-ink2">
              Nothing archived yet.
            </li>
          )}
        </ul>
      </Card>
    </>
  );
}

