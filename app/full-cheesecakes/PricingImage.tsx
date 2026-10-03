"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

/**
 * The price list, tappable to fill the screen.
 *
 * Full-screen matters here: the Important Information box is small print on a
 * phone, and pinching a page-width image doesn't help much. Opened this way
 * the browser's own zoom has the full file to work with.
 */
export function PricingImage({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  // Escape closes it, and the page behind shouldn't scroll while it's up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative block w-full overflow-hidden rounded-card border border-line"
        aria-label="Enlarge the price list"
      >
        <Image
          src={src}
          alt="Full San Sebastián cheesecake flavours, prices and ordering information"
          width={1450}
          height={2576}
          priority
          className="block h-auto w-full"
        />
        <span className="absolute bottom-3 right-3 rounded-full bg-navy/85 px-3 py-1.5 text-[11px] font-semibold text-white">
          Tap to enlarge
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 overflow-auto bg-ink/90 p-3"
        >
          <button
            onClick={() => setOpen(false)}
            className="sticky top-0 z-10 ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-ink"
            aria-label="Close"
          >
            ×
          </button>
          {/* Plain img rather than next/image: this one is for zooming into,
              so it wants the whole file, not a resized version. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Full San Sebastián cheesecake flavours and prices"
            onClick={(e) => e.stopPropagation()}
            className="mx-auto block w-full max-w-3xl rounded-card"
          />
        </div>
      )}
    </>
  );
}
