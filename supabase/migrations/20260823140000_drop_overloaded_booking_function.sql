-- Drop obsolete 11-parameter overload of admin_create_student_booking to prevent PostgREST ambiguous candidate error
drop function if exists public.admin_create_student_booking(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, text);

-- Ensure 12-parameter version is explicitly granted
grant execute on function public.admin_create_student_booking(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, text, text) to authenticated;
grant execute on function public.admin_create_student_booking(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, text, text) to service_role;
