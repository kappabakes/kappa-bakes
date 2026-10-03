import type { Metadata } from "next";
import { FULL_CAKES, SHOP, whatsappLink } from "@/lib/config";
import { PricingImage } from "./PricingImage";
import { FullFaqs } from "./FullFaqs";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Full San Sebastián Cheesecakes",
  description:
    "Whole San Sebastián cheesecakes, eight slices, pre-sliced and boxed. Collection from Batley, West Yorkshire. Order by WhatsApp.",
};

/**
 * Whole cheesecakes are sold by conversation, not by checkout — the flavours,
 * date and time are all agreed first. So this page's job is to answer enough
 * questions that the WhatsApp message someone sends is a useful one.
 */
export default function FullCheesecakes() {
  const wa = whatsappLink();

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
        Full San Sebastián
        <br />
        Cheesecakes
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed text-ink2">
        {FULL_CAKES.intro}
      </p>

      <div className="mt-6">
        <PricingImage src={FULL_CAKES.image} />
      </div>

      <div className="mt-6 rounded-card bg-cream-warm p-5">
        <p className="text-[14px] leading-relaxed text-ink">
          {FULL_CAKES.callout}
        </p>
      </div>

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block rounded-btn bg-good px-6 py-4 text-center text-[16px] font-bold text-white transition-opacity hover:opacity-90"
        >
          Contact us on WhatsApp
        </a>
      )}

      <p className="mt-10 text-[12px] font-bold uppercase tracking-wider text-gold-hover">
        Common questions
      </p>
      <FullFaqs faqs={FULL_CAKES.faqs} />

      <p className="mt-6 text-[13px] leading-relaxed text-ink2">
        Allergens are listed against every flavour on our{" "}
        <Link href="/menu" className="text-gold-hover underline underline-offset-4">
          menu
        </Link>
        , and will be discussed again when you confirm your order.
      </p>

      <p className="mt-8 text-[13px] text-muted">
        Collection only, from {SHOP.area}.
      </p>
    </main>
  );
}
