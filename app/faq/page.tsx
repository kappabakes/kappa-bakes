import Link from "next/link";
import {
  SHOP,
  whatsappLink,
  GRACE_MINUTES,
  LATE_GRACE_MINUTES,
  CANCEL_DEADLINE,
} from "@/lib/config";

export const metadata = { title: "FAQs" };

type QA = { q: string; a: string[] };

const FAQS: QA[] = [
  {
    q: "Can I have my toppings separately?",
    a: [
      "Absolutely. When ordering, you can choose to have your toppings added ready on collection or provided separately in a tub.",
      "We especially recommend choosing them separately if you aren't planning on eating your cheesecake straight away.",
    ],
  },
  {
    q: "Where can I check the allergens?",
    a: [
      "Allergen information is displayed alongside each flavour on both the Menu and Ordering pages. Please check this information carefully before placing your order.",
    ],
  },
  {
    q: "How should I store my cheesecake?",
    a: [
      "Your cheesecake should be kept refrigerated and is best enjoyed within 3 days of collection.",
      "For the perfect creamy texture, we recommend taking your cheesecake out of the fridge at least 1 hour before eating.",
    ],
  },
  {
    q: "Can I warm the sauce?",
    a: [
      "Yes, you can warm the sauce. By standard, the sauces are made to be used at room temperature.",
      "However, if you would like a more rich and creamy texture you can warm the sauce pot using 10-15 second bursts to ensure the sauce doesn't burn. All sauce pots are microwave safe.",
    ],
  },
  {
    q: "When can I collect my order?",
    a: [
      "Available collection dates and times are shown when placing your order. Your selected collection date and time will also be included in your order confirmation.",
    ],
  },
  {
    q: "What happens if I'm running late for collection?",
    a: [
      `If you haven't been in touch, we hold your order for ${GRACE_MINUTES} minutes after your collection slot ends. After that it's a no-show.`,
      `If you message us before your slot ends to say you're running late, we can hold it for up to ${LATE_GRACE_MINUTES} minutes after. If you haven't collected by then it's still a no-show — getting in touch extends the wait, it doesn't remove the deadline.`,
      "Orders can't be moved to another collection day — everything is baked for the date you chose.",
      "A no-show order is cancelled and not refunded.",
    ],
  },
  {
    q: "Can I make changes to my order after placing it?",
    a: [
      "Yes. Message us and we can change your contact details, collection date, chosen flavours and whether you'd like your toppings added ready on collection or provided separately in a tub.",
      "Any amendments need to be made at least 24 hours before the start of your collection slot.",
      "Please note that slices can only be changed once, so have a think before requesting a change.",
      "If your new choice costs more, we'll take the difference by bank transfer or send you a Stripe payment link. If it costs less, we'll refund the difference through Stripe or by bank transfer, whichever you prefer.",
      "Changes to collection dates and flavours are also subject to availability, so we recommend getting in touch as early as possible.",
    ],
  },
  {
    q: "Can I cancel my order?",
    a: [
      `Yes — as long as you request it by ${CANCEL_DEADLINE}.`,
      "Message us with your order number and we'll cancel it and arrange your refund.",
      "After that we've already bought the ingredients and started baking, so the no-show policy applies instead.",
    ],
  },
  {
    q: "How will I know my order has been confirmed?",
    a: [
      "Once your order has been successfully placed, you'll receive confirmation by email and SMS containing your order and collection details.",
      "Please check your confirmation carefully to make sure everything is correct.",
    ],
  },
  {
    q: "What happens when a collection date is sold out?",
    a: [
      "We make a limited number of slices for each collection date. Once all available slices have been ordered, that collection date will show as sold out.",
      "Any additional availability will be announced on our socials, so keep an eye out.",
    ],
  },
  {
    q: "Can I order a whole cheesecake or place a larger order?",
    a: [
      "For whole cheesecakes, larger orders or special occasions, please get in touch with us directly to discuss availability.",
    ],
  },
];

export default function FAQ() {
  const wa = whatsappLink(`Hi ${SHOP.name}, I have a question`);

  return (
    <main className="bg-cream py-12">
      <div className="mx-auto max-w-3xl px-5">
        <h1 className="text-center font-display text-4xl text-ink md:text-5xl">
          Frequently Asked Questions
        </h1>
        <div className="mx-auto mt-3 flex items-center justify-center gap-3 text-gold">
          <span className="h-px w-16 bg-gold/40" />
          <span aria-hidden>♥</span>
          <span className="h-px w-16 bg-gold/40" />
        </div>

        {/* <details> rather than a JavaScript accordion: it opens on tap,
            it's searchable by the browser, and it works if scripts fail. */}
        <ul className="mt-10 space-y-3">
          {FAQS.map((item) => (
            <li key={item.q}>
              <details className="group rounded-card border border-line bg-paper px-5 py-4 shadow-soft open:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-display text-lg text-ink">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-xl text-gold transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>

                <div className="mt-3 border-t border-line pt-3">
                  {item.a.map((para) => (
                    <p
                      key={para}
                      className="mt-2 text-[15px] leading-relaxed text-ink2 first:mt-0"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-card border border-line bg-cream-warm p-6 text-center">
          <h2 className="font-display text-2xl text-ink">
            Still not sure about something?
          </h2>
          <p className="mt-2 text-[15px] text-ink2">
            Message us and we&apos;ll get back to you.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-btn bg-whatsapp px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Message us on WhatsApp
              </a>
            )}
            <Link
              href="/menu"
              className="rounded-btn border border-navy bg-paper px-6 py-3 font-semibold text-navy transition-colors hover:bg-cream-beige"
            >
              See the menu
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[13px] text-muted">
          Full details are in our{" "}
          <Link href="/privacy" className="text-gold-hover underline underline-offset-4">
            Privacy &amp; Terms
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
