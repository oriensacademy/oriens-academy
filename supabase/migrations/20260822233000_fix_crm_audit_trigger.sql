-- Correct table-polymorphic audit trigger field access discovered by remote QA.
-- Converting NEW to jsonb avoids referencing columns absent from another trigger table.
create or replace function public.crm_audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  if tg_table_name = 'student_profiles' then
    v_action := 'student.updated';
  elsif tg_table_name = 'bookings' then
    v_action := case when tg_op = 'INSERT' then 'appointment.created' else 'appointment.updated' end;
  elsif tg_table_name = 'student_homework' then
    if tg_op = 'INSERT' then
      v_action := 'homework.assigned';
    elsif v_new ->> 'status' in ('reviewed', 'completed') and
      ((v_old ->> 'status') is distinct from (v_new ->> 'status') or
       (v_old ->> 'teacher_feedback') is distinct from (v_new ->> 'teacher_feedback')) then
      v_action := 'homework.reviewed';
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), v_action, tg_table_name, v_new ->> 'id',
    case
      when tg_table_name = 'bookings' then jsonb_build_object(
        'status', v_new ->> 'status',
        'slot_id', v_new ->> 'slot_id',
        'student_linked', nullif(v_new ->> 'student_user_id', '') is not null
      )
      when tg_table_name = 'student_homework' then jsonb_build_object(
        'status', v_new ->> 'status',
        'student_user_id', v_new ->> 'student_user_id',
        'lesson_id', v_new ->> 'lesson_id'
      )
      else jsonb_build_object(
        'active', (v_new ->> 'active')::boolean,
        'target_exam', v_new ->> 'target_exam'
      )
    end
  );
  return new;
end;
$$;
