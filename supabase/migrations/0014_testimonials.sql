-- ===================================================================
-- skin.theory — dual-mode testimonials (text quote OR single image)
-- -------------------------------------------------------------------
-- One table, two shapes, distinguished by `type`:
--   'text'  — customer_name, quote_text, rating, duration_label
--             (the classic flower-icon quote card)
--   'image' — image_url only — a single admin-uploaded graphic (e.g. a
--             collage of review screenshots) that replaces the card's
--             entire content, no quote/star overlay on top
--
-- Storage: images go in the existing `site-media` bucket (0011) under a
-- testimonials/ prefix — no new bucket, no new policy needed; that
-- bucket already allows JPEG/PNG up to 30MB with staff-only write, which
-- comfortably covers this feature's 2MB cap (enforced client-side).
--
-- Rotation, since there's no prior "Option A" spec in this history to
-- match against — documenting the choice made here:
--   `is_featured` is the eligibility pool (same idea as products.status
--   or categories.is_active elsewhere in this schema) — an entry must be
--   featured to ever appear on the homepage at all.
--   "Weekly rotation" picks exactly ONE entry per week from that pool:
--   text entries ranked by rating desc, image entries by priority desc
--   then created_at desc, merged into one ordered list, and the ISO week
--   number indexes into it (wrapping around). Deterministic and
--   stateless — every visitor in the same week sees the same testimonial,
--   with no cron job or scheduled function required. The actual index
--   maths lives in the storefront reader (lib/api/testimonials.js), not
--   here — this migration only sets up the ranking each type needs.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

create table if not exists public.testimonials (
  id             uuid primary key default gen_random_uuid(),
  type           text not null default 'text' check (type in ('text', 'image')),

  -- type = 'text'
  customer_name  text,
  quote_text     text,
  rating         numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  duration_label text,   -- e.g. "Using for 3 months"

  -- type = 'image'
  image_url      text,   -- storage path under site-media, e.g. testimonials/<uuid>.jpg

  -- shared
  is_featured    boolean not null default false,
  priority       int not null default 0,  -- manual tie-break / image-mode ordering
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users on delete set null,

  constraint testimonials_type_fields check (
    (type = 'text'  and customer_name is not null and quote_text is not null and image_url is null)
    or
    (type = 'image' and image_url is not null and quote_text is null and customer_name is null)
  )
);

create index if not exists testimonials_featured_idx
  on public.testimonials (is_featured, type, rating desc, priority desc, created_at desc);

alter table public.testimonials enable row level security;

-- Public/storefront: only the featured pool is ever exposed. Unfeatured
-- drafts, retired testimonials, etc. stay invisible to anon/authenticated
-- shoppers — same principle as products_public vs. the base products table.
drop policy if exists testimonials_public_read on public.testimonials;
create policy testimonials_public_read on public.testimonials
  for select using (is_featured = true);

-- Staff: full visibility + write, editor level (same bar as content_blocks —
-- this is storefront copy/imagery, not a commerce-sensitive table).
drop policy if exists testimonials_staff_read on public.testimonials;
create policy testimonials_staff_read on public.testimonials
  for select using (public.is_staff('editor'));

drop policy if exists testimonials_staff_write on public.testimonials;
create policy testimonials_staff_write on public.testimonials
  for all using (public.is_staff('editor')) with check (public.is_staff('editor'));

-- Audit trail + updated_at bookkeeping, consistent with every other
-- staff-editable table in this schema.
drop trigger if exists testimonials_audit on public.testimonials;
create trigger testimonials_audit
  after insert or update or delete on public.testimonials
  for each row execute function public.write_audit();

create or replace function public.testimonials_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists testimonials_touch on public.testimonials;
create trigger testimonials_touch
  before update on public.testimonials
  for each row execute function public.testimonials_touch_updated_at();

-- -------------------------------------------------------------------
-- VERIFY
-- -------------------------------------------------------------------
--   insert into testimonials (type, customer_name, quote_text, rating, duration_label, is_featured)
--     values ('text', 'Test User', 'Great products!', 5, 'Using for 2 months', true);
--   select * from testimonials;                          -- staff: all rows
--   -- as anon (REST): /rest/v1/testimonials?select=*     -- only is_featured=true rows
