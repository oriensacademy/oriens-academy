-- Reviewed high-value institution/city intent aliases; identity remains the ROR university row.
insert into public.search_aliases(entity_type,entity_id,alias,normalized_alias,language,priority,source)
select 'UNIVERSITY',u.id,v.alias,public.normalize_university_search_text(v.alias),v.language,120,
  'reviewed search golden set 2026-08-30'
from (values
  ('University of São Paulo','São Paulo','pt'),
  ('Istanbul Technical University','İstanbul Teknik Üniversitesi','tr'),
  ('National University of Singapore','NUS','en')
) v(university_name,alias,language)
join public.universities u on u.name=v.university_name
on conflict(entity_type,entity_id,normalized_alias) do update set
  priority=excluded.priority,source=excluded.source,updated_at=now();
