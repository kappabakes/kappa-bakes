import Link from "next/link";
import {
  SHOP,
  GRACE_MINUTES,
  LATE_GRACE_MINUTES,
  ALLERGEN_BODY,
  NO_SHOW_BODY,
  CANCEL_DEADLINE,
} from "@/lib/config";

export const metadata = { title: "Privacy & Terms" };

export default function Terms() {
  return (
    <main className="bg-cream py-12">
      <div className="mx-auto max-w-3xl px-5">
        <Link
          href="/"
          className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold-hover"
        >
          ← {SHOP.name}
        </Link>

        <h1 className="mt-5 font-display text-4xl text-ink md:text-5xl">
          Privacy &amp; Terms
        </h1>
        <p className="mt-3 text-[15px] text-ink2">
          The short version: we bake to order, you collect, and we only keep
          what we need to get your slices to you.
        </p>

        {/* ---------------- terms ---------------- */}
        <H>Ordering and payment</H>
        <P>
          Every order is paid in full when you place it, through Stripe. We
          never see or store your card details. Your slices are only held once
          payment goes through — until then they stay on sale.
        </P>
        <P>
          Slices are limited per collection date and per order. Once a date
          sells out or reaches its cut-off, no further orders can be placed for
          it.
        </P>

        <H>Cut-off times</H>
        <P>
          Each collection date has a cut-off shown on the ordering page, usually
          the evening before. Everything is baked the day before collection, so
          orders can&apos;t be accepted after it.
        </P>

        <H>Collection</H>
        <P>
          Collection only — we don&apos;t deliver. Your collection date, time
          window and the full address are in your confirmation email, and you
          can look them up any time on the tracking page.
        </P>
        <P>Please arrive within your collection window.</P>
        <P>
          If you haven&apos;t been in touch, we hold your order for{" "}
          <strong>{GRACE_MINUTES} minutes</strong> after the window ends. After
          that it&apos;s a no-show.
        </P>
        <P>
          If you message us <strong>before your window closes</strong> to say
          you&apos;re running late, we can hold it for up to{" "}
          <strong>{LATE_GRACE_MINUTES} minutes</strong> after the window ends.
          If you haven&apos;t collected by then, it&apos;s a no-show as well —
          getting in touch extends the wait, it doesn&apos;t remove the
          deadline.
        </P>
        <P>
          Orders can&apos;t be moved to another collection day. Everything is
          baked for the date you chose.
        </P>

        <H>No-Show Policy</H>
        <P>{NO_SHOW_BODY}</P>
        <P>
          A no-show order is cancelled and <strong>not refunded</strong>.
        </P>

        <H>Allergens Disclaimer</H>
        <P>{ALLERGEN_BODY}</P>
        <P>
          Allergens are listed against each flavour on the menu and the ordering
          page, and you&apos;re asked to confirm you&apos;ve read them before
          paying. If you have a serious allergy, please message us before
          ordering — we&apos;d rather talk it through than guess.
        </P>

        <H>Changes and cancellations</H>
        <P>
          Need to change a flavour, a topping choice or your collection date?
          Message us before the cut-off and we&apos;ll sort it if we can. After
          the cut-off the order is baked, so changes aren&apos;t possible.
        </P>
        <P>
          <strong>Cancelling:</strong> you can cancel for a full refund as long
          as you request it by {CANCEL_DEADLINE}. After that we&apos;ve already
          bought the ingredients and started baking, so the No-Show Policy
          applies instead.
        </P>

        {/* ---------------- privacy ---------------- */}
        <H>What we keep</H>
        <P>
          Your name, email address, mobile number and what you ordered.
          Card details are handled by Stripe and never reach us.
        </P>

        <H>Why we keep it</H>
        <P>
          To confirm your order, to reach you if something changes on collection
          day, and to keep a record of the sale. Order records are kept for six
          years because HMRC requires it.
        </P>

        <H>Emails about new flavours</H>
        <P>
          If you ticked the box when ordering, we&apos;ll occasionally email you
          when a new flavour lands or slices are running low. Never more than
          weekly, never to anyone who hasn&apos;t ordered, and every one has a
          one-click unsubscribe. Order confirmations and collection reminders
          aren&apos;t marketing and keep coming either way.
        </P>

        <H>Who else sees it</H>
        <P>
          Stripe processes the payment. Our email provider sends the
          confirmations, and our SMS provider sends the texts. That&apos;s all —
          nothing is sold or shared with anyone else.
        </P>

        <H>Getting it removed</H>
        <P>
          Email {SHOP.email} and we&apos;ll delete what we can. Records tied to
          a sale have to stay for the six years above; everything else goes.
        </P>

        <p className="mt-12 border-t border-line pt-5 text-xs text-muted">
          {SHOP.name} · {SHOP.email} · Last updated{" "}
          {new Date().toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </main>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-9 font-display text-2xl text-ink">{children}</h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[15px] leading-relaxed text-ink2">{children}</p>
  );
}
