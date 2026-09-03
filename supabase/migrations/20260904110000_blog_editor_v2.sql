-- Blog editor V2: scoped public media and server-clock publishing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-media',
  'blog-media',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public blog media read" on storage.objects;
create policy "Public blog media read" on storage.objects for select
using (bucket_id = 'blog-media');

drop policy if exists "Admin blog media insert" on storage.objects;
create policy "Admin blog media insert" on storage.objects for insert to authenticated
with check (bucket_id = 'blog-media' and public.is_admin());

drop policy if exists "Admin blog media update" on storage.objects;
create policy "Admin blog media update" on storage.objects for update to authenticated
using (bucket_id = 'blog-media' and public.is_admin())
with check (bucket_id = 'blog-media' and public.is_admin());

drop policy if exists "Admin blog media delete" on storage.objects;
create policy "Admin blog media delete" on storage.objects for delete to authenticated
using (bucket_id = 'blog-media' and public.is_admin());

create or replace function public.admin_publish_blog_post(
  p_post_id uuid,
  p_scheduled_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.blog_posts%rowtype;
  v_publish_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_post from public.blog_posts where id = p_post_id for update;
  if not found then return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND'); end if;
  if length(trim(v_post.title)) < 2 or length(trim(v_post.excerpt)) < 1 or length(trim(v_post.content)) < 1 then
    return jsonb_build_object('success', false, 'error_code', 'CONTENT_REQUIRED');
  end if;

  v_publish_at := case when p_scheduled_at is null or p_scheduled_at <= now() then now() else p_scheduled_at end;
  update public.blog_posts set status = 'published', published_at = v_publish_at where id = p_post_id;
  return jsonb_build_object('success', true, 'published_at', v_publish_at);
end;
$$;

revoke all on function public.admin_publish_blog_post(uuid, timestamptz) from public, anon;
grant execute on function public.admin_publish_blog_post(uuid, timestamptz) to authenticated, service_role;
