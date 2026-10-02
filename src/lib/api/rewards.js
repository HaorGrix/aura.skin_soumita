/* =================================================================== *
 * skin.theory — Rewards programme (storefront side)
 * -------------------------------------------------------------------
 * Everything here is set in Admin → Rewards:
 *   • on/off and programme name   (store_settings.rewards_enabled/_name)
 *   • earn rates                  (points_per_taka, points_per_review)
 *   • reward tiers                (coupons with required_points, via
 *                                  list_reward_tiers(), 0070)
 * Nothing about the programme is hardcoded on the storefront any more.
 * =================================================================== */
import { useEffect, useMemo, useState } from "react";
import { useStoreSettings } from "./settings.js";
import { CONVERSION_RATE } from "../format.js";

let tiersCache = null;
let tiersInflight = null;

/** "3% off", "৳100 off", "Free shipping" — the reward a tier gives. */
function describe(t) {
  const parts = [];
  if (t.kind === "percent" && Number(t.value_percent) > 0) parts.push(`${Number(t.value_percent)}% off`);
  else if (t.kind === "fixed" && t.value_minor > 0) parts.push(`৳${Math.round(t.value_minor / 100)} off`);
  if (t.kind === "free_shipping" || t.also_free_shipping) parts.push(parts.length ? "free shipping" : "Free shipping");
  return parts.join(" + ") || t.code;
}

function mapTier(t) {
  return {
    code: t.code,
    points: t.required_points,
    short: t.label?.trim() || describe(t),
    reward: t.label?.trim() || describe(t),
    freeShipping: t.kind === "free_shipping" || !!t.also_free_shipping,
  };
}

/** Active reward tiers, lowest first. Never throws; [] on failure. */
export async function getRewardTiers() {
  if (tiersCache) return tiersCache;
  if (tiersInflight) return tiersInflight;
  tiersInflight = (async () => {
    try {
      const { supabase } = await import("./client.js");
      const { data, error } = await supabase.rpc("list_reward_tiers");
      if (error) throw error;
      tiersCache = (data ?? []).map(mapTier);
    } catch (err) {
      console.error("[rewards] couldn't load reward tiers:", err);
      tiersCache = [];
    } finally {
      tiersInflight = null;
    }
    return tiersCache;
  })();
  return tiersInflight;
}

export function useRewardTiers() {
  const [tiers, setTiers] = useState(() => tiersCache ?? []);
  useEffect(() => {
    let alive = true;
    getRewardTiers().then((t) => { if (alive) setTiers(t); });
    return () => { alive = false; };
  }, []);
  return tiers;
}

/** Points a purchase of `total` (cart/legacy price units) earns. */
export function pointsForPurchase(total, { enabled, pointsPerTaka }) {
  if (!enabled || !(pointsPerTaka > 0)) return 0;
  return Math.max(0, Math.floor((Number(total) || 0) * CONVERSION_RATE * pointsPerTaka));
}

/** "1 point for every ৳1000 spent" / "2 points for every ৳1 spent". */
export function spendRateText(pointsPerTaka) {
  if (!(pointsPerTaka > 0)) return null;
  if (pointsPerTaka >= 1) return `${+pointsPerTaka.toFixed(2)} point${pointsPerTaka === 1 ? "" : "s"} for every ৳1 spent`;
  return `1 point for every ৳${Math.round(1 / pointsPerTaka)} spent`;
}

/** The whole programme as one object for components. */
export function useRewards() {
  const s = useStoreSettings();
  const tiers = useRewardTiers();
  const enabled = s.rewardsEnabled !== false;
  const name = s.rewardsName || `${s.storeName} Rewards`;
  return useMemo(() => ({
    enabled,
    name,
    pointsPerTaka: s.pointsPerTaka,
    pointsPerReview: s.pointsPerReview,
    earnsOnSpend: enabled && s.pointsPerTaka > 0,
    earnsOnReview: enabled && s.pointsPerReview > 0,
    spendText: spendRateText(s.pointsPerTaka),
    tiers: enabled ? tiers : [],
  }), [enabled, name, s.pointsPerTaka, s.pointsPerReview, tiers]);
}
