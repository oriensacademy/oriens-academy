-- Qualify window-order columns inside the PL/pgSQL wrapper because RETURNS TABLE
-- output names are also variables in PL/pgSQL scope.
do $$
declare
  function_definition text;
  corrected_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.search_autocomplete_entities(text,integer)'::regprocedure
  );
  corrected_definition := replace(
    function_definition,
    'partition by entity_type order by match_layer, score desc, title',
    'partition by combined.entity_type order by combined.match_layer, combined.score desc, combined.title'
  );
  if corrected_definition = function_definition then
    raise exception 'Expected autocomplete window-order expression was not found';
  end if;
  execute corrected_definition;
end $$;
