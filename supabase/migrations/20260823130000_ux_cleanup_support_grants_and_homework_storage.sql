-- Migration: 20260823130000_ux_cleanup_support_grants_and_homework_storage.sql
-- Description: Fix support_threads permissions, student preferences grants, homework attachments storage & metadata

-- 1. Support Threads & Messages Grants & Student Update Policy
grant select, insert, update on public.support_threads to authenticated;
grant select, insert, update on public.support_messages to authenticated;
grant all on public.support_threads to service_role;
grant all on public.support_messages to service_role;

-- Allow students to update student_last_read_at (and optionally status) on their own threads
drop policy if exists "student_update_own_support_threads" on public.support_threads;
create policy "student_update_own_support_threads"
  on public.support_threads for update
  to authenticated
  using (auth.uid() = student_user_id)
  with check (auth.uid() = student_user_id);

-- 2. Student Preferences RPC & Table Grants
grant execute on function public.save_student_preferences(uuid, text[], text[], boolean) to authenticated, service_role;
grant select, insert, update, delete on public.student_exam_preferences to authenticated, service_role;
grant select, insert, update, delete on public.student_destination_preferences to authenticated, service_role;

-- 3. Homework Attachments Schema Enhancement
alter table public.student_homework
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_size bigint,
  add column if not exists attachment_mime text;

-- 4. Supabase Storage Bucket for Homework Attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homework-attachments',
  'homework-attachments',
  false,
  20971520, -- 20 MB limit
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
) on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp'
  ];

-- Storage RLS Policies
drop policy if exists "Admin manage homework attachments" on storage.objects;
create policy "Admin manage homework attachments"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'homework-attachments' and public.is_admin())
  with check (bucket_id = 'homework-attachments' and public.is_admin());

drop policy if exists "Student read own homework attachments" on storage.objects;
create policy "Student read own homework attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'homework-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.student_homework h
        where h.student_user_id = auth.uid()
        and (h.attachment_path = storage.objects.name or h.attachment_path = storage.objects.id::text)
      )
    )
  );
