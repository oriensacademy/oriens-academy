-- Migration: 20260904120000_blog_content_json.sql
-- Description: Adds structured block-editor content storage for the blog
-- visual block editor (V3). Additive only -- no data rewritten, nothing
-- dropped. Legacy Markdown posts keep content_json = null and continue to
-- render via the existing `content` column / renderBlogMarkdown fallback.
-- No RLS/grant changes needed: column-level grants inherit from the existing
-- table-level `grant select on table public.blog_posts` (20260904100000).

alter table public.blog_posts add column if not exists content_json jsonb;

comment on column public.blog_posts.content_json is
  'Structured block-based editor content (canonical for posts authored in the visual block editor). NULL for legacy Markdown-only posts, which the public renderer falls back to rendering from `content` instead.';
