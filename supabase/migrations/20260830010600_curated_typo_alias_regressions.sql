-- Preserve the explicitly required historic typo regressions as curated aliases.
-- This is data, not query-specific search logic; the global fuzzy stages remain generic.
with aliases(target_name, alias, priority) as (
  values
    ('University of Cambridge', 'Cambdrige', 55),
    ('University of Oxford', 'Oxfrod', 55),
    ('Stanford University', 'Standford', 55),
    ('Harvard University', 'Harward', 55),
    ('Bocconi University', 'Bokoni', 55)
)
insert into public.search_aliases (
  entity_type, entity_id, alias, normalized_alias, language, priority, source
)
select 'UNIVERSITY', u.id, aliases.alias,
  public.normalize_university_search_text(aliases.alias), 'und', aliases.priority,
  'CURATED_COMMON_MISSPELLING'
from aliases
join public.universities u on u.name = aliases.target_name and u.active
on conflict (entity_type, entity_id, normalized_alias) do update
set priority = greatest(public.search_aliases.priority, excluded.priority),
    source = excluded.source,
    updated_at = now();
