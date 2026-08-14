-- ===================================================================
-- skin.theory — Journal / blog CMS
-- -------------------------------------------------------------------
-- Replaces the hardcoded ARTICLES arrays in components/home/Journal.jsx
-- and pages/Articles.jsx with a real, admin-manageable table. One row
-- per article; `status` gates storefront visibility exactly like
-- products.status / categories.is_active elsewhere in this schema —
-- 'draft' rows exist only for admin preview, 'published' is what
-- shoppers can ever see.
--
-- `body_html` is Tiptap's HTML output, sanitized with DOMPurify at
-- render time on the storefront (untrusted-HTML-in, sanitize-on-render
-- is safer than sanitize-on-write since the sanitizer's allowlist can
-- evolve without a data migration).
--
-- `read_minutes` is nullable so the admin can leave it to auto-calculate
-- from word count (done client-side at save time) or override it by
-- hand — same "computed unless the admin overrides it" shape as
-- suggestCode() elsewhere, just simpler (no round trip needed).
--
-- Storage: cover + inline body images go in the existing `site-media`
-- bucket (0011) under a journal/ prefix — no new bucket or policy
-- needed, same reasoning as 0014_testimonials.sql.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create table if not exists public.journal_articles (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  slug           text not null unique,
  excerpt        text,
  body_html      text not null default '',
  cover_image    text,   -- storage path under site-media, e.g. journal/<uuid>.jpg
  category       text not null,
  read_minutes   int,    -- null = derive from word count on the storefront
  status         text not null default 'draft' check (status in ('draft', 'published')),
  published_at   timestamptz,
  author_name    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users on delete set null
);

-- Storefront reads: published articles, newest first. Admin list reads
-- everything, so this index is shaped for the public query specifically.
create index if not exists journal_articles_public_idx
  on public.journal_articles (status, published_at desc);

create index if not exists journal_articles_category_idx
  on public.journal_articles (category) where status = 'published';

alter table public.journal_articles enable row level security;

-- Public/storefront: only published articles are ever exposed. Drafts
-- stay invisible to anon/authenticated shoppers — enforced in Postgres,
-- not just hidden by the UI.
drop policy if exists journal_articles_public_read on public.journal_articles;
create policy journal_articles_public_read on public.journal_articles
  for select using (status = 'published');

-- Staff: full visibility + write, editor level (same bar as testimonials
-- and content_blocks — storefront copy/imagery, not commerce-sensitive).
drop policy if exists journal_articles_staff_read on public.journal_articles;
create policy journal_articles_staff_read on public.journal_articles
  for select using (public.is_staff('editor'));

drop policy if exists journal_articles_staff_write on public.journal_articles;
create policy journal_articles_staff_write on public.journal_articles
  for all using (public.is_staff('editor')) with check (public.is_staff('editor'));

-- Audit trail + updated_at bookkeeping, consistent with every other
-- staff-editable table in this schema.
drop trigger if exists journal_articles_audit on public.journal_articles;
create trigger journal_articles_audit
  after insert or update or delete on public.journal_articles
  for each row execute function public.write_audit();

create or replace function public.journal_articles_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists journal_articles_touch on public.journal_articles;
create trigger journal_articles_touch
  before update on public.journal_articles
  for each row execute function public.journal_articles_touch_updated_at();

-- -------------------------------------------------------------------
-- VERIFY
-- -------------------------------------------------------------------
--   insert into journal_articles (title, slug, excerpt, body_html, category, status, published_at)
--     values ('Test Article', 'test-article', 'A short excerpt.', '<p>Body</p>', 'Routine', 'published', now());
--   select * from journal_articles;                          -- staff: all rows
--   -- as anon (REST): /rest/v1/journal_articles?select=*     -- only status=published rows
-- -------------------------------------------------------------------
