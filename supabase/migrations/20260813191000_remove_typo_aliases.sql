-- Typographical variants belong to the fuzzy match layer, not the canonical
-- alias layer. Established names/acronyms remain untouched.
delete from public.search_aliases
where entity_type = 'UNIVERSITY'
  and normalized_alias in ('oxfor', 'oxfrod', 'cambrige', 'cambrdge');
