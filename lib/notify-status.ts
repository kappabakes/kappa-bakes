import { SHOP, money, whatsappLink } from "./config";
import { emailShell, heading, para } from "./email-layout";
import { sendEmail } from "./notify";

/** What was decided about money when an order was cancelled. */
export type RefundChoice = "NONE" | "FULL" | "PARTIAL" | "NOTHING_PAID";

/**
 * The refund position, in one sentence.
 *
 * Chosen from a short list rather than typed, so the wording is the same
 * every time — it's the part of a cancellation someone reads twice.
 */
export function refundLine(
  choice: RefundChoice,
  paidPence: number,
  partialPence?: number,
  depositPence?: number
): string | null {
  switch (choice) {
    case "FULL":
      return `A full refund of ${money(paidPence)} has been issued and should reach you within 5-10 days.`;
    case "PARTIAL":
      return `A partial refund of ${money(partialPence ?? 0)} has been issued and should reach you within 5-10 days.`;
    case "NONE":
      // A whole cake's deposit is the usual reason there's nothing back, so
      // say which sum is being kept rather than just "no refund".
      return depositPence
        ? `Your ${money(depositPence)} deposit is non-refundable, as agreed when the order was placed.`
        : "No refund is due on this order.";
    case "NOTHING_PAID":
      return null;
  }
}

/**
 * Sent after collection.
 *
 * Mostly about how to eat it: a San Sebastián straight from the fridge is a
 * different cake, and someone who eats it cold is quietly disappointed
 * without ever knowing why.
 */
export function buildCollectedEmail(firstName: string, orderNo?: string) {
  const body = [
    para(`Hi ${firstName},`),
    para("Thanks for collecting today. Here's how to get the best out of it."),

    heading("STORING IT"),
    para("Keep it refrigerated and eat within 3 days."),

    heading("BEFORE YOU EAT IT"),
    para(
      "Take it out of the fridge 30 minutes before serving. San Sebastián cheesecake is meant to be eaten at room temperature — straight from the fridge it's firm and you lose the texture that makes it what it is."
    ),

    heading("YOUR SAUCE"),
    para(
      "If you took sauce in a tub, warm it for 10-15 seconds and stir before pouring. Don't let it boil."
    ),

    heading("YOUR TOPPINGS"),
    para(
      "If your toppings came separately, add them just before eating so they stay put."
    ),

    para(
      "Tomorrow we'll send a short survey asking how it was — one tap, and it's anonymous.",
      "margin-top:20px;font-size:14px;color:#5b6b7f;"
    ),
  ].join("");

  const text = [
    `Hi ${firstName},`,
    "",
    "Thanks for collecting today. Here's how to get the best out of it.",
    "",
    "STORING IT",
    "Keep it refrigerated and eat within 3 days.",
    "",
    "BEFORE YOU EAT IT",
    "Take it out of the fridge 30 minutes before serving. San Sebastian cheesecake is meant to be eaten at room temperature — straight from the fridge it's firm and you lose the texture that makes it what it is.",
    "",
    "YOUR SAUCE",
    "If you took sauce in a tub, warm it for 10-15 seconds and stir before pouring. Don't let it boil.",
    "",
    "YOUR TOPPINGS",
    "If your toppings came separately, add them just before eating so they stay put.",
    "",
    "Tomorrow we'll send a short survey asking how it was — one tap, and it's anonymous.",
    "",
    SHOP.name,
  ].join("\n");

  return {
    subject: orderNo
      ? `Thanks for collecting — ${SHOP.name} order ${orderNo}`
      : `Thanks for collecting — ${SHOP.name}`,
    html: emailShell(body, "Any questions, message us on WhatsApp."),
    text,
  };
}

/**
 * Sent when a slice order isn't collected.
 *
 * Firm about the policy, but people do turn up on the wrong day — so it ends
 * with a way to say so rather than a full stop.
 */
export function buildNoShowEmail(firstName: string, orderNo: string) {
  const body = [
    para(`Hi ${firstName},`),
    para(
      "Your order wasn't collected today and the collection window has now closed."
    ),
    para(
      "Slices are baked to order, so payment isn't refundable where an order isn't collected. This was set out in the no-show policy you agreed to when ordering."
    ),
    para(
      "If you think this is a mistake, message us on WhatsApp and we'll look into it.",
      "font-size:14px;color:#5b6b7f;"
    ),
  ].join("");

  const text = [
    `Hi ${firstName},`,
    "",
    "Your order wasn't collected today and the collection window has now closed.",
    "",
    "Slices are baked to order, so payment isn't refundable where an order isn't collected. This was set out in the no-show policy you agreed to when ordering.",
    "",
    "If you think this is a mistake, message us on WhatsApp and we'll look into it.",
    "",
    SHOP.name,
  ].join("\n");

  return {
    subject: `Your ${SHOP.name} order ${orderNo}`,
    html: emailShell(body, "Any questions, message us on WhatsApp."),
    text,
  };
}

/** Sent on cancellation, and only when you choose to send it. */
export function buildCancelledEmail(
  firstName: string,
  refund: string | null,
  orderNo?: string,
  whole = false
) {
  const opening = whole
    ? "Your Full San Sebastián order has been cancelled as requested."
    : "Your order has been cancelled as requested.";

  const body = [
    para(`Hi ${firstName},`),
    para(opening),
    ...(refund ? [para(refund)] : []),
    para("Any questions, message us on WhatsApp.", "font-size:14px;color:#5b6b7f;"),
  ].join("");

  const text = [
    `Hi ${firstName},`,
    "",
    whole
      ? "Your Full San Sebastian order has been cancelled as requested."
      : "Your order has been cancelled as requested.",
    ...(refund ? ["", refund] : []),
    "",
    "Any questions, message us on WhatsApp.",
    "",
    SHOP.name,
  ].join("\n");

  return {
    subject: whole
      ? `Your Full San Sebastián order has been cancelled`
      : `Your ${SHOP.name} order ${orderNo} has been cancelled`,
    html: emailShell(body, "Any questions, message us on WhatsApp."),
    text,
  };
}

/**
 * Whole cakes only: a nudge when they haven't turned up.
 *
 * There's no no-show status on these — a time is agreed by message, so being
 * late is a conversation. This says what happens if that conversation
 * doesn't happen.
 */
export function buildChaseEmail(firstName: string) {
  const body = [
    para(`Hi ${firstName},`),
    para("Your order is ready and waiting, but we haven't seen you yet."),
    para(
      "Please message us on WhatsApp to let us know when you're collecting."
    ),
    para(
      "If it isn't collected by the end of today, the order will be marked as a no-show and won't be available to collect — unless you've contacted us to rearrange for the following day.",
      "font-size:14px;color:#5b6b7f;"
    ),
  ].join("");

  const text = [
    `Hi ${firstName},`,
    "",
    "Your order is ready and waiting, but we haven't seen you yet.",
    "",
    "Please message us on WhatsApp to let us know when you're collecting.",
    "",
    "If it isn't collected by the end of today, the order will be marked as a no-show and won't be available to collect — unless you've contacted us to rearrange for the following day.",
    "",
    SHOP.name,
  ].join("\n");

  return {
    subject: `Your Full San Sebastián order is ready — ${SHOP.name}`,
    html: emailShell(body, "Any questions, message us on WhatsApp."),
    text,
  };
}

/** Sends one of the above. Never throws — a status change still happens. */
export async function sendStatusEmail(
  to: string,
  built: { subject: string; html: string; text: string }
) {
  try {
    return await sendEmail(to, built.subject, built.text, built.html);
  } catch {
    return "Failed";
  }
}
