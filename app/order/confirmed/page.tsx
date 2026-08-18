import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/stock";
import {
  SHOP,
  SOCIALS,
  money,
  dayLabel,
  whatsappLink,
  orderQuery,
} from "@/lib/config";
import { collectionAddress } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order Confirmed" };

type Slice = {
  flavour: string;
  toppings: string | null;
  placement?: string | null;
  extraSauce?: string | null;
  addedSauce?: { name: string; pricePence: number } | null;
  addedToppings?: { name: string; pricePence: number }[] | null;
  pricePence: number;
};

export default async function Confirmed({
  searchParams,
}: {
  searchParams: { ok?: string };
}) {
  const orderNo = searchParams.ok;

  // Second chance at the confirmation email, if the webhook's attempt didn't
  // land. Runs before the page is rendered, and does nothing when the first
  // attempt worked.
  if (orderNo) {
    const { ensureConfirmationSent } = await import("@/lib/ensure-confirmation");
    await ensureConfirmationSent(orderNo).catch((e) =>
      console.error("Confirmation retry failed", e)
    );
  }
  const order = orderNo
    ? await db.order.findUnique({ where: { orderNo } })
    : null;
  const day = order
    ? await db.collectionDay.findUnique({ where: { day: order.day } })
    : null;

  const address = await collectionAddress();
  const slices = (order?.slices ?? []) as unknown as Slice[];
  const grouped = new Map<string, { n: number; line: Slice }>();
  for (const s of slices) {
    // Extra sauce is part of the key, or two slices ordered differently would
    // collapse into one line and the extra would vanish.
    const key = [
      s.flavour,
      s.toppings ?? "",
      s.placement ?? "",
      s.extraSauce ?? "",
      s.addedSauce?.name ?? "",
      (s.addedToppings ?? []).map((t) => t.name).join(","),
    ].join("|");
    const row = grouped.get(key) ?? { n: 0, line: s };
    row.n++;
    grouped.set(key, row);
  }

  // Same four-line template as the tracking page, so a message from either
  // place tells you which order it's about.
  const wa = order
    ? orderQuery({
        orderNo: order.orderNo,
        lastName: order.lastName,
        day: order.day,
      })
    : whatsappLink(`Hi ${SHOP.name}, I have a question`);

  return (
    <main className="bg-cream py-12">
      <div className="mx-auto max-w-3xl px-5">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-good text-3xl text-good">
            ✓
          </span>
          <h1 className="mt-5 font-display text-4xl text-ink">
            Order Confirmed!
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-ink2">
            Thank you{order ? `, ${order.firstName}` : ""}. Your slices are
            held and paid for. A confirmation is on its way to your email and
            phone.
          </p>
        </div>

        {order && (
          <>
            <div className="mx-auto mt-7 max-w-sm rounded-card border border-line bg-cream-warm px-6 py-5 text-center">
              <p className="text-[13px] font-semibold text-ink2">
                Your Order Number
              </p>
              <p className="mt-1 font-display text-3xl text-gold">
                {order.orderNo}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Save this to track your order.
              </p>
            </div>

            <section className="mt-8 rounded-card border border-line bg-paper p-6 shadow-soft">
              <h2 className="font-display text-2xl text-ink">Your Order</h2>

              <ul className="mt-4 divide-y divide-line">
                {[...grouped.values()].map(({ n, line }, i) => (
                  <li key={i} className="flex items-center gap-4 py-3">
                    <div className="grow">
                      <p className="font-semibold text-ink">{line.flavour}</p>
                      {line.toppings ? (
                        <p className="text-[13px] text-gold">
                          Toppings: {line.toppings}
                        </p>
                      ) : (
                        line.placement && (
                          <p className="text-[13px] text-gold">
                            Served: {line.placement}
                          </p>
                        )
                      )}
                      {line.extraSauce && (
                        <p className="text-[13px] font-semibold text-gold">
                          Extra sauce: {line.extraSauce}
                        </p>
                      )}
                      {line.addedSauce && (
                        <p className="text-[13px] font-semibold text-gold">
                          Sauce: {line.addedSauce.name}
                        </p>
                      )}
                      {line.addedToppings && line.addedToppings.length > 0 && (
                        <p className="text-[13px] font-semibold text-gold">
                          Toppings:{" "}
                          {line.addedToppings.map((t) => t.name).join(", ")}
                        </p>
                      )}
                    </div>
                    {/* whitespace-nowrap so the × never wraps away from the
                        number, however long the flavour's extras run. */}
                    <span className="shrink-0 whitespace-nowrap rounded-btn border border-line px-3 py-1 text-sm text-ink2">
                      × {n}
                    </span>
                    <span className="w-20 text-right font-semibold text-ink">
                      {money(n * line.pricePence)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 flex items-center justify-between border-t border-line pt-4 font-display text-xl text-ink">
                <span>Total Paid</span>
                <span>{money(order.totalPence)}</span>
              </p>
            </section>

            <section className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-card border border-line bg-paper p-5">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink2">
                  Collection Day
                </h3>
                <p className="mt-2 font-display text-lg text-ink">
                  {dayLabel(order.day)}
                </p>
                {day && (
                  <p className="text-sm text-ink2">
                    {day.startTime} – {day.endTime}
                  </p>
                )}
              </div>

              <div className="rounded-card border border-line bg-paper p-5">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink2">
                  Collection Point
                </h3>
                {address.map((l) => (
                  <p key={l} className="text-sm text-ink2">
                    {l}
                  </p>
                ))}
              </div>
            </section>

            <p className="mt-4 rounded-card border border-line bg-cream-warm px-5 py-4 text-[13px] leading-relaxed text-ink2">
              Nothing to pay at the door — just give your order number. Please
              arrive within your collection window.
            </p>
          </>
        )}

        <nav className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="rounded-btn border border-navy bg-paper px-5 py-3.5 text-center font-semibold text-navy transition-colors hover:bg-cream-beige"
          >
            Back to Home
          </Link>
          {/* They've just been given the details — no reason to ask for them
              again, so the link carries them and opens straight on tracking. */}
          <Link
            href={
              order
                ? `/track?o=${encodeURIComponent(order.orderNo)}&n=${encodeURIComponent(order.lastName)}`
                : "/track"
            }
            className="rounded-btn bg-navy px-5 py-3.5 text-center font-semibold text-white transition-colors hover:bg-navy-hover"
          >
            Track Your Order
          </Link>
          <a
            href={SOCIALS.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-btn bg-gold px-5 py-3.5 text-center font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            Follow us on Instagram
          </a>
          <a
            href={SOCIALS.snapchat.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-btn border border-line bg-paper px-5 py-3.5 text-center font-semibold text-ink transition-colors hover:bg-cream-beige"
          >
            Add us on Snapchat
          </a>
        </nav>

        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-between gap-4 rounded-card border border-good/30 bg-good-light px-5 py-4"
          >
            <span>
              <span className="block font-semibold text-[#166534]">
                Questions about your order?
              </span>
              <span className="block text-[13px] text-ink2">
                We&apos;re here to help on WhatsApp.
              </span>
            </span>
            <span className="shrink-0 rounded-btn border border-good px-4 py-2 text-[13px] font-semibold text-good">
              Chat on WhatsApp
            </span>
          </a>
        )}
      </div>
    </main>
  );
}
