import { db } from "./stock";
import { dayWindow } from "./stock";
import { notifyCustomer, SliceLine } from "./notify";
import { collectionAddress } from "./settings";
import { recordCustomer } from "./marketing";
import { OrderStatus } from "@prisma/client";

/**
 * The single place an order becomes real. Called by the Stripe webhook in
 * normal use, and directly by the test path — so what you rehearse in test
 * mode is the same code that runs when money moves.
 */
export async function markPaid(
  orderId: string,
  paymentIntent: string | null,
  marketingOptIn: boolean
) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === OrderStatus.PAID) {
    console.log(
      `markPaid skipped for ${orderId}: ${!order ? "no such order" : "already paid"}`
    );
    return; // idempotent
  }
  console.log(`markPaid running for ${order.orderNo}`);

  await db.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.PAID,
      reservedUntil: null,
      stripePaymentId: paymentIntent,
    },
  });

  await db.orderEvent.create({
    data: {
      orderId,
      kind: "Paid",
      detail: paymentIntent ? `Stripe ${paymentIntent}` : "Test order — no payment taken",
    },
  });

  await recordCustomer({
    email: order.email,
    firstName: order.firstName,
    lastName: order.lastName,
    mobile: order.mobile,
    totalPence: order.totalPence,
    marketingOptIn,
  });

  const window = await dayWindow(order.day);
  const address = await collectionAddress();
  let { emailStatus, smsStatus } = await notifyCustomer({
    orderNo: order.orderNo,
    firstName: order.firstName,
    // Without this the tracking link in the email has nothing to prefill,
    // and the customer is asked to type details they were just given.
    lastName: order.lastName,
    email: order.email,
    mobile: order.mobile,
    day: order.day,
    window,
    slices: order.slices as unknown as SliceLine[],
    totalPence: order.totalPence,
    address,
  });

  // One retry if the email didn't go. Whatever the cause — a provider blip,
  // a key not yet visible — a customer who has paid must not be left without
  // their collection details.
  if (emailStatus !== "Sent" && order.email) {
    console.warn(
      `Confirmation email for ${order.orderNo} came back "${emailStatus}" — retrying once.`
    );
    await new Promise((r) => setTimeout(r, 1500));
    const retry = await notifyCustomer(
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
      { email: true, sms: false }
    );
    emailStatus = retry.emailStatus;
    if (emailStatus !== "Sent")
      console.error(
        `Confirmation email for ${order.orderNo} failed twice: ${emailStatus}. Resend it from the admin.`
      );
  }

  await db.order.update({
    where: { id: orderId },
    data: { confirmSentAt: new Date(), emailStatus, smsStatus },
  });

  await db.orderEvent.create({
    data: {
      orderId,
      kind: "Confirmation sent",
      detail: `Email ${emailStatus}. SMS ${smsStatus}.`,
    },
  });
}
