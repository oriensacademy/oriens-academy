-- Country-wide window ranking is a controlled maintenance operation over the
-- full catalog and can exceed the API role's short interactive statement limit.
alter function public.refresh_university_featured_ranks()
  set statement_timeout = '120s';
