"use client";

import { useEffect, useState } from "react";
import { ALLERGENS, allergenLabel } from "@/lib/config";
import { Btn } from "./ui";

/**
 * Allergens, behind a button.
 *
 * Fourteen tick boxes under every flavour and every extra made both editors
 * unreadable — the list is long, rarely changed, and only matters when
 * you're deliberately setting it.
 */
export function AllergenPicker({
  value,
  onChange,
  custom,
  onAddCustom,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /// Ones you've added yourself, alongside the statutory fourteen.
  custom?: { id: string; label: string }[];
  onAddCustom?: (label: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(value);
  const [adding, setAdding] = useState("");

  useEffect(() => setPicked(value), [value, open]);

  const all = [...ALLERGENS, ...(custom ?? [])];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="rounded-btn border border-field bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-cream-warm"
        >
          {value.length ? `Allergens (${value.length})` : "Set allergens"}
        </button>

        {value.length > 0 ? (
          <span className="text-[12px] text-ink2">
            {value.map((a) => allergenLabel(a)).join(", ")}
          </span>
        ) : (
          <span className="text-[12px] font-semibold text-bad">None set</span>
        )}
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto my-8 w-full max-w-md rounded-card border border-line bg-paper p-5 shadow-card"
          >
            <h2 className="font-display text-2xl text-ink">Allergens</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
              Tick everything this contains. Customers see these before they
              agree to the allergen notice.
            </p>

            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {all.map((a) => {
                const on = picked.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={[
                      "flex cursor-pointer items-center gap-2.5 rounded-btn border px-3 py-2 text-[14px]",
                      on
                        ? "border-navy bg-navy/5 text-ink"
                        : "border-field bg-paper text-ink2",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPicked(
                          on
                            ? picked.filter((x) => x !== a.id)
                            : [...picked, a.id]
                        )
                      }
                      className="h-4 w-4 accent-gold"
                    />
                    {a.label}
                  </label>
                );
              })}
            </div>

            {onAddCustom && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-[12.5px] font-semibold text-ink">
                  Add your own
                </p>
                {/*
                  The fourteen above are the UK's legally declarable
                  allergens and stay fixed. Anything added here is extra
                  information — useful, but not a substitute for them.
                */}
                <p className="mb-2 text-[11.5px] leading-snug text-ink2">
                  The list above is the fourteen you must declare by law and
                  can&apos;t be changed. Anything you add here is extra detail
                  on top.
                </p>
                <div className="flex gap-2">
                  <input
                    value={adding}
                    onChange={(e) => setAdding(e.target.value)}
                    placeholder="e.g. Alcohol"
                    className="grow rounded-btn border border-field bg-paper px-3 py-2 text-[14px] text-ink"
                  />
                  <Btn
                    variant="outline"
                    onClick={async () => {
                      if (!adding.trim()) return;
                      await onAddCustom(adding.trim());
                      setAdding("");
                    }}
                    disabled={!adding.trim()}
                  >
                    Add
                  </Btn>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Btn
                variant="gold"
                onClick={() => {
                  onChange(picked);
                  setOpen(false);
                }}
              >
                Save
              </Btn>
              <Btn variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
