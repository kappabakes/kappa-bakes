"use client";

import { useState } from "react";
import { Btn, readError } from "./ui";

type Row = {
  flavourId: string;
  name: string;
  sold: number;
  cap: number | null;
  groupLeft: number;
};

/**
 * Dividing a shared cake between its flavours, for one date.
 *
 * Without caps the group is a straight pool — whoever orders takes from the
 * same slices. With them, each flavour has a ceiling, which is what makes
 * "give the rest to this one" possible: drop the others to what they've
 * already sold and the remaining slices are reachable only through the one
 * you left open.
 */
export function GroupShares({
  dayIso,
  groupName,
  groupStock,
  rows,
  onSaved,
  flash,
}: {
  dayIso: string;
  groupName: string;
  groupStock: number;
  rows: Row[];
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const [caps, setCaps] = useState<Record<string, string>>(
    Object.fromEntries(
      rows.map((r) => [r.flavourId, r.cap === null ? "" : String(r.cap)])
    )
  );
  const [busy, setBusy] = useState(false);

  const soldTotal = rows.reduce((n, r) => n + r.sold, 0);
  const left = Math.max(0, groupStock - soldTotal);

  async function save(next?: Record<string, string>) {
    const use = next ?? caps;
    setBusy(true);

    const r = await fetch("/api/admin/caps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayIso,
        caps: rows.map((row) => ({
          flavourId: row.flavourId,
          cap: use[row.flavourId]?.trim() === "" ? null : Number(use[row.flavourId]),
        })),
      }),
    });

    setBusy(false);
    if (!r.ok) return flash(await readError(r));
    flash("Saved");
    onSaved();
  }

  /** Everything still unsold goes to one flavour; the rest close at sold. */
  function giveRestTo(flavourId: string) {
    const next: Record<string, string> = {};
    for (const r of rows) {
      next[r.flavourId] =
        r.flavourId === flavourId ? String(r.sold + left) : String(r.sold);
    }
    setCaps(next);
    save(next);
  }

  return (
    <div className="mt-2 rounded-card border border-gold/40 bg-gold-light/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-gold-hover">
          {groupName}
        </span>
        <span className="text-[12px] text-ink2">
          {soldTotal} sold of {groupStock} · {left} left in the cake
        </span>
      </div>

      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.flavourId} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[8rem] grow text-[14px] text-ink">
              {r.name}
              <span className="ml-1.5 text-[12px] text-ink2">
                {r.sold} sold
              </span>
            </span>

            <input
              inputMode="numeric"
              value={caps[r.flavourId] ?? ""}
              onChange={(e) =>
                setCaps({
                  ...caps,
                  [r.flavourId]: e.target.value.replace(/\D/g, ""),
                })
              }
              placeholder="no cap"
              className="w-20 rounded-btn border border-field bg-paper px-2 py-1.5 text-center text-[14px] text-ink"
            />

            {left > 0 && (
              <button
                onClick={() => giveRestTo(r.flavourId)}
                disabled={busy}
                className="rounded-btn bg-navy px-2.5 py-1.5 text-[11px] font-semibold text-white"
              >
                Give it the {left}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Btn variant="gold" onClick={() => save()} disabled={busy}>
          {busy ? "Saving…" : "Save shares"}
        </Btn>
        <button
          onClick={() => {
            const next = Object.fromEntries(rows.map((r) => [r.flavourId, ""]));
            setCaps(next);
            save(next);
          }}
          disabled={busy}
          className="text-[12px] font-semibold text-ink2 underline underline-offset-4"
        >
          Clear all caps
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-ink2">
        Blank means no cap — that flavour can take whatever the cake has left.
        A cap can be raised any time; it can&apos;t go below what&apos;s
        already sold.
      </p>
    </div>
  );
}
