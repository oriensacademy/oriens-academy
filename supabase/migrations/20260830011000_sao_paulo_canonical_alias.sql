insert into public.search_aliases(entity_type,entity_id,alias,normalized_alias,language,priority,source)
select 'UNIVERSITY',u.id,'São Paulo',public.normalize_university_search_text('São Paulo'),'pt',140,
  'reviewed USP city intent 2026-08-30'
from public.universities u where u.name='Universidade de São Paulo'
on conflict(entity_type,entity_id,normalized_alias) do update set
  priority=excluded.priority,source=excluded.source,updated_at=now();
