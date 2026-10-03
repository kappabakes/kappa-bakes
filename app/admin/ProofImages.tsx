"use client";

import { useState } from "react";
import { readError } from "./ui";

/**
 * Screenshots kept on an order — either the messages it was agreed in, or
 * the message asking to cancel.
 *
 * Thumbnails rather than a button: the point of proof is being able to check
 * it at a glance, and a button makes you open it to find out what's there.
 */
export function ProofImages({
  id,
  kind,
  field,
  proof,
  onChange,
  flash,
}: {
  id: string;
  kind: "SLICE" | "WHOLE";
  /// Which set this is. An order can hold both.
  field: "orderProof" | "cancelProof";
  proof: string[];
  onChange: (next: string[]) => void;
  flash: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  async function upload(files: FileList) {
    setBusy(true);
    const urls: string[] = [];

    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch("/api/admin/upload", { method: "POST", body });
      if (!r.ok) {
        flash(await readError(r));
        break;
      }
      urls.push((await r.json()).url);
    }

    if (urls.length) {
      const r = await fetch("/api/admin/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, kind, field, urls }),
      });
      if (r.ok) onChange((await r.json()).proof);
      else flash(await readError(r));
    }

    setBusy(false);
  }

  /**
   * Moving is done in the viewer rather than on the thumbnails: arrows on a
   * 56px square would crowd it, and you generally decide the order while
   * looking at the image anyway.
   */
  async function move(image: string, dir: -1 | 1) {
    const at = proof.indexOf(image);
    const to = at + dir;
    if (to < 0 || to >= proof.length) return;

    const next = [...proof];
    [next[at], next[to]] = [next[to], next[at]];
    onChange(next);

    const r = await fetch("/api/admin/proof", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind, field, urls: next }),
    });
    // Put it back if the save didn't take, rather than showing an order
    // that isn't stored.
    if (!r.ok) {
      onChange(proof);
      flash(await readError(r));
    }
  }

  async function remove(image: string) {
    if (!confirm("Remove this image?")) return;
    const r = await fetch(
      `/api/admin/proof?id=${id}&kind=${kind}&field=${field}&image=${encodeURIComponent(image)}`,
      { method: "DELETE" }
    );
    if (!r.ok) return flash(await readError(r));
    onChange(proof.filter((u) => u !== image));
  }

  const i = viewing ? proof.indexOf(viewing) : -1;

  return (
    <>
      {/* Fixed squares in a row, so a tall screenshot and a wide one still
          line up. Each is cropped to its top, which is where a message
          thread's useful part is. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {proof.map((u) => (
          <button
            key={u}
            onClick={() => setViewing(u)}
            className="relative h-14 w-14 overflow-hidden rounded-btn border border-field bg-cream-warm"
            aria-label="Enlarge"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt=""
              className="h-full w-full object-cover object-top"
            />
            {proof.length > 1 && (
              <span className="absolute bottom-0 right-0 rounded-tl bg-ink/75 px-1 text-[10px] font-bold text-white">
                {proof.indexOf(u) + 1}
              </span>
            )}
          </button>
        ))}

        <label
          className={[
            "flex h-14 w-14 cursor-pointer items-center justify-center rounded-btn border-[1.5px] border-dashed text-xl",
            busy
              ? "border-field text-muted"
              : "border-gold text-gold-hover hover:bg-cream-warm",
          ].join(" ")}
          title={proof.length ? "Add more" : "Add proof"}
        >
          {busy ? "…" : "+"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {viewing && (
        <div
          onClick={() => setViewing(null)}
          className="fixed inset-0 z-50 overflow-auto bg-ink/90 p-4"
        >
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between gap-3 pb-3">
              <span className="text-[13px] text-white/80">
                {i + 1} of {proof.length}
              </span>
              <button
                onClick={() => setViewing(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-ink"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewing}
              alt="Proof"
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-card bg-white"
            />

            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 flex flex-wrap justify-center gap-2"
            >
              {proof.map((u) => (
                <button
                  key={u}
                  onClick={() => setViewing(u)}
                  className={[
                    "h-10 w-10 overflow-hidden rounded",
                    u === viewing ? "opacity-100 ring-2 ring-white" : "opacity-50",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt=""
                    className="h-full w-full object-cover object-top"
                  />
                </button>
              ))}
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 flex items-center justify-center gap-2"
            >
              <button
                onClick={() => move(viewing, -1)}
                disabled={i === 0}
                className="rounded-btn bg-white/20 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
              >
                ← Move earlier
              </button>
              <button
                onClick={() => move(viewing, 1)}
                disabled={i === proof.length - 1}
                className="rounded-btn bg-white/20 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
              >
                Move later →
              </button>
            </div>

            <button
              onClick={() => {
                const next = proof.filter((u) => u !== viewing);
                remove(viewing);
                setViewing(next[0] ?? null);
              }}
              className="mx-auto mt-3 block text-[12px] text-bad-light underline underline-offset-4"
            >
              Remove this one
            </button>
          </div>
        </div>
      )}
    </>
  );
}
