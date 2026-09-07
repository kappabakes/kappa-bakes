"use client";

import { SmartLink } from "./SmartLink";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SHOP } from "@/lib/config";

/**
 * Cream bar with the logo centred and dipping below it, as in the mockups.
 * Home, Menu and FAQs sit left, Track and the gold Order button right.
 */
export function Header() {
  const path = usePathname();

  // ADMIN_PATH rewrites a secret URL to /admin behind the scenes, so the
  // path here is the secret one and this check alone can't catch it. The
  // data attribute lets the admin layout hide it by CSS regardless.
  if (path.startsWith("/admin")) return null;

  const NavLink = ({
    href,
    label,
    className = "",
  }: {
    href: string;
    label: string;
    className?: string;
  }) => (
    <SmartLink
      href={href}
      className={[
        "whitespace-nowrap pb-1 text-[13px] transition-colors sm:text-[15px]",
        className,
        path === href
          ? "border-b-2 border-gold font-semibold text-ink"
          : "text-ink2 hover:text-ink",
      ].join(" ")}
    >
      {label}
    </SmartLink>
  );

  return (
    <header data-site-chrome className="relative z-40">
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        <nav className="relative rounded-card bg-cream-warm px-4 shadow-soft sm:px-8">
          <div className="grid grid-cols-3 items-center gap-2 py-2.5 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-8">
              <NavLink href="/" label="Home" />
              <NavLink href="/menu" label="Menu" />
            </div>

            <SmartLink
              href="/"
              aria-label={SHOP.name}
              className="justify-self-center"
            >
              <Image
                src={SHOP.logo}
                alt={SHOP.name}
                width={304}
                height={304}
                priority
                unoptimized
                className="h-14 w-14 rounded-full sm:h-[76px] sm:w-[76px]"
              />
            </SmartLink>

            <div className="flex items-center justify-end gap-2 sm:gap-5">
              {/* Two lines on a phone so it doesn't squeeze the logo out of
                  the middle; one line from tablet up. */}
              <SmartLink
                href="/track"
                className="text-center text-[12px] leading-tight text-ink2 transition-colors hover:text-ink sm:whitespace-nowrap sm:text-right sm:text-[15px]"
              >
                Track My
                <br className="sm:hidden" /> Order
              </SmartLink>
              <SmartLink
                href="/order"
                className="rounded-btn bg-gold px-3 py-2 text-center text-[12px] font-semibold uppercase leading-tight tracking-wide text-white transition-colors hover:bg-gold-hover sm:whitespace-nowrap sm:px-6 sm:text-sm"
              >
                Order
                <br className="sm:hidden" /> Now
              </SmartLink>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
