-- Phase 03: Centralized Homework Management, Question Bank, Templates, and Mock Exams (Denemeler)

-- 1. QUESTION BANK
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  code text,
  exam text not null check (char_length(btrim(exam)) > 0),
  topic text not null check (char_length(btrim(topic)) > 0),
  difficulty text check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  language text not null default 'en' check (language in ('en', 'tr')),
  question_type text not null check (question_type in ('multiple_choice', 'short_answer', 'long_answer')),
  prompt text not null check (char_length(btrim(prompt)) > 0),
  options jsonb not null default '[]'::jsonb,
  reference_answer text,
  explanation text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_bank_exam_topic on public.question_bank(exam, topic);
create index if not exists idx_question_bank_type_status on public.question_bank(question_type, status);
create index if not exists idx_question_bank_code on public.question_bank(code);

-- 2. HOMEWORK TEMPLATES
create table if not exists public.homework_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text not null default '',
  subject text,
  exam text,
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  external_link text check (external_link is null or external_link ~* '^https?://'),
  instructor_note text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_homework_templates_status on public.homework_templates(status);
create index if not exists idx_homework_templates_exam on public.homework_templates(exam);

-- 3. HOMEWORK TEMPLATE QUESTIONS (Ordered junction or custom snapshot)
create table if not exists public.homework_template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.homework_templates(id) on delete cascade,
  question_bank_id uuid references public.question_bank(id) on delete set null,
  position integer not null default 0 check (position >= 0),
  question_type text not null check (question_type in ('multiple_choice', 'short_answer', 'long_answer')),
  prompt text not null check (char_length(btrim(prompt)) > 0),
  options jsonb not null default '[]'::jsonb,
  reference_answer text,
  explanation text,
  created_at timestamptz not null default now()
);

create index if not exists idx_homework_template_questions on public.homework_template_questions(template_id, position);

-- 4. MOCK EXAMS (Denemeler)
create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  exam text not null check (char_length(btrim(exam)) > 0),
  description text not null default '',
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes > 0),
  topic_mix text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mock_exams_status on public.mock_exams(status);
create index if not exists idx_mock_exams_exam on public.mock_exams(exam);

-- 5. MOCK EXAM QUESTIONS
create table if not exists public.mock_exam_questions (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references public.mock_exams(id) on delete cascade,
  question_bank_id uuid references public.question_bank(id) on delete set null,
  position integer not null default 0 check (position >= 0),
  question_type text not null check (question_type in ('multiple_choice', 'short_answer', 'long_answer')),
  prompt text not null check (char_length(btrim(prompt)) > 0),
  options jsonb not null default '[]'::jsonb,
  reference_answer text,
  explanation text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mock_exam_questions on public.mock_exam_questions(mock_exam_id, position);

-- 6. RLS POLICIES
alter table public.question_bank enable row level security;
alter table public.homework_templates enable row level security;
alter table public.homework_template_questions enable row level security;
alter table public.mock_exams enable row level security;
alter table public.mock_exam_questions enable row level security;

create policy "Admin full access question_bank" on public.question_bank
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admin full access homework_templates" on public.homework_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admin full access homework_template_questions" on public.homework_template_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admin full access mock_exams" on public.mock_exams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admin full access mock_exam_questions" on public.mock_exam_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.question_bank, public.homework_templates, public.homework_template_questions, public.mock_exams, public.mock_exam_questions to authenticated, service_role;

-- 7. RPC: ASSIGN TEMPLATE OR MOCK EXAM TO STUDENTS
create or replace function public.admin_assign_homework_template(
  p_template_id uuid,
  p_student_ids uuid[],
  p_due_date timestamptz default null,
  p_lesson_id uuid default null,
  p_custom_title text default null,
  p_custom_instructions text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_template public.homework_templates%rowtype;
  v_assignment_id uuid;
  v_homework_id uuid;
  v_question_id uuid;
  v_student uuid;
  v_q record;
  v_opt jsonb;
  v_ids uuid[] := '{}';
  v_title text;
  v_desc text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;

  if coalesce(array_length(p_student_ids, 1), 0) = 0 or p_template_id is null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT');
  end if;

  select * into v_template from public.homework_templates where id = p_template_id;
  if v_template.id is null then
    return jsonb_build_object('success', false, 'error_code', 'TEMPLATE_NOT_FOUND');
  end if;

  v_title := coalesce(nullif(btrim(p_custom_title), ''), v_template.title);
  v_desc := coalesce(nullif(btrim(p_custom_instructions), ''), v_template.description);

  -- Create snapshot assignment
  insert into public.homework_assignments(
    title,
    description,
    lesson_id,
    due_date,
    external_link,
    instructor_note,
    created_by
  ) values (
    left(v_title, 200),
    v_desc,
    p_lesson_id,
    p_due_date,
    v_template.external_link,
    v_template.instructor_note,
    auth.uid()
  ) returning id into v_assignment_id;

  -- Copy snapshot questions
  for v_q in
    select * from public.homework_template_questions
    where template_id = p_template_id
    order by position asc
  loop
    insert into public.homework_questions(
      assignment_id,
      position,
      question_type,
      prompt,
      reference_answer,
      explanation
    ) values (
      v_assignment_id,
      v_q.position,
      v_q.question_type,
      v_q.prompt,
      v_q.reference_answer,
      v_q.explanation
    ) returning id into v_question_id;

    if v_q.question_type = 'multiple_choice' and jsonb_typeof(coalesce(v_q.options, '[]'::jsonb)) = 'array' then
      for v_opt in select value from jsonb_array_elements(v_q.options) loop
        insert into public.homework_question_options(
          question_id,
          option_key,
          option_text,
          is_correct
        ) values (
          v_question_id,
          v_opt->>'option_key',
          coalesce(v_opt->>'option_text', ''),
          coalesce((v_opt->>'is_correct')::boolean, false)
        );
      end loop;
    end if;
  end loop;

  -- Create individual student homework rows
  foreach v_student in array p_student_ids loop
    perform 1 from public.student_profiles where id = v_student and active;
    if found then
      insert into public.student_homework(
        student_user_id,
        assignment_id,
        lesson_id,
        title,
        description,
        due_date,
        status,
        assignment_file_url
      ) values (
        v_student,
        v_assignment_id,
        p_lesson_id,
        left(v_title, 200),
        v_desc,
        p_due_date,
        'assigned',
        v_template.external_link
      ) returning id into v_homework_id;

      v_ids := array_append(v_ids, v_homework_id);
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'homework_ids', v_ids
  );
end;
$$;
