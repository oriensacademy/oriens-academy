-- The homework notification Edge Function reads assignment content with the
-- trusted service role. Keep the grant read-only and limited to the one new
-- table the function needs; student profiles/homework already have SELECT.
grant select on table public.homework_assignments to service_role;
