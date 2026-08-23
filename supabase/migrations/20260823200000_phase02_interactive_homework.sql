-- Phase 02: interactive homework definitions, questions, answers and attachments.
-- Existing student_homework rows remain the per-student history.

create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text not null default '',
  lesson_id uuid references public.student_lessons(id) on delete set null,
  due_date timestamptz,
  external_link text check (external_link is null or external_link ~* '^https?://'),
  instructor_note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_homework
  add column if not exists assignment_id uuid references public.homework_assignments(id) on delete restrict,
  add column if not exists draft_saved_at timestamptz,
  add column if not exists reopened_at timestamptz,
  add column if not exists reviewed_at timestamptz;

insert into public.homework_assignments(id,title,description,lesson_id,due_date,external_link,instructor_note,created_by,created_at,updated_at)
select h.id,h.title,h.description,h.lesson_id,h.due_date,
       case when h.assignment_file_url ~* '^https?://' then h.assignment_file_url else null end,null,
       coalesce((select user_id from public.admin_profiles where active order by created_at limit 1), h.student_user_id),
       h.created_at,h.updated_at
from public.student_homework h
where h.assignment_id is null
on conflict (id) do nothing;

update public.student_homework set assignment_id=id where assignment_id is null;
alter table public.student_homework alter column assignment_id set not null;

update public.student_homework set status='reviewed' where status='completed';
update public.student_homework set status='overdue' where status='late';
alter table public.student_homework drop constraint if exists student_homework_status_check;
alter table public.student_homework add constraint student_homework_status_check
  check (status in ('assigned','in_progress','submitted','reviewed','overdue'));

create table if not exists public.homework_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  position integer not null check (position >= 0),
  question_type text not null check (question_type in ('multiple_choice','short_answer','long_answer')),
  prompt text not null check (char_length(btrim(prompt)) > 0),
  reference_answer text,
  explanation text,
  created_at timestamptz not null default now(),
  unique(assignment_id,position)
);

create table if not exists public.homework_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.homework_questions(id) on delete cascade,
  option_key text not null check (option_key in ('A','B','C','D')),
  option_text text not null check (char_length(btrim(option_text)) > 0),
  is_correct boolean not null default false,
  unique(question_id,option_key)
);

create unique index if not exists uq_homework_question_one_correct_option
  on public.homework_question_options(question_id) where is_correct;

create table if not exists public.homework_student_answers (
  id uuid primary key default gen_random_uuid(),
  student_homework_id uuid not null references public.student_homework(id) on delete cascade,
  question_id uuid not null references public.homework_questions(id) on delete cascade,
  answer_text text,
  selected_option_id uuid references public.homework_question_options(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_homework_id,question_id)
);

create table if not exists public.homework_attachments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.homework_assignments(id) on delete cascade,
  student_homework_id uuid references public.student_homework(id) on delete cascade,
  attachment_kind text not null check (attachment_kind in ('resource','submission')),
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size between 1 and 20971520),
  mime_type text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (
    (attachment_kind='resource' and assignment_id is not null and student_homework_id is null)
    or (attachment_kind='submission' and student_homework_id is not null and assignment_id is null)
  )
);

create index if not exists idx_student_homework_assignment on public.student_homework(assignment_id);
create index if not exists idx_homework_questions_assignment on public.homework_questions(assignment_id,position);
create index if not exists idx_homework_answers_homework on public.homework_student_answers(student_homework_id);
create index if not exists idx_homework_attachments_assignment on public.homework_attachments(assignment_id);

alter table public.homework_assignments enable row level security;
alter table public.homework_questions enable row level security;
alter table public.homework_question_options enable row level security;
alter table public.homework_student_answers enable row level security;
alter table public.homework_attachments enable row level security;

create policy "Admin manage homework assignments" on public.homework_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manage homework questions" on public.homework_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manage homework options" on public.homework_question_options for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manage homework answers" on public.homework_student_answers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Student read own homework answers" on public.homework_student_answers for select to authenticated
  using (exists(select 1 from public.student_homework h where h.id=student_homework_id and h.student_user_id=auth.uid()));
create policy "Admin manage homework attachment rows" on public.homework_attachments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Student read own homework attachment rows" on public.homework_attachments for select to authenticated
  using (exists(select 1 from public.student_homework h where h.student_user_id=auth.uid() and (h.id=student_homework_id or h.assignment_id=assignment_id)));
create policy "Student add own submission attachment rows" on public.homework_attachments for insert to authenticated
  with check (attachment_kind='submission' and uploaded_by=auth.uid() and exists(select 1 from public.student_homework h where h.id=student_homework_id and h.student_user_id=auth.uid() and h.status in ('assigned','in_progress','overdue')));

grant select,insert,update,delete on public.homework_assignments,public.homework_questions,public.homework_question_options,public.homework_student_answers,public.homework_attachments to authenticated;

create or replace function public.admin_create_interactive_homework(p_assignment jsonb,p_student_ids uuid[],p_questions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_assignment_id uuid; v_homework_id uuid; v_question_id uuid; v_student uuid; v_q jsonb; v_o jsonb; v_ids uuid[]='{}';
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if coalesce(array_length(p_student_ids,1),0)=0
    or nullif(btrim(p_assignment->>'title'),'') is null
    or jsonb_typeof(coalesce(p_questions,'[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_questions,'[]'::jsonb))=0
  then return jsonb_build_object('success',false,'error_code','INVALID_INPUT'); end if;
  insert into public.homework_assignments(title,description,lesson_id,due_date,external_link,instructor_note,created_by)
  values(left(btrim(p_assignment->>'title'),200),coalesce(p_assignment->>'description',''),nullif(p_assignment->>'lesson_id','')::uuid,
    nullif(p_assignment->>'due_date','')::timestamptz,nullif(btrim(p_assignment->>'external_link'),''),nullif(btrim(p_assignment->>'instructor_note'),''),auth.uid()) returning id into v_assignment_id;
  for v_q in select value from jsonb_array_elements(coalesce(p_questions,'[]')) loop
    if v_q->>'question_type' not in ('multiple_choice','short_answer','long_answer')
      or nullif(btrim(v_q->>'prompt'),'') is null
      or (
        v_q->>'question_type'='multiple_choice' and (
          jsonb_typeof(coalesce(v_q->'options','[]'::jsonb)) <> 'array'
          or jsonb_array_length(coalesce(v_q->'options','[]'::jsonb)) <> 4
          or (select count(*) from jsonb_array_elements(coalesce(v_q->'options','[]'::jsonb)) option_row where coalesce((option_row->>'is_correct')::boolean,false)) <> 1
        )
      )
    then raise exception 'INVALID_QUESTION' using errcode='22023'; end if;
    insert into public.homework_questions(assignment_id,position,question_type,prompt,reference_answer,explanation)
    values(v_assignment_id,coalesce((v_q->>'position')::integer,0),v_q->>'question_type',v_q->>'prompt',nullif(v_q->>'reference_answer',''),nullif(v_q->>'explanation','')) returning id into v_question_id;
    if v_q->>'question_type'='multiple_choice' then
      for v_o in select value from jsonb_array_elements(coalesce(v_q->'options','[]')) loop
        insert into public.homework_question_options(question_id,option_key,option_text,is_correct)
        values(v_question_id,v_o->>'option_key',v_o->>'option_text',coalesce((v_o->>'is_correct')::boolean,false));
      end loop;
    end if;
  end loop;
  foreach v_student in array p_student_ids loop
    perform 1 from public.student_profiles where id=v_student and active;
    if found then
      insert into public.student_homework(student_user_id,assignment_id,lesson_id,title,description,due_date,status,assignment_file_url)
      values(v_student,v_assignment_id,nullif(p_assignment->>'lesson_id','')::uuid,left(btrim(p_assignment->>'title'),200),coalesce(p_assignment->>'description',''),nullif(p_assignment->>'due_date','')::timestamptz,'assigned',nullif(btrim(p_assignment->>'external_link'),'')) returning id into v_homework_id;
      v_ids:=array_append(v_ids,v_homework_id);
    end if;
  end loop;
  return jsonb_build_object('success',true,'assignment_id',v_assignment_id,'homework_ids',v_ids);
end; $$;

create or replace function public.get_student_homework_detail(p_homework_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_homework public.student_homework%rowtype; v_assignment public.homework_assignments%rowtype;
begin
  select * into v_homework from public.student_homework where id=p_homework_id and student_user_id=auth.uid();
  if v_homework.id is null then raise exception 'HOMEWORK_NOT_FOUND' using errcode='42501'; end if;
  select * into v_assignment from public.homework_assignments where id=v_homework.assignment_id;
  return jsonb_build_object('homework',to_jsonb(v_homework),'assignment',to_jsonb(v_assignment)-'instructor_note',
    'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'position',q.position,'question_type',q.question_type,'prompt',q.prompt,
      'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'option_key',o.option_key,'option_text',o.option_text) order by o.option_key),'[]') from public.homework_question_options o where o.question_id=q.id)) order by q.position),'[]') from public.homework_questions q where q.assignment_id=v_homework.assignment_id),
    'answers',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.homework_student_answers a where a.student_homework_id=v_homework.id),
    'attachments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.homework_attachments a where a.assignment_id=v_homework.assignment_id or a.student_homework_id=v_homework.id));
end; $$;

create or replace function public.save_homework_draft(p_homework_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_homework public.student_homework%rowtype; v_answer jsonb;
begin
  select * into v_homework from public.student_homework where id=p_homework_id and student_user_id=auth.uid() for update;
  if v_homework.id is null or v_homework.status not in ('assigned','in_progress','overdue') then return jsonb_build_object('success',false,'error_code','HOMEWORK_LOCKED'); end if;
  for v_answer in select value from jsonb_array_elements(coalesce(p_answers,'[]')) loop
    if exists(
      select 1 from public.homework_questions q
      where q.id=(v_answer->>'question_id')::uuid
        and q.assignment_id=v_homework.assignment_id
        and (
          nullif(v_answer->>'selected_option_id','') is null
          or exists (
            select 1 from public.homework_question_options o
            where o.id=(v_answer->>'selected_option_id')::uuid and o.question_id=q.id
          )
        )
    ) then
      insert into public.homework_student_answers(student_homework_id,question_id,answer_text,selected_option_id)
      values(v_homework.id,(v_answer->>'question_id')::uuid,nullif(v_answer->>'answer_text',''),nullif(v_answer->>'selected_option_id','')::uuid)
      on conflict(student_homework_id,question_id) do update set answer_text=excluded.answer_text,selected_option_id=excluded.selected_option_id,updated_at=now();
    end if;
  end loop;
  update public.student_homework set status=case when status='overdue' then 'overdue' else 'in_progress' end,draft_saved_at=now(),updated_at=now() where id=v_homework.id;
  return jsonb_build_object('success',true,'saved_at',now());
end; $$;

create or replace function public.submit_interactive_homework(p_homework_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  v_result:=public.save_homework_draft(p_homework_id,p_answers);
  if not coalesce((v_result->>'success')::boolean,false) then return v_result; end if;
  update public.student_homework set status='submitted',submitted_at=now(),updated_at=now() where id=p_homework_id and student_user_id=auth.uid();
  return jsonb_build_object('success',true,'submitted_at',now());
end; $$;

create or replace function public.admin_review_interactive_homework(p_homework_id uuid,p_feedback text,p_reopen boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.student_homework set status=case when p_reopen then 'in_progress' else 'reviewed' end,
    teacher_feedback=nullif(btrim(p_feedback),''),reviewed_at=case when p_reopen then null else now() end,
    reopened_at=case when p_reopen then now() else reopened_at end,updated_at=now() where id=p_homework_id;
  if not found then return jsonb_build_object('success',false,'error_code','NOT_FOUND'); end if;
  return jsonb_build_object('success',true);
end; $$;

revoke all on function public.admin_create_interactive_homework(jsonb,uuid[],jsonb),public.get_student_homework_detail(uuid),public.save_homework_draft(uuid,jsonb),public.submit_interactive_homework(uuid,jsonb),public.admin_review_interactive_homework(uuid,text,boolean) from public,anon;
grant execute on function public.admin_create_interactive_homework(jsonb,uuid[],jsonb),public.get_student_homework_detail(uuid),public.save_homework_draft(uuid,jsonb),public.submit_interactive_homework(uuid,jsonb),public.admin_review_interactive_homework(uuid,text,boolean) to authenticated;

drop policy if exists "Student upload own homework attachments" on storage.objects;
create policy "Student upload own homework attachments" on storage.objects for insert to authenticated with check (
  bucket_id='homework-attachments'
  and (storage.foldername(name))[1]='submissions'
  and (storage.foldername(name))[2]=auth.uid()::text
  and lower(storage.extension(name)) in ('pdf','doc','docx','ppt','pptx','xls','xlsx','png','jpg','jpeg','webp')
);

drop policy if exists "Student read own homework attachments" on storage.objects;
create policy "Student read own homework attachments" on storage.objects for select to authenticated using (
  bucket_id='homework-attachments' and (
    ((storage.foldername(name))[1]='submissions' and (storage.foldername(name))[2]=auth.uid()::text)
    or exists (
      select 1 from public.homework_attachments a
      join public.student_homework h on h.assignment_id=a.assignment_id
      where a.storage_path=storage.objects.name and a.attachment_kind='resource' and h.student_user_id=auth.uid()
    )
  )
);

drop policy if exists "Student update own homework attachments" on storage.objects;
create policy "Student update own homework attachments" on storage.objects for update to authenticated
  using (bucket_id='homework-attachments' and (storage.foldername(name))[1]='submissions' and (storage.foldername(name))[2]=auth.uid()::text)
  with check (bucket_id='homework-attachments' and (storage.foldername(name))[1]='submissions' and (storage.foldername(name))[2]=auth.uid()::text);

drop policy if exists "Student delete own homework attachments" on storage.objects;
create policy "Student delete own homework attachments" on storage.objects for delete to authenticated using (
  bucket_id='homework-attachments' and (storage.foldername(name))[1]='submissions' and (storage.foldername(name))[2]=auth.uid()::text
);

create or replace function public.protect_student_homework_submission()
returns trigger language plpgsql set search_path='' as $$
begin
  if public.is_admin() then return new; end if;
  if auth.uid() is distinct from old.student_user_id then raise exception 'HOMEWORK_FORBIDDEN' using errcode='42501'; end if;
  if old.status in ('submitted','reviewed') then raise exception 'HOMEWORK_LOCKED' using errcode='42501'; end if;
  new.id:=old.id; new.student_user_id:=old.student_user_id; new.assignment_id:=old.assignment_id; new.lesson_id:=old.lesson_id;
  new.title:=old.title; new.description:=old.description; new.due_date:=old.due_date; new.assignment_file_url:=old.assignment_file_url;
  new.teacher_feedback:=old.teacher_feedback; new.reviewed_at:=old.reviewed_at; new.created_at:=old.created_at;
  if new.status not in ('assigned','in_progress','submitted','overdue') then new.status:=old.status; end if;
  if new.status='submitted' and new.submitted_at is null then new.submitted_at:=now(); end if;
  return new;
end; $$;
