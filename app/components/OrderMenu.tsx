"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Order Now opens a choice rather than going straight to the slice page.
 *
 * The two lines of explanation matter: someone who doesn't yet know the
 * difference between a slice order and a whole cheesecake would otherwise
 * guess, and guessing wrong means a wasted trip through the wrong flow.
 */
export function OrderMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on a tap elsewhere or on Escape — a menu you can't dismiss is
  // worse than no menu on a phone.
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative justify-self-end">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-btn bg-gold px-3 py-2 text-center text-[12px] font-semibold uppercase leading-tight tracking-wide text-white transition-colors hover:bg-gold-hover sm:whitespace-nowrap sm:px-6 sm:text-sm"
      >
        Order
        <br className="sm:hidden" /> Now
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[260px] overflow-hidden rounded-card border border-line bg-paper shadow-card"
        >
          <Link
            href="/order"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block border-b border-line px-4 py-3.5 transition-colors hover:bg-cream-warm"
          >
            <span className="block text-[15px] font-semibold text-ink">
              Order Slices
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-ink2">
              Choose your collection date and slices
            </span>
          </Link>

          <Link
            href="/full-cheesecakes"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3.5 transition-colors hover:bg-cream-warm"
          >
            <span className="block text-[15px] font-semibold text-ink">
              Order a Full San Sebastián
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-ink2">
              Whole cheesecakes, by enquiry
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
