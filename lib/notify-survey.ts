import { SHOP } from "./config";
import { emailShell, heading, para } from "./email-layout";
import { sendEmail } from "./notify";
import { RATINGS } from "./survey";

const site = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

/**
 * The survey, sent the day after collection.
 *
 * Every rating is a link, so one tap records an answer without loading a
 * page. Someone who never opens the follow-up has still told you something,
 * which is the difference between a survey people answer and one they don't.
 */
export function buildSurveyEmail(firstName: string, token: string) {
  const link = (value: string) =>
    `${site()}/feedback?t=${encodeURIComponent(token)}&r=${value}`;

  const buttons = RATINGS.map(
    (r) => `<tr><td style="padding:4px 0;">
      <a href="${link(r.value)}"
         style="display:block;background:${r.colour};color:#ffffff;text-decoration:none;
                font-size:16px;font-weight:700;padding:14px;border-radius:8px;text-align:center;">
        ${r.label}
      </a></td></tr>`
  ).join("");

  const html = emailShell(
    [
      para(`Hi ${firstName},`),
      para("Thanks for collecting yesterday. How was it?"),

      `<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5b6b7f;background:#f3efe4;border-radius:8px;padding:14px;">
         Your answer is anonymous — we see the rating and any comment, but not
         who sent it. So please be honest, it's the only way we improve.
       </p>`,

      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${buttons}</table>`,

      para(
        "One tap and you're done. There's a box on the next page if you'd like to say more, but it's optional.",
        "margin-top:20px;font-size:14px;color:#5b6b7f;"
      ),
    ].join(""),
    "Any questions, message us on WhatsApp — this mailbox isn't monitored."
  );

  const text = [
    `Hi ${firstName},`,
    "",
    "Thanks for collecting yesterday. How was it?",
    "",
    "Your answer is anonymous — we see the rating and any comment, but not who sent it.",
    "",
    ...RATINGS.map((r) => `${r.label}: ${link(r.value)}`),
    "",
    "One tap and you're done.",
    "",
    SHOP.name,
  ].join("\n");

  // Leads with the name, so it reads as a real business rather than a
  // marketing blast someone deletes unread.
  return {
    subject: `${SHOP.name}: How was your recent order?`,
    html,
    text,
  };
}

export async function sendSurveyEmail(
  to: string,
  firstName: string,
  token: string
) {
  const { subject, html, text } = buildSurveyEmail(firstName, token);
  return sendEmail(to, subject, text, html);
}
