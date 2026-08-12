/* =================================================================== *
 * skin.theory admin — coupons & flash sales
 * -------------------------------------------------------------------
 * Two kinds of coupon share one table, distinguished by `required_points`:
 *   • Manual coupons (required_points IS NULL) — anything the client makes.
 *   • Loyalty coupons (required_points set)    — unlock at a points
 *     milestone, shown on the Rewards page. Both kinds can be created,
 *     turned off, and (if unused) deleted the same way.
 * =================================================================== */
import { supabase } from "../client.js";

export const DISCOUNT_KINDS = [
  { id: "percent", label: "Percentage off" },
  { id: "fixed", label: "Fixed amount off" },
  { id: "free_shipping", label: "Free shipping" },
];

export async function listCoupons({ search = "", activeOnly = false } = {}) {
  let q = supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (search.trim()) q = q.ilike("code", `%${search.trim()}%`);
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  return { data, error };
}

export async function getCoupon(id) {
  const { data, error } = await supabase.from("coupons").select("*").eq("id", id).maybeSingle();
  return { data, error };
}

const COUPON_FIELDS = [
  "code", "kind", "value_minor", "value_percent", "also_free_shipping",
  "min_subtotal_minor", "max_discount_minor", "starts_at", "ends_at",
  "usage_limit", "usage_limit_per_customer", "first_order_only",
  "required_points", "applies_to", "is_active",
];

function pick(input) {
  const out = {};
  for (const k of COUPON_FIELDS) if (input[k] !== undefined) out[k] = input[k] === "" ? null : input[k];
  if (out.code) out.code = out.code.trim().toUpperCase();
  return out;
}

export async function saveCoupon(input) {
  const row = pick(input);
  if (input.id) {
    const { data, error } = await supabase
      .from("coupons").update(row).eq("id", input.id).select().single();
    return { data, error };
  }
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("coupons").insert({ ...row, created_by: userData?.user?.id ?? null }).select().single();
  return { data, error };
}

/** Deactivate rather than delete — a deleted coupon orphans its redemption
 *  rows and erases the record of discounts already given. */
export async function deactivateCoupon(id) {
  const { data, error } = await supabase
    .from("coupons").update({ is_active: false }).eq("id", id).select().single();
  return { data, error };
}

/** Hard delete — only ever safe for a coupon nobody has redeemed yet (the
 *  redemptions FK has no ON DELETE clause, so Postgres itself blocks this
 *  the moment a redemption row exists; that failure is translated into a
 *  message that points the admin at "Turn off" instead). */
export async function deleteCoupon(id) {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error?.code === "23503") {
    return { error: { message: "This coupon has already been used, so it can't be deleted — turn it off instead to keep the redemption history intact." } };
  }
  return { error };
}

export async function couponRedemptions(couponId, limit = 50) {
  const { data, error } = await supabase
    .from("coupon_redemptions")
    .select("id, discount_minor, created_at, order_id, orders(number, email)")
    .eq("coupon_id", couponId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
}

/** Suggest an unused code, e.g. "EID20". Checks the DB so the client can't
 *  create a duplicate and get a confusing unique-violation error. */
export async function suggestCode(base = "SALE") {
  const clean = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "SALE";
  const { data } = await supabase.from("coupons").select("code").ilike("code", `${clean}%`);
  const taken = new Set((data ?? []).map((r) => r.code.toUpperCase()));
  if (!taken.has(clean)) return clean;
  for (let i = 2; i < 100; i++) if (!taken.has(`${clean}${i}`)) return `${clean}${i}`;
  return `${clean}${Date.now().toString().slice(-4)}`;
}

/* ---------------------------------------------------------------- *
 * Flash / seasonal sales
 * ---------------------------------------------------------------- */

export async function listSales() {
  const { data, error } = await supabase
    .from("sales").select("*").order("starts_at", { ascending: false });
  return { data, error };
}

export async function saveSale(input) {
  const row = {
    name: input.name,
    kind: input.kind ?? "percent",
    value_percent: input.value_percent === "" ? null : input.value_percent,
    value_minor: input.value_minor === "" ? null : input.value_minor,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    scope: input.scope ?? { all: false, products: [], categories: [], brands: [] },
    banner_text: input.banner_text ?? null,
    badge_label: input.badge_label ?? null,
    image_path: input.image_path ?? null,
    show_countdown: input.show_countdown ?? true,
    priority: input.priority ?? 0,
    is_active: input.is_active ?? true,
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("sales").update(row).eq("id", input.id).select().single();
    return { data, error };
  }
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("sales").insert({ ...row, created_by: userData?.user?.id ?? null }).select().single();
  return { data, error };
}

export async function deactivateSale(id) {
  const { data, error } = await supabase
    .from("sales").update({ is_active: false }).eq("id", id).select().single();
  return { data, error };
}

/**
 * Which products would this sale actually touch, and at what price?
 * Shown as a preview before the client activates a campaign — the difference
 * between "20% off" and "20% off 340 products including the ones I sell at
 * cost" is the whole point.
 */
export async function previewSaleScope(scope, valuePercent) {
  let q = supabase.from("products")
    .select("id, name, brand, price_minor, compare_at_minor, category_id")
    .eq("status", "active");

  if (!scope?.all) {
    const ors = [];
    if (scope?.products?.length) ors.push(`id.in.(${scope.products.join(",")})`);
    if (scope?.categories?.length) ors.push(`category_id.in.(${scope.categories.join(",")})`);
    if (scope?.brands?.length) ors.push(`brand.in.(${scope.brands.map((b) => `"${b}"`).join(",")})`);
    if (!ors.length) return { data: [], error: null };
    q = q.or(ors.join(","));
  }

  const { data, error } = await q.limit(500);
  if (error) return { data: null, error };

  const pct = Number(valuePercent) || 0;
  return {
    data: data.map((p) => ({
      ...p,
      new_price_minor: Math.round(p.price_minor * (1 - pct / 100)),
    })),
    error: null,
  };
}
