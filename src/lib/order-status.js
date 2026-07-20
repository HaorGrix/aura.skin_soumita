/* Order status — SINGLE source of truth.
 *
 * Status is DERIVED from how long ago the order was placed, never stored.
 * A stored `status` field goes stale the moment time passes: an order from
 * three days ago would still read "Confirmed" in the orders list while the
 * tracking modal (which derives from the timestamp) says "Delivered".
 * Every surface must read status from here. */

export const ORDER_STAGES = [
  { id: "confirmed",       label: "Order Confirmed",  desc: "We’ve received your ritual" },
  { id: "processing",      label: "Processing",       desc: "Packing your glow with care" },
  { id: "out-for-delivery",label: "Out for Delivery", desc: "On its way to you" },
  { id: "delivered",       label: "Delivered",        desc: "Delivered to your address" },
];

/* Hours since placement → stage. */
export function orderStatusId(timestamp) {
  const createdAt = new Date(timestamp || Date.now());
  const hoursPassed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

  if (hoursPassed < 0.5) return "confirmed";
  if (hoursPassed < 24) return "processing";
  if (hoursPassed < 48) return "out-for-delivery";
  return "delivered";
}

/** Human label for an order's current stage (e.g. "Out for Delivery"). */
export function orderStatusLabel(timestamp) {
  const id = orderStatusId(timestamp);
  return ORDER_STAGES.find((s) => s.id === id)?.label ?? "Confirmed";
}

/** Index into ORDER_STAGES — drives the tracker's progress bar. */
export function orderStageIndex(timestamp) {
  const id = orderStatusId(timestamp);
  return ORDER_STAGES.findIndex((s) => s.id === id);
}
