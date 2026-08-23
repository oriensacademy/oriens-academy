-- Migration: 20260823090000_student_live_support_system.sql
-- Description: Realtime Student Support and Ticket System with strict RLS and trigger automation

-- 1. Support Threads Table
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 2 and 200),
  category text not null default 'general' check (category in ('general', 'academic', 'booking', 'homework', 'package', 'payment', 'technical', 'other')),
  status text not null default 'open' check (status in ('open', 'waiting_student', 'waiting_support', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  student_last_read_at timestamptz default now(),
  admin_last_read_at timestamptz
);

-- 2. Support Messages Table
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_type text not null check (sender_type in ('student', 'admin', 'system')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

-- 3. Indexes
create index if not exists idx_support_threads_student on public.support_threads(student_user_id, last_message_at desc);
create index if not exists idx_support_threads_status on public.support_threads(status, last_message_at desc);
create index if not exists idx_support_messages_thread on public.support_messages(thread_id, created_at asc);

-- 4. Triggers & Functions
create trigger trg_support_threads_updated_at before update on public.support_threads
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_support_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.sender_type = 'student' then
    update public.support_threads
    set
      last_message_at = new.created_at,
      updated_at = new.created_at,
      student_last_read_at = new.created_at,
      status = case when status = 'closed' then 'closed' else 'waiting_support' end
    where id = new.thread_id;
  elsif new.sender_type = 'admin' then
    update public.support_threads
    set
      last_message_at = new.created_at,
      updated_at = new.created_at,
      admin_last_read_at = new.created_at,
      status = case when status = 'closed' then 'closed' else 'waiting_student' end
    where id = new.thread_id;
  else
    update public.support_threads
    set
      last_message_at = new.created_at,
      updated_at = new.created_at
    where id = new.thread_id;
  end if;
  return new;
end;
$$;

create trigger trg_support_message_created after insert on public.support_messages
  for each row execute function public.handle_new_support_message();

-- 5. Row Level Security (RLS)
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

-- Student Policies
create policy "student_select_own_support_threads"
  on public.support_threads for select
  using (auth.uid() = student_user_id);

create policy "student_insert_own_support_threads"
  on public.support_threads for insert
  with check (auth.uid() = student_user_id);

create policy "student_select_own_support_messages"
  on public.support_messages for select
  using (
    exists (
      select 1 from public.support_threads t
      where t.id = support_messages.thread_id and t.student_user_id = auth.uid()
    )
  );

create policy "student_insert_own_support_messages"
  on public.support_messages for insert
  with check (
    sender_type = 'student'
    and sender_user_id = auth.uid()
    and exists (
      select 1 from public.support_threads t
      where t.id = thread_id and t.student_user_id = auth.uid() and t.status <> 'closed'
    )
  );

-- Admin Policies
create policy "admin_all_support_threads"
  on public.support_threads for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_all_support_messages"
  on public.support_messages for all
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Realtime Publication
alter publication supabase_realtime add table public.support_threads;
alter publication supabase_realtime add table public.support_messages;
