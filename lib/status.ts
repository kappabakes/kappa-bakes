import { OrderStatus } from "@prisma/client";

/**
 * The customer-facing stage. Derived rather than stored, so there's nothing
 * for you to click through each weekend:
 *
 *   Order placed      — always, once paid
 *   Payment confirmed — always, once paid
 *   Preparing         — from payment until the collection window opens
 *   Ready             — the moment the window opens on the day
 *   Collected         — only when you tick it in the admin
 */
export type Stage =
  | "PLACED"
  | "PAID"
  | "PREPARING"
  | "READY"
  | "COLLECTED"
  | "NO_SHOW"
  | "CANCELLED";

export const STAGES: { id: Stage; label: string; note: string }[] = [
  { id: "PLACED", label: "Order Placed", note: "We've got your order." },
  { id: "PAID", label: "Payment Confirmed", note: "Payment received." },
  {
    id: "PREPARING",
    label: "Preparing Your Order",
    note: "We're baking your cheesecake.",
  },
  {
    id: "READY",
    label: "Ready for Collection",
    note: "Your order is ready to collect",
  },
  { id: "COLLECTED", label: "Collected", note: "Hope you enjoy!" },
];

/**
 * Turns "2:00 PM" plus a date into a real moment. Times are stored as the
 * text you typed in the admin, so this has to parse them rather than assume.
 */
export function windowOpensAt(day: Date, startTime: string): Date {
  const m = startTime.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  const d = new Date(day);
  if (!m) {
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }
  let hour = Number(m[1]);
  const mins = Number(m[2] ?? 0);
  const suffix = m[3]?.toUpperCase();
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  d.setUTCHours(hour, mins, 0, 0);
  return d;
}

export function currentStage(
  status: OrderStatus,
  day: Date,
  startTime: string,
  now = new Date()
): Stage {
  if (status === OrderStatus.COLLECTED) return "COLLECTED";
  if (status === OrderStatus.NO_SHOW) return "NO_SHOW";
  if (status === OrderStatus.CANCELLED) return "CANCELLED";
  return now >= windowOpensAt(day, startTime) ? "READY" : "PREPARING";
}

/** How far along the tracker to fill. */
export const stageIndex = (stage: Stage) =>
  stage === "COLLECTED" ? 4 : stage === "READY" ? 3 : 2;
