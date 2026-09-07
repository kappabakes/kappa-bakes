"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Btn, Card, readError } from "./ui";

/**
 * The homepage gallery. Photos upload to the same storage the flavour images
 * use, so adding one is a tap here rather than a code change.
 */
export function GalleryManager({ flash }: { flash: (m: string) => void }) {
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [usingFolder, setUsingFolder] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/gallery");
    if (!r.ok) return flash(await readError(r));
    const d = await r.json();
    setPhotos(d.photos);
    setUsingFolder(d.usingFolder);
  }, [flash]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(next: string[]) {
    setPhotos(next); // show it straight away
    const r = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos: next }),
    });
    if (!r.ok) flash(await readError(r));
    load();
  }

  async function upload(files: FileList) {
    setBusy(true);
    const added: string[] = [];

    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch("/api/admin/upload", { method: "POST", body });
      if (!r.ok) {
        flash(await readError(r));
        break;
      }
      added.push((await r.json()).url);
    }

    setBusy(false);
    if (added.length) {
      await save([...(photos ?? []), ...added]);
      flash(`${added.length} photo${added.length === 1 ? "" : "s"} added`);
    }
  }

  function move(i: number, by: -1 | 1) {
    const next = [...(photos ?? [])];
    const to = i + by;
    if (to < 0 || to >= next.length) return;
    [next[i], next[to]] = [next[to], next[i]];
    save(next);
  }

  return (
    <Card className="mb-5">
      <h2 className="font-display text-xl text-ink">Homepage gallery</h2>
      <p className="mt-1 text-[13px] text-ink2">
        Photos of customer orders, shown on the homepage. Tap one on the site
        and it opens full size.
      </p>

      {usingFolder && (
        <p className="mt-3 rounded-card border border-gold/40 bg-gold-light px-4 py-2.5 text-[13px] text-ink">
          Currently showing the photos built into the site. Upload one here and
          these take over completely.
        </p>
      )}

      {photos === null && (
        <p className="mt-3 text-sm text-ink2">Loading…</p>
      )}

      {photos !== null && photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((src, i) => (
            <li key={src} className="group relative">
              <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-cream-beige">
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>

              <div className="mt-1 flex items-center justify-between gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move earlier"
                  className="px-1.5 text-ink2 hover:text-ink disabled:opacity-20"
                >
                  ‹
                </button>
                <button
                  onClick={() => {
                    if (!confirm("Remove this photo from the gallery?")) return;
                    save(photos.filter((_, j) => j !== i));
                  }}
                  className="text-[11px] font-semibold text-bad hover:underline"
                >
                  Remove
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === photos.length - 1}
                  aria-label="Move later"
                  className="px-1.5 text-ink2 hover:text-ink disabled:opacity-20"
                >
                  ›
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-4 inline-block cursor-pointer rounded-btn bg-gold px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover">
        {busy ? "Uploading…" : "Add photos"}
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

      <p className="mt-2 text-[12px] text-muted">
        Square photos work best, around 600×600. Pick several at once if you
        like. Up to 30.
      </p>
    </Card>
  );
}
