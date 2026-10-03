"use client";

import { useState } from "react";
import { money } from "@/lib/config";
import { Btn } from "./ui";

export type CancelResult = {
  reason: string;
  note?: string;
  sendEmail: boolean;
  refund: "NONE" | "FULL" | "PARTIAL" | "NOTHING_PAID";
  refundPence?: number;
};

/**
 * Cancelling, in one place.
 *
 * The refund position is picked from a list rather than typed, so the
 * wording a customer reads is the same every time — it's the part of a
 * cancellation people read twice.
 */
export function CancelDialog({
  who,
  paidPence,
  isDeposit,
  onClose,
  onConfirm,
}: {
  who: string;
  /// What they've actually handed over — the full payment, or the deposit.
  paidPence: number;
  isDeposit?: boolean;
  onClose: () => void;
  onConfirm: (r: CancelResult) => void;
}) {
  const [reason, setReason] = useState("CUSTOMER");
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [refund, setRefund] = useState<CancelResult["refund"]>("NONE");
  const [partial, setPartial] = useState("");

  const preview =
    refund === "FULL"
      ? `A full refund of ${money(paidPence)} has been issued and should reach you within 5-10 days.`
      : refund === "PARTIAL"
        ? `A partial refund of ${money(Math.round(parseFloat(partial || "0") * 100))} has been issued and should reach you within 5-10 days.`
        : refund === "NONE"
          ? isDeposit
            ? `Your ${money(paidPence)} deposit is non-refundable, as agreed when the order was placed.`
            : "No refund is due on this order."
          : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto my-8 w-full max-w-md rounded-card border border-line bg-paper p-6 shadow-card"
      >
        <h2 className="font-display text-2xl text-ink">Cancel {who}&apos;s order</h2>

        <p className="mt-4 text-[13px] font-semibold text-ink">Why?</p>
        <div className="mt-1.5 space-y-1.5">
          {[
            ["CUSTOMER", "The customer asked to cancel"],
            ["OTHER", "Another reason"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2.5 text-[14px] text-ink"
            >
              <input
                type="radio"
                checked={reason === value}
                onChange={() => setReason(value)}
                className="h-4 w-4 accent-gold"
              />
              {label}
            </label>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">
            Note (yours only, not sent)
          </span>
          <textarea
            value={note}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink"
          />
        </label>

        <p className="mt-4 text-[13px] font-semibold text-ink">Refund</p>
        <select
          value={refund}
          onChange={(e) => setRefund(e.target.value as CancelResult["refund"])}
          className="mt-1.5 w-full rounded-btn border border-field bg-paper px-3 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
        >
          <option value="NONE">
            {isDeposit ? "Deposit kept — no refund" : "No refund"}
          </option>
          <option value="FULL">Full refund ({money(paidPence)})</option>
          <option value="PARTIAL">Partial refund</option>
          <option value="NOTHING_PAID">Nothing was paid</option>
        </select>

        {refund === "PARTIAL" && (
          <label className="mt-2 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              How much (£)
            </span>
            <input
              inputMode="decimal"
              value={partial}
              onChange={(e) => setPartial(e.target.value)}
              placeholder="0.00"
              className="w-32 rounded-btn border border-field bg-paper px-3 py-2.5 text-[15px] text-ink"
            />
          </label>
        )}

        <label className="mt-4 flex items-start gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="mt-1 h-4 w-4 accent-gold"
          />
          <span>
            Email the customer
            <span className="block text-[12px] text-ink2">
              Leave unticked when you&apos;ve already sorted it by message.
            </span>
          </span>
        </label>

        {/* What they'll read, before it's sent rather than after. */}
        {sendEmail && preview && (
          <p className="mt-2 rounded-btn bg-cream-warm px-3 py-2.5 text-[13px] leading-relaxed text-ink2">
            {preview}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Btn
            variant="danger"
            onClick={() =>
              onConfirm({
                reason,
                note: note.trim() || undefined,
                sendEmail,
                refund,
                refundPence:
                  refund === "PARTIAL"
                    ? Math.round(parseFloat(partial || "0") * 100)
                    : undefined,
              })
            }
          >
            Cancel the order
          </Btn>
          <Btn variant="outline" onClick={onClose}>
            Close
          </Btn>
        </div>
      </div>
    </div>
  );
}
