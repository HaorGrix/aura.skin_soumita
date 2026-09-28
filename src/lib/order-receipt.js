/* =================================================================== *
 * skin.theory — order receipt (memo)
 * -------------------------------------------------------------------
 * One snapshot of a placed order, taken at checkout from the cart lines
 * and the server's computed totals. The success screen, the printable
 * memo and the account's order details all read this same snapshot, so a
 * product later renamed, repriced or removed from the catalog can't turn
 * an old order into zeros.
 * =================================================================== */
import { formatPrice } from "./format.js";

/** Cart lines → the fields a receipt needs. */
export function receiptLines(items) {
  return (items ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    brand: i.brand ?? "",
    size: i.sizeLabel && i.sizeLabel !== "Standard" ? i.sizeLabel : null,
    qty: i.qty,
    price: i.price ?? 0,
    image: i.image ?? null,
  }));
}

/** Server-computed order (placeOrder()'s data) → the totals block. */
export function receiptTotals(data) {
  return {
    subtotal: Number(data.subtotal) || 0,
    discount: Number(data.discount) || 0,
    shipping: Number(data.shipping) || 0,
    tax: Number(data.tax) || 0,
    total: Number(data.total) || 0,
    couponCode: data.couponCode ?? null,
  };
}

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Open the memo in its own window and hand it to the browser's print
 * dialog (print or "Save as PDF"). A separate plain document keeps the
 * site's header, footer and animations off the printout.
 *
 * @returns {boolean} false when the browser blocked the new window.
 */
export function printReceipt({ number, placedAt, payMethod, lines, totals, address, email }) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return false;

  const date = new Date(placedAt || Date.now()).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const rows = lines.map((l) => `
    <tr>
      <td>${escapeHtml(l.name)}${l.size ? ` <span class="muted">(${escapeHtml(l.size)})</span>` : ""}</td>
      <td class="num">${l.qty}</td>
      <td class="num">${escapeHtml(formatPrice(l.price))}</td>
      <td class="num">${escapeHtml(formatPrice(l.price * l.qty))}</td>
    </tr>`).join("");
  const line = (label, value) => `<tr><td colspan="3">${label}</td><td class="num">${value}</td></tr>`;
  const addressText = [address?.name, address?.line1, address?.city, address?.postcode, address?.phone]
    .filter(Boolean).map(escapeHtml).join("<br>");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>Skin Theory — Order ${escapeHtml(number)}</title>
<style>
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 22px; margin: 0; } .muted { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { padding: 8px 6px; border-bottom: 1px solid #e5e5e5; text-align: left; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #555; }
  .num { text-align: right; white-space: nowrap; }
  .total td { font-weight: 700; font-size: 16px; border-bottom: 0; }
  .grid { display: flex; justify-content: space-between; gap: 24px; margin-top: 16px; }
  @media print { body { margin: 0; } }
</style></head><body>
  <h1>Skin Theory</h1>
  <div class="muted">www.skintheorybd.shop</div>
  <div class="grid">
    <div><strong>Order ${escapeHtml(number)}</strong><br><span class="muted">${escapeHtml(date)}</span><br>
      Payment: ${payMethod === "cod" ? "Cash on Delivery" : escapeHtml(payMethod)}</div>
    <div>${addressText ? `<strong>Deliver to</strong><br>${addressText}` : ""}${email ? `<br>${escapeHtml(email)}` : ""}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}
      ${line("Subtotal", escapeHtml(formatPrice(totals.subtotal)))}
      ${totals.discount > 0 ? line(`Discount${totals.couponCode ? ` (${escapeHtml(totals.couponCode)})` : ""}`, `−${escapeHtml(formatPrice(totals.discount))}`) : ""}
      ${line("Delivery", totals.shipping > 0 ? escapeHtml(formatPrice(totals.shipping)) : "Free")}
      ${totals.tax > 0 ? line("Tax", escapeHtml(formatPrice(totals.tax))) : ""}
      <tr class="total"><td colspan="3">${payMethod === "cod" ? "Amount due" : "Total paid"}</td><td class="num">${escapeHtml(formatPrice(totals.total))}</td></tr>
    </tbody>
  </table>
  <p class="muted" style="margin-top:24px">Thank you for shopping with Skin Theory.</p>
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
