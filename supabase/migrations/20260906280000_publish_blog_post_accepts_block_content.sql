-- Migration: 20260906280000_publish_blog_post_accepts_block_content.sql
--
-- admin_publish_blog_post() gated publishing on the legacy `content` column
-- being non-blank. Since the visual block editor shipped, `content` is only a
-- derived plain-text fallback: deriveLegacyContentFallback() returns a single
-- space when no block carries text, and the DB CHECK on blog_posts.content
-- forces that space to be stored. trim(' ') is '', so a perfectly valid
-- image-only or gallery-only post failed the gate and the editor surfaced the
-- raw code "CONTENT_REQUIRED".
--
-- The real content of a modern post is content_json. This makes that the
-- source of truth for the gate: a post with at least one block may publish,
-- and the legacy column is only consulted for older Markdown posts that have
-- no content_json. Title/excerpt now report distinct codes so the editor can
-- say which field is missing instead of one catch-all message.

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
  v_block_count integer;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_post from public.blog_posts where id = p_post_id for update;
  if not found then return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND'); end if;

  if length(trim(coalesce(v_post.title, ''))) < 2 then
    return jsonb_build_object('success', false, 'error_code', 'TITLE_REQUIRED');
  end if;

  if length(trim(coalesce(v_post.excerpt, ''))) < 1 then
    return jsonb_build_object('success', false, 'error_code', 'EXCERPT_REQUIRED');
  end if;

  -- jsonb_array_length errors on a non-array, so only ask when it is one.
  v_block_count := case
    when jsonb_typeof(v_post.content_json -> 'blocks') = 'array'
      then jsonb_array_length(v_post.content_json -> 'blocks')
    else 0
  end;

  if v_block_count = 0 and length(trim(coalesce(v_post.content, ''))) < 1 then
    return jsonb_build_object('success', false, 'error_code', 'CONTENT_REQUIRED');
  end if;

  v_publish_at := case when p_scheduled_at is null or p_scheduled_at <= now() then now() else p_scheduled_at end;
  update public.blog_posts set status = 'published', published_at = v_publish_at where id = p_post_id;
  return jsonb_build_object('success', true, 'published_at', v_publish_at);
end;
$$;

revoke all on function public.admin_publish_blog_post(uuid, timestamptz) from public, anon;
grant execute on function public.admin_publish_blog_post(uuid, timestamptz) to authenticated, service_role;
