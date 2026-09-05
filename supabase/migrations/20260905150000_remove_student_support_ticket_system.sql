-- Migration: 20260905150000_remove_student_support_ticket_system.sql
--
-- Removes the legacy student support/ticket system (20260823090000_student_live_support_system.sql).
--
-- Scope boundary -- three separate systems, only one is removed:
--   A) Public contact form (contact_requests / contact_replies / create-contact /
--      send-contact-reply / Admin -> Iletisim) ....... KEPT, business requirement.
--   B) Student support ticket system (support_threads / support_messages /
--      send-support-email / Student Portal "Destek" / Admin "Ogrenci Destek") ... REMOVED here.
--   C) Admin "Iletisim & Destek" module ............. reduced to (A) only.
--
-- Verified empty before removal: support_threads = 0 rows, support_messages = 0 rows
-- (production read-only preflight, 2026-09-05). No SQL function or trigger outside
-- this system references either table.

-- Realtime publication membership must be dropped before the tables are.
do $pub$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
    ) then
      execute 'alter publication supabase_realtime drop table public.support_messages';
    end if;
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_threads'
    ) then
      execute 'alter publication supabase_realtime drop table public.support_threads';
    end if;
  end if;
end;
$pub$;

drop trigger if exists trg_support_message_created on public.support_messages;
drop trigger if exists trg_support_threads_updated_at on public.support_threads;

drop table if exists public.support_messages cascade;
drop table if exists public.support_threads cascade;

drop function if exists public.handle_new_support_message();

-- notification.support_email is intentionally retained: it is the internal
-- recipient for admin appointment notifications (dispatchAppointmentConfirmedEmails),
-- not part of the student ticket system.
