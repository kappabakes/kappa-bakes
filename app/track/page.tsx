"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { whatsappLink, SHOP } from "@/lib/config";

type Stage = { id: string; label: string; note: string };
type Result = {
  orderNo: string;
  name: string;
  status: string;
  day: string;
  window: string;
  address: string[];
  lines: string[];
  total: string;
  policy: string;
  stage: string;
  stageIndex: number;
  stages: Stage[];
  lastName: string;
  isTest: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelNote: string | null;
  links: { instagram: string; snapchat: string; whatsapp: string | null };
};

export default function Track() {
  return (
    <Suspense
      fallback={<main className="p-10 text-sm text-ink2">One moment…</main>}
    >
      <TrackInner />
    </Suspense>
  );
}

function TrackInner() {
  const params = useSearchParams();
  const [orderNo, setOrderNo] = useState("");
  const [lastName, setLastName] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const look = useCallback(
    async (no = orderNo, last = lastName) => {
      setBusy(true);
      setError(null);
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo: no, lastName: last }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setResult(null);
        setError(data.error);
        return;
      }
      setResult(data);
    },
    [orderNo, lastName]
  );

  /**
   * Arriving from the confirmation screen or the confirmation email, the
   * order number and surname come along in the link — so it goes straight to
   * the tracking rather than asking for details they've just been given.
   */
  useEffect(() => {
    const o = params.get("o");
    const n = params.get("n");
    if (!o || !n) return;
    setOrderNo(o);
    setLastName(n);
    look(o, n);
    // Only on arrival: re-running whenever the fields change would fight
    // with someone typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once an order is found, use the message the server built — it carries the
  // order number, surname and collection date, each on its own line.
  const wa = result
    ? result.links.whatsapp
    : whatsappLink(`Hi ${SHOP.name}, I have a question`);

  return (
    <main className="bg-cream py-12">
      <div className="mx-auto max-w-4xl px-5">
        <h1 className="text-center font-display text-4xl text-ink md:text-5xl">
          Track Your Order
        </h1>
        <p className="mt-3 text-center text-[15px] text-ink2">
          Enter your order number and the last name used to place it.
        </p>

        {!result && (
          <div className="mt-9 grid gap-5 md:grid-cols-2">
            <div className="rounded-card border border-line bg-paper p-6 shadow-soft">
              <h2 className="font-display text-2xl text-ink">
                Enter Your Details
              </h2>

              <label className="mt-5 block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Order Number
                </span>
                <input
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="e.g. KB014"
                  className="w-full rounded-btn border border-field bg-paper px-4 py-3 text-[15px] uppercase text-ink placeholder:text-muted focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
                />
                <span className="mt-1 block text-[12px] text-muted">
                  You&apos;ll find this in your confirmation.
                </span>
              </label>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Last Name
                </span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && look()}
                  placeholder="e.g. Khan"
                  className="w-full rounded-btn border border-field bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
                />
                <span className="mt-1 block text-[12px] text-muted">
                  The name the order was placed under.
                </span>
              </label>

              <button
                onClick={() => look()}
                disabled={busy || !orderNo || !lastName}
                className="mt-6 w-full rounded-btn bg-navy px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy-hover disabled:opacity-50"
              >
                {busy ? "Looking…" : "Track Order"}
              </button>

              {error && (
                <p className="mt-4 rounded-card border border-bad/30 bg-bad-light px-4 py-3 text-sm text-ink">
                  {error}
                </p>
              )}
            </div>

            <div className="rounded-card border border-line bg-cream-warm p-6">
              <h2 className="font-display text-2xl text-ink">Need Help?</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink2">
                If you&apos;re having trouble finding your order, message us on
                WhatsApp and we&apos;ll look it up.
              </p>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 block rounded-btn border border-good bg-paper px-5 py-3 text-center font-semibold text-good transition-colors hover:bg-good-light"
                >
                  Chat on WhatsApp
                </a>
              )}

              <h3 className="mt-7 font-semibold text-ink">Tips</h3>
              <ul className="mt-2 space-y-2 text-[14px] text-ink2">
                <li>Use the last name the order was placed under.</li>
                <li>Order numbers look like KB014 — check your email.</li>
              </ul>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-9 space-y-5">
            {/* summary bar */}
            <div className="grid gap-4 rounded-card border border-line bg-paper p-6 shadow-soft sm:grid-cols-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink2">
                  Order Number
                </p>
                <p className="mt-1 font-display text-2xl text-gold">
                  {result.orderNo}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink2">
                  Collection Day
                </p>
                <p className="mt-1 font-semibold text-ink">{result.day}</p>
                <p className="text-sm text-ink2">{result.window}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink2">
                  Status
                </p>
                <p className="mt-1">
                  <span
                    className={[
                      "inline-block rounded-btn px-3 py-1 text-sm font-semibold",
                      result.stage === "COLLECTED"
                        ? "bg-good-light text-good"
                        : result.stage === "NO_SHOW" ||
                            result.stage === "CANCELLED"
                          ? "bg-bad-light text-bad"
                          : result.stage === "READY"
                            ? "bg-gold-light text-gold-hover"
                            : "bg-warn-light text-[#C56C00]",
                    ].join(" ")}
                  >
                    {result.stage === "CANCELLED"
                      ? "Cancelled"
                      : (result.stages.find((s) => s.id === result.stage)
                          ?.label ?? result.stage)}
                  </span>
                </p>
              </div>
            </div>

            {/* the two outcomes worth saying something about */}
            {result.stage === "COLLECTED" && (
              <div className="rounded-card border border-good/40 bg-good-light p-6">
                <h2 className="font-display text-2xl text-ink">
                  Your order has been collected.
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink2">
                  Enjoy your San Sebastián. If you have a minute, send us a
                  picture or video — a review means a lot to a small kitchen.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <a
                    href={result.links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-btn bg-gold px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-gold-hover"
                  >
                    Review on Instagram
                  </a>
                  <a
                    href={result.links.snapchat}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-btn border border-navy bg-paper px-4 py-3 text-center font-semibold text-navy transition-colors hover:bg-cream-beige"
                  >
                    Send on Snapchat
                  </a>
                  {result.links.whatsapp && (
                    <a
                      href={result.links.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-btn border border-good bg-paper px-4 py-3 text-center font-semibold text-good transition-colors hover:bg-good-light"
                    >
                      Any issues? WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}

            {result.stage === "CANCELLED" && (
              <div className="rounded-card border border-bad/40 bg-bad-light p-6">
                <h2 className="font-display text-2xl text-ink">
                  Your order was cancelled.
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink2">
                  {result.cancelReason === "CUSTOMER"
                    ? "This was cancelled at your request."
                    : "This was cancelled by Kappa Bakes."}
                  {result.cancelledAt && (
                    <>
                      {" "}
                      Cancelled on{" "}
                      {new Date(result.cancelledAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                      .
                    </>
                  )}
                </p>

                {result.cancelNote && (
                  <p className="mt-3 rounded-card border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink2">
                    {result.cancelNote}
                  </p>
                )}

                {result.links.whatsapp && (
                  <a
                    href={result.links.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-block rounded-btn border border-good bg-paper px-5 py-3 font-semibold text-good transition-colors hover:bg-good-light"
                  >
                    Any questions? Message us
                  </a>
                )}
              </div>
            )}

            {result.stage === "NO_SHOW" && (
              <div className="rounded-card border border-bad/40 bg-bad-light p-6">
                <h2 className="font-display text-2xl text-ink">
                  You missed your collection slot.
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink2">
                  Sorry — your order wasn&apos;t collected, so it has been
                  cancelled. As set out in the collection policy you accepted,
                  the order is still charged: everything is baked to order.
                </p>
                {result.links.whatsapp && (
                  <a
                    href={result.links.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-block rounded-btn border border-good bg-paper px-5 py-3 font-semibold text-good transition-colors hover:bg-good-light"
                  >
                    Think this is wrong? Message us
                  </a>
                )}
              </div>
            )}

            {/* progress — meaningless once an order is cancelled */}
            {result.stage !== "CANCELLED" && (
            <div className="rounded-card border border-line bg-paper p-6 shadow-soft">
              <h2 className="font-display text-2xl text-ink">Order Progress</h2>
              <ol className="mt-5 space-y-4">
                {result.stages.map((s, i) => {
                  const done = i < result.stageIndex;
                  const now = i === result.stageIndex;
                  return (
                    <li key={s.id} className="flex items-start gap-3">
                      <span
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          done
                            ? "bg-good text-white"
                            : now
                              ? "bg-navy text-white"
                              : "border border-line bg-paper text-muted",
                        ].join(" ")}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <span>
                        <span
                          className={[
                            "block font-semibold",
                            done || now ? "text-ink" : "text-muted",
                          ].join(" ")}
                        >
                          {s.label}
                        </span>
                        <span className="block text-[13px] text-ink2">
                          {s.note}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            )}

            {/* order */}
            <div className="rounded-card border border-line bg-paper p-6 shadow-soft">
              <h2 className="font-display text-2xl text-ink">Your Order</h2>
              <ul className="mt-3 space-y-1 text-[15px] text-ink2">
                {result.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="mt-4 flex items-center justify-between border-t border-line pt-4 font-semibold text-ink">
                <span>Total Paid</span>
                <span className="font-display text-xl">{result.total}</span>
              </p>

              <h3 className="mt-6 font-semibold text-ink">Collection</h3>
              <p className="text-sm text-ink2">
                {result.day}, {result.window}
              </p>
              {result.address.map((l) => (
                <p key={l} className="text-sm text-ink2">
                  {l}
                </p>
              ))}

              <p className="mt-5 rounded-card border border-line bg-cream-warm px-4 py-3 text-[13px] leading-relaxed text-ink2">
                {result.policy}
              </p>
            </div>

            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-card border border-good/30 bg-good-light px-5 py-4"
              >
                <span>
                  <span className="block font-semibold text-[#166534]">
                    Need to get in touch?
                  </span>
                  <span className="block text-[13px] text-ink2">
                    Message us about this order on WhatsApp.
                  </span>
                </span>
                <span className="shrink-0 rounded-btn border border-good px-4 py-2 text-[13px] font-semibold text-good">
                  Chat on WhatsApp
                </span>
              </a>
            )}

            <button
              onClick={() => {
                // Also drop any ?o= and ?n= from the address bar, or the
                // browser's back button would drop them straight back in.
                window.history.replaceState(null, "", "/track");
                setResult(null);
                setOrderNo("");
                setLastName("");
                setError(null);
              }}
              className="w-full rounded-btn border border-navy bg-paper px-5 py-3 font-semibold text-navy transition-colors hover:bg-cream-beige"
            >
              Track another order
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
