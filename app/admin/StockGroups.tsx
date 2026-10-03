"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, readError } from "./ui";

type Group = {
  id: string;
  name: string;
  stock: number;
  active: boolean;
};

type Flavour = {
  id: string;
  name: string;
  stockGroupId: string | null;
  stockPerDay: number | null;
};

/**
 * Flavours cut from the same cheesecake.
 *
 * Two ways of finishing one cake still come out of the same eight slices, so
 * they share a count. A flavour can only be in one group — otherwise there'd
 * be two different answers for how many are left.
 */
export function StockGroups({ flash }: { flash: (m: string) => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/stock-groups");
    if (!r.ok) return flash(await readError(r));
    const d = await r.json();
    setGroups(d.groups);
    setFlavours(d.flavours);
  }, [flash]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(body: {
    id?: string;
    name: string;
    stock: number;
    flavourIds?: string[];
  }) {
    const r = await fetch("/api/admin/stock-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return flash(await readError(r));
    flash("Saved");
    setAdding(false);
    load();
  }

  async function remove(g: Group) {
    if (
      !confirm(
        `Delete "${g.name}"?\n\nThe flavours in it go back to their own slice counts.`
      )
    )
      return;

    const r = await fetch(`/api/admin/stock-groups?id=${g.id}`, {
      method: "DELETE",
    });
    if (!r.ok) return flash(await readError(r));
    flash("Deleted");
    load();
  }

  return (
    <Card className="mt-6">
      <h2 className="font-display text-xl text-ink">Stock groups</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink2">
        For flavours cut from the same cheesecake. They share one slice count
        instead of each having their own, and the name is the heading customers
        see above them.
      </p>

      <ul className="mt-4 space-y-3">
        {groups.map((g) => (
          <GroupRow
            key={g.id}
            group={g}
            flavours={flavours}
            onSave={save}
            onDelete={() => remove(g)}
          />
        ))}
      </ul>

      {adding ? (
        <GroupRow
          group={{ id: "", name: "", stock: 8, active: true }}
          flavours={flavours}
          onSave={save}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 text-[13px] font-semibold text-gold-hover underline underline-offset-4"
        >
          + New group
        </button>
      )}
    </Card>
  );
}

function GroupRow({
  group,
  flavours,
  onSave,
  onDelete,
  onCancel,
}: {
  group: Group;
  flavours: Flavour[];
  onSave: (b: {
    id?: string;
    name: string;
    stock: number;
    flavourIds?: string[];
  }) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [stock, setStock] = useState(String(group.stock));
  const [picked, setPicked] = useState<string[]>(
    flavours.filter((f) => f.stockGroupId === group.id).map((f) => f.id)
  );

  const dirty =
    name !== group.name ||
    stock !== String(group.stock) ||
    picked.join() !==
      flavours
        .filter((f) => f.stockGroupId === group.id)
        .map((f) => f.id)
        .join();

  return (
    <li className="rounded-card border border-line p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="One cake, two ways"
          className="min-w-[10rem] grow rounded-btn border border-field bg-paper px-3 py-2 text-[15px] font-semibold text-ink focus:border-gold focus:outline-none"
        />
        <span className="flex items-center gap-1.5">
          <input
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
            className="w-16 rounded-btn border border-field bg-paper px-2 py-2 text-center text-[15px] text-ink"
          />
          <span className="text-[12px] text-ink2">slices</span>
        </span>
      </div>

      <div className="mt-3 space-y-1">
        {flavours.map((f) => {
          const on = picked.includes(f.id);
          // A flavour already in another group can't be in this one too.
          const taken =
            !on && f.stockGroupId !== null && f.stockGroupId !== group.id;

          return (
            <label
              key={f.id}
              className={[
                "flex items-center gap-2.5 text-[14px]",
                taken ? "opacity-40" : "cursor-pointer text-ink",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={taken}
                onChange={() =>
                  setPicked(
                    on ? picked.filter((x) => x !== f.id) : [...picked, f.id]
                  )
                }
                className="h-4 w-4 accent-gold"
              />
              {f.name}
              {taken && (
                <span className="text-[11px] text-muted">in another group</span>
              )}
              {!on && !taken && f.stockPerDay !== null && (
                <span className="text-[11px] text-muted">
                  has its own stock — joining replaces it
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Btn
          variant={dirty ? "gold" : "outline"}
          onClick={() =>
            onSave({
              id: group.id || undefined,
              name,
              stock: Number(stock) || 8,
              flavourIds: picked,
            })
          }
          disabled={!name.trim()}
        >
          {group.id ? "Save" : "Create group"}
        </Btn>

        {onDelete && (
          <Btn variant="danger" onClick={onDelete}>
            Delete
          </Btn>
        )}
        {onCancel && (
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
        )}
      </div>
    </li>
  );
}
