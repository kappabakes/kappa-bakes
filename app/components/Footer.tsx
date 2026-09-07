"use client";

import { usePathname } from "next/navigation";
import { SmartLink } from "./SmartLink";
import { SHOP, SOCIALS, whatsappLink } from "@/lib/config";
import { PaymentMarks } from "./PaymentMarks";

export function Footer() {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  const wa = whatsappLink(`Hi ${SHOP.name}, I have a question`);

  // Safari's floating toolbar sits over the bottom of the page, and the
  // safe-area inset doesn't account for it — that only covers the home
  // indicator. So there's real padding on phones as well, dropped on wider
  // screens where no toolbar overlaps.
  return (
    <footer
      data-site-chrome
      className="mt-20 bg-navy-dark text-white [padding-bottom:calc(env(safe-area-inset-bottom)+5rem)] sm:[padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]"
    >
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col items-center gap-7 md:flex-row md:items-start md:justify-between">
          {/* left — WhatsApp */}
          <div className="text-center md:text-left">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 font-semibold"
              >
                <WhatsAppIcon />
                Contact us on WhatsApp
              </a>
            )}
            <p className="mt-1 text-[13px] text-[#D5E1EC]">
              We&apos;re here to help with any enquiries.
            </p>
          </div>

          {/* middle — payments */}
          <div className="flex flex-col items-center gap-2.5">
            <p className="text-[13px] text-[#D5E1EC]">
              Payments powered by <span className="font-semibold text-white">stripe</span>
            </p>
            <PaymentMarks />
          </div>

          {/* right — social */}
          <div className="flex items-center gap-5">
            <a
              href={SOCIALS.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Follow us on Instagram, ${SOCIALS.instagram.handle}`}
              className="transition-opacity hover:opacity-80"
            >
              <InstagramIcon />
            </a>
            <a
              href={SOCIALS.snapchat.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Add us on Snapchat, ${SOCIALS.snapchat.handle}`}
              className="transition-opacity hover:opacity-80"
            >
              <SnapchatIcon />
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-[12px] text-[#D5E1EC]">
          <span>{SHOP.name}</span>
          <SmartLink href="/menu" className="hover:text-white">Menu</SmartLink>
          <SmartLink href="/faq" className="hover:text-white">FAQs</SmartLink>
          <SmartLink href="/track" className="hover:text-white">Track an order</SmartLink>
          <SmartLink href="/privacy" className="hover:text-white">
            Privacy &amp; Terms
          </SmartLink>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <defs>
        <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FFC107" />
          <stop offset="0.5" stopColor="#F06445" />
          <stop offset="1" stopColor="#C13584" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="url(#ig)" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="url(#ig)" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.3" fill="url(#ig)" />
    </svg>
  );
}

function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-[#FFFC00]" aria-hidden>
      <path d="M12 2c2.6 0 4.7 2 4.8 4.6 0 .7 0 1.6-.1 2.3.3.1.6.1.9 0 .3-.1.7-.2 1 0 .4.2.6.6.5 1-.2.6-.9.9-1.5 1.1-.3.1-.7.2-.8.5-.1.3.1.7.3 1 .8 1.4 2 2.4 3.4 2.8.3.1.5.4.4.7-.1.5-.9.8-1.7 1-.4.1-.5.2-.6.6-.1.3-.2.6-.6.6-.5 0-1-.2-1.7-.1-.6 0-1.1.2-1.7.6-.7.5-1.5 1.1-2.6 1.1s-1.9-.6-2.6-1.1c-.6-.4-1.1-.6-1.7-.6-.7-.1-1.2.1-1.7.1-.4 0-.5-.3-.6-.6-.1-.4-.2-.5-.6-.6-.8-.2-1.6-.5-1.7-1 0-.3.1-.6.4-.7 1.4-.4 2.6-1.4 3.4-2.8.2-.3.4-.7.3-1-.1-.3-.5-.4-.8-.5-.6-.2-1.3-.5-1.5-1.1-.1-.4.1-.8.5-1 .3-.2.7-.1 1 0 .3.1.6.1.9 0-.1-.7-.1-1.6-.1-2.3C7.3 4 9.4 2 12 2Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .5.4l.8 1.8c.1.2 0 .4-.1.5l-.4.5c-.1.1-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.3Z" />
    </svg>
  );
}
