-- Migration: 20260823180000_student_homework_submission_attachments.sql
-- Description: Add student submission attachment columns and allow authenticated students to upload attachments to homework-attachments bucket

-- 1. Add submission attachment columns to student_homework
alter table public.student_homework
  add column if not exists submission_attachment_path text,
  add column if not exists submission_attachment_name text,
  add column if not exists submission_attachment_size bigint,
  add column if not exists submission_attachment_mime text;

-- 2. Storage Policies for Student Submission Attachments
drop policy if exists "Student upload own homework attachments" on storage.objects;
create policy "Student upload own homework attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'homework-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Student update own homework attachments" on storage.objects;
create policy "Student update own homework attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'homework-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Student delete own homework attachments" on storage.objects;
create policy "Student delete own homework attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'homework-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
