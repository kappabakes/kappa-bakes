import Image from "next/image";
import { ZoomImage } from "../components/ZoomImage";
import Link from "next/link";
import { db } from "@/lib/stock";
import { money, allergenLabel, ALLERGEN_HEADING, ALLERGEN_BODY } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

export default async function Menu() {
  const flavours = await db.flavour.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main className="bg-cream py-12">
      <div className="mx-auto max-w-4xl px-5">
        <h1 className="text-center font-display text-4xl text-ink md:text-5xl">
          Our Flavours
        </h1>
        <div className="mx-auto mt-3 flex items-center justify-center gap-3 text-gold">
          <span className="h-px w-16 bg-gold/40" />
          <span aria-hidden>♥</span>
          <span className="h-px w-16 bg-gold/40" />
        </div>

        {flavours.length === 0 && (
          <p className="mt-12 text-center text-ink2">
            The menu&apos;s being updated. Check back shortly.
          </p>
        )}

        <ul className="mt-10 space-y-4">
          {flavours.map((f) => (
            <li
              key={f.id}
              className="flex flex-col rounded-card border border-line bg-paper shadow-soft transition-shadow hover:shadow-card sm:flex-row"
            >
              {f.image && (
                <ZoomImage
                  src={f.image}
                  alt={f.name}
                  caption={f.name}
                  description={f.description}
                  sizes="(max-width: 640px) 100vw, 450px"
                  className="h-44 w-full shrink-0 sm:h-56 sm:w-56"
                />
              )}

              <div className="flex grow flex-col justify-center gap-3 p-5 sm:flex-row sm:items-center">
                <div className="grow">
                  {/* A wordmark if you've made one, otherwise the text name.
                      The text name is still what goes in emails and texts. */}
                  {f.nameImage ? (
                    <div className="relative h-10 w-full max-w-[260px]">
                      <Image
                        src={f.nameImage}
                        alt={f.name}
                        fill
                        sizes="520px"
                        quality={95}
                        className="object-contain object-left"
                      />
                    </div>
                  ) : (
                    <h2 className="font-display text-2xl text-ink">{f.name}</h2>
                  )}
                  <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-ink2">
                    {f.description}
                  </p>
                  {f.allergens.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {f.allergens.map((a) => (
                        <li
                          key={a}
                          className="rounded-btn bg-cream-beige px-3 py-1 text-[12px] text-ink2"
                        >
                          {allergenLabel(a)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="shrink-0 font-display text-2xl text-ink sm:pl-6">
                  {money(f.pricePence)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-card border border-line bg-cream-warm px-5 py-4 text-[13px] leading-relaxed text-ink2">
          <p className="font-semibold text-ink">{ALLERGEN_HEADING}</p>
          <p className="mt-1">{ALLERGEN_BODY}</p>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/order"
            className="inline-block rounded-btn bg-navy px-8 py-3.5 font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy-hover"
          >
            Order Now
          </Link>
        </div>
      </div>
    </main>
  );
}
