-- Ensure customer-facing package emails use the assigned package's real,
-- human-readable name. Numeric custom names such as "10" become
-- "10 Derslik Paket" instead of falling back to the generic pricing row.
create or replace function public.admin_send_package_notification(
  p_purchase_id uuid,
  p_kind text default 'package_assigned'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_purchase public.student_package_purchases%rowtype;
  v_holder record;
  v_learner_name text;
  v_package_name text;
  v_remaining integer;
  v_total_remaining integer;
  v_sends integer;
  v_action text;
  v_template text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_kind not in ('package_assigned', 'lesson_rights') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_KIND');
  end if;

  v_action := 'package.' || p_kind || '_email_manually_sent';
  v_template := case when p_kind = 'package_assigned' then 'package_assigned_manual' else 'lesson_rights_manual' end;

  select * into v_purchase
  from public.student_package_purchases
  where id = p_purchase_id;
  if v_purchase.id is null then
    return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_template || ':' || p_purchase_id::text, 0));
  if exists (
    select 1 from public.audit_logs
    where action = v_action and entity_id = p_purchase_id::text and created_at > now() - interval '60 seconds'
  ) then
    return jsonb_build_object('success', true, 'suppressed', true, 'error_code', 'DUPLICATE_SUPPRESSED');
  end if;

  select ga.user_id, ga.email, ga.full_name, ga.preferred_language
    into v_holder
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
  where gs.student_id = v_purchase.student_user_id and gs.active and ga.active
    and ga.email_verified_at is not null
  order by gs.is_primary desc, gs.created_at asc
  limit 1;
  if v_holder.email is null then
    return jsonb_build_object('success', false, 'error_code', 'NO_VERIFIED_ACCOUNT_HOLDER');
  end if;

  select full_name into v_learner_name
  from public.student_profiles where id = v_purchase.student_user_id;

  select case when v_holder.preferred_language = 'en' then name_en else name_tr end
    into v_package_name
  from public.pricing_packages where id = v_purchase.package_id;

  -- An explicitly assigned name belongs to the learner and takes precedence.
  v_package_name := coalesce(nullif(btrim(v_purchase.custom_package_name), ''), v_package_name, nullif(v_purchase.package_id, 'custom'));
  if v_package_name is null
     or lower(btrim(v_package_name)) in ('custom', 'özel paket', 'custom package')
     or btrim(v_package_name) ~ '^[0-9]+$' then
    v_package_name := case
      when v_holder.preferred_language = 'en' then v_purchase.lesson_count::text || '-Lesson Package'
      else v_purchase.lesson_count::text || ' Derslik Paket'
    end;
  end if;

  v_remaining := greatest(0, v_purchase.lesson_count - v_purchase.lessons_used);
  v_total_remaining := public.calculate_student_usable_remaining_lessons(v_purchase.student_user_id);
  select count(*) into v_sends from public.audit_logs
  where action = v_action and entity_id = p_purchase_id::text;

  perform public.enqueue_email_notification(
    'package.' || p_kind || '.manual',
    'student_package_purchase',
    v_purchase.id::text,
    v_holder.email,
    v_template,
    jsonb_build_object(
      'purchase_id', v_purchase.id,
      'account_holder_name', v_holder.full_name,
      'learner_name', v_learner_name,
      'package_name', v_package_name,
      'lesson_count', v_purchase.lesson_count,
      'lessons_used', v_purchase.lessons_used,
      'remaining_lessons', v_remaining,
      'total_remaining_lessons', v_total_remaining,
      'start_date', v_purchase.start_date,
      'end_date', v_purchase.end_date,
      'locale', coalesce(v_holder.preferred_language, 'tr')
    ),
    v_template || ':' || v_purchase.id::text || case when v_sends > 0 then ':resend' || v_sends::text else '' end,
    now()
  );

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_action, 'student_package_purchase', v_purchase.id::text,
    jsonb_build_object('resend_index', v_sends, 'remaining', v_remaining, 'package_name', v_package_name));

  return jsonb_build_object('success', true, 'suppressed', false, 'resend_index', v_sends,
    'remaining', v_remaining, 'total_remaining', v_total_remaining, 'package_name', v_package_name);
end;
$fn$;

revoke all on function public.admin_send_package_notification(uuid, text) from public, anon;
grant execute on function public.admin_send_package_notification(uuid, text) to authenticated, service_role;
