/* =================================================================== *
 * skin.theory admin — CMS content blocks
 * -------------------------------------------------------------------
 * Each editable region of the storefront is one row in `content_blocks`,
 * keyed by a slot id, holding a JSONB payload. The client never sees JSON:
 * `schemas.js` declares the fields per slot and the editor renders a typed
 * form from that declaration.
 *
 * A BEFORE UPDATE trigger snapshots the previous payload into
 * content_revisions, so every save is undoable.
 * =================================================================== */
import { supabase } from "../client.js";
import { SLOTS, defaultsFor } from "./schemas.js";

// Re-exported for the existing admin call sites that import it from here.
// The implementation lives in schemas.js so the storefront can use it without
// pulling in the Supabase SDK.
export { defaultsFor };

/** All blocks, merged with their schema definitions so the UI can list
 *  slots that exist in code but have never been saved to the DB yet. */
export async function listBlocks() {
  const { data, error } = await supabase
    .from("content_blocks").select("slot, payload, updated_at, updated_by");
  if (error) return { data: null, error };

  const bySlot = Object.fromEntries((data ?? []).map((r) => [r.slot, r]));
  const merged = SLOTS.map((schema) => ({
    ...schema,
    payload: bySlot[schema.slot]?.payload ?? defaultsFor(schema),
    updatedAt: bySlot[schema.slot]?.updated_at ?? null,
    exists: !!bySlot[schema.slot],
  }));
  return { data: merged, error: null };
}

export async function getBlock(slot) {
  const schema = SLOTS.find((s) => s.slot === slot);
  const { data, error } = await supabase
    .from("content_blocks").select("*").eq("slot", slot).maybeSingle();
  if (error) return { data: null, error };

  return {
    data: {
      schema,
      payload: data?.payload ?? defaultsFor(schema),
      updatedAt: data?.updated_at ?? null,
      exists: !!data,
    },
    error: null,
  };
}

export async function saveBlock(slot, payload) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("content_blocks")
    .upsert(
      { slot, payload, updated_by: userData?.user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: "slot" }
    )
    .select()
    .single();
  return { data, error };
}

export async function listRevisions(slot, limit = 20) {
  const { data, error } = await supabase
    .from("content_revisions")
    .select("id, payload, created_at, actor_id")
    .eq("slot", slot)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
}

/** Restore is just a normal save of an old payload — which itself snapshots
 *  the current one, so restoring is undoable too. */
export async function restoreRevision(slot, revisionId) {
  const { data: rev, error } = await supabase
    .from("content_revisions").select("payload").eq("id", revisionId).single();
  if (error) return { data: null, error };
  return saveBlock(slot, rev.payload);
}

