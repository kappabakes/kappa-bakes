"use client";

import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/config";
import { WholeItem, describeItem, balancePence } from "@/lib/whole";
import { Btn, Card, Field, PageHead, readError, adminBase } from "./ui";

type Order = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  collectAt: string;
  items: WholeItem[];
  totalPence: number;
  depositPence: number;
  status: "CONFIRMED" | "COLLECTED" | "CANCELLED";
  notes: string | null;
  emailStatus: string | null;
  smsStatus: string | null;
  allergensDiscussedAt: string | null;
  depositTermsAt: string | null;
  cancelReason: string | null;
  cancelNote: string | null;
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/**
 * Whole cheesecakes, kept apart from slice orders.
 *
 * No order numbers, no stock, no collection-day capacity — these are taken by
 * hand, paid by deposit, and collected at a time you agree with the customer.
 */
export function WholeOrders({
  archive = false,
  flash,
}: {
  archive?: boolean;
  flash: (m: string) => void;
}) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [flavours, setFlavours] = useState<string[]>([]);

  const load = useCallback(
    async (search = "") => {
      const r = await fetch(
        `/api/admin/whole?${archive ? "archive=1&" : ""}${
          search ? `q=${encodeURIComponent(search)}` : ""
        }`
      );
      if (!r.ok) return flash(await readError(r));
      setOrders((await r.json()).orders);
    },
    [archive, flash]
  );

  useEffect(() => {
    load();
    fetch("/api/admin/flavours")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d)
          setFlavours(
            d.flavours
              .filter((f: { active: boolean }) => f.active)
              .map((f: { name: string }) => f.name)
          );
      })
      .catch(() => {});
  }, [load]);

  async function setStatus(o: Order, status: Order["status"]) {
    let cancelReason: string | undefined;
    let cancelNote: string | undefined;

    if (status === "CANCELLED") {
      const byCustomer = confirm(
        `Cancel ${o.firstName} ${o.lastName}'s order?\n\nOK for "requested by the customer", Cancel to give another reason.`
      );
      cancelReason = byCustomer ? "CUSTOMER" : "OTHER";
      cancelNote = prompt("Anything to note? (optional)") ?? undefined;
    }

    const r = await fetch("/api/admin/whole", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: o.id, status, cancelReason, cancelNote }),
    });
    if (!r.ok) return flash(await readError(r));
    flash("Updated");
    load(q);
  }

  return (
    <>
      <PageHead
        title={archive ? "Whole cheesecakes — archive" : "Whole cheesecakes"}
        note={
          archive
            ? "Collected, cancelled and past orders."
            : "Taken by hand. Deposit now, balance on collection."
        }
      />

      {!archive && (
        <div className="mb-4">
          <Btn variant="gold" onClick={() => setAdding(true)}>
            + New whole cheesecake order
          </Btn>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
          placeholder="Name, mobile or email"
          className="min-w-[14rem] grow rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <Btn variant="outline" onClick={() => load(q)}>
          Search
        </Btn>
        {q && (
          <Btn
            variant="ghost"
            onClick={() => {
              setQ("");
              load();
            }}
          >
            Clear
          </Btn>
        )}
      </div>

      {orders === null && <p className="text-sm text-ink2">Loading…</p>}

      {orders?.length === 0 && (
        <Card>
          <p className="text-sm text-ink2">
            {q
              ? "Nothing matches that search."
              : archive
                ? "Nothing here yet."
                : "No upcoming whole cheesecake orders."}
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {orders?.map((o) => {
          const balance = balancePence(o.totalPence, o.depositPence);
          return (
            <li
              key={o.id}
              className={[
                "rounded-card border-l-4 bg-paper p-4 shadow-soft",
                o.status === "COLLECTED"
                  ? "border-good bg-good-light/40"
                  : o.status === "CANCELLED"
                    ? "border-bad bg-bad-light/40"
                    : "border-transparent",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">
                  {o.firstName} {o.lastName}
                  {o.status === "CANCELLED" && (
                    <span className="ml-2 rounded-md bg-bad px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Cancelled
                    </span>
                  )}
                  {o.status === "COLLECTED" && (
                    <span className="ml-2 rounded-md bg-good px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Collected
                    </span>
                  )}
                </p>
                <p className="text-[13px] font-semibold text-gold-hover">
                  {stamp(o.collectAt)}
                </p>
              </div>

              <p className="mt-0.5 text-[13px] text-ink2">
                {o.mobile} · {o.email}
              </p>

              <ul className="mt-2 space-y-0.5">
                {o.items.map((it, n) => (
                  <li key={n} className="text-[15px] text-ink">
                    {it.qty}× {describeItem(it)}
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-[14px] text-ink">
                Total {money(o.totalPence)} · Deposit {money(o.depositPence)} ·{" "}
                <strong>{money(balance)} due on collection</strong>
              </p>

              {o.notes && (
                <p className="mt-2 whitespace-pre-line rounded-btn bg-cream-warm px-3 py-2 text-[13px] text-ink2">
                  {o.notes}
                </p>
              )}

              {o.status === "CANCELLED" && (
                <p className="mt-2 rounded-card border border-bad/30 bg-bad-light px-3 py-2 text-[13px] text-ink">
                  {o.cancelReason === "CUSTOMER"
                    ? "Cancelled at the customer's request."
                    : "Cancelled."}
                  {o.cancelNote && ` ${o.cancelNote}`}
                </p>
              )}

              <p className="mt-2 text-[12px] text-muted">
                email {o.emailStatus ?? "—"} · sms {o.smsStatus ?? "—"}
                {o.allergensDiscussedAt && " · allergens discussed"}
                {o.depositTermsAt && " · deposit terms explained"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {o.status !== "COLLECTED" && o.status !== "CANCELLED" && (
                  <>
                    <button
                      onClick={() => setStatus(o, "COLLECTED")}
                      className="rounded-btn border border-navy bg-good px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Collected
                    </button>
                    <button
                      onClick={() => setEditing(o)}
                      className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setStatus(o, "CANCELLED")}
                      className="rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Cancel
                    </button>
                  </>
                )}

                <button
                  onClick={() =>
                    window.open(`${adminBase()}/whole-record/${o.id}`, "_blank")
                  }
                  className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy"
                >
                  Order record
                </button>

                {(o.status === "CANCELLED" || archive) && (
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          `Delete this order permanently? Nothing is kept.`
                        )
                      )
                        return;
                      const r = await fetch(`/api/admin/whole?id=${o.id}`, {
                        method: "DELETE",
                      });
                      if (!r.ok) return flash(await readError(r));
                      flash("Deleted");
                      load(q);
                    }}
                    className="rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {(adding || editing) && (
        <WholeForm
          order={editing}
          flavours={flavours}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            load(q);
          }}
          flash={flash}
        />
      )}
    </>
  );
}

/**
 * The form.
 *
 * Flavours are picked one at a time rather than listed as every possible
 * combination: with six flavours there are twenty-one pairings, and a list
 * that long is unusable. Choose a flavour, say whole or half, and only then
 * pick the second half.
 */
function WholeForm({
  order,
  flavours,
  onClose,
  onSaved,
  flash,
}: {
  order: Order | null;
  flavours: string[];
  onClose: () => void;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const [f, setF] = useState({
    firstName: order?.firstName ?? "",
    lastName: order?.lastName ?? "",
    email: order?.email ?? "",
    mobile: order?.mobile ?? "",
    date: order ? order.collectAt.slice(0, 10) : "",
    time: order
      ? new Date(order.collectAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "14:00",
    total: order ? (order.totalPence / 100).toFixed(2) : "",
    deposit: order ? (order.depositPence / 100).toFixed(2) : "",
    notes: order?.notes ?? "",
  });

  const [items, setItems] = useState<WholeItem[]>(
    order?.items ?? [{ kind: "WHOLE", flavour: "", qty: 1 }]
  );
  const [allergens, setAllergens] = useState(
    Boolean(order?.allergensDiscussedAt)
  );
  const [depositTerms, setDepositTerms] = useState(
    Boolean(order?.depositTermsAt)
  );
  const [notify, setNotify] = useState(!order);
  const [busy, setBusy] = useState(false);

  const setItem = (i: number, patch: Partial<WholeItem>) =>
    setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    if (!f.date || !f.time) return flash("Set a collection date and time.");

    setBusy(true);
    const r = await fetch("/api/admin/whole", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: order?.id,
        firstName: f.firstName,
        lastName: f.lastName,
        email: f.email,
        mobile: f.mobile,
        collectAtIso: `${f.date}T${f.time}:00`,
        items,
        totalPence: Math.round(parseFloat(f.total || "0") * 100),
        depositPence: Math.round(parseFloat(f.deposit || "0") * 100),
        notes: f.notes,
        allergensDiscussed: allergens,
        depositTermsExplained: depositTerms,
        notify,
      }),
    });
    setBusy(false);

    if (!r.ok) return flash(await readError(r));
    flash(order ? "Order updated" : "Order saved");
    onSaved();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto my-8 w-full max-w-2xl rounded-card border border-line bg-paper p-6 shadow-card"
      >
        <h2 className="font-display text-2xl text-ink">
          {order ? "Edit order" : "New whole cheesecake order"}
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="First name" value={f.firstName} onChange={(v) => setF({ ...f, firstName: v })} />
          <Field label="Last name" value={f.lastName} onChange={(v) => setF({ ...f, lastName: v })} />
          <Field label="Email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
          <Field label="Mobile" value={f.mobile} onChange={(v) => setF({ ...f, mobile: v })} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Collection date
            </span>
            <input
              type="date"
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
              className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Collection time
            </span>
            <input
              type="time"
              value={f.time}
              onChange={(e) => setF({ ...f, time: e.target.value })}
              className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[13px] font-semibold text-ink">Cheesecakes</p>

          <ul className="mt-3 space-y-3">
            {items.map((it, i) => (
              <li key={i} className="rounded-card bg-cream-warm p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={String(it.qty)}
                    onChange={(e) =>
                      setItem(i, {
                        qty: Number(e.target.value.replace(/\D/g, "")) || 1,
                      })
                    }
                    className="w-16 rounded-btn border border-field bg-paper px-2 py-2 text-center text-[15px] text-ink"
                  />

                  <select
                    value={it.flavour}
                    onChange={(e) => setItem(i, { flavour: e.target.value })}
                    className="min-w-[9rem] grow rounded-btn border border-field bg-paper px-3 py-2 text-[15px] text-ink"
                  >
                    <option value="">Choose a flavour</option>
                    {flavours.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  <select
                    value={it.kind}
                    onChange={(e) =>
                      setItem(i, {
                        kind: e.target.value as WholeItem["kind"],
                        flavourB:
                          e.target.value === "HALF" ? it.flavourB : undefined,
                      })
                    }
                    className="rounded-btn border border-field bg-paper px-3 py-2 text-[15px] text-ink"
                  >
                    <option value="WHOLE">Whole cake</option>
                    <option value="HALF">Half and half</option>
                  </select>

                  {items.length > 1 && (
                    <button
                      onClick={() =>
                        setItems(items.filter((_, j) => j !== i))
                      }
                      className="text-xs text-ink2 underline underline-offset-4"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Only asked once they've said it's a half — no point
                    showing a second flavour on a whole cake. */}
                {it.kind === "HALF" && (
                  <select
                    value={it.flavourB ?? ""}
                    onChange={(e) => setItem(i, { flavourB: e.target.value })}
                    className="mt-2 w-full rounded-btn border border-field bg-paper px-3 py-2 text-[15px] text-ink"
                  >
                    <option value="">…and the other half</option>
                    {flavours
                      .filter((n) => n !== it.flavour)
                      .map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                  </select>
                )}
              </li>
            ))}
          </ul>

          <button
            onClick={() =>
              setItems([...items, { kind: "WHOLE", flavour: "", qty: 1 }])
            }
            className="mt-2 text-xs font-semibold text-gold-hover underline underline-offset-4"
          >
            + Add another cheesecake
          </button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Field label="Order total (£)" value={f.total} onChange={(v) => setF({ ...f, total: v })} />
          <Field label="Deposit taken (£)" value={f.deposit} onChange={(v) => setF({ ...f, deposit: v })} />
        </div>

        {f.total && f.deposit && (
          <p className="mt-2 text-[13px] text-ink2">
            Balance due on collection:{" "}
            <strong className="text-ink">
              {money(
                Math.max(
                  0,
                  Math.round(parseFloat(f.total || "0") * 100) -
                    Math.round(parseFloat(f.deposit || "0") * 100)
                )
              )}
            </strong>
          </p>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">
            Notes (yours only, not sent)
          </span>
          <textarea
            value={f.notes}
            rows={2}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
            className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink"
          />
        </label>

        <label className="mt-4 flex items-start gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={allergens}
            onChange={(e) => setAllergens(e.target.checked)}
            className="mt-1 h-4 w-4 accent-gold"
          />
          <span>
            Allergens discussed
            <span className="block text-[12px] text-ink2">
              Recorded on the order with a timestamp, the same as a customer
              ticking it online.
            </span>
          </span>
        </label>

        <label className="mt-3 flex items-start gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={depositTerms}
            onChange={(e) => setDepositTerms(e.target.checked)}
            className="mt-1 h-4 w-4 accent-gold"
          />
          <span>
            Non-refundable deposit explained
            <span className="block text-[12px] text-ink2">
              Recorded with a timestamp. The confirmation states it too, but a
              dated note of having said it is worth more if it's disputed.
            </span>
          </span>
        </label>

        <label className="mt-3 flex items-start gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="mt-1 h-4 w-4 accent-gold"
          />
          <span>
            Send the confirmation
            <span className="block text-[12px] text-ink2">
              Email and text. Leave unticked when fixing a typo.
            </span>
          </span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <Btn variant="gold" onClick={save} disabled={busy}>
            {busy ? "Saving…" : order ? "Save changes" : "Save and confirm"}
          </Btn>
          <Btn variant="outline" onClick={onClose}>
            Close
          </Btn>
        </div>
      </div>
    </div>
  );
}
