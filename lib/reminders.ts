import { db, midnightUtc, dayWindow } from "./stock";
import { collectionAddress } from "./settings";
import { buildReminderEmail, sendEmail, SliceLine } from "./notify";
import { OrderStatus } from "@prisma/client";

/**
 * Lives here rather than in the route, because a Next.js route file may only
 * export request handlers — anything else fails the build.
 */
export async function sendReminders(forDay?: Date) {
  const day = forDay ?? midnightUtc(new Date());

  const collectionDay = await db.collectionDay.findUnique({ where: { day } });
  if (!collectionDay)
    return { sent: 0, reason: "No collection day today" };

  const orders = await db.order.findMany({
    where: {
      day,
      status: OrderStatus.PAID, // not collected, not a no-show
      reminderSentAt: null,
    },
  });

  if (orders.length === 0)
    return { sent: 0, reason: "Nobody to remind" };

  const [address, window] = await Promise.all([
    collectionAddress(),
    dayWindow(day),
  ]);

  let sent = 0;
  let failed = 0;

  for (const order of orders) {
    const { subject, body, html } = buildReminderEmail(
      {
        orderNo: order.orderNo,
        firstName: order.firstName,
        lastName: order.lastName,
        email: order.email,
        mobile: order.mobile,
        day: order.day,
        window,
        slices: order.slices as unknown as SliceLine[],
        totalPence: order.totalPence,
      },
      address
    );

    const status = await sendEmail(order.email, subject, body, html);
    if (status === "Sent" || status.startsWith("Skipped")) sent++;
    else failed++;

    await db.order.update({
      where: { id: order.id },
      data: { reminderSentAt: new Date() },
    });

    await db.orderEvent.create({
      data: {
        orderId: order.id,
        kind: "Collection reminder sent",
        detail: status,
      },
    });
  }

  return { sent, failed, total: orders.length };
}


/**
 * Whole-cheesecake reminders, on the morning of collection.
 *
 * Separate from the slice reminder above: these have their own email, their
 * own times, and no collection window to belong to.
 */
export async function sendWholeReminders(forDay?: Date) {
  const { collectionAddress } = await import("./settings");
  const { notifyWhole } = await import("./notify-whole");
  const { WholeStatus } = await import("@prisma/client");

  /*
   * "Today" in UK terms. An order at 00:30 BST is still 23:30 UTC the day
   * before, so a UTC-based window would email the wrong people either side
   * of midnight.
   */
  const { ukWallTimeToUtc } = await import("./whole");
  const now = forDay ?? new Date();
  const todayUk = now.toLocaleDateString("en-CA", {
    timeZone: "Europe/London",
  }); // YYYY-MM-DD

  const start = ukWallTimeToUtc(todayUk, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const orders = await db.wholeOrder.findMany({
    where: {
      collectAt: { gte: start, lt: end },
      status: WholeStatus.CONFIRMED,
      reminderSentAt: null,
    },
  });

  if (!orders.length) return { sent: 0, reason: "Nothing collecting today" };

  const address = await collectionAddress();
  let sent = 0;

  for (const o of orders) {
    const { emailStatus } = await notifyWhole(
      {
        firstName: o.firstName,
        lastName: o.lastName,
        email: o.email,
        mobile: o.mobile,
        collectAt: o.collectAt,
        items: o.items as never,
        totalPence: o.totalPence,
        depositPence: o.depositPence,
        address,
      },
      true
    );

    await db.wholeOrder.update({
      where: { id: o.id },
      data: { reminderSentAt: new Date() },
    });

    if (emailStatus === "Sent") sent++;
  }

  return { sent, of: orders.length };
}
