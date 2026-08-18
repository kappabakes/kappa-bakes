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
    const { subject, body } = buildReminderEmail(
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

    const status = await sendEmail(order.email, subject, body);
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
