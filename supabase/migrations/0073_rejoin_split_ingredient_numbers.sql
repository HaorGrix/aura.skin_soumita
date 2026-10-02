-- =====================================================================
-- 0073 — rejoin ingredient amounts split at the thousands comma
-- ---------------------------------------------------------------------
-- The admin's ingredient field split on every comma, so "Salicylic Acid
-- 5,000 ppm" was stored as two ingredients ("Salicylic Acid 5" and
-- "000 ppm") and the product page read "5, 000 ppm". The field no longer
-- splits there; this rejoins the entries already stored. Idempotent.
-- =====================================================================

create or replace function pg_temp.rejoin_thousands(p text[]) returns text[]
language plpgsql immutable as $$
declare out text[] := '{}'; item text;
begin
  foreach item in array coalesce(p, '{}') loop
    if cardinality(out) > 0 and item ~ '^\d{3}' and out[cardinality(out)] ~ '\d$' then
      out[cardinality(out)] := out[cardinality(out)] || ',' || item;
    else
      out := out || item;
    end if;
  end loop;
  return out;
end $$;

update public.products
   set ingredients = pg_temp.rejoin_thousands(ingredients)
 where ingredients is distinct from pg_temp.rejoin_thousands(ingredients);
