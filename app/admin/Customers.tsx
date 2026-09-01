"use client";

import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/config";
import { Btn, Card, PageHead, Field, Tag, readError } from "./ui";

type Customer = {
  email: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  orderCount: number;
  lastOrderAt: string | null;
  totalPence: number;
  marketingOptIn: boolean;
  unsubscribedAt: string | null;
};

export function Customers({ flash }: { flash: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);

  const load = useCallback(async (search = "") => {
    const r = await fetch(
      `/api/admin/customers${search ? `?q=${encodeURIComponent(search)}` : ""}`
    );
    if (r.ok) setRows((await r.json()).customers);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const spend = rows.reduce((n, c) => n + c.totalPence, 0);
  const repeat = rows.filter((c) => c.orderCount > 1).length;

  return (
    <>
      <PageHead
        title="Customers"
        note="Built from paid orders. One row per person, not per order."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink2">
            Customers
          </p>
          <p className="mt-1 font-display text-3xl text-ink">{rows.length}</p>
        </Card>
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink2">
            Ordered more than once
          </p>
          <p className="mt-1 font-display text-3xl text-ink">{repeat}</p>
        </Card>
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink2">
            Lifetime spend
          </p>
          <p className="mt-1 font-display text-3xl text-ink">{money(spend)}</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-end gap-3">
          <Field
            label="Search"
            value={q}
            onChange={setQ}
            placeholder="Name, email or mobile"
            className="grow"
          />
          <Btn onClick={() => load(q)}>Search</Btn>
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

        <ul className="mt-5 divide-y divide-line">
          {rows.map((c) => (
            <li key={c.email} className="flex flex-wrap items-center gap-3 py-3">
              <div className="grow">
                <p className="font-semibold text-ink">
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-[13px] text-ink2">
                  {c.email}
                  {c.mobile && ` · ${c.mobile}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Tag>{c.orderCount} order{c.orderCount === 1 ? "" : "s"}</Tag>
                <Tag tone="gold">{money(c.totalPence)}</Tag>
                {c.unsubscribedAt ? (
                  <Tag tone="bad">Unsubscribed</Tag>
                ) : c.marketingOptIn ? (
                  <Tag tone="good">Opted in</Tag>
                ) : (
                  <Tag>No emails</Tag>
                )}
              </div>

              <p className="w-full text-[12px] text-muted sm:w-auto">
                {c.lastOrderAt
                  ? `Last ordered ${new Date(c.lastOrderAt).toLocaleDateString("en-GB")}`
                  : "—"}
              </p>

              <button
                onClick={async () => {
                  const off = !c.unsubscribedAt;
                  if (
                    !confirm(
                      off
                        ? `Unsubscribe ${c.firstName} ${c.lastName}?\n\nThey'll stop getting marketing emails. Order confirmations and collection reminders still send — those aren't marketing.`
                        : `Put ${c.firstName} back on the list?\n\nOnly do this if they've asked. Adding someone who hasn't would be sending marketing without consent.`
                    )
                  )
                    return;
                  const r = await fetch("/api/admin/customers", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: c.email,
                      unsubscribed: off,
                    }),
                  });
                  if (!r.ok) return flash(await readError(r));
                  flash(off ? `${c.firstName} unsubscribed` : `${c.firstName} resubscribed`);
                  load(q);
                }}
                className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
              >
                {c.unsubscribedAt ? "Resubscribe" : "Unsubscribe"}
              </button>

              <button
                onClick={async () => {
                  if (
                    !confirm(
                      `Remove ${c.firstName} ${c.lastName} from the customer list?\n\nTheir orders stay — this only removes their contact details and totals. They'll reappear if they order again.\n\nIf they've asked not to be emailed, unsubscribing them is better: deleting loses the record that they asked.`
                    )
                  )
                    return;
                  const r = await fetch(
                    `/api/admin/customers?email=${encodeURIComponent(c.email)}`,
                    { method: "DELETE" }
                  );
                  if (!r.ok) return flash(await readError(r));
                  flash(`${c.firstName} removed`);
                  load(q);
                }}
                className="rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Remove
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="py-6 text-center text-sm text-ink2">
              No customers yet. They appear after their first paid order.
            </li>
          )}
        </ul>
      </Card>
    </>
  );
}
