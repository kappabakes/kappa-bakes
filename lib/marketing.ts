import { db } from "./stock";
import { sendEmail } from "./notify";
import { SHOP } from "./config";

/**
 * UK PECR, in short: you may email your own customers about similar products
 * without prior consent (the "soft opt-in"), provided you gave them a chance
 * to refuse when you took their address, and give them an easy way out in
 * every message since.
 *
 * So: only people who have actually ordered ever end up in here, the box is on
 * the checkout page, and every marketing email carries an unsubscribe link.
 * Transactional confirmations are a different thing entirely and are never
 * filtered by opt-in.
 */

export type Segment = "all" | "recent" | "lapsed";

export const SEGMENTS: { id: Segment; label: string; note: string }[] = [
  { id: "all", label: "Everyone opted in", note: "Anyone who has ordered and not unsubscribed" },
  { id: "recent", label: "Ordered in the last 60 days", note: "Your regulars" },
  { id: "lapsed", label: "Not ordered in 60+ days", note: "Worth a nudge" },
];

export async function audience(segment: Segment) {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  return db.customer.findMany({
    where: {
      marketingOptIn: true,
      unsubscribedAt: null,
      ...(segment === "recent" ? { lastOrderAt: { gte: cutoff } } : {}),
      ...(segment === "lapsed" ? { lastOrderAt: { lt: cutoff } } : {}),
    },
    orderBy: { lastOrderAt: "desc" },
  });
}

const unsubUrl = (token: string) =>
  `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?t=${token}`;

/** Personalises, appends the legally required footer, and sends. */
export async function sendCampaign(
  segment: Segment,
  subject: string,
  body: string
) {
  const people = await audience(segment);
  let sentCount = 0;
  let failCount = 0;

  for (const person of people) {
    const text = [
      body.replace(/\{name\}/g, person.firstName),
      "",
      "—",
      // Deliberately the email address, not the collection address. UK rules
      // require a valid contact for opt-out requests, which this satisfies —
      // and the collection address stays private until someone has actually
      // ordered and paid.
      `${SHOP.name} · ${SHOP.email}`,
      `Stop these emails: ${unsubUrl(person.unsubToken)}`,
      "You're getting this because you opted in to these emails on a previous order.",
    ].join("\n");

    const status = await sendEmail(person.email, subject, text);
    status === "Sent" ? sentCount++ : failCount++;
  }

  await db.campaign.create({
    data: { subject, body, segment, sentCount, failCount },
  });

  return { sentCount, failCount, total: people.length };
}

/** Called after every paid order. Keeps the list a list of people. */
export async function recordCustomer(o: {
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  totalPence: number;
  marketingOptIn: boolean;
}) {
  const existing = await db.customer.findUnique({ where: { email: o.email } });

  await db.customer.upsert({
    where: { email: o.email },
    create: {
      email: o.email,
      firstName: o.firstName,
      lastName: o.lastName,
      mobile: o.mobile,
      marketingOptIn: o.marketingOptIn,
      optInAt: o.marketingOptIn ? new Date() : null,
      orderCount: 1,
      lastOrderAt: new Date(),
      totalPence: o.totalPence,
    },
    update: {
      firstName: o.firstName,
      lastName: o.lastName,
      mobile: o.mobile,
      orderCount: { increment: 1 },
      lastOrderAt: new Date(),
      totalPence: { increment: o.totalPence },
      // Opting in again is fine. Opting out is never silently undone by a
      // later order — once someone has unsubscribed, only they can reverse it.
      ...(o.marketingOptIn && !existing?.unsubscribedAt
        ? { marketingOptIn: true, optInAt: existing?.optInAt ?? new Date() }
        : {}),
    },
  });
}
