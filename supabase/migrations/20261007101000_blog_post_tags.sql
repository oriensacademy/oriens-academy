-- Blog yazısı etiketleri (referans blog düzenleyicisi: "Etiketler (virgülle)").
-- Additive: varsayılanı boş dizi olan tek kolon. Mevcut yazılar değişmez,
-- backfill yok. Yazma yetkisi mevcut blog_posts RLS politikalarından gelir.

alter table public.blog_posts
  add column if not exists tags text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'blog_posts_tags_limits'
      and conrelid = 'public.blog_posts'::regclass
  ) then
    alter table public.blog_posts
      add constraint blog_posts_tags_limits
      check (coalesce(array_length(tags, 1), 0) <= 12 and char_length(array_to_string(tags, ',')) <= 400);
  end if;
end $$;
