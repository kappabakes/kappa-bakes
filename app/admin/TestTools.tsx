"use client";

import { useCallback, useEffect, useState } from "react";

type Day = { iso: string; label: string; left: number; confirmed: boolean };

export function TestTools({ flash }: { flash: (m: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(0);
  const [days, setDays] = useState<Day[]>([]);
  const [dayIso, setDayIso] = useState("");
  // Held as text, not a number: coercing on every keystroke means the field
  // snaps back to 1 the moment you clear it, and you can't type "12".
  const [howMany, setHowMany] = useState("1");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([
      fetch("/api/admin/test"),
      fetch("/api/admin/days"),
    ]);
    if (t.ok) {
      const data = await t.json();
      setEnabled(data.enabled);
      setCount(data.count);
    }
    if (d.ok) {
      const data = await d.json();
      setDays(data.days);
      if (!dayIso && data.days[0]) setDayIso(data.days[0].iso);
    }
  }, [dayIso]);

  useEffect(() => {
    load();
  }, [load]);

  if (!enabled) return null;

  async function make() {
    setBusy(true);
    const r = await fetch("/api/admin/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayIso, count: Number(howMany) || 1 }),
    });
    const d = await r.json();
    setBusy(false);
    flash(r.ok ? `Created ${d.made.length} test order(s)` : (d.error ?? "Failed"));
    load();
  }

  async function wipe() {
    if (!confirm(`Delete all ${count} test orders? Real orders aren't touched.`))
      return;
    setBusy(true);
    const r = await fetch("/api/admin/test?all=true", { method: "DELETE" });
    const d = await r.json();
    setBusy(false);
    flash(`Deleted ${d.deleted} test order(s)`);
    load();
  }

  return (
    <section className="mt-12 border border-dashed border-bad px-4 py-5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-bad">
        Test tools
      </h2>
      <p className="mt-2 text-xs text-muted">
        Creates paid orders without going near Stripe, so you can rehearse
        sold-out states, editing and the day sheet. Set{" "}
        <code className="text-ink">TEST_MODE=false</code> before you go
        live and this panel disappears.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[13px] font-semibold text-ink">
            Day
          </span>
          <select
            value={dayIso}
            onChange={(e) => setDayIso(e.target.value)}
            className="mt-1 block bg-cream px-3 py-2 text-sm text-ink"
          >
            {days.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.label} — {d.left} free{d.confirmed ? "" : " (unconfirmed)"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-semibold text-ink">
            How many
          </span>
          <input
            inputMode="numeric"
            value={howMany}
            onChange={(e) => setHowMany(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setHowMany((v) => (v === "" ? "1" : v))}
            className="mt-1 w-20 border-b border-line bg-transparent pb-1 text-sm text-ink focus:border-navy"
          />
        </label>

        <button
          onClick={make}
          disabled={busy || !dayIso}
          className="border border-navy px-3 py-1.5 text-xs text-gold disabled:opacity-30"
        >
          {busy ? "Working…" : "Create test orders"}
        </button>

        <button
          onClick={async () => {
            if (
              !confirm(
                "Set order numbers back to KB001?\n\nOnly works with no real orders on the system, so it can't renumber over a live sequence."
              )
            )
              return;
            const r = await fetch("/api/admin/test", { method: "PATCH" });
            const d = await r.json();
            flash(
              r.ok
                ? "Next order will be KB001"
                : (d.error ?? "Couldn't reset the numbering.")
            );
          }}
          className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
        >
          Reset order numbers to KB001
        </button>

        <button
          onClick={async () => {
            const r = await fetch(
              "/api/cron/sweep-checkouts?manual=true"
            );
            const d = await r.json();
            flash(
              r.ok
                ? `Checked ${d.checked}, released ${d.released}${
                    d.recovered ? `, ${d.recovered} paid order recovered` : ""
                  }`
                : "Couldn't run the sweep."
            );
          }}
          className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
        >
          Release abandoned checkouts
        </button>

        <button
          onClick={wipe}
          disabled={busy || count === 0}
          className="ml-auto border border-bad px-3 py-1.5 text-xs text-bad disabled:opacity-30"
        >
          Delete all {count} test orders
        </button>
      </div>
    </section>
  );
}
