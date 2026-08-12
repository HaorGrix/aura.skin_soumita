-- ===================================================================
-- skin.theory — fix normalize_bd_phone(): it normalized NOTHING
-- -------------------------------------------------------------------
-- FOUND during live testing of 0026 immediately after the client applied
-- it: normalize_bd_phone() returned NULL for every real BD number,
-- including the exact examples in 0026's own VERIFY block.
--
-- ROOT CAUSE
-- BD mobile numbers are "0" + "1" + operator-digit[3-9] + 8 digits — the
-- "1" right after the trunk "0" is a FIXED, MANDATORY character (every
-- Bangladeshi mobile prefix is 013/014/015/016/017/018/019), not part of
-- the operator digit itself. 0026's patterns were:
--     ^0[3-9]\d{9}$      (local)   — wrong: tests the digit AFTER "0"
--                                    against [3-9], skipping the "1"
--     ^880[3-9]\d{9}$    (country) — same mistake, missing the "1"
-- So "01712345678" (0-1-7-...) was tested against "0" then immediately
-- [3-9] — but the actual second character is "1", which isn't in [3-9],
-- so the pattern never matched and every branch fell through to NULL.
--
-- This is exactly the class of bug 0011/0004 in this project's own
-- history were about: shipping a regex that looks right but was never
-- run against a real value. Caught here specifically BECAUSE 0026 was
-- tested live before being called done, rather than only built and
-- assumed correct — see the report accompanying this migration for the
-- full self-test (9 cases, plain JS, before this SQL was even written).
--
-- FIX: match "01"/"8801" as a literal two/four-character prefix, THEN
-- the operator digit, mirroring components/ui/PhoneInput.jsx's
-- BD_PHONE_REGEX exactly: /^(?:\+8801|8801|01)[3-9]\d{8}$/.
--
-- Nothing else from 0026 changes — coupon_phone_redemptions,
-- place_order(), and set_order_status() only ever CALL this function,
-- none of them duplicate its pattern, so this one-function replacement
-- is the complete fix.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

create or replace function public.normalize_bd_phone(raw text)
returns text
language sql immutable as $$
  select case
    -- already 8801 + operator digit + 8 digits = 13 chars
    when regexp_replace(coalesce(raw, ''), '\D', '', 'g') ~ '^8801[3-9]\d{8}$'
      then regexp_replace(raw, '\D', '', 'g')
    -- local: 01 + operator digit + 8 digits = 11 chars -> drop the leading
    -- "0", prepend "880" (the "1" stays — it's not the digit we dropped)
    when regexp_replace(coalesce(raw, ''), '\D', '', 'g') ~ '^01[3-9]\d{8}$'
      then '880' || substring(regexp_replace(raw, '\D', '', 'g') from 2)
    -- bare subscriber number, no leading 0 or country code: already
    -- starts with the mandatory "1" + operator digit + 8 digits = 10 chars
    when regexp_replace(coalesce(raw, ''), '\D', '', 'g') ~ '^1[3-9]\d{8}$'
      then '880' || regexp_replace(raw, '\D', '', 'g')
    else null
  end;
$$;

-- -------------------------------------------------------------------
-- VERIFY — run all of these; every "before" value in 0026's own VERIFY
-- block was actually broken, so re-check them here:
--   select normalize_bd_phone('+880 171-234-5678');  -- '8801712345678'
--   select normalize_bd_phone('8801712345678');       -- '8801712345678'
--   select normalize_bd_phone('01712345678');         -- '8801712345678'
--   select normalize_bd_phone('1712345678');          -- '8801712345678'
--   select normalize_bd_phone('019 1234 5678');       -- '8801912345678'
--   select normalize_bd_phone('not a phone');         -- null
--   select normalize_bd_phone('012345678');           -- null (013-019 only)
--   select normalize_bd_phone('0171234567');          -- null (too short)
-- -------------------------------------------------------------------
