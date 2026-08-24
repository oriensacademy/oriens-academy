-- Phase 03: Simplify /admin/odevler + Homework & Course Materials
-- Content Types: homework, lesson_note, worksheet, resource, mock_exam

-- 1. Extend homework_templates
alter table public.homework_templates
  add column if not exists content_type text not null default 'homework'
    check (content_type in ('homework', 'lesson_note', 'worksheet', 'resource', 'mock_exam')),
  add column if not exists language text not null default 'tr'
    check (language in ('tr', 'en')),
  add column if not exists exam_code text,
  add column if not exists resource_file_url text,
  add column if not exists attachment_name text;

create index if not exists idx_homework_templates_content_type on public.homework_templates(content_type);

-- 2. Extend homework_assignments
alter table public.homework_assignments
  add column if not exists content_type text not null default 'homework'
    check (content_type in ('homework', 'lesson_note', 'worksheet', 'resource', 'mock_exam')),
  add column if not exists language text not null default 'tr'
    check (language in ('tr', 'en')),
  add column if not exists exam_code text,
  add column if not exists resource_file_url text,
  add column if not exists attachment_name text;

create index if not exists idx_homework_assignments_content_type on public.homework_assignments(content_type);

-- 3. Extend student_homework
alter table public.student_homework
  add column if not exists content_type text not null default 'homework'
    check (content_type in ('homework', 'lesson_note', 'worksheet', 'resource', 'mock_exam'));

create index if not exists idx_student_homework_content_type on public.student_homework(content_type);

-- 4. Update admin_assign_homework_template RPC
create or replace function public.admin_assign_homework_template(
  p_template_id uuid,
  p_student_ids uuid[],
  p_due_date timestamptz default null,
  p_lesson_id uuid default null,
  p_custom_title text default null,
  p_custom_instructions text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template record;
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
    content_type,
    language,
    exam_code,
    resource_file_url,
    attachment_name,
    lesson_id,
    due_date,
    external_link,
    instructor_note,
    created_by
  ) values (
    left(v_title, 200),
    v_desc,
    coalesce(v_template.content_type, 'homework'),
    coalesce(v_template.language, 'tr'),
    coalesce(v_template.exam_code, v_template.exam),
    v_template.resource_file_url,
    v_template.attachment_name,
    p_lesson_id,
    p_due_date,
    v_template.external_link,
    v_template.instructor_note,
    auth.uid()
  ) returning id into v_assignment_id;

  -- Copy snapshot questions if any exist
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
        content_type,
        lesson_id,
        title,
        description,
        due_date,
        status,
        assignment_file_url
      ) values (
        v_student,
        v_assignment_id,
        coalesce(v_template.content_type, 'homework'),
        p_lesson_id,
        left(v_title, 200),
        v_desc,
        p_due_date,
        'assigned',
        coalesce(v_template.resource_file_url, v_template.external_link)
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
