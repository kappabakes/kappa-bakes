import { db, flavourStock, openDays } from "./stock";
import { SHOP, dayLabel } from "./config";
import { emailShell, para, linkButton } from "./email-layout";
import { sendEmail } from "./notify";

/**
 * Telling people a sold-out flavour is back.
 *
 * Driven by the number, not by what moved it. More baked, an order
 * cancelled, a no-show, a released checkout, slices reallocated inside a
 * group — all of them end with a count above zero, and watching that means a
 * cause nobody thought of still works.
 *
 * Nothing here ever throws into a caller: an alert failing must not stop an
 * order being cancelled or stock being saved.
 */
export async function runStockAlerts() {
  try {
    const days = await openDays();
    let sent = 0;

    for (const d of days) {
      const day = new Date(d.iso);
      const stock = await flavourStock(day);

      for (const [flavourId, row] of Object.entries(stock)) {
        if (!row.offered) continue;
        if (row.left === null || row.left <= 0) continue;

        sent += await notifyFor(flavourId, day, row.left, d.label);
      }
    }

    return { sent };
  } catch (err) {
    console.error("Stock alerts failed:", err);
    return { sent: 0 };
  }
}

/** Everyone waiting on this flavour who hasn't already been told about it. */
async function notifyFor(
  flavourId: string,
  day: Date,
  left: number,
  label: string
) {
  const flavour = await db.flavour.findUnique({
    where: { id: flavourId },
    select: { name: true },
  });
  if (!flavour) return 0;

  const waiting = await db.stockAlert.findMany({
    where: {
      flavourId,
      // Either they're waiting on this date, or on any date.
      OR: [{ day }, { day: null }],
    },
  });

  let sent = 0;

  for (const a of waiting) {
    // At most one email per person per flavour per date. Slices come back
    // for small reasons, and without this a flickering count could send
    // three times in an afternoon.
    if (a.lastSentFor && +a.lastSentFor === +day) continue;

    const { subject, html, text } = buildAlertEmail(
      flavour.name,
      left,
      label,
      a.id
    );

    const status = await sendEmail(a.email, subject, text, html);
    if (status !== "Sent") continue;
    sent++;

    if (a.repeating) {
      await db.stockAlert.update({
        where: { id: a.id },
        data: { lastSentAt: new Date(), lastSentFor: day },
      });
    } else {
      // One-off: they've had their answer.
      await db.stockAlert.delete({ where: { id: a.id } });
    }
  }

  return sent;
}

function buildAlertEmail(
  flavour: string,
  left: number,
  label: string,
  alertId: string
) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  const body = [
    para(`<strong>${flavour} is back.</strong>`, "font-size:18px;"),
    para(
      `There ${left === 1 ? "is 1 slice" : `are ${left} slices`} available for ${label}. They go quickly, so if you'd like one it's worth ordering now.`
    ),
    linkButton(`${site}/order`, "Order now"),
    para(
      `You asked to be told when this flavour came back. <a href="${site}/stop-alert?id=${alertId}" style="color:#5b6b7f;">Stop these emails</a>`,
      "font-size:12.5px;color:#5b6b7f;"
    ),
  ].join("");

  const text = [
    `${flavour} is back.`,
    "",
    `There ${left === 1 ? "is 1 slice" : `are ${left} slices`} available for ${label}.`,
    "",
    `Order: ${site}/order`,
    "",
    `Stop these emails: ${site}/stop-alert?id=${alertId}`,
    "",
    SHOP.name,
  ].join("\n");

  return {
    subject: `${flavour} is back — ${SHOP.name}`,
    html: emailShell(body),
    text,
  };
}
