import {
  SHOP,
  money,
  shortDay,
  NO_SHOW_POLICY,
  GRACE_NOTE,
  whatsappLink,
} from "./config";

export type SliceLine = {
  flavour: string;
  toppings: string | null;
  placement?: string | null;
  /// null when they didn't want it; otherwise where the extra pot goes.
  extraSauce?: string | null;
  addedSauce?: { name: string; pricePence: number } | null;
  addedToppings?: { name: string; pricePence: number }[] | null;
};

/**
 * Group identical lines: "2x Plain Jane". The key is flavour + toppings +
 * extra sauce, so two of the same flavour ordered differently stay on
 * separate lines — which is what you need when you're plating them.
 */
export function summarise(slices: SliceLine[]): string[] {
  const counts = new Map<string, number>();
  for (const s of slices) {
    let key = s.toppings
      ? `${s.flavour} — ${s.toppings}`
      : s.placement
        ? `${s.flavour} — ${s.placement}`
        : s.flavour;
    if (s.extraSauce) key += ` + extra sauce (${s.extraSauce})`;
    if (s.addedSauce) key += ` + ${s.addedSauce.name}`;
    if (s.addedToppings?.length)
      key += ` + ${s.addedToppings.map((t) => t.name).join(", ")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([label, n]) => `- ${n}x ${label}`);
}

export type Payload = {
  address?: string[];
  /// Needed for the tracking link. Required so it can't be forgotten.
  lastName: string;
  orderNo: string;
  firstName: string;
  email: string;
  mobile: string;
  day: Date;
  window: string;
  slices: SliceLine[];
  totalPence: number;
};

export function buildEmail(p: Payload, updated = false) {
  const verb = updated ? "has been updated" : "is confirmed and paid";
  return {
    subject: `${SHOP.name} order ${p.orderNo}${updated ? " updated" : " confirmed"}`,
    body: [
      `Hi ${p.firstName}, your ${SHOP.name} order ${p.orderNo} ${verb}.`,
      "",
      "Collection",
      `${shortDay(p.day)}, ${p.window}`,
      "",
      ...(p.address ?? SHOP.addressLines),
      "",
      `Your order (${p.slices.length} slice${p.slices.length === 1 ? "" : "s"})`,
      ...summarise(p.slices),
      "",
      `Paid ${money(p.totalPence)}`,
      "",
      "Nothing to pay at the door — just give your order number.",
      "",
      GRACE_NOTE,
      "",
      `Track your order: ${trackLink(p)}`,
      "",
      // No sign-off: the sender already reads "Kappa Bakes", and a repeated
      // trailing line gets collapsed by Gmail as though it were a signature.
      NO_SHOW_POLICY,
    ].join("\n"),
  };
}

/** Strip anything that would push the message out of GSM-7. */
const gsmSafe = (s: string) =>
  s
    .replace(/[—–]/g, "-")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/•/g, "-")
    .replace(/…/g, "...");

export function buildSms(p: Payload, updated = false, max = 145): string {
  const link = whatsappLink() ? ` Qs: ${whatsappLink()!.replace("https://", "")}` : "";
  const core = (withBrand: boolean) =>
    `Hi ${p.firstName}, your ${withBrand ? SHOP.name + " " : ""}order ${p.orderNo} is ` +
    `${updated ? "updated" : "confirmed and paid"}. ${shortDay(p.day)} ${p.window}. ` +
    // No address here — it goes out in the confirmation email, which is where
    // someone will look for it anyway.
    `${p.slices.length} slice${p.slices.length === 1 ? "" : "s"}. Details in your email.${link}`;
  const full = gsmSafe(core(true));
  return full.length > max ? gsmSafe(core(false)) : full;
}

export async function sendEmail(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY?.trim();

  // Temporary diagnostic. The same call sends fine from the admin but not
  // from the Stripe webhook, which shouldn't be possible on one deployment —
  // so this records exactly what each context can see.
  console.log(
    `sendEmail: key ${key ? `present (${key.length} chars, starts ${key.slice(0, 3)})` : "MISSING"}, from ${process.env.FROM_EMAIL ?? "unset"}`
  );

  if (!key) {
    // Local development: print it so the wording can be checked without an
    // email provider configured.
    console.log("\n──────── EMAIL (not sent, no RESEND_API_KEY) ────────");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}\n`);
    console.log(body);
    console.log("────────────────────────────────────────────────────\n");
    return "Skipped — no RESEND_API_KEY";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${SHOP.name} <${process.env.FROM_EMAIL?.trim()}>`,
        to,
        subject,
        text: body,
        reply_to: SHOP.email,
      }),
    });
    if (res.ok) return "Sent";

    // Resend explains itself in the body — a bare status code sent us hunting
    // for a problem it would have named.
    const detail = await res.text().catch(() => "");
    console.error(`Resend refused the email (${res.status}): ${detail}`);
    return `Failed: ${res.status}`;
  } catch (e) {
    console.error("Resend request failed", e);
    return `Failed: ${(e as Error).message}`;
  }
}

const isUkMobile = (n: string) => /^\+447\d{9}$/.test(n);

export function normaliseMobile(raw: string): string {
  const s = raw.replace(/[^0-9+]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("44")) return `+${s}`;
  if (s.startsWith("0")) return `+44${s.slice(1)}`;
  return s.length === 10 ? `+44${s}` : s;
}

export async function sendSms(to: string, text: string) {
  const key = process.env.SMS_API_KEY?.trim();
  if (!key) {
    console.log(
      `\n──────── SMS (not sent, no SMS_API_KEY) ────────\nTo: ${to}\n${text}\n[${text.length} characters]\n───────────────────────────────────────────────\n`
    );
    return "Skipped — no SMS_API_KEY";
  }
  if (!isUkMobile(to)) return "Not a UK mobile — check number";
  try {
    const res = await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: process.env.SMS_SENDER_ID ?? "KappaBakes",
        destination: to.replace(/^\+/, ""),
        content: text,
      }),
    });
    if (res.ok) return "Sent";

    // Resend explains itself in the body — a bare status code sent us hunting
    // for a problem it would have named.
    const detail = await res.text().catch(() => "");
    console.error(`Resend refused the email (${res.status}): ${detail}`);
    return `Failed: ${res.status}`;
  } catch (e) {
    console.error("Resend request failed", e);
    return `Failed: ${(e as Error).message}`;
  }
}

/**
 * One call to tell a customer everything, used on confirm and on resend.
 * `channels` lets the admin resend just one — a wrong mobile shouldn't mean
 * emailing them a second time.
 */
export async function notifyCustomer(
  p: Payload,
  updated = false,
  channels: { email?: boolean; sms?: boolean } = { email: true, sms: true }
) {
  const { subject, body } = buildEmail(p, updated);
  const emailStatus = channels.email
    ? await sendEmail(p.email, subject, body)
    : "Not sent";
  const smsStatus = channels.sms
    ? await sendSms(p.mobile, buildSms(p, updated))
    : "Not sent";
  return { emailStatus, smsStatus };
}

/**
 * Collection-morning reminder. Deliberately short — they've already had the
 * full confirmation, so this is the details they need at the door and nothing
 * else.
 */
export function buildReminderEmail(p: Payload, address: string[]) {
  return {
    subject: `Collecting today — ${SHOP.name} order ${p.orderNo}`,
    body: [
      `Hi ${p.firstName}, your ${SHOP.name} order is ready to collect today.`,
      "",
      "Collection",
      `${shortDay(p.day)}, ${p.window}`,
      "",
      ...address,
      "",
      `Your order (${p.slices.length} slice${p.slices.length === 1 ? "" : "s"})`,
      ...summarise(p.slices),
      "",
      `Order number: ${p.orderNo}`,
      "Nothing to pay at the door — just give your order number.",
      "",
      GRACE_NOTE,
      "",
      "See you shortly.",
    ].join("\n"),
  };
}

/** A tracking link that opens straight on their order, no details to retype. */
function trackLink(p: Payload) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const base = `${site}/track`;

  if (!p.lastName) {
    console.error(
      `Tracking link for ${p.orderNo} built without a surname — it will ask the customer to type their details.`
    );
    return base;
  }

  return `${base}?o=${encodeURIComponent(p.orderNo)}&n=${encodeURIComponent(p.lastName)}`;
}
