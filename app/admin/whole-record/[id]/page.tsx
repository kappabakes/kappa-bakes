"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/config";
import { WholeItem, describeItem, balancePence } from "@/lib/whole";

type Record = {
  order: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    collectAt: string;
    items: WholeItem[];
    totalPence: number;
    depositPence: number;
    status: string;
    requests: string | null;
    notes: string | null;
    allergensDiscussedAt: string | null;
    allergenText: string | null;
    depositTermsAt: string | null;
    depositTermsText: string | null;
    collectedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    cancelNote: string | null;
    createdAt: string;
    confirmSentAt: string | null;
    reminderSentAt: string | null;
    emailStatus: string | null;
    smsStatus: string | null;
    cancelProof: string[];
    orderProof: string[];
  };
  address: string[];
};

const stamp = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";

/**
 * The paper trail for a whole-cake order: what was agreed, when, and what was
 * confirmed to them. Printable, because a dispute months later is exactly
 * when you'll want it.
 */
export default function WholeRecord({ params }: { params: { id: string } }) {
  const [r, setR] = useState<Record | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/whole-record?id=${params.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setR)
      .catch(() => setErr("Couldn't load this record."));
  }, [params.id]);

  if (err) return <main className="p-10 text-sm">{err}</main>;
  if (!r) return <main className="p-10 text-sm">Loading…</main>;

  const o = r.order;
  const balance = balancePence(o.totalPence, o.depositPence);

  return (
    <main className="receipt mx-auto max-w-[720px] bg-white p-10 text-[13px] leading-relaxed text-black">
      <h1 className="text-[20px] font-bold">Whole Cheesecake Order</h1>
      <p className="mb-6 text-[12px] text-neutral-600">
        Kappa Bakes · taken {stamp(o.createdAt)}
      </p>

      <Row k="Customer" v={`${o.firstName} ${o.lastName}`} />
      <Row k="Mobile" v={o.mobile} />
      <Row k="Email" v={o.email} />
      <Row k="Collecting" v={stamp(o.collectAt)} />
      <Row k="Address" v={r.address.join(", ")} />
      <Row k="Status" v={o.status} />

      <h2 className="mt-6 text-[15px] font-bold">Order</h2>
      <ul className="mt-1">
        {o.items.map((it, n) => (
          <li key={n} className="mb-1">
            {it.qty}× {describeItem(it)}
            {/* As listed when the order was taken, not as they are now. */}
            {it.allergens && it.allergens.length > 0 && (
              <span className="block text-[12px] text-neutral-700">
                Allergens: {it.allergens.join(", ")}
              </span>
            )}
          </li>
        ))}
      </ul>

      {o.orderProof?.length > 0 && (
        <>
          <h2 className="mt-6 text-[15px] font-bold">
            Order proof ({o.orderProof.length})
          </h2>
          <p className="text-[12px] text-neutral-600">
            Screenshots of the messages this order was agreed in.
          </p>
          <div className="mt-2 flex flex-wrap gap-2.5">
                {o.orderProof.map((u, n) => (
                <figure key={u} className="m-0 w-[180px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt={`Order message ${n + 1}`}
                    className="block w-full rounded border border-neutral-300"
                  />
                  <figcaption className="mt-0.5 text-[11px] text-neutral-600">
                    {n + 1} of {o.orderProof.length}
                  </figcaption>
                </figure>
                ))}
              </div>
        </>
      )}

      <h2 className="mt-6 text-[15px] font-bold">Payment</h2>
      <Row k="Order total" v={money(o.totalPence)} />
      <Row k="Deposit taken" v={`${money(o.depositPence)} (non-refundable)`} />
      <Row k="Balance on collection" v={money(balance)} />

      <h2 className="mt-6 text-[15px] font-bold">Confirmed to the customer</h2>
      <Row
        k="Allergens discussed"
        v={
          o.allergensDiscussedAt ? stamp(o.allergensDiscussedAt) : "Not recorded"
        }
      />
      {o.allergenText && (
        <p className="mt-1 text-[12px] text-neutral-700">{o.allergenText}</p>
      )}

      <Row
        k="Deposit terms explained"
        v={o.depositTermsAt ? stamp(o.depositTermsAt) : "Not recorded"}
      />
      {o.depositTermsText && (
        <p className="mt-1 text-[12px] text-neutral-700">{o.depositTermsText}</p>
      )}

      {/*
        One timeline rather than a History section with a Cancellation
        section under it. A cancellation can happen before a reminder would
        have gone, so listing them by time is the only honest order — and
        it's what you'd want in front of you in a dispute.
      */}
      <h2 className="mt-6 text-[15px] font-bold">History</h2>
      <ul className="mt-1 list-none p-0">
        {[
          {
            at: o.createdAt,
            what: "Order taken",
            detail: null as string | null,
          },
          ...(o.allergensDiscussedAt
            ? [
                {
                  at: o.allergensDiscussedAt,
                  what: "Allergens discussed",
                  detail: o.allergenText,
                },
              ]
            : []),
          ...(o.depositTermsAt
            ? [
                {
                  at: o.depositTermsAt,
                  what: "Deposit terms explained",
                  detail: o.depositTermsText,
                },
              ]
            : []),
          ...(o.confirmSentAt
            ? [
                {
                  at: o.confirmSentAt,
                  what: "Confirmation sent",
                  detail: `Email ${o.emailStatus ?? "—"}, SMS ${o.smsStatus ?? "—"}`,
                },
              ]
            : []),
          ...(o.reminderSentAt
            ? [
                {
                  at: o.reminderSentAt,
                  what: "Collection reminder sent",
                  detail: null,
                },
              ]
            : []),
          ...(o.collectedAt
            ? [{ at: o.collectedAt, what: "Collected", detail: null }]
            : []),
          ...(o.cancelledAt
            ? [
                {
                  at: o.cancelledAt,
                  what: "Cancelled",
                  detail: [
                    o.cancelReason === "CUSTOMER"
                      ? "Requested by the customer"
                      : "Other",
                    o.cancelNote,
                  ]
                    .filter(Boolean)
                    .join(" — "),
                },
              ]
            : []),
        ]
          .sort((a, b) => +new Date(a.at) - +new Date(b.at))
          .map((e) => (
            <li key={e.what + e.at} className="mb-1">
              <span className="inline-block w-[180px] font-semibold">
                {stamp(e.at)}
              </span>
              {e.what}
              {e.detail && (
                <span className="block pl-[180px] text-[12px] text-neutral-700">
                  {e.detail}
                </span>
              )}
            </li>
          ))}

        {/* Things that haven't happened are worth stating, so a blank isn't
            mistaken for a missing record. */}
        {!o.cancelledAt && !o.collectedAt && (
          <li className="mb-1 text-neutral-600">
            <span className="inline-block w-[180px] font-semibold">—</span>
            Not yet collected
          </li>
        )}
      </ul>

      {o.cancelProof?.length > 0 && (
        <div className="mt-4">
          <p className="text-[12px] font-semibold">
            Proof of the cancellation request ({o.cancelProof.length}):
          </p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {o.cancelProof.map((u, n) => (
              <figure key={u} className="m-0 w-[180px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt={`Cancellation message ${n + 1}`}
                  className="block w-full rounded border border-neutral-300"
                />
                <figcaption className="mt-0.5 text-[11px] text-neutral-600">
                  {n + 1} of {o.cancelProof.length}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {o.requests && (
        <>
          <h2 className="mt-6 text-[15px] font-bold">
            Additional Info/Requests
          </h2>
          <p className="whitespace-pre-line">{o.requests}</p>
          <p className="mt-1 text-[12px] text-neutral-600">
            Included in the confirmation sent to the customer.
          </p>
        </>
      )}

      {o.notes && (
        <>
          <h2 className="mt-6 text-[15px] font-bold">Notes</h2>
          <p className="whitespace-pre-line">{o.notes}</p>
        </>
      )}

      <button
        onClick={() => window.print()}
        className="mt-8 rounded border border-black px-4 py-2 text-[12px] print:hidden"
      >
        Print
      </button>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="inline-block w-[180px] font-semibold">{k}</span>
      {v}
    </p>
  );
}
