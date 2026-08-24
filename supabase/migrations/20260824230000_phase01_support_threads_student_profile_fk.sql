-- Migration: 20260824230000_phase01_support_threads_student_profile_fk.sql
-- Description: Establish explicit foreign key between support_threads and student_profiles for PostgREST resource joins

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_support_threads_student_profile'
    and table_name = 'support_threads'
  ) then
    alter table public.support_threads
      add constraint fk_support_threads_student_profile
      foreign key (student_user_id) references public.student_profiles(id)
      on delete cascade;
  end if;
end $$;

-- Ensure grants for authenticated and service_role
grant select, insert, update on public.support_threads to authenticated;
grant select, insert, update on public.support_messages to authenticated;
grant all on public.support_threads to service_role;
grant all on public.support_messages to service_role;
