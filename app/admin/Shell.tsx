"use client";

import { useState } from "react";
import Image from "next/image";
import { SHOP } from "@/lib/config";

export type Section =
  | "dashboard"
  | "orders"
  | "menu"
  | "customers"
  | "dates"
  | "archive"
  | "broadcast"
  | "settings";

const NAV: { id: Section; label: string; note: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", note: "Today at a glance", icon: "▦" },
  { id: "orders", label: "Orders", note: "View & manage orders", icon: "🛍" },
  { id: "menu", label: "Menu", note: "Flavours & allergens", icon: "🍰" },
  { id: "customers", label: "Customers", note: "Who's ordered before", icon: "👥" },
  { id: "dates", label: "Collection Dates", note: "Dates, times & cut-offs", icon: "📅" },
  { id: "archive", label: "Archive", note: "Past collections", icon: "🗄" },
  { id: "broadcast", label: "Broadcasts", note: "Email your customers", icon: "📣" },
  { id: "settings", label: "Settings", note: "Limits, devices, testing", icon: "⚙" },
];

/**
 * Sidebar on desktop. On a phone it's a menu of cards you drill into, with a
 * back arrow — the same structure, just one screen at a time.
 */
export function Shell({
  section,
  setSection,
  who,
  onSignOut,
  children,
}: {
  section: Section | null;
  setSection: (s: Section | null) => void;
  who: string;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const current = NAV.find((n) => n.id === section);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-cream [padding-bottom:calc(env(safe-area-inset-bottom)+5rem)] lg:flex lg:[padding-bottom:0]">
      {/* ---------- desktop sidebar ---------- */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-dark px-4 py-6 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <Image
            src={SHOP.logo}
            alt=""
            width={176}
            height={176}
            unoptimized
            className="h-11 w-11 rounded-full"
          />
          <span className="font-display text-lg leading-tight">
            {SHOP.name}
          </span>
        </div>

        <nav className="mt-8 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={[
                "flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-left text-[15px] transition-colors",
                section === n.id
                  ? "bg-gold font-semibold text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <span aria-hidden className="w-5 text-center">
                {n.icon}
              </span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="px-3 text-[12px] text-white/60">Signed in as</p>
          <p className="truncate px-3 text-[13px]">{who}</p>
          <button
            onClick={onSignOut}
            className="mt-3 w-full rounded-btn px-3 py-2 text-left text-[14px] text-white/75 hover:bg-white/10 hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* ---------- mobile ---------- */}
      <div className="grow">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-navy-dark px-4 py-3 text-white lg:hidden">
          {section && (
            <button
              onClick={() => setSection(null)}
              aria-label="Back to the menu"
              className="text-xl leading-none"
            >
              ←
            </button>
          )}

          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open the menu"
            className="text-xl leading-none"
          >
            ☰
          </button>

          <span className="font-display text-lg">
            {current?.label ?? "Admin Portal"}
          </span>

          <button
            onClick={onSignOut}
            className="ml-auto text-[13px] text-white/70"
          >
            Log out
          </button>
        </header>

        {/* Slide-over menu, so any section is one tap away from any other. */}
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-ink/60 lg:hidden"
          >
            <nav
              onClick={(e) => e.stopPropagation()}
              className="h-full w-72 max-w-[85%] overflow-y-auto bg-navy-dark px-4 py-5 text-white"
            >
              <div className="flex items-center gap-3">
                <Image
                  src={SHOP.logo}
                  alt=""
                  width={144}
                  height={144}
                  unoptimized
                  className="h-10 w-10 rounded-full"
                />
                <span className="font-display text-lg">{SHOP.name}</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close the menu"
                  className="ml-auto text-xl"
                >
                  ✕
                </button>
              </div>

              <ul className="mt-6 space-y-1">
                {NAV.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        setSection(n.id);
                        setMenuOpen(false);
                      }}
                      className={[
                        "flex w-full items-center gap-3 rounded-btn px-3 py-3 text-left text-[15px]",
                        section === n.id
                          ? "bg-gold font-semibold text-white"
                          : "text-white/80 hover:bg-white/10",
                      ].join(" ")}
                    >
                      <span aria-hidden className="w-5 text-center">
                        {n.icon}
                      </span>
                      {n.label}
                    </button>
                  </li>
                ))}
              </ul>

              <p className="mt-6 border-t border-white/10 pt-4 text-[12px] text-white/60">
                {who}
              </p>
            </nav>
          </div>
        )}

        {/* mobile home: the menu itself */}
        {!section && (
          <div className="px-5 py-7 lg:hidden">
            <h1 className="font-display text-3xl text-ink">Admin Portal</h1>
            <p className="mt-1 text-sm text-ink2">Manage your store</p>

            <ul className="mt-6 space-y-3">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => setSection(n.id)}
                    className="flex w-full items-center gap-4 rounded-card border border-line bg-paper px-4 py-4 text-left shadow-soft"
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-btn bg-cream-warm"
                    >
                      {n.icon}
                    </span>
                    <span className="grow">
                      <span className="block font-semibold text-ink">
                        {n.label}
                      </span>
                      <span className="block text-[13px] text-ink2">
                        {n.note}
                      </span>
                    </span>
                    <span className="text-gold" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <main
          className={[
            "px-5 py-7 lg:px-8",
            section ? "block" : "hidden lg:block",
          ].join(" ")}
        >
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { NAV };
