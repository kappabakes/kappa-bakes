import { SHOP, SOCIALS, whatsappLink } from "./config";

const site = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

/** A small caps heading, the way the sections read in the whole-cake email. */
export const heading = (text: string) =>
  `<p style="margin:20px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#8a7a5c;">${text}</p>`;

export const para = (text: string, extra = "") =>
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;${extra}">${text}</p>`;

/** Address lines, styled so mail apps don't turn them blue. */
export const addressBlock = (lines: string[]) =>
  lines
    .map(
      (l) =>
        `<p class="address" style="margin:0 0 2px;font-size:16px;color:#09264a;">${l}</p>`
    )
    .join("");

/**
 * The three social buttons, as images.
 *
 * WhatsApp only appears when a number is configured — an orphan button
 * linking nowhere is worse than no button.
 */
export function socialButtons() {
  const wa = whatsappLink();
  const one = (img: string, href: string, alt: string) =>
    href
      ? `<a href="${href}" style="text-decoration:none;display:inline-block;margin:4px 6px;">
           <img src="${site()}/email/${img}" alt="${alt}" width="180"
                style="display:block;border:0;width:180px;height:auto;" />
         </a>`
      : "";

  return `${one("whatsapp.png", wa ?? "", "Contact us on WhatsApp")}
          ${one("instagram.png", SOCIALS.instagram.url, "Follow us on Instagram")}
          ${one("tiktok.png", SOCIALS.tiktok.url, "Follow us on TikTok")}
          ${one("snapchat.png", SOCIALS.snapchat.url, "Add us on Snapchat")}`;
}

/**
 * Wraps a body in the branded shell: header image, white card, social
 * buttons, sign-off.
 *
 * Tables and inline styles because email clients are twenty years behind
 * browsers. The head block stops mail apps auto-linking addresses and
 * turning them blue.
 */
export function emailShell(bodyHtml: string, footNote?: string) {
  return `<!DOCTYPE html>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#faf7f1;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">

        <tr><td>
          <img src="${site()}/email/header.jpg" alt="${SHOP.name}" width="600"
               style="display:block;border:0;width:100%;height:auto;" />
        </td></tr>

        <tr><td style="padding:28px 32px 8px;font-family:Helvetica,Arial,sans-serif;color:#09264a;">
          ${bodyHtml}
        </td></tr>

        <tr><td align="center" style="padding:8px 24px 24px;">
          ${socialButtons()}
        </td></tr>

        <tr><td style="padding:0 32px 28px;font-family:Helvetica,Arial,sans-serif;">
          ${
            footNote
              ? `<p style="margin:0 0 4px;font-size:13px;color:#5b6b7f;">${footNote}</p>`
              : ""
          }
          <p style="margin:12px 0 0;font-size:14px;font-weight:bold;color:#09264a;">${SHOP.name}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** A button-style link, for the tracking link in slice emails. */
export const linkButton = (href: string, label: string) =>
  `<a href="${href}"
      style="display:inline-block;background:#09264a;color:#ffffff;text-decoration:none;
             font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;
             padding:12px 24px;border-radius:8px;margin:4px 0 16px;">${label}</a>`;
