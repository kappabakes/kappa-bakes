"use client";

import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/config";
import { Card, PageHead, Tag } from "./ui";

type Day = {
  iso: string;
  label: string;
  capacity: number;
  taken: number;
  left: number;
  startTime: string;
  endTime: string;
  confirmed: boolean;
  open: boolean;
  closed: boolean;
  breakdown: { flavour: string; total: number; separate: number }[];
};

type Slice = {
  flavour: string;
  toppings: string | null;
  pricePence: number;
  extraSauce?: string | null;
};

type Order = {
  id: string;
  orderNo: string;
  firstName: string;
  lastName: string;
  day: string;
  totalPence: number;
  sliceCount: number;
  status: string;
  slices: Slice[];
  isTest: boolean;
};

type FlavourRow = {
  flavour: string;
  slices: number;
  separate: number;
  extras: number;
  revenue: number;
};

export function Dashboard({ go }: { go: (s: "orders" | "dates") => void }) {
  const [days, setDays] = useState<Day[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const [d, o] = await Promise.all([
      fetch("/api/admin/days"),
      fetch("/api/admin/orders"),
    ]);
    if (d.ok) setDays((await d.json()).days);
    if (o.ok) setOrders((await o.json()).orders);
  }, []);

  // Live: refresh on mount, every 30 seconds, and when the tab regains focus.
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // "Active" = confirmed and still to come. Unconfirmed dates aren't selling
  // yet, so counting them would flatter the numbers.
  const active = days.filter((d) => d.confirmed);
  const activeIsos = new Set(active.map((d) => new Date(d.iso).getTime()));
  const live = orders.filter((o) =>
    activeIsos.has(new Date(o.day).getTime())
  );

  const slicesFor = (rows: Order[]) =>
    rows.reduce((n, o) => n + o.sliceCount, 0);
  const moneyFor = (rows: Order[]) =>
    rows.reduce((n, o) => n + o.totalPence, 0);

  /** Flavour tallies with revenue, from the slice detail on each order. */
  const flavoursFor = (rows: Order[]): FlavourRow[] => {
    const map = new Map<string, FlavourRow>();
    for (const o of rows) {
      for (const s of o.slices ?? []) {
        const row =
          map.get(s.flavour) ??
          { flavour: s.flavour, slices: 0, separate: 0, extras: 0, revenue: 0 };
        row.slices++;
        row.revenue += s.pricePence;
        if (s.toppings === "separately") row.separate++;
        if (s.extraSauce) row.extras++;
        map.set(s.flavour, row);
      }
    }
    return [...map.values()].sort((a, b) => b.slices - a.slices);
  };

  const totalSlices = slicesFor(live);
  const totalRevenue = moneyFor(live);
  const capacity = active.reduce((n, d) => n + d.capacity, 0);
  const allFlavours = flavoursFor(live);
  const fill = capacity > 0 ? Math.round((totalSlices / capacity) * 100) : 0;
  const perOrder = live.length > 0 ? totalSlices / live.length : 0;
  const avgOrder = live.length > 0 ? totalRevenue / live.length : 0;
  const tubs = allFlavours.reduce((n, f) => n + f.separate, 0);
  const extraSauces = allFlavours.reduce((n, f) => n + f.extras, 0);
  const testCount = live.filter((o) => o.isTest).length;
  const unconfirmed = days.filter((d) => !d.confirmed).length;

  return (
    <>
      <PageHead
        title="Dashboard"
        note="Everything across your open collection dates."
      />

      {unconfirmed > 0 && (
        <Card className="mb-5 border-gold/40 bg-gold-light">
          <p className="text-[15px] text-ink">
            {unconfirmed} date{unconfirmed === 1 ? "" : "s"} not confirmed yet,
            so nothing below counts them.{" "}
            <button
              onClick={() => go("dates")}
              className="font-semibold text-gold-hover underline underline-offset-4"
            >
              Set them up
            </button>
          </p>
        </Card>
      )}

      {testCount > 0 && (
        <Card className="mb-5 border-bad/30 bg-bad-light">
          <p className="text-[15px] text-ink">
            {testCount} of these {testCount === 1 ? "is a" : "are"} test order
            {testCount === 1 ? "" : "s"}. Clear them in Settings before you
            trust the revenue figures.
          </p>
        </Card>
      )}

      {/* ---------- headline ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Slices ordered" value={String(totalSlices)} note={`of ${capacity || "—"} available`} />
        <Stat label="Orders" value={String(live.length)} note={live.length ? `${perOrder.toFixed(1)} slices each` : undefined} />
        <Stat label="Revenue" value={money(totalRevenue)} note={live.length ? `${money(Math.round(avgOrder))} average` : undefined} />
        <Stat
          label="Sold"
          value={`${fill}%`}
          note={
            capacity > 0
              ? fill >= 100
                ? "Fully booked"
                : `${capacity - totalSlices} slices left`
              : undefined
          }
        />
      </div>

      {active.length === 0 && (
        <Card className="mt-5">
          <p className="text-[15px] text-ink2">
            No confirmed collection dates. Add and confirm one and the numbers
            appear here.
          </p>
        </Card>
      )}

      {/* ---------- flavours across everything ---------- */}
      {allFlavours.length > 0 && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl text-ink">
              Flavours — all active collection dates
            </h2>
            <span className="text-[13px] text-ink2">
              {totalSlices} slices · {tubs} need tubs
              {extraSauces > 0 && ` · ${extraSauces} extra sauce`}
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {allFlavours.map((f) => {
              const share = totalSlices
                ? Math.round((f.slices / totalSlices) * 100)
                : 0;
              return (
                <li key={f.flavour}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{f.flavour}</span>
                    <span className="text-[13px] text-ink2">
                      {f.slices} slice{f.slices === 1 ? "" : "s"} · {share}% ·{" "}
                      {money(f.revenue)}
                      {f.separate > 0 && (
                        <span className="text-gold"> · {f.separate} in tubs</span>
                      )}
                      {f.extras > 0 && (
                        <span className="text-gold"> · {f.extras} extra sauce</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-beige">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ---------- per date ---------- */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {active.map((d) => {
          const rows = live.filter(
            (o) => new Date(o.day).getTime() === new Date(d.iso).getTime()
          );
          const dayFlavours = flavoursFor(rows);
          const dayRevenue = moneyFor(rows);
          const dayFill =
            d.capacity > 0 ? Math.round((d.taken / d.capacity) * 100) : 0;

          return (
            <Card key={d.iso}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl text-ink">{d.label}</h2>
                <span className="text-[13px] text-ink2">
                  {d.startTime} – {d.endTime}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Tag tone="gold">
                  {d.taken} of {d.capacity} slices
                </Tag>
                <Tag>{rows.length} orders</Tag>
                <Tag tone="good">{money(dayRevenue)}</Tag>
                {d.closed && <Tag tone="bad">Orders closed</Tag>}
                {!d.open && <Tag tone="bad">Paused</Tag>}
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream-beige">
                <div
                  className={`h-full rounded-full ${dayFill >= 100 ? "bg-good" : "bg-navy"}`}
                  style={{ width: `${Math.min(100, dayFill)}%` }}
                />
              </div>

              {dayFlavours.length > 0 ? (
                <table className="mt-4 w-full border-t border-line text-[15px]">
                  <thead>
                    <tr className="text-left text-[12px] uppercase tracking-wide text-ink2">
                      <th className="py-2 font-semibold">Flavour</th>
                      <th className="py-2 text-right font-semibold">Slices</th>
                      <th className="py-2 text-right font-semibold">Tubs</th>
                    <th className="py-2 text-right font-semibold">Extra</th>
                      <th className="py-2 text-right font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {dayFlavours.map((f) => (
                      <tr key={f.flavour}>
                        <td className="py-2 text-ink">{f.flavour}</td>
                        <td className="py-2 text-right font-semibold text-ink">
                          {f.slices}
                        </td>
                        <td className="py-2 text-right text-gold">
                          {f.separate || "—"}
                        </td>
                        <td className="py-2 text-right text-gold">
                          {f.extras || "—"}
                        </td>
                        <td className="py-2 text-right text-ink2">
                          {money(f.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-4 border-t border-line pt-3 text-sm text-ink2">
                  No orders yet.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* ---------- recent ---------- */}
      <Card className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Recent Orders</h2>
          <button
            onClick={() => go("orders")}
            className="text-[13px] font-semibold text-gold-hover underline underline-offset-4"
          >
            View all
          </button>
        </div>

        {live.length === 0 ? (
          <p className="mt-3 text-sm text-ink2">
            Nothing yet. Orders appear the moment someone pays.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {live.slice(0, 8).map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 py-2.5 text-[15px]"
              >
                <span className="w-16 shrink-0 font-semibold text-gold">
                  {o.orderNo}
                </span>
                <span className="grow truncate text-ink">
                  {o.firstName} {o.lastName}
                  {o.isTest && <span className="ml-2 text-[11px] text-bad">TEST</span>}
                </span>
                <span className="shrink-0 text-ink2">{o.sliceCount} sl</span>
                <span className="w-16 shrink-0 text-right font-semibold text-ink">
                  {money(o.totalPence)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink2">
        {label}
      </p>
      <p className="mt-1.5 font-display text-3xl text-ink">{value}</p>
      {note && <p className="mt-1 text-[12px] text-ink2">{note}</p>}
    </div>
  );
}
