"use client";

import { useCallback, useEffect, useState } from "react";
import { money, extraSaucePence } from "@/lib/config";
import { Btn, Card, Field, readError } from "./ui";

type Flavour = {
  id: string;
  name: string;
  hasToppings: boolean;
  serving: "CHOICE" | "ON_SLICE" | "IN_TUB";
  pricePence: number;
  active: boolean;
  sauceIds: string[];
  toppingIds: string[];
  maxSauces: number;
  maxToppings: number;
};

type Extra = {
  id: string;
  kind: "SAUCE" | "TOPPING";
  name: string;
  pricePence: number;
  active: boolean;
};
type Day = { iso: string; label: string; left: number; capacity: number };
type Line = {
  flavourId: string;
  toppings: string | null;
  extraSauce: string | null;
  addedSauceIds: string[];
  addedToppingIds: string[];
};

const METHODS = ["Free", "Cash", "Bank transfer", "Other"];

/**
 * An order added by hand — a friend, a cash sale, a freebie. Skips Stripe
 * entirely, so there's nothing to refund afterwards, and ignores the cut-off
 * and a paused date because you're the one adding it.
 */
export function ManualOrder({
  onDone,
  flash,
}: {
  onDone: () => void;
  flash: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    dayIso: "",
    paymentMethod: "Free",
    charge: "",
    note: "",
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      fetch("/api/admin/flavours"),
      fetch("/api/admin/days"),
      fetch("/api/admin/extras"),
    ]);
    if (c.ok)
      setExtras(
        (await c.json()).extras.filter((e: Extra) => e.active)
      );
    if (a.ok)
      setFlavours(
        (await a.json()).flavours.filter((x: Flavour) => x.active)
      );
    if (b.ok) {
      const d = (await b.json()).days as Day[];
      setDays(d);
      setF((cur) => ({ ...cur, dayIso: cur.dayIso || d[0]?.iso || "" }));
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const priceOf = (id: string) =>
    extras.find((e) => e.id === id)?.pricePence ?? 0;

  const listPrice = lines.reduce(
    (n, l) =>
      n +
      (flavours.find((x) => x.id === l.flavourId)?.pricePence ?? 0) +
      (l.extraSauce ? extraSaucePence(l.extraSauce) : 0) +
      l.addedSauceIds.reduce((m, id) => m + priceOf(id), 0) +
      l.addedToppingIds.reduce((m, id) => m + priceOf(id), 0),
    0
  );

  async function submit(force = false) {
    setBusy(true);
    const r = await fetch("/api/admin/orders/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f,
        slices: lines,
        chargePence:
          f.paymentMethod === "Free"
            ? 0
            : f.charge
              ? Math.round(parseFloat(f.charge) * 100)
              : listPrice,
        notify,
        force,
      }),
    });
    const d = await r.json().catch(() => null);
    setBusy(false);

    if (!r.ok) {
      if (d?.needsForce && confirm(`${d.error}\n\nAdd it anyway?`))
        return submit(true);
      return flash(d?.error ?? (await readError(r)));
    }

    flash(`Added ${d.orderNo} — ${money(d.totalPence)}`);
    setLines([]);
    setF({ ...f, firstName: "", lastName: "", mobile: "", email: "", note: "" });
    setOpen(false);
    onDone();
  }

  if (!open)
    return (
      <Btn variant="outline" onClick={() => setOpen(true)}>
        + Add an order by hand
      </Btn>
    );

  const day = days.find((d) => d.iso === f.dayIso);
  const ready = f.firstName && f.lastName && f.dayIso && lines.length > 0;

  return (
    <Card className="mb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Add an order by hand</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-[13px] text-ink2 underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
      <p className="mt-1 text-[13px] text-ink2">
        No payment taken, nothing to refund. Ignores the cut-off and works on a
        paused date.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="First name" value={f.firstName} onChange={(v) => setF({ ...f, firstName: v })} />
        <Field label="Last name" value={f.lastName} onChange={(v) => setF({ ...f, lastName: v })} />
        <Field label="Mobile (optional)" value={f.mobile} onChange={(v) => setF({ ...f, mobile: v })} placeholder="07…" />
        <Field label="Email (optional)" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">
          Collection day
        </span>
        <select
          value={f.dayIso}
          onChange={(e) => setF({ ...f, dayIso: e.target.value })}
          className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
        >
          {days.map((d) => (
            <option key={d.iso} value={d.iso}>
              {d.label} — {d.left} of {d.capacity} free
            </option>
          ))}
        </select>
      </label>

      {/* slices */}
      <div className="mt-4">
        <span className="text-[13px] font-semibold text-ink">Slices</span>
        <ul className="mt-2 space-y-2">
          {lines.map((l, i) => {
            const fl = flavours.find((x) => x.id === l.flavourId);
            return (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={l.flavourId}
                  onChange={(e) => {
                    const picked = flavours.find(
                      (x) => x.id === e.target.value
                    );
                    setLines(
                      lines.map((x, j) =>
                        j === i
                          ? {
                              flavourId: e.target.value,
                              toppings: picked?.hasToppings
                                ? (x.toppings ?? "on the slice")
                                : null,
                              extraSauce: picked?.hasToppings
                                ? x.extraSauce
                                : null,
                              // Extras are per flavour, so a change clears
                              // anything the new one doesn't offer.
                              addedSauceIds: [],
                              addedToppingIds: [],
                            }
                          : x
                      )
                    );
                  }}
                  className="rounded-btn border border-field bg-paper px-3 py-2 text-sm text-ink"
                >
                  {flavours.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} — {money(x.pricePence)}
                    </option>
                  ))}
                </select>

                {fl && fl.hasToppings && fl.serving !== "CHOICE" && (
                  <span className="text-xs text-ink2">
                    {fl.serving === "IN_TUB" ? "In a tub" : "On the slice"}
                  </span>
                )}

                {fl?.hasToppings && fl.serving === "CHOICE" && (
                  <select
                    value={l.toppings ?? "on the slice"}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) =>
                          j === i ? { ...x, toppings: e.target.value } : x
                        )
                      )
                    }
                    className="rounded-btn border border-field bg-paper px-3 py-2 text-sm text-ink"
                  >
                    <option value="on the slice">On collection</option>
                    <option value="separately">Separate tub</option>
                  </select>
                )}

                {fl?.hasToppings && (
                  <select
                    value={l.extraSauce ?? ""}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) =>
                          j === i
                            ? { ...x, extraSauce: e.target.value || null }
                            : x
                        )
                      )
                    }
                    className="rounded-btn border border-field bg-paper px-3 py-2 text-sm text-ink"
                  >
                    <option value="">No extra sauce</option>
                    <option value="in a tub">
                      Extra sauce, tub (+{money(extraSaucePence("in a tub"))})
                    </option>
                    <option value="on the slice">
                      Extra sauce, on slice (+{money(extraSaucePence("on the slice"))})
                    </option>
                  </select>
                )}

                {fl &&
                  fl.sauceIds.length > 0 &&
                  // Never more boxes than sauces available on this flavour.
                  Array.from(
                    {
                      length: Math.min(
                        fl.maxSauces,
                        extras.filter(
                          (e) =>
                            e.kind === "SAUCE" && fl.sauceIds.includes(e.id)
                        ).length
                      ),
                    },
                    (_, n) => {
                      const taken = l.addedSauceIds.filter((_, j) => j !== n);
                      return (
                        <select
                          key={n}
                          value={l.addedSauceIds[n] ?? ""}
                          onChange={(e) => {
                            const next = [...l.addedSauceIds];
                            if (e.target.value) next[n] = e.target.value;
                            else next.splice(n, 1);
                            setLines(
                              lines.map((x, j) =>
                                j === i
                                  ? { ...x, addedSauceIds: next.filter(Boolean) }
                                  : x
                              )
                            );
                          }}
                          className="rounded-btn border border-field bg-paper px-3 py-2 text-sm text-ink"
                        >
                          <option value="">Sauce {n + 1}</option>
                          {extras
                            .filter(
                              (e) =>
                                e.kind === "SAUCE" &&
                                fl.sauceIds.includes(e.id) &&
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

                {fl &&
                  fl.toppingIds.length > 0 &&
                  // Never more boxes than toppings available on this flavour.
                  Array.from(
                    {
                      length: Math.min(
                        fl.maxToppings,
                        extras.filter(
                          (e) =>
                            e.kind === "TOPPING" && fl.toppingIds.includes(e.id)
                        ).length
                      ),
                    },
                    (_, n) => {
                    const taken = l.addedToppingIds.filter((_, j) => j !== n);
                    return (
                      <select
                        key={n}
                        value={l.addedToppingIds[n] ?? ""}
                        onChange={(e) => {
                          const next = [...l.addedToppingIds];
                          if (e.target.value) next[n] = e.target.value;
                          else next.splice(n, 1);
                          setLines(
                            lines.map((x, j) =>
                              j === i
                                ? { ...x, addedToppingIds: next.filter(Boolean) }
                                : x
                            )
                          );
                        }}
                        className="rounded-btn border border-field bg-paper px-3 py-2 text-sm text-ink"
                      >
                        <option value="">Topping {n + 1}</option>
                        {extras
                          .filter(
                            (e) =>
                              e.kind === "TOPPING" &&
                              fl.toppingIds.includes(e.id) &&
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
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
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
              setLines([
                ...lines,
                {
                  flavourId: flavours[0].id,
                  toppings: flavours[0].hasToppings ? "on the slice" : null,
                  extraSauce: null,
                  addedSauceIds: [],
                  addedToppingIds: [],
                },
              ])
            }
            className="mt-2 text-[13px] font-semibold text-gold-hover underline underline-offset-4"
          >
            Add a slice
          </button>
        )}
      </div>

      {/* payment */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">
            How it was paid
          </span>
          <select
            value={f.paymentMethod}
            onChange={(e) => setF({ ...f, paymentMethod: e.target.value })}
            className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {f.paymentMethod !== "Free" && (
          <Field
            label="Amount taken (£)"
            value={f.charge}
            onChange={(v) => setF({ ...f, charge: v })}
            placeholder={(listPrice / 100).toFixed(2)}
            hint="Leave blank to use the list price"
          />
        )}
      </div>

      <Field
        label="Note for your records (optional)"
        value={f.note}
        onChange={(v) => setF({ ...f, note: v })}
        placeholder="Friend, no charge"
        className="mt-3"
      />

      <label className="mt-4 flex items-center gap-2.5 text-[14px] text-ink2">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          className="h-4 w-4 accent-gold"
        />
        Send them a confirmation by email and SMS
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Btn onClick={() => submit()} disabled={!ready || busy}>
          {busy ? "Adding…" : "Add order"}
        </Btn>
        <span className="text-[13px] text-ink2">
          {lines.length} slice{lines.length === 1 ? "" : "s"} · list price{" "}
          {money(listPrice)}
          {f.paymentMethod === "Free" && " · recording as £0.00"}
        </span>
      </div>

      {day && lines.length > day.left && (
        <p className="mt-3 rounded-card border border-gold/40 bg-gold-light px-4 py-2.5 text-[13px] text-ink">
          Only {day.left} slice{day.left === 1 ? "" : "s"} free that day.
          You&apos;ll be asked to confirm before it goes over.
        </p>
      )}
    </Card>
  );
}
