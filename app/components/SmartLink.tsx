"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A link that starts the page over when you're already on it.
 *
 * Next.js treats navigating to the page you're on as a no-op, so tapping
 * "Track My Order" while already looking at a tracked order left the old
 * result on screen — it looked broken. Here, a click on the current page
 * reloads it properly.
 */
export function SmartLink({
  href,
  className,
  "aria-label": ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const samePage = path === href.split("?")[0];

  if (samePage)
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        className={className}
        onClick={(e) => {
          // A plain href would work, but this also clears any query string
          // left over from a tracking link.
          e.preventDefault();
          window.location.href = href;
        }}
      >
        {children}
      </a>
    );

  return (
    <Link href={href} aria-label={ariaLabel} className={className}>
      {children}
    </Link>
  );
}
