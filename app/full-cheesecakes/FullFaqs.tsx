"use client";

import { useState } from "react";

/**
 * Collapsed by default, one open at a time. Seven answers expanded would
 * bury the WhatsApp button under a wall of text, which is the opposite of
 * what this page is for.
 */
export function FullFaqs({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="mt-2 border-t border-line">
      {faqs.map((f, i) => (
        <li key={f.q} className="border-b border-line">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-start justify-between gap-4 py-4 text-left"
            aria-expanded={open === i}
          >
            <span className="text-[15px] font-semibold text-ink">{f.q}</span>
            <span className="mt-0.5 shrink-0 text-lg font-bold leading-none text-gold-hover">
              {open === i ? "−" : "+"}
            </span>
          </button>

          {open === i && (
            <p className="pb-4 text-[14px] leading-relaxed text-ink2">{f.a}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
