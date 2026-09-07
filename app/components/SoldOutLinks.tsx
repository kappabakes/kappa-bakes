import { SOCIALS } from "@/lib/config";

/**
 * Shown when there's nothing left to sell. Someone who arrives too late is
 * still worth having — so the message ends in two taps, not a dead end.
 */
export function SoldOutLinks({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-card border border-gold/40 bg-gold-light px-5 py-5 text-center ${className}`}
    >
      <p className="font-display text-2xl text-ink">All slices are gone.</p>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink2">
        Follow us on Instagram and add us on Snapchat for updates on when
        orders will be open again.
      </p>

      <div className="mx-auto mt-5 grid max-w-md gap-3 sm:grid-cols-2">
        <a
          href={SOCIALS.instagram.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-btn bg-gold px-4 py-3 font-semibold text-white transition-colors hover:bg-gold-hover"
        >
          Follow on Instagram
        </a>
        <a
          href={SOCIALS.snapchat.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-btn border border-navy bg-paper px-4 py-3 font-semibold text-navy transition-colors hover:bg-cream-beige"
        >
          Add on Snapchat
        </a>
      </div>
    </div>
  );
}
