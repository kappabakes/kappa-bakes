"use client";

import { useState } from "react";

/**
 * Joining the waiting list for a sold-out flavour.
 *
 * The wording never says why slices might return. A slice comes back for all
 * sorts of reasons — more baked, an order cancelled, a checkout released —
 * and often two at once, so naming one would be wrong as often as right.
 */
export function NotifyMe({
  flavourId,
  flavourName,
  dayIso,
  dayLabel,
  defaultEmail,
}: {
  flavourId: string;
  flavourName: string;
  dayIso: string | null;
  dayLabel: string | null;
  defaultEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [choice, setChoice] = useState<"DAY" | "ONCE" | "ALWAYS">(
    dayIso ? "DAY" : "ONCE"
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);

    const r = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        flavourId,
        dayIso: choice === "DAY" ? dayIso : null,
        repeating: choice === "ALWAYS",
      }),
    }).catch(() => null);

    setBusy(false);

    if (!r || !r.ok) {
      setError(
        (await r?.json().catch(() => null))?.error ??
          "That didn't save. Try again in a moment."
      );
      return;
    }
    setDone(true);
  }

  if (done)
    return (
      <div className="mt-2.5 rounded-btn bg-good-light px-3.5 py-3 text-center">
        <p className="text-[14px] font-semibold text-good">
          You&apos;re on the list
        </p>
        <p className="mt-0.5 text-[12px] text-ink2">
          We&apos;ll email {email} when {flavourName} is available.
        </p>
      </div>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2.5 w-full rounded-btn border-[1.5px] border-navy bg-paper py-2.5 text-[13.5px] font-bold text-navy transition-colors hover:bg-cream-warm"
      >
        🔔 Notify me when it&apos;s back
      </button>
    );

  return (
    <div className="mt-2.5 rounded-card border border-line bg-paper p-3.5">
      <p className="text-[13px] font-semibold text-ink">
        We&apos;ll email you the moment it&apos;s available again.
      </p>

      <input
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="mt-2 w-full rounded-btn border border-field bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-gold focus:outline-none"
      />

      <p className="mb-1.5 mt-3 text-[12px] font-bold uppercase tracking-wider text-gold-hover">
        When should we tell you?
      </p>

      <div className="space-y-1.5">
        {/*
          Three options rather than four: "every time" paired with a single
          date can't do anything, because that date happens once.
        */}
        {dayIso && dayLabel && (
          <Choice
            on={choice === "DAY"}
            onClick={() => setChoice("DAY")}
            title={dayLabel}
            note="If more slices become available for that date"
          />
        )}
        <Choice
          on={choice === "ONCE"}
          onClick={() => setChoice("ONCE")}
          title="Any date — once"
          note="The next time slices become available, then we'll stop"
        />
        <Choice
          on={choice === "ALWAYS"}
          onClick={() => setChoice("ALWAYS")}
          title="Any date — every time"
          note="Whenever slices become available, until you stop it"
        />
      </div>

      {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}

      <button
        onClick={join}
        disabled={busy || !email.includes("@")}
        className="mt-3 w-full rounded-btn bg-navy py-3 text-[14px] font-bold text-white disabled:bg-cream-beige disabled:text-muted"
      >
        {busy ? "Saving…" : "Let me know"}
      </button>

      <p className="mt-2 text-center text-[11px] leading-snug text-muted">
        One email per date at most. Unsubscribe link in every one.
      </p>
    </div>
  );
}

function Choice({
  on,
  onClick,
  title,
  note,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex w-full items-start gap-2.5 rounded-btn border px-3 py-2.5 text-left",
        on ? "border-navy bg-navy/5" : "border-field bg-paper",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2",
          on ? "border-[5px] border-navy" : "border-field",
        ].join(" ")}
      />
      <span>
        <span className="block text-[13.5px] text-ink">{title}</span>
        <span className="block text-[11.5px] text-ink2">{note}</span>
      </span>
    </button>
  );
}
