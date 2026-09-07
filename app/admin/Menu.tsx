"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { money } from "@/lib/config";
import { Btn, Card, PageHead, Field, Area, Tag, Chip, readError } from "./ui";
import { Extras } from "./Extras";

type Flavour = {
  id: string;
  name: string;
  description: string;
  pricePence: number;
  hasToppings: boolean;
  allergens: string[];
  image: string | null;
  nameImage: string | null;
  maxPerOrder: number | null;
  stockPerDay: number | null;
  serving: "CHOICE" | "ON_SLICE" | "IN_TUB";
  selectedDatesOnly: boolean;
  dateStock?: { iso: string; stock: number }[];
  hasExtraSauce: boolean;
  sauceIds: string[];
  toppingIds: string[];
  maxSauces: number;
  maxToppings: number;
  active: boolean;
  sortOrder: number;
};

/** A new flavour arrives pre-filled, so every field is something to change
 *  rather than something to invent. Nothing reaches the site until you save. */
const placeholder = {
  name: "New flavour",
  description: "A line about what's in it — this shows on the menu.",
  price: "6.50",
  hasToppings: true,
  serving: "CHOICE" as "CHOICE" | "ON_SLICE" | "IN_TUB",
  selectedDatesOnly: false,
  dateStock: [] as { iso: string; stock: number }[],
  hasExtraSauce: true,
  allergens: ["milk", "eggs", "gluten"] as string[],
  image: "",
  nameImage: "",
  maxPerOrder: "",
  stockPerDay: "",
  sauceIds: [] as string[],
  toppingIds: [] as string[],
  maxSauces: 1,
  maxToppings: 2,
  sortOrder: 0,
};

export function MenuManager({ flash }: { flash: (m: string) => void }) {
  const [flavours, setFlavours] = useState<Flavour[] | null>(null);
  const [days, setDays] = useState<
    { iso: string; label: string; capacity: number }[]
  >([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState({ ...placeholder });
  const [uploading, setUploading] = useState(false);
  const [allergens, setAllergens] = useState<
    { id: string; label: string; custom: boolean }[]
  >([]);
  const [newAllergen, setNewAllergen] = useState("");
  const [catalogue, setCatalogue] = useState<
    { id: string; kind: "SAUCE" | "TOPPING"; name: string; pricePence: number; active: boolean }[]
  >([]);

  const load = useCallback(async () => {
    const [r, a, x] = await Promise.all([
      fetch("/api/admin/flavours"),
      fetch("/api/allergens"),
      fetch("/api/admin/extras"),
    ]);
    if (r.ok) {
      const d = await r.json();
      setFlavours(d.flavours);
      setDays(d.days ?? []);
    }
    else {
      setFlavours([]);
      flash(await readError(r));
    }
    if (a.ok) setAllergens((await a.json()).allergens);
    if (x.ok) setCatalogue((await x.json()).extras);
  }, []);

  /** Adding one puts it on the list for every flavour to choose from. It
   *  isn't ticked anywhere until you tick it. */
  async function addAllergen() {
    const label = newAllergen.trim();
    if (!label) return;
    const r = await fetch("/api/admin/allergens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!r.ok) return flash(await readError(r));
    setNewAllergen("");
    flash(`${label} added to the allergen list`);
    load();
  }

  async function dropAllergen(label: string) {
    if (
      !confirm(
        `Remove ${label} from the list? Flavours already ticked with it keep it.`
      )
    )
      return;
    await fetch(`/api/admin/allergens?label=${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
    load();
  }

  useEffect(() => {
    load();
  }, [load]);

  const live = (flavours ?? []).filter((f) => f.active);
  const archived = (flavours ?? []).filter((f) => !f.active);

  function startEdit(f: Flavour) {
    setEditing(f.id);
    setDraft({
      name: f.name,
      description: f.description,
      price: (f.pricePence / 100).toFixed(2),
      hasToppings: f.hasToppings,
      allergens: f.allergens,
      image: f.image ?? "",
      nameImage: f.nameImage ?? "",
      maxPerOrder: f.maxPerOrder ? String(f.maxPerOrder) : "",
      stockPerDay: f.stockPerDay ? String(f.stockPerDay) : "",
      serving: f.serving ?? "CHOICE",
      selectedDatesOnly: f.selectedDatesOnly ?? false,
      dateStock: f.dateStock ?? [],
      hasExtraSauce: f.hasExtraSauce ?? true,
      sauceIds: f.sauceIds ?? [],
      toppingIds: f.toppingIds ?? [],
      maxSauces: f.maxSauces ?? 1,
      maxToppings: f.maxToppings ?? 2,
      sortOrder: f.sortOrder,
    });
  }

  async function upload(file: File, field: "image" | "nameImage" = "image") {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body });
    setUploading(false);
    if (!r.ok) return flash(await readError(r));
    const { url } = await r.json();
    setDraft((d) => ({ ...d, [field]: url }));
    flash(field === "image" ? "Photo uploaded" : "Name image uploaded");
  }

  async function save() {
    const pence = Math.round(parseFloat(draft.price) * 100);
    if (!draft.name.trim() || !Number.isFinite(pence) || pence <= 0)
      return flash("A flavour needs a name and a price.");

    const r = await fetch("/api/admin/flavours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing === "new" ? undefined : editing,
        name: draft.name,
        description: draft.description,
        pricePence: pence,
        hasToppings: draft.hasToppings,
        allergens: draft.allergens,
        image: draft.image,
        nameImage: draft.nameImage,
        maxPerOrder: draft.maxPerOrder ? Number(draft.maxPerOrder) : null,
        stockPerDay: draft.stockPerDay ? Number(draft.stockPerDay) : null,
        serving: draft.serving,
        selectedDatesOnly: draft.selectedDatesOnly,
        dateStock: draft.selectedDatesOnly ? draft.dateStock : [],
        hasExtraSauce: draft.hasExtraSauce,
        sauceIds: draft.sauceIds,
        toppingIds: draft.toppingIds,
        maxSauces: Number(draft.maxSauces) || 1,
        maxToppings: Number(draft.maxToppings) || 2,
        sortOrder: Number(draft.sortOrder) || 0,
        active: true,
      }),
    });
    if (!r.ok) return flash(await readError(r));
    flash("Menu updated");
    setEditing(null);
    setDraft({ ...placeholder });
    load();
  }

  async function archive(f: Flavour) {
    if (
      !confirm(
        `Archive ${f.name}? It comes off the menu but keeps its price, photo and allergens, ready to bring back.`
      )
    )
      return;
    await fetch(`/api/admin/flavours?id=${f.id}`, { method: "DELETE" });
    flash(`${f.name} archived`);
    load();
  }

  /** Swap a flavour with the one above or below, then save the whole order. */
  async function move(index: number, by: -1 | 1) {
    const next = [...live];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    // Show it immediately, then persist — waiting for the round trip makes
    // reordering four items feel sluggish.
    setFlavours([...next, ...archived]);
    const r = await fetch("/api/admin/flavours/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((f) => f.id) }),
    });
    if (!r.ok) flash(await readError(r));
    load();
  }

  async function hardDelete(f: Flavour) {
    if (
      !confirm(
        `Delete ${f.name} for good? Past orders keep their own copy, so your records are safe — but the flavour itself is gone.`
      )
    )
      return;
    await fetch(`/api/admin/flavours?id=${f.id}&hard=true`, {
      method: "DELETE",
    });
    flash(`${f.name} deleted`);
    load();
  }

  async function restore(f: Flavour) {
    await fetch("/api/admin/flavours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, active: true }),
    });
    flash(`${f.name} is back on the menu`);
    load();
  }

  /* ---------- editor ---------- */
  if (editing) {
    return (
      <>
        <PageHead
          title={editing === "new" ? "Add Flavour" : "Edit Flavour"}
          note={
            editing === "new"
              ? "Everything below is a placeholder — change what you need and save."
              : "Changes show on the site immediately. Past orders keep what was ordered."
          }
          action={
            editing !== "new" ? (
              <Btn
                variant="danger"
                onClick={() => {
                  const f = (flavours ?? []).find((x) => x.id === editing);
                  if (f) archive(f);
                  setEditing(null);
                }}
              >
                Archive flavour
              </Btn>
            ) : undefined
          }
        />

        <Card>
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            {/* photo */}
            <div>
              <div className="relative aspect-square w-full overflow-hidden rounded-card border border-line bg-cream-beige">
                {draft.image ? (
                  <Image
                    src={draft.image}
                    alt=""
                    fill
                    sizes="220px"
                    quality={95}
              className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-center text-[13px] text-muted">
                    No photo yet
                  </span>
                )}
              </div>

              <label className="mt-3 block cursor-pointer rounded-btn border border-navy bg-paper px-4 py-2.5 text-center text-sm font-semibold text-navy hover:bg-cream-beige">
                {uploading ? "Uploading…" : draft.image ? "Change image" : "Upload image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
              </label>
              <p className="mt-1.5 text-center text-[12px] text-muted">
                PNG, JPG or WebP, up to 5MB
              </p>

              {/* Uploading needs Blob storage, which only exists once you're
                  deployed. Typing a path works anywhere — put the file in
                  public/flavours and reference it here. */}
              <Field
                label="…or path to a file in /public"
                value={draft.image}
                onChange={(v) => setDraft({ ...draft, image: v })}
                placeholder="/flavours/plain-jane.jpg"
                className="mt-3"
              />

              {/* The name as a wordmark. Menu page only — emails, texts and
                  the day sheet always use the text name above. */}
              <div className="mt-6 border-t border-line pt-4">
                <p className="text-[13px] font-semibold text-ink">
                  Name image
                  <span className="ml-1 font-normal text-muted">optional</span>
                </p>
                <div className="mt-2 flex h-14 items-center justify-center rounded-btn border border-line bg-cream-warm px-3">
                  {draft.nameImage ? (
                    <div className="relative h-10 w-full">
                      <Image
                        src={draft.nameImage}
                        alt=""
                        fill
                        sizes="220px"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <span className="text-[12px] text-muted">
                      Text name will be used
                    </span>
                  )}
                </div>

                <label className="mt-2 block cursor-pointer rounded-btn border border-navy bg-paper px-4 py-2 text-center text-[13px] font-semibold text-navy hover:bg-cream-beige">
                  {draft.nameImage ? "Change name image" : "Upload name image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(f, "nameImage");
                    }}
                  />
                </label>

                {draft.nameImage && (
                  <button
                    onClick={() => setDraft({ ...draft, nameImage: "" })}
                    className="mt-1.5 w-full text-[12px] text-muted underline underline-offset-4 hover:text-bad"
                  >
                    Remove, use text name
                  </button>
                )}

                <Field
                  label="…or path to a file in /public"
                  value={draft.nameImage}
                  onChange={(v) => setDraft({ ...draft, nameImage: v })}
                  placeholder="/flavours/names/plain-jane.png"
                  className="mt-3"
                />

                <p className="mt-2 text-[12px] text-muted">
                  Shows on the menu page only. Transparent PNG, around 520x100.
                </p>
              </div>
            </div>

            {/* fields */}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Name"
                  value={draft.name}
                  onChange={(v) => setDraft({ ...draft, name: v })}
                />
                <Field
                  label="Price (£)"
                  value={draft.price}
                  onChange={(v) => setDraft({ ...draft, price: v })}
                />
              </div>

              <Area
                label="Description"
                value={draft.description}
                onChange={(v) => setDraft({ ...draft, description: v })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Limit per order"
                  value={draft.maxPerOrder}
                  onChange={(v) =>
                    setDraft({ ...draft, maxPerOrder: v.replace(/\D/g, "") })
                  }
                  placeholder="No limit"
                  hint="For a limited special. Blank means only the date's limit applies."
                />
                <Field
                  label="Stock per collection date"
                  value={draft.stockPerDay}
                  onChange={(v) =>
                    setDraft({ ...draft, stockPerDay: v.replace(/\D/g, "") })
                  }
                  placeholder="No separate stock"
                  hint="How many you make of this flavour each date. These slices are counted separately from the day's total, and it shows as sold out once they're gone."
                />
              </div>

              <label className="flex items-start gap-3 text-[15px] text-ink">
                <input
                  type="checkbox"
                  checked={draft.hasToppings}
                  onChange={(e) =>
                    setDraft({ ...draft, hasToppings: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-gold"
                />
                <span>
                  This flavour comes with toppings
                  <span className="block text-[12px] text-ink2">
                    Untick for a plain slice. Customers still choose on the
                    slice or in a tub if they add a sauce or a topping.
                  </span>
                </span>
              </label>

              {/* A one-off special: on the menu only for the dates you pick. */}
              <div className="border-t border-line pt-4">
                <label className="flex items-start gap-3 text-[15px] text-ink">
                  <input
                    type="checkbox"
                    checked={draft.selectedDatesOnly}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        selectedDatesOnly: e.target.checked,
                      })
                    }
                    className="mt-1 h-4 w-4 accent-gold"
                  />
                  <span>
                    Only on selected dates
                    <span className="block text-[12px] text-ink2">
                      For a special you&apos;re making once. It won&apos;t
                      appear at all on other dates — not sold out, just not on
                      the menu.
                    </span>
                  </span>
                </label>

                {draft.selectedDatesOnly && (
                  <div className="mt-3">
                    {days.length === 0 ? (
                      <p className="text-[13px] text-ink2">
                        No upcoming collection dates. Set some up first, then
                        come back.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {days.map((d) => {
                          const row = draft.dateStock.find(
                            (x) => x.iso === d.iso
                          );
                          return (
                            <li
                              key={d.iso}
                              className="flex flex-wrap items-center gap-3"
                            >
                              <label className="flex min-w-[10rem] grow cursor-pointer items-center gap-2.5 text-[14px] text-ink">
                                <input
                                  type="checkbox"
                                  checked={Boolean(row)}
                                  onChange={(e) =>
                                    setDraft({
                                      ...draft,
                                      dateStock: e.target.checked
                                        ? [
                                            ...draft.dateStock,
                                            { iso: d.iso, stock: 8 },
                                          ]
                                        : draft.dateStock.filter(
                                            (x) => x.iso !== d.iso
                                          ),
                                    })
                                  }
                                  className="h-4 w-4 accent-gold"
                                />
                                {d.label}
                              </label>

                              {row && (
                                <span className="flex items-center gap-2">
                                  <input
                                    inputMode="numeric"
                                    value={String(row.stock)}
                                    onChange={(e) =>
                                      setDraft({
                                        ...draft,
                                        dateStock: draft.dateStock.map((x) =>
                                          x.iso === d.iso
                                            ? {
                                                ...x,
                                                stock:
                                                  Number(
                                                    e.target.value.replace(
                                                      /\D/g,
                                                      ""
                                                    )
                                                  ) || 0,
                                              }
                                            : x
                                        ),
                                      })
                                    }
                                    className="w-20 rounded-btn border border-field bg-paper px-3 py-1.5 text-[15px] text-ink focus:border-gold focus:outline-none"
                                  />
                                  <span className="text-[12px] text-ink2">
                                    slices
                                  </span>
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p className="mt-2 text-[12px] text-muted">
                      These slices are separate from the day&apos;s total, so
                      they don&apos;t eat into your other flavours.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[15px] text-ink">
                  How toppings and sauce are served
                </p>
                <div className="mt-2 space-y-2">
                  {(
                    [
                      [
                        "CHOICE",
                        "Customer chooses",
                        "On the slice or in a tub, their call.",
                      ],
                      [
                        "ON_SLICE",
                        "On the slice only",
                        "No choice offered. For anything that doesn't work in a tub.",
                      ],
                      [
                        "IN_TUB",
                        "In a tub only",
                        "No choice offered. For a sauce that needs warming, or won't pour.",
                      ],
                    ] as const
                  ).map(([value, title, note]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-start gap-3 text-[15px] text-ink"
                    >
                      <input
                        type="radio"
                        name="serving"
                        checked={draft.serving === value}
                        onChange={() => setDraft({ ...draft, serving: value })}
                        className="mt-1 h-4 w-4 accent-gold"
                      />
                      <span>
                        {title}
                        <span className="block text-[12px] text-ink2">
                          {note}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {draft.hasToppings && draft.serving !== "ON_SLICE" && (
                <label className="flex items-start gap-3 text-[15px] text-ink">
                  <input
                    type="checkbox"
                    checked={draft.hasExtraSauce}
                    onChange={(e) =>
                      setDraft({ ...draft, hasExtraSauce: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 accent-gold"
                  />
                  <span>
                    Offer extra sauce
                    <span className="block text-[12px] text-ink2">
                      More of the sauce it already comes with. On the slice
                      50p, in a tub £1.
                    </span>
                  </span>
                </label>
              )}

              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink">
                  Allergens
                  <span className="ml-2 font-normal text-muted">
                    shown on the menu and order page
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {allergens.map((a) => {
                    const on = draft.allergens.includes(a.id);
                    return (
                      <Chip
                        key={a.id}
                        on={on}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            allergens: on
                              ? draft.allergens.filter((x) => x !== a.id)
                              : [...draft.allergens, a.id],
                          })
                        }
                      >
                        {a.label}
                      </Chip>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field
                    label="Add another allergen"
                    value={newAllergen}
                    onChange={setNewAllergen}
                    placeholder="e.g. Wheat"
                    className="w-56"
                    hint="Goes on the list for every flavour. Nothing is ticked automatically."
                  />
                  <Btn variant="ghost" onClick={addAllergen} disabled={!newAllergen.trim()}>
                    Add
                  </Btn>
                </div>

                {allergens.some((a) => a.custom) && (
                  <p className="mt-2 text-[12px] text-muted">
                    Yours:{" "}
                    {allergens
                      .filter((a) => a.custom)
                      .map((a) => (
                        <button
                          key={a.id}
                          onClick={() => dropAllergen(a.label)}
                          className="mr-2 underline underline-offset-4 hover:text-bad"
                        >
                          {a.label} ✕
                        </button>
                      ))}
                  </p>
                )}
              </div>

              {/* which extras this flavour offers */}
              <ExtraPicker
                title="Add sauce"
                note="For a flavour that doesn't come with one, or where a second sauce works."
                kind="SAUCE"
                catalogue={catalogue}
                selected={draft.sauceIds}
                onChange={(ids) => setDraft({ ...draft, sauceIds: ids })}
                extra={
                  <Field
                    label="How many at once"
                    value={String(draft.maxSauces)}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        maxSauces: Number(v.replace(/\D/g, "")) || 1,
                      })
                    }
                    className="mt-3 w-36"
                  />
                }
              />

              <ExtraPicker
                title="Add toppings"
                note="Customers pick from dropdowns, and can't choose the same one twice."
                kind="TOPPING"
                catalogue={catalogue}
                selected={draft.toppingIds}
                onChange={(ids) => setDraft({ ...draft, toppingIds: ids })}
                extra={
                  <Field
                    label="How many at once"
                    value={String(draft.maxToppings)}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        maxToppings: Number(v.replace(/\D/g, "")) || 1,
                      })
                    }
                    className="mt-3 w-36"
                  />
                }
              />

              <div className="flex gap-3 pt-2">
                <Btn
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    setDraft({ ...placeholder });
                  }}
                >
                  Cancel
                </Btn>
                <Btn onClick={save}>Save changes</Btn>
              </div>
            </div>
          </div>
        </Card>
      </>
    );
  }

  /* ---------- list ---------- */
  return (
    <>
      <PageHead
        title="Menu"
        note="Manage your flavours and allergen information. The arrows set the order they appear in on the menu and ordering page."
        action={
          <Btn
            variant="gold"
            onClick={() => {
              setEditing("new");
              setDraft({ ...placeholder, sortOrder: live.length });
            }}
          >
            + Add Flavour
          </Btn>
        }
      />

      <Card className="p-0">
        <ul className="divide-y divide-line">
          {live.map((f, i) => (
            <li key={f.id} className="p-4">
              <div className="flex items-start gap-3">
                {/* reorder */}
                <div className="flex shrink-0 flex-col pt-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${f.name} up`}
                    className="px-1 text-ink2 hover:text-ink disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === live.length - 1}
                    aria-label={`Move ${f.name} down`}
                    className="px-1 text-ink2 hover:text-ink disabled:opacity-20"
                  >
                    ▼
                  </button>
                </div>

                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-btn bg-cream-beige">
                  {f.image && (
                    <Image src={f.image} alt="" fill sizes="128px" quality={95} className="object-cover" />
                  )}
                </div>

                <div className="min-w-0 grow">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-ink">{f.name}</p>
                    <p className="font-semibold text-ink">
                      {money(f.pricePence)}
                    </p>
                  </div>

                  <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-ink2">
                    {f.description}
                  </p>

                  {f.selectedDatesOnly && (
                    <p className="mt-1 text-[12px] font-semibold text-gold-hover">
                      Selected dates only
                      {f.dateStock && f.dateStock.length > 0
                        ? ` · ${f.dateStock.length} date${f.dateStock.length === 1 ? "" : "s"}`
                        : " · none set"}
                    </p>
                  )}
                  {f.serving !== "CHOICE" && (
                    <p className="mt-1 text-[12px] font-semibold text-ink2">
                      {f.serving === "IN_TUB"
                        ? "In a tub only"
                        : "On the slice only"}
                    </p>
                  )}
                  {(f.maxPerOrder || f.stockPerDay) && (
                    <p className="mt-1 text-[12px] font-semibold text-gold-hover">
                      {f.maxPerOrder && `Limited to ${f.maxPerOrder} per order`}
                      {f.maxPerOrder && f.stockPerDay && " · "}
                      {f.stockPerDay && `${f.stockPerDay} made per date`}
                    </p>
                  )}

                  {f.allergens.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {f.allergens.map((a) => (
                        <li
                          key={a}
                          className="rounded-md bg-cream-beige px-2 py-0.5 text-[11px] text-ink2"
                        >
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* buttons on their own row so they always sit inside the card */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <button
                  onClick={() => startEdit(f)}
                  className="rounded-btn border border-navy bg-paper px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-beige"
                >
                  Edit
                </button>
                <button
                  onClick={() => archive(f)}
                  className="rounded-btn border border-navy bg-cream-beige px-3 py-1.5 text-xs font-semibold text-ink2 transition-colors hover:bg-line"
                >
                  Archive
                </button>
                <button
                  onClick={() => hardDelete(f)}
                  className="rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {flavours === null && (
            <li className="p-6 text-center text-sm text-ink2">Loading…</li>
          )}
          {flavours !== null && live.length === 0 && (
            <li className="p-6 text-center text-sm text-ink2">
              Nothing on the menu yet. Add a flavour above.
            </li>
          )}
        </ul>
      </Card>

      <Extras flash={flash} />

      {archived.length > 0 && (
        <Card className="mt-5">
          <h2 className="font-display text-xl text-ink">Archived Flavours</h2>
          <p className="mt-1 text-[13px] text-ink2">
            Kept exactly as they were — price, photo, description and allergens.
            Bring one back for a weekend and nothing needs retyping.
          </p>
          <ul className="mt-4 divide-y divide-line">
            {archived.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-3">
                <span className="grow text-ink2">{f.name}</span>
                <button
                  onClick={() => restore(f)}
                  className="rounded-btn border border-navy bg-cream-beige px-3 py-1.5 text-xs font-semibold text-ink2 transition-colors hover:bg-line"
                >
                  Unarchive
                </button>
                <button
                  onClick={() => hardDelete(f)}
                  className="rounded-btn border border-navy bg-bad px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}


/** Tick which sauces or toppings a flavour offers. */
function ExtraPicker({
  title,
  note,
  kind,
  catalogue,
  selected,
  onChange,
  extra,
}: {
  title: string;
  note: string;
  kind: "SAUCE" | "TOPPING";
  catalogue: { id: string; kind: string; name: string; pricePence: number; active: boolean }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  extra?: React.ReactNode;
}) {
  const items = catalogue.filter((e) => e.kind === kind && e.active);

  return (
    <div className="border-t border-line pt-4">
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[12px] text-ink2">{note}</p>

      {items.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink2">
          Nothing to offer yet — add some under Extras at the bottom of this
          page, then come back.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((e) => {
              const on = selected.includes(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() =>
                    onChange(
                      on
                        ? selected.filter((x) => x !== e.id)
                        : [...selected, e.id]
                    )
                  }
                  className={[
                    "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    on
                      ? "bg-navy text-white"
                      : "bg-cream-beige text-ink2 hover:bg-cream-warm",
                  ].join(" ")}
                >
                  {e.name} · {money(e.pricePence)}
                </button>
              );
            })}
          </div>
          {selected.length === 0 && (
            <p className="mt-2 text-[12px] text-muted">
              None ticked, so this option won&apos;t appear for this flavour.
            </p>
          )}
          {selected.length > 0 && extra}
        </>
      )}
    </div>
  );
}
