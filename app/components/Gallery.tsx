"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * A scrollable row of customer photos. Tap one to see it full size.
 * Renders nothing at all when there are no photos, rather than leaving a
 * heading over an empty space.
 */
export function Gallery({ images }: { images: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  // Escape closes, arrows move between photos.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => ((i ?? 0) + 1) % images.length);
      if (e.key === "ArrowLeft")
        setOpen((i) => ((i ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  if (images.length === 0) return null;

  return (
    <section className="bg-cream py-14">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.16em] text-ink">
          Gallery
        </h2>

        {/* Scrolls sideways once there are more than fit. */}
        <ul className="mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
          {images.map((src, i) => (
            <li
              key={src}
              className="w-40 shrink-0 snap-start sm:w-52"
            >
              <button
                onClick={() => setOpen(i)}
                className="relative block aspect-square w-full overflow-hidden rounded-card border border-line bg-cream-beige transition-transform hover:scale-[1.02]"
                aria-label={`View photo ${i + 1} of ${images.length}`}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, 420px"
                  quality={95}
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-sm text-ink2">
          Collection only. The full address comes with your order confirmation.
        </p>
      </div>

      {open !== null && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5"
        >
          <div
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-card bg-cream-beige">
              <Image
                src={images[open]}
                alt=""
                fill
                sizes="(max-width: 768px) 90vw, 672px"
                quality={95}
                className="object-cover"
                priority
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={() =>
                  setOpen((i) => ((i ?? 0) - 1 + images.length) % images.length)
                }
                className="rounded-btn bg-paper px-4 py-2.5 font-semibold text-ink"
                aria-label="Previous photo"
              >
                ‹ Previous
              </button>

              <span className="text-sm text-white">
                {open + 1} of {images.length}
              </span>

              <button
                onClick={() => setOpen((i) => ((i ?? 0) + 1) % images.length)}
                className="rounded-btn bg-paper px-4 py-2.5 font-semibold text-ink"
                aria-label="Next photo"
              >
                Next ›
              </button>
            </div>

            <button
              onClick={() => setOpen(null)}
              className="mt-3 w-full rounded-btn border border-white/40 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
