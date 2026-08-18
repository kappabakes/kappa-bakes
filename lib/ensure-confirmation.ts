import { db } from "./stock";
import { dayWindow } from "./stock";
import { collectionAddress } from "./settings";
import { notifyCustomer, SliceLine } from "./notify";
import { OrderStatus } from "@prisma/client";

/**
 * A second chance at the confirmation email, run when the customer lands on
 * the confirmation screen.
 *
 * The Stripe webhook sends it first. That mostly works, but not always, and
 * the failure is silent from the customer's side — they've paid and have no
 * collection details. This runs in a separate request, on a separate
 * invocation, so a problem confined to the webhook's execution doesn't cost
 * anyone their confirmation.
 *
 * Does nothing when the first attempt succeeded, so the normal case is one
 * email and one database read.
 */
export async function ensureConfirmationSent(orderNo: string) {
  const order = await db.order.findUnique({ where: { orderNo } });

  if (!order) return;
  if (order.status !== OrderStatus.PAID) return; // not paid, nothing to confirm
  if (order.emailStatus === "Sent") return; // already gone
  if (!order.email) return;

  console.log(
    `Confirmation for ${order.orderNo} was "${order.emailStatus}" — sending from the confirmation page.`
  );

  const [window, address] = await Promise.all([
    dayWindow(order.day),
    collectionAddress(),
  ]);

  const { emailStatus } = await notifyCustomer(
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
      address,
    },
    false,
    { email: true, sms: false } // SMS already went, or didn't; don't double it
  );

  await db.order.update({
    where: { id: order.id },
    data: { emailStatus, confirmSentAt: new Date() },
  });

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      kind: "Confirmation retried",
      detail: `Sent from the confirmation page. Email ${emailStatus}.`,
    },
  });
}
