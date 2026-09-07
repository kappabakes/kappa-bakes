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
  };
  address: string[];
};

const stamp = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
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
          <li key={n}>
            {it.qty}× {describeItem(it)}
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-[15px] font-bold">Payment</h2>
      <Row k="Order total" v={money(o.totalPence)} />
      <Row k="Deposit taken" v={`${money(o.depositPence)} (non-refundable)`} />
      <Row k="Balance on collection" v={money(balance)} />

      <h2 className="mt-6 text-[15px] font-bold">Confirmed to the customer</h2>
      <Row
        k="Allergens discussed"
        v={o.allergensDiscussedAt ? stamp(o.allergensDiscussedAt) : "Not recorded"}
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

      {o.collectedAt && <Row k="Collected" v={stamp(o.collectedAt)} />}

      {o.cancelledAt && (
        <>
          <h2 className="mt-6 text-[15px] font-bold">Cancellation</h2>
          <Row k="Cancelled" v={stamp(o.cancelledAt)} />
          <Row
            k="Reason"
            v={
              o.cancelReason === "CUSTOMER"
                ? "Requested by the customer"
                : "Other"
            }
          />
          {o.cancelNote && <p className="mt-1">{o.cancelNote}</p>}
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
