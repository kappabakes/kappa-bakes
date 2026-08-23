"use client";

import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/config";
import { Btn, Card, Field, readError } from "./ui";

type Extra = {
  id: string;
  kind: "SAUCE" | "TOPPING";
  name: string;
  pricePence: number;
  active: boolean;
  canTub: boolean;
  sortOrder: number;
};

/**
 * Sauces and toppings that can be added to a slice. Each has its own price.
 * Which ones appear on which flavour is set per flavour, in the editor above.
 */
export function Extras({ flash }: { flash: (m: string) => void }) {
  const [extras, setExtras] = useState<Extra[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/extras");
    if (r.ok) setExtras((await r.json()).extras);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="mt-6">
      <h2 className="font-display text-2xl text-ink">Extras</h2>
      <p className="mt-1 text-[13px] text-ink2">
        Sauces and toppings customers can add. Set which ones each flavour
        offers when you edit that flavour.
      </p>

      <Group
        kind="SAUCE"
        title="Add sauce"
        note="For flavours that don't come with a sauce. One per slice."
        extras={extras}
        onChange={load}
        flash={flash}
      />

      <Group
        kind="TOPPING"
        title="Add toppings"
        note="Chosen from dropdowns when ordering. Each can only be picked once per slice."
        extras={extras}
        onChange={load}
        flash={flash}
      />
    </Card>
  );
}

function Group({
  kind,
  title,
  note,
  extras,
  onChange,
  flash,
}: {
  kind: "SAUCE" | "TOPPING";
  title: string;
  note: string;
  extras: Extra[];
  onChange: () => void;
  flash: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("1.00");
  const mine = extras.filter((e) => e.kind === kind);

  async function save(
    body: Partial<Extra> & { name: string; pricePence: number }
  ) {
    const r = await fetch("/api/admin/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...body }),
    });
    if (!r.ok) return flash(await readError(r));
    onChange();
  }

  async function add() {
    const pence = Math.round(parseFloat(price) * 100);
    if (!name.trim() || !Number.isFinite(pence))
      return flash("Needs a name and a price.");
    await save({ name, pricePence: pence, sortOrder: mine.length });
    setName("");
    setPrice("1.00");
    flash(`${name} added`);
  }

  async function remove(e: Extra) {
    if (
      !confirm(
        `Delete ${e.name}? It comes off every flavour that offers it. Past orders keep their own copy, so records aren't affected.`
      )
    )
      return;
    const r = await fetch(`/api/admin/extras?id=${e.id}`, { method: "DELETE" });
    if (!r.ok) return flash(await readError(r));
    flash(`${e.name} deleted`);
    onChange();
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-[12px] text-ink2">{note}</p>

      <ul className="mt-3 divide-y divide-line">
        {mine.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <EditableName
              value={e.name}
              onCommit={(v) => save({ id: e.id, name: v, pricePence: e.pricePence })}
            />
            <EditablePrice
              value={(e.pricePence / 100).toFixed(2)}
              onCommit={(v) =>
                save({
                  id: e.id,
                  name: e.name,
                  pricePence: Math.round(parseFloat(v) * 100) || 0,
                })
              }
            />
            {kind === "SAUCE" && (
              <label className="flex items-center gap-2 text-[13px] text-ink2">
                <input
                  type="checkbox"
                  checked={e.canTub}
                  onChange={(ev) =>
                    save({
                      id: e.id,
                      name: e.name,
                      pricePence: e.pricePence,
                      active: e.active,
                      canTub: ev.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-gold"
                />
                Can go in a tub
              </label>
            )}

            <label className="flex items-center gap-2 text-[13px] text-ink2">
              <input
                type="checkbox"
                checked={e.active}
                onChange={(ev) =>
                  save({
                    id: e.id,
                    name: e.name,
                    pricePence: e.pricePence,
                    active: ev.target.checked,
                    canTub: e.canTub,
                  })
                }
                className="h-4 w-4 accent-gold"
              />
              Available
            </label>
            <button
              onClick={() => remove(e)}
              className="ml-auto rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Delete
            </button>
          </li>
        ))}
        {mine.length === 0 && (
          <li className="py-3 text-sm text-ink2">
            None yet — add one below.
          </li>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder={kind === "SAUCE" ? "Salted caramel" : "Biscuit crumble"}
          className="min-w-[12rem] grow"
        />
        <Field
          label="Price (£)"
          value={price}
          onChange={setPrice}
          className="w-28"
        />
        <Btn variant="gold" onClick={add} disabled={!name.trim()}>
          Add
        </Btn>
      </div>
    </div>
  );
}

/** Both fields save on blur rather than on every keystroke. */
function EditableName({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && v.trim() && onCommit(v)}
      className="min-w-[9rem] grow rounded-btn border border-field bg-paper px-3 py-1.5 text-[15px] text-ink focus:border-gold focus:outline-none"
    />
  );
}

function EditablePrice({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <span className="flex items-center gap-1">
      <span className="text-[13px] text-ink2">£</span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onCommit(v)}
        className="w-20 rounded-btn border border-field bg-paper px-2 py-1.5 text-[15px] text-ink focus:border-gold focus:outline-none"
      />
    </span>
  );
}
