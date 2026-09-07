import { SHOP, money, whatsappLink, SOCIALS } from "./config";
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
};

const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

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
  const site = siteUrl();
  const wa = whatsappLink();

  const button = (img: string, href: string, alt: string) =>
    href
      ? `<a href="${href}" style="text-decoration:none;display:inline-block;margin:4px 6px;">
           <img src="${site}/email/${img}" alt="${alt}" width="180"
                style="display:block;border:0;width:180px;height:auto;" />
         </a>`
      : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="format-detection" content="telephone=no,address=no,date=no" />
  <style>
    /* Mail apps auto-link addresses and phone numbers and colour them blue.
       This leaves them looking like the text around them. */
    a[x-apple-data-detectors], .address a {
      color: inherit !important;
      text-decoration: none !important;
      pointer-events: none;
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#faf7f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#faf7f1;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">

        <tr><td>
          <img src="${site}/email/header.jpg" alt="${SHOP.name}" width="600"
               style="display:block;border:0;width:100%;height:auto;" />
        </td></tr>

        <tr><td style="padding:28px 32px 8px;font-family:Helvetica,Arial,sans-serif;color:#09264a;">
          <p style="margin:0 0 16px;font-size:16px;">Hi ${p.firstName},</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
            Thank you for your Full San Sebastian order — its confirmed.
          </p>

          <p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">YOUR ORDER</p>
          ${lines
            .map(
              (l) =>
                `<p style="margin:0 0 6px;font-size:16px;">${l}</p>`
            )
            .join("")}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr><td style="font-size:16px;padding:4px 16px 4px 0;">Order total</td>
                <td align="right" style="font-size:16px;padding:4px 0;white-space:nowrap;">${money(p.totalPence)}</td></tr>
            <tr><td style="font-size:16px;padding:4px 16px 4px 0;">Deposit taken</td>
                <td align="right" style="font-size:16px;padding:4px 0;white-space:nowrap;">${money(p.depositPence)}</td></tr>
            <tr><td style="font-size:16px;padding:8px 16px 4px 0;border-top:1px solid #eee5d6;font-weight:bold;">Balance due on collection</td>
                <td align="right" style="font-size:16px;padding:8px 0 4px;border-top:1px solid #eee5d6;font-weight:bold;white-space:nowrap;">${money(balance)}</td></tr>
          </table>

          <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5b6b7f;">
            Your deposit is non-refundable. The remaining balance is taken by
            contactless card payment when you collect.
          </p>

          <p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">COLLECTION ADDRESS:</p>
          ${p.address
            .map(
              (l) =>
                `<p class="address" style="margin:0 0 2px;font-size:16px;color:#09264a;">${l}</p>`
            )
            .join("")}
          <p style="margin:20px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">COLLECTION DATE:</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${day} ${date}</p>

          <p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">COLLECTION TIME:</p>
          <p style="margin:0 0 24px;font-size:16px;font-weight:bold;">${time}</p>

          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">
            Please message us on WhatsApp 10 minutes before you arrive so we
            can have your order ready.
          </p>
        </td></tr>

        <tr><td align="center" style="padding:8px 24px 24px;">
          ${button("whatsapp.png", wa ?? "", "Contact us on WhatsApp")}
          ${button("instagram.png", SOCIALS.instagram.url, "Follow us on Instagram")}
          ${button("snapchat.png", SOCIALS.snapchat.url, "Add us on Snapchat")}
        </td></tr>

        <tr><td style="padding:0 32px 28px;font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0 0 4px;font-size:13px;color:#5b6b7f;">
            Any questions, message us on WhatsApp — this mailbox isn't monitored.
          </p>
          <p style="margin:12px 0 0;font-size:14px;font-weight:bold;color:#09264a;">${SHOP.name}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

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
  const site = siteUrl();
  const wa = whatsappLink();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="format-detection" content="telephone=no,address=no,date=no" />
  <style>
    a[x-apple-data-detectors], .address a {
      color: inherit !important;
      text-decoration: none !important;
      pointer-events: none;
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#faf7f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f1;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td>
          <img src="${site}/email/header.jpg" alt="${SHOP.name}" width="600"
               style="display:block;border:0;width:100%;height:auto;" />
        </td></tr>
        <tr><td style="padding:28px 32px;font-family:Helvetica,Arial,sans-serif;color:#09264a;">
          <p style="margin:0 0 16px;font-size:16px;">Hi ${p.firstName},</p>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">
            Your order is ready to collect today at the time below.
          </p>

          ${describeItems(p.items)
            .map((l) => `<p style="margin:0 0 6px;font-size:16px;">${l}</p>`)
            .join("")}

          <p style="margin:16px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">COLLECTION ADDRESS:</p>
          ${p.address
            .map(
              (l) =>
                `<p class="address" style="margin:0 0 2px;font-size:16px;color:#09264a;">${l}</p>`
            )
            .join("")}
          <p style="margin:16px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">COLLECTION DATE:</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${day} ${date}</p>

          <p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">COLLECTION TIME:</p>
          <p style="margin:0 0 20px;font-size:16px;font-weight:bold;">${time}</p>

          ${
            balance > 0
              ? `<p style="margin:0 0 20px;font-size:16px;">Balance due on collection: <strong>${money(balance)}</strong>, by contactless card.</p>`
              : ""
          }

          <p style="margin:0;font-size:15px;line-height:1.5;">
            Please message us on WhatsApp 10 minutes before you arrive so we
            can have your order ready.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:0 24px 24px;">
          ${
            wa
              ? `<a href="${wa}" style="text-decoration:none;display:inline-block;">
                   <img src="${site}/email/whatsapp.png" alt="Contact us on WhatsApp" width="180"
                        style="display:block;border:0;width:180px;height:auto;" />
                 </a>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:0 32px 28px;font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0;font-size:13px;color:#5b6b7f;">
            Any questions, message us on WhatsApp — this mailbox isn't monitored.
          </p>
          <p style="margin:12px 0 0;font-size:14px;font-weight:bold;color:#09264a;">${SHOP.name}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

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
