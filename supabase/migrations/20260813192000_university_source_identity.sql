alter table public.universities
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists ror_id text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create unique index if not exists idx_universities_external_identity
  on public.universities(external_source, external_id);

create index if not exists idx_universities_ror_id
  on public.universities(ror_id)
  where ror_id is not null;

create unique index if not exists idx_search_aliases_entity_term_unique
  on public.search_aliases(entity_type, entity_id, normalized_alias);

comment on column public.universities.external_source is
  'Discovery metadata source; not an admissions-claim source.';
comment on column public.universities.external_id is
  'Stable identifier assigned by external_source.';
