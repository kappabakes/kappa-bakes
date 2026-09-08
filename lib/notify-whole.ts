import { SHOP, money, whatsappLink, SOCIALS } from "./config";
import { emailShell, heading, para, addressBlock } from "./email-layout";
import { sendEmail, sendSms, gsmSafe, normaliseMobile } from "./notify";
import { WholeItem, describeItems, balancePence, cakeCount } from "./whole";

export type WholePayload = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  collectAt: Date;
  items: WholeItem[];
  totalPence: number;
  depositPence: number;
  address: string[];
  /// Shown in the confirmation, under the deposit note. Left out entirely
  /// when empty rather than printing an empty heading.
  requests?: string | null;
};

/**
 * Anything a customer told you goes through here before it reaches the HTML.
 * Without it, an ampersand or angle bracket in a request would break the
 * email — and worse could be pasted in deliberately.
 */
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** DD/MM/YYYY and HH:MM, both in UK time. */
function when(d: Date) {
  const day = d.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "Europe/London",
  });
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
  return { day, date, time };
}

/**
 * The confirmation, as HTML.
 *
 * Tables and inline styles throughout — email clients are twenty years
 * behind browsers, and anything cleverer breaks in Outlook. Images are
 * absolute URLs to the live site, because an email has no idea where it
 * came from.
 *
 * A plain-text version goes alongside for clients that won't render HTML,
 * and because spam filters distrust HTML-only mail.
 */
export function buildWholeEmail(p: WholePayload) {
  const { day, date, time } = when(p.collectAt);
  const lines = describeItems(p.items);
  const balance = balancePence(p.totalPence, p.depositPence);
  const wa = whatsappLink();

  const html = emailShell(
    [
      para(`Hi ${p.firstName},`),
      para("Thank you for your Full San Sebastian order — its confirmed."),

      heading("YOUR ORDER"),
      lines.map((l) => para(l, "margin-bottom:4px;")).join(""),

      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
         <tr><td style="font-size:16px;padding:4px 16px 4px 0;">Order total</td>
             <td align="right" style="font-size:16px;padding:4px 0;white-space:nowrap;">${money(p.totalPence)}</td></tr>
         <tr><td style="font-size:16px;padding:4px 16px 4px 0;">Deposit taken</td>
             <td align="right" style="font-size:16px;padding:4px 0;white-space:nowrap;">${money(p.depositPence)}</td></tr>
         <tr><td style="font-size:16px;padding:8px 16px 4px 0;border-top:1px solid #eee5d6;font-weight:bold;">Balance due on collection</td>
             <td align="right" style="font-size:16px;padding:8px 0 4px;border-top:1px solid #eee5d6;font-weight:bold;white-space:nowrap;">${money(balance)}</td></tr>
       </table>`,

      para(
        "Your deposit is non-refundable. The remaining balance is taken by contactless card payment when you collect.",
        "font-size:14px;color:#5b6b7f;"
      ),

      p.requests?.trim()
        ? heading("ADDITIONAL INFO/REQUESTS:") +
          para(escapeHtml(p.requests.trim()), "white-space:pre-line;")
        : "",

      heading("COLLECTION ADDRESS:"),
      addressBlock(p.address),

      heading("COLLECTION DATE:"),
      para(`${day} ${date}`, "font-weight:bold;"),

      heading("COLLECTION TIME:"),
      para(time, "font-weight:bold;"),

      para(
        "Please message us on WhatsApp 10 minutes before you arrive so we can have your order ready.",
        "font-size:15px;"
      ),
    ].join(""),
    "Any questions, message us on WhatsApp — this mailbox isn't monitored."
  );

  const text = [
    `Hi ${p.firstName},`,
    "",
    "Thank you for your Full San Sebastian order — its confirmed.",
    "",
    "YOUR ORDER",
    ...lines,
    "",
    `Order total: ${money(p.totalPence)}`,
    `Deposit taken: ${money(p.depositPence)}`,
    `Balance due on collection: ${money(balance)}`,
    "",
    "Your deposit is non-refundable. The remaining balance is taken by contactless card payment when you collect.",
    "",
    ...(p.requests?.trim()
      ? ["ADDITIONAL INFO/REQUESTS:", p.requests.trim(), ""]
      : []),
    "COLLECTION ADDRESS:",
    ...p.address,
    "",
    "COLLECTION DATE:",
    `${day} ${date}`,
    "",
    "COLLECTION TIME:",
    time,
    "",
    "Please message us on WhatsApp 10 minutes before you arrive so we can have your order ready.",
    "",
    wa ? `WhatsApp: ${wa}` : "",
    `Instagram: ${SOCIALS.instagram.url}`,
    `Snapchat: ${SOCIALS.snapchat.url}`,
    "",
    "Any questions, message us on WhatsApp — this mailbox isn't monitored.",
    "",
    SHOP.name,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return {
    subject: "Your Full San Sebastián order is confirmed",
    html,
    text,
  };
}

/** The morning-of reminder. Same shape, less of it. */
export function buildWholeReminder(p: WholePayload) {
  const { day, date, time } = when(p.collectAt);
  const balance = balancePence(p.totalPence, p.depositPence);

  const html = emailShell(
    [
      para(`Hi ${p.firstName},`),
      para("Your order is ready to collect today at the time below."),

      heading("YOUR ORDER"),
      describeItems(p.items)
        .map((l) => para(l, "margin-bottom:4px;"))
        .join(""),

      heading("COLLECTION ADDRESS:"),
      addressBlock(p.address),

      heading("COLLECTION DATE:"),
      para(`${day} ${date}`, "font-weight:bold;"),

      heading("COLLECTION TIME:"),
      para(time, "font-weight:bold;"),

      balance > 0
        ? para(
            `Balance due on collection: <strong>${money(balance)}</strong>, by contactless card.`
          )
        : "",

      para(
        "Please message us on WhatsApp 10 minutes before you arrive so we can have your order ready.",
        "font-size:15px;"
      ),
    ].join(""),
    "Any questions, message us on WhatsApp — this mailbox isn't monitored."
  );

  const text = [
    `Hi ${p.firstName},`,
    "",
    "Your order is ready to collect today at the time below.",
    "",
    ...describeItems(p.items),
    "",
    "COLLECTION ADDRESS:",
    ...p.address,
    "",
    "COLLECTION DATE:",
    `${day} ${date}`,
    "",
    "COLLECTION TIME:",
    time,
    "",
    balance > 0
      ? `Balance due on collection: ${money(balance)}, by contactless card.`
      : "",
    "",
    "Please message us on WhatsApp 10 minutes before you arrive so we can have your order ready.",
    "",
    SHOP.name,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject: `Collecting today at ${time} — ${SHOP.name}`, html, text };
}

/**
 * One text, one segment. Deliberately short: the email carries the detail,
 * and a second segment is a second charge.
 */
export function buildWholeSms(p: WholePayload, max = 145) {
  const { date, time } = when(p.collectAt);
  const balance = balancePence(p.totalPence, p.depositPence);
  const link = whatsappLink()
    ? ` Qs: ${whatsappLink()!.replace("https://", "")}`
    : "";

  const core = (withBrand: boolean) =>
    `Hi ${p.firstName}, your ${withBrand ? SHOP.name + " " : ""}order is confirmed. ` +
    `${cakeCount(p.items)} cheesecake${cakeCount(p.items) === 1 ? "" : "s"}, ` +
    `${date} at ${time}. ${money(balance)} due on collection. Details in your email.${link}`;

  const full = gsmSafe(core(true));
  return full.length > max ? gsmSafe(core(false)) : full;
}

/** Sends both. Neither failing stops the other. */
export async function notifyWhole(p: WholePayload, reminder = false) {
  const built = reminder ? buildWholeReminder(p) : buildWholeEmail(p);

  const emailStatus = await sendEmail(
    p.email,
    built.subject,
    built.text,
    built.html
  );

  const smsStatus = reminder
    ? "Skipped"
    : await sendSms(normaliseMobile(p.mobile), buildWholeSms(p));

  return { emailStatus, smsStatus };
}
