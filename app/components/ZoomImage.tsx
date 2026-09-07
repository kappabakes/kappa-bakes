"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * A photo you can tap to see full size. Used on the menu, where the thumbnail
 * is too small to judge a slice by.
 */
export function ZoomImage({
  src,
  alt,
  caption,
  description,
  className = "",
  sizes = "450px",
}: {
  src: string;
  alt: string;
  caption?: string;
  description?: string;
  className?: string;
  sizes?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block cursor-pointer overflow-hidden rounded-card bg-cream-beige ${className}`}
        aria-label={`See ${alt} larger`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={95}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-ink/70 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Tap to enlarge
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6"
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-card bg-paper"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square w-full">
              <Image
                src={src}
                alt={alt}
                fill
                sizes="384px"
                quality={95}
                className="object-cover"
                priority
              />
            </div>
            <div className="p-5">
              {caption && (
                <h3 className="font-display text-2xl text-ink">{caption}</h3>
              )}
              {description && (
                <p className="mt-1 whitespace-pre-line text-sm text-ink2">{description}</p>
              )}
              <button
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-btn border border-navy py-2.5 text-sm font-semibold text-navy"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
