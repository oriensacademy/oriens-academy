-- Repair the browser-role ACL for the admin-managed blog.
-- RLS remains the row-level authority: public reads are published-only and
-- authenticated writes still require public.is_admin().

revoke all privileges on table public.blog_posts from anon, authenticated;

grant select on table public.blog_posts to anon;
grant select, insert, update on table public.blog_posts to authenticated;
