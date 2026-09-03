-- Migration: 20260904100000_blog_posts.sql
-- Description: Public TR/EN blog with admin-managed publish/draft/archive lifecycle.
-- Modeled directly on the existing testimonials table + RLS pattern
-- (20260811000000_init_schema.sql, 20260812220000_testimonials_grants.sql).

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 1 and 160),
  locale text not null check (locale in ('tr','en')),
  title text not null check (char_length(title) between 2 and 200),
  excerpt text not null check (char_length(excerpt) between 1 and 500),
  content text not null check (char_length(content) between 1 and 50000),
  cover_image_url text,
  author_name text check (author_name is null or char_length(author_name) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locale, slug)
);

create index if not exists idx_blog_posts_public_listing
  on public.blog_posts (locale, published_at desc)
  where status = 'published';

alter table public.blog_posts enable row level security;
alter table public.blog_posts force row level security;

grant select on table public.blog_posts to anon, authenticated;
grant select, insert, update, delete on table public.blog_posts to service_role;

drop policy if exists "Public published blog posts policy" on public.blog_posts;
create policy "Public published blog posts policy"
  on public.blog_posts for select
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "Admin blog posts policy" on public.blog_posts;
create policy "Admin blog posts policy"
  on public.blog_posts for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

comment on table public.blog_posts is
  'Public TR/EN blog posts. Anonymous/authenticated clients may only SELECT rows that are published and past their publish date; all writes require admin authorization via RLS.';
