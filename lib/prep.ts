import { db } from "./stock";
import { adminEmails } from "./auth";
import { money, dayLabel, SHOP } from "./config";
import { emailShell, heading, para } from "./email-layout";
import { sendEmail } from "./notify";
import { SliceLine } from "./notify";
import { WholeItem, describeItem, balancePence } from "./whole";
import { ukWallTimeToUtc } from "./whole";
import { OrderStatus, WholeStatus } from "@prisma/client";

/** How far ahead the shopping list goes out. */
export const PREP_DAYS_AHEAD = 2;

/**
 * What you need to buy and bake for one collection date.
 *
 * Slices are a tally — how many, of what. Whole cakes are listed in full,
 * because each one may carry a request that changes what you do.
 */
export async function gatherPrep(dateUk: string) {
  const start = ukWallTimeToUtc(dateUk, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [orders, wholes] = await Promise.all([
    db.order.findMany({
      where: {
        day: { gte: start, lt: end },
        // Cancelled and no-shows aren't being made.
        status: { in: [OrderStatus.PAID, OrderStatus.COLLECTED] },
      },
      select: { slices: true },
    }),
    db.wholeOrder.findMany({
      where: {
        collectAt: { gte: start, lt: end },
        status: WholeStatus.CONFIRMED,
      },
      orderBy: { collectAt: "asc" },
    }),
  ]);

  // Slices by flavour, specials included — they're just flavours here.
  const byFlavour = new Map<string, number>();
  let sliceCount = 0;

  for (const o of orders)
    for (const s of o.slices as unknown as SliceLine[]) {
      sliceCount++;
      byFlavour.set(s.flavour, (byFlavour.get(s.flavour) ?? 0) + 1);
    }

  return {
    sliceCount,
    flavours: [...byFlavour].sort((a, b) => b[1] - a[1]),
    wholes,
    anything: sliceCount > 0 || wholes.length > 0,
  };
}

/**
 * One email covering both lines for a date, rather than two that have to be
 * read together.
 */
export function buildPrepEmail(
  dateUk: string,
  prep: Awaited<ReturnType<typeof gatherPrep>>
) {
  const [y, m, d] = dateUk.split("-");
  const readable = dayLabel(new Date(`${dateUk}T12:00:00Z`));

  const sliceBlock = prep.sliceCount
    ? [
        heading(`SLICES — ${prep.sliceCount} TOTAL`),
        prep.flavours
          .map(
            ([flavour, n]) =>
              `<p style="margin:0 0 4px;font-size:16px;"><strong>${n}</strong> × ${flavour}</p>`
          )
          .join(""),
      ].join("")
    : heading("SLICES — NONE");

  const wholeBlock = prep.wholes.length
    ? [
        heading(`WHOLE CHEESECAKES — ${prep.wholes.length}`),
        prep.wholes
          .map((w) => {
            const items = (w.items as unknown as WholeItem[])
              .map((i) => `${i.qty}× ${describeItem(i)}`)
              .join("<br />");

            const time = w.collectAt.toLocaleTimeString("en-GB", {
              timeZone: "Europe/London",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });

            return `<div style="border:1px solid #eee5d6;border-radius:8px;padding:14px;margin:0 0 10px;">
              <p style="margin:0 0 6px;font-size:16px;font-weight:bold;">
                ${w.firstName} ${w.lastName} — ${time}
              </p>
              <p style="margin:0 0 6px;font-size:16px;">${items}</p>
              <p style="margin:0 0 6px;font-size:14px;color:#5b6b7f;">
                ${money(w.totalPence)} total · ${money(balancePence(w.totalPence, w.depositPence))} due on collection
              </p>
              ${
                w.requests
                  ? `<p style="margin:8px 0 0;font-size:15px;background:#f8f1dd;border-radius:6px;padding:10px;white-space:pre-line;"><strong>Requests:</strong> ${w.requests}</p>`
                  : ""
              }
              ${
                w.notes
                  ? `<p style="margin:8px 0 0;font-size:14px;color:#5b6b7f;white-space:pre-line;"><strong>Notes:</strong> ${w.notes}</p>`
                  : ""
              }
            </div>`;
          })
          .join(""),
      ].join("")
    : heading("WHOLE CHEESECAKES — NONE");

  const html = emailShell(
    [
      para(
        `Shopping and prep for <strong>${readable}</strong>, two days from now.`,
        "font-size:17px;"
      ),
      sliceBlock,
      wholeBlock,
      para(
        "Orders can still come in until the cut-off, so check again on the day.",
        "margin-top:20px;font-size:14px;color:#5b6b7f;"
      ),
    ].join("")
  );

  const text = [
    `Prep for ${readable} — two days from now.`,
    "",
    prep.sliceCount ? `SLICES — ${prep.sliceCount} TOTAL` : "SLICES — NONE",
    ...prep.flavours.map(([f, n]) => `${n} x ${f}`),
    "",
    prep.wholes.length
      ? `WHOLE CHEESECAKES — ${prep.wholes.length}`
      : "WHOLE CHEESECAKES — NONE",
    ...prep.wholes.flatMap((w) => {
      const items = (w.items as unknown as WholeItem[]).map(
        (i) => `  ${i.qty}x ${describeItem(i)}`
      );
      const time = w.collectAt.toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return [
        `${w.firstName} ${w.lastName} — ${time}`,
        ...items,
        `  ${money(w.totalPence)} total, ${money(balancePence(w.totalPence, w.depositPence))} on collection`,
        ...(w.requests ? [`  Requests: ${w.requests}`] : []),
        ...(w.notes ? [`  Notes: ${w.notes}`] : []),
        "",
      ];
    }),
    "Orders can still come in until the cut-off, so check again on the day.",
  ].join("\n");

  return {
    subject: `Prep for ${d}/${m}/${y} — ${prep.sliceCount} slices, ${prep.wholes.length} whole`,
    html,
    text,
  };
}

/** Sends to every admin address. */
export async function sendPrepEmail(dateUk: string) {
  const prep = await gatherPrep(dateUk);
  if (!prep.anything) return { sent: 0, reason: "Nothing on that date" };

  const { subject, html, text } = buildPrepEmail(dateUk, prep);
  let sent = 0;

  for (const to of adminEmails()) {
    if ((await sendEmail(to, subject, text, html)) === "Sent") sent++;
  }

  return { sent, slices: prep.sliceCount, wholes: prep.wholes.length };
}
