"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Receipt = {
  shop: { name: string; addressLines: string[]; email: string };
  orderNo: string;
  status: string;
  customer: { name: string; email: string; mobile: string };
  collection: { day: string; window: string; address: string[] };
  slices: { flavour: string; toppings: string; price: string }[];
  total: string;
  customerNote: string | null;
  adminNote: string | null;
  payment: {
    stripeSessionId: string | null;
    stripePaymentId: string | null;
    placedAt: string;
    confirmSentAt: string | null;
    emailStatus: string | null;
    smsStatus: string | null;
  };
  policy: {
    acceptedAt: string | null;
    text: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  };
  allergens: { acceptedAt: string | null; text: string | null };
  cancellation: {
    at: string;
    reason: string | null;
    note: string | null;
  } | null;
  events: { kind: string; detail: string | null; at: string }[];
};

const stamp = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "Europe/London",
      })
    : "—";

/**
 * Deliberately plain: black on white, no brand colours, everything on one
 * page. This is a document someone else reads to decide whether you're owed
 * money, so it should look like a record, not like marketing.
 */
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/receipt?id=${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then(setR)
      .catch(() => setError("Sign in on the admin page first, then reopen this."));
  }, [id]);

  if (error) return <main className="p-10 text-sm">{error}</main>;
  if (!r) return <main className="p-10 text-sm">Loading…</main>;

  return (
    <main className="receipt mx-auto max-w-[720px] bg-white p-10 text-[13px] leading-relaxed text-black">
      <button
        onClick={() => window.print()}
        className="no-print mb-8 border border-black px-4 py-2 text-xs"
      >
        Save as PDF or print
      </button>

      <header className="border-b-2 border-black pb-3">
        <h1 className="text-xl font-bold">Order record — {r.orderNo}</h1>
        <p className="mt-1">
          {r.shop.name}, {r.shop.addressLines.join(", ")} · {r.shop.email}
        </p>
        <p className="mt-1">
          Produced {stamp(new Date().toISOString())} · Status {r.status}
        </p>
      </header>

      <Section title="Customer">
        <Row k="Name" v={r.customer.name} />
        <Row k="Email" v={r.customer.email} />
        <Row k="Mobile" v={r.customer.mobile} />
      </Section>

      <Section title="Collection">
        <Row k="Date" v={r.collection.day} />
        <Row k="Time" v={r.collection.window} />
        <Row k="Address" v={r.collection.address.join(", ")} />
      </Section>

      <Section title="What was ordered">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1.5 font-semibold">Flavour</th>
              <th className="py-1.5 font-semibold">Toppings</th>
              <th className="py-1.5 text-right font-semibold">Price</th>
            </tr>
          </thead>
          <tbody>
            {r.slices.map((s, i) => (
              <tr key={i} className="border-b border-neutral-300">
                <td className="py-1.5">{s.flavour}</td>
                <td className="py-1.5">{s.toppings}</td>
                <td className="py-1.5 text-right">{s.price}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold" colSpan={2}>
                Total paid
              </td>
              <td className="py-2 text-right font-semibold">{r.total}</td>
            </tr>
          </tbody>
        </table>
        {r.customerNote && (
          <p className="mt-3">Customer note: “{r.customerNote}”</p>
        )}
        {r.adminNote && <p className="mt-1">Our note: {r.adminNote}</p>}
      </Section>

      {r.cancellation && (
        <Section title="Cancellation">
          <Row k="Cancelled at" v={stamp(r.cancellation.at)} />
          <Row
            k="Reason"
            v={
              r.cancellation.reason === "CUSTOMER"
                ? "Requested by the customer"
                : "Cancelled by Kappa Bakes"
            }
          />
          {r.cancellation.note && (
            <p className="mt-2 border-l-2 border-black pl-3 italic">
              {r.cancellation.note}
            </p>
          )}
          <p className="mt-2">
            The slices returned to sale at that point. Any refund was handled
            separately in Stripe.
          </p>
        </Section>
      )}

      <Section title="Policies accepted by the customer">
        <p>
          Neither box was pre-ticked, and the order could not be submitted
          until both were ticked.
        </p>

        <div className="mt-4 border border-black p-3">
          <p className="font-semibold">
            <span className="mr-2 inline-block">[✓]</span>
            Allergen information — accepted
          </p>
          <p className="mt-1.5 border-l-2 border-neutral-400 pl-3 italic">
            {r.allergens?.text ?? "—"}
          </p>
          <p className="mt-1.5 text-[12px]">
            Accepted at {stamp(r.allergens?.acceptedAt ?? null)}
          </p>
        </div>

        <div className="mt-3 border border-black p-3">
          <p className="font-semibold">
            <span className="mr-2 inline-block">[✓]</span>
            No show policy — accepted
          </p>
          <p className="mt-1.5 border-l-2 border-neutral-400 pl-3 italic">
            {r.policy.text ?? "—"}
          </p>
          <p className="mt-1.5 text-[12px]">
            Accepted at {stamp(r.policy.acceptedAt)}
          </p>
        </div>

        <div className="mt-3">
          <Row k="IP address" v={r.policy.ipAddress ?? "—"} />
          <Row k="Device" v={r.policy.userAgent ?? "—"} />
        </div>
        <p className="mt-3">
          The no show policy was shown again on the payment page before the
          customer paid.
        </p>
      </Section>

      <Section title="Payment">
        <Row k="Placed" v={stamp(r.payment.placedAt)} />
        <Row k="Stripe checkout session" v={r.payment.stripeSessionId ?? "—"} />
        <Row k="Stripe payment" v={r.payment.stripePaymentId ?? "—"} />
      </Section>

      <Section title="Confirmations sent">
        <Row k="Sent" v={stamp(r.payment.confirmSentAt)} />
        <Row k="Email" v={r.payment.emailStatus ?? "—"} />
        <Row k="SMS" v={r.payment.smsStatus ?? "—"} />
      </Section>

      <Section title="Full history">
        <table className="w-full border-collapse">
          <tbody>
            {r.events.map((e, i) => (
              <tr key={i} className="border-b border-neutral-300 align-top">
                <td className="w-56 py-1.5">{stamp(e.at)}</td>
                <td className="py-1.5 font-semibold">{e.kind}</td>
                <td className="py-1.5">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <footer className="mt-8 border-t border-black pt-3 text-[11px]">
        This record is generated from the order database. Timestamps are UK
        time. The history above is append-only.
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 break-inside-avoid">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 border-b border-neutral-200 py-1">
      <span className="w-44 shrink-0 text-neutral-600">{k}</span>
      <span className="break-all">{v}</span>
    </div>
  );
}
