import Link from "next/link";
import Image from "next/image";
import { SHOP } from "@/lib/config";
import { openDays } from "@/lib/stock";
import { Countdown } from "./components/Countdown";
import { StockDot } from "./SliceCounter";
import { SoldOutLinks } from "./components/SoldOutLinks";
import { Gallery } from "./components/Gallery";
import { currentGallery } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export default async function Home() {
  const days = await openDays();
  const anyLeft = days.some((d) => !d.soldOut);

  return (
    <main>
      {/* hero */}
      <section className="bg-gradient-to-br from-[#E4EDF7] via-[#D5E2F0] to-[#F2E8DC]">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 pb-14 pt-12 md:grid-cols-2 md:pb-20 md:pt-16">
          <div>
            <h1 className="font-display text-[36px] leading-[1.1] text-ink sm:text-5xl md:text-[56px]">
              Homemade.
              <br />
              Premium.
              <br />
              Baked with <span className="text-gold">love.</span>
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-ink2 md:text-base">
              San Sebastián Cheesecakes
              <br />
              Collection only
              <br />
              <span className="mt-1 inline-block font-medium text-ink">
                📍 {SHOP.area}
              </span>
            </p>
            <Link
              href="/order"
              className="mt-7 inline-flex items-center gap-2 rounded-btn bg-navy px-7 py-3.5 font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy-hover"
            >
              {anyLeft ? "Order Now" : "See what's on"}
              <span aria-hidden>›</span>
            </Link>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-card shadow-card">
            <Image
              src="/hero.jpg"
              alt="A slice of San Sebastián cheesecake"
              fill
              sizes="(max-width: 768px) 100vw, 700px"
              quality={95}
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* how ordering works */}
      <section className="bg-cream py-14">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.16em] text-ink">
            How Ordering Works
          </h2>

          <ol className="mt-9 grid gap-9 sm:grid-cols-3">
            {[
              ["Choose a date", "Pick your preferred collection day."],
              ["Pick your slices", "Choose your flavours and toppings."],
              [
                "Collect & enjoy",
                "Collect your order within the time slot and enjoy!!",
              ],
            ].map(([title, note], i) => (
              <li key={title} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 bg-paper font-display text-xl text-navy">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-ink2">{note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* this weekend */}
      <section className="bg-cream-warm py-14">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center font-display text-3xl text-ink md:text-4xl">
            This Week
          </h2>
          <div className="mx-auto mt-2 flex items-center justify-center gap-3 text-gold">
            <span className="h-px w-14 bg-gold/40" />
            <span aria-hidden>♥</span>
            <span className="h-px w-14 bg-gold/40" />
          </div>

          {days.length === 0 && (
            <p className="mx-auto mt-8 max-w-lg text-center text-[15px] leading-relaxed text-ink2">
              Nothing open for ordering just yet — either this weekend has
              closed for baking, or the next dates aren&apos;t up. New ones go
              up most weeks, and Instagram gets them first.
            </p>
          )}

          {days.length > 0 && !anyLeft && (
            <div className="mt-8">
              <SoldOutLinks />
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {days.map((d) => (
              <div
                key={d.id}
                className={[
                  "rounded-card border bg-paper p-5 shadow-soft",
                  d.soldOut ? "border-line opacity-60" : "border-line",
                ].join(" ")}
              >
                <p className="font-display text-xl text-ink">{d.label}</p>
                <p className="mt-1 text-sm text-ink2">{d.window}</p>

                <p className="mt-4">
                  <span
                    className={[
                      "inline-flex items-center gap-2 rounded-btn border px-4 py-1.5 text-sm font-semibold",
                      d.soldOut
                        ? "border-line bg-cream text-muted"
                        : "border-gold bg-paper text-good",
                    ].join(" ")}
                  >
                    {!d.soldOut && <StockDot left={d.left} capacity={d.capacity} />}
                    {d.soldOut
                      ? "SOLD OUT"
                      : `${d.left} SLICE${d.left === 1 ? "" : "S"} AVAILABLE`}
                  </span>
                </p>

                {d.cutoffIso && !d.soldOut && (
                  <p className="mt-3 text-[13px] font-medium">
                    <Countdown cutoffIso={d.cutoffIso} />
                  </p>
                )}
                {d.note && <p className="mt-2 text-[13px] text-gold">{d.note}</p>}
              </div>
            ))}
          </div>

          {anyLeft && (
            <div className="mt-8 text-center">
              <Link
                href="/order"
                className="inline-block rounded-btn bg-gold px-8 py-3.5 font-semibold uppercase tracking-wide text-white transition-colors hover:bg-gold-hover"
              >
                Order Now
              </Link>
            </div>
          )}
        </div>
      </section>

      <Gallery images={await currentGallery()} />
    </main>
  );
}
