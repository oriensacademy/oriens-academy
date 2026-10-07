-- Customer revision archive architecture and reversible test-account reset.
-- Financial, authentication and audit history are deliberately preserved.

alter table public.guardian_accounts
  add column if not exists archived_at timestamptz;

alter table public.student_profiles
  add column if not exists archived_at timestamptz;

alter table public.contact_requests
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.student_package_purchases
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.student_lessons
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.student_package_adjustments
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.notification_deliveries
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.student_admin_notes
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists guardian_accounts_active_archive_idx
  on public.guardian_accounts (archived_at, active);
create index if not exists student_profiles_active_archive_idx
  on public.student_profiles (archived_at, active);
create index if not exists contact_requests_archive_created_idx
  on public.contact_requests (is_archived, created_at desc);
create index if not exists student_package_purchases_archive_student_idx
  on public.student_package_purchases (student_user_id, is_archived, created_at desc);
create index if not exists student_lessons_archive_student_idx
  on public.student_lessons (student_user_id, is_archived, lesson_date desc);
create index if not exists student_package_adjustments_archive_student_idx
  on public.student_package_adjustments (student_user_id, is_archived, created_at desc);
create index if not exists notification_deliveries_archive_recipient_idx
  on public.notification_deliveries (recipient, is_archived, created_at desc);
create index if not exists student_admin_notes_archive_student_idx
  on public.student_admin_notes (student_user_id, is_archived, created_at desc);

-- Archived operational history is not part of the member-facing current state.
drop policy if exists "Student own lessons read" on public.student_lessons;
create policy "Student own lessons read" on public.student_lessons for select
  using (student_user_id = auth.uid() and not is_archived);

drop policy if exists "Student own package purchase read policy" on public.student_package_purchases;
create policy "Student own package purchase read policy" on public.student_package_purchases for select
  using (student_user_id = auth.uid() and not is_archived);

drop policy if exists "Student own read adjustments policy" on public.student_package_adjustments;
create policy "Student own read adjustments policy" on public.student_package_adjustments for select
  using (student_user_id = auth.uid() and not is_archived);

create or replace function public.admin_archive_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guardians integer := 0;
  v_students integer := 0;
  v_links integer := 0;
  v_student_ids uuid[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'MEMBER_ID_REQUIRED'; end if;
  if exists (select 1 from public.admin_profiles where user_id = p_user_id) then
    raise exception 'ADMIN_MEMBER_ARCHIVE_FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct sp.id), '{}'::uuid[]) into v_student_ids
  from public.student_profiles sp
  where sp.id = p_user_id or sp.legacy_auth_user_id = p_user_id;

  update public.guardian_accounts
  set active = false, archived_at = coalesce(archived_at, now()), updated_at = now()
  where user_id = p_user_id and archived_at is null;
  get diagnostics v_guardians = row_count;

  update public.student_profiles
  set active = false, archived_at = coalesce(archived_at, now()), updated_at = now()
  where id = any(v_student_ids) and archived_at is null;
  get diagnostics v_students = row_count;

  update public.guardian_students
  set active = false, updated_at = now()
  where active and (guardian_user_id = p_user_id or student_id = any(v_student_ids));
  get diagnostics v_links = row_count;

  if v_guardians + v_students = 0 then raise exception 'MEMBER_NOT_FOUND_OR_ALREADY_ARCHIVED'; end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'member_archived', 'member', p_user_id::text,
    jsonb_build_object('guardian_rows', v_guardians, 'student_rows', v_students, 'relationship_rows', v_links));

  return jsonb_build_object('success', true, 'guardian_rows', v_guardians, 'student_rows', v_students, 'relationship_rows', v_links);
end;
$$;

create or replace function public.admin_restore_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guardians integer := 0;
  v_students integer := 0;
  v_links integer := 0;
  v_student_ids uuid[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'MEMBER_ID_REQUIRED'; end if;

  select coalesce(array_agg(distinct sp.id), '{}'::uuid[]) into v_student_ids
  from public.student_profiles sp
  where sp.id = p_user_id or sp.legacy_auth_user_id = p_user_id;

  update public.guardian_accounts set active = true, archived_at = null, updated_at = now()
  where user_id = p_user_id and archived_at is not null;
  get diagnostics v_guardians = row_count;

  update public.student_profiles set active = true, archived_at = null, updated_at = now()
  where id = any(v_student_ids) and archived_at is not null;
  get diagnostics v_students = row_count;

  update public.guardian_students gs set active = true, updated_at = now()
  where not gs.active
    and (gs.guardian_user_id = p_user_id or gs.student_id = any(v_student_ids))
    and exists (select 1 from public.guardian_accounts ga where ga.user_id = gs.guardian_user_id and ga.archived_at is null and ga.active)
    and exists (select 1 from public.student_profiles sp where sp.id = gs.student_id and sp.archived_at is null and sp.active);
  get diagnostics v_links = row_count;

  if v_guardians + v_students = 0 then raise exception 'MEMBER_NOT_FOUND_OR_NOT_ARCHIVED'; end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'member_restored', 'member', p_user_id::text,
    jsonb_build_object('guardian_rows', v_guardians, 'student_rows', v_students, 'relationship_rows', v_links));

  return jsonb_build_object('success', true, 'guardian_rows', v_guardians, 'student_rows', v_students, 'relationship_rows', v_links);
end;
$$;

create or replace function public.admin_archive_contact_request(p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_changed integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  update public.contact_requests
  set is_archived = true, archived_at = coalesce(archived_at, now()), updated_at = now()
  where id = p_contact_id and not is_archived;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'CONTACT_NOT_FOUND_OR_ALREADY_ARCHIVED'; end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'contact_request_archived', 'contact_request', p_contact_id::text, '{}'::jsonb);
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_restore_contact_request(p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_changed integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  update public.contact_requests
  set is_archived = false, archived_at = null, updated_at = now()
  where id = p_contact_id and is_archived;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'CONTACT_NOT_FOUND_OR_NOT_ARCHIVED'; end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'contact_request_restored', 'contact_request', p_contact_id::text, '{}'::jsonb);
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_archive_student_note(p_note_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  update public.student_admin_notes
  set is_archived = true, archived_at = coalesce(archived_at, now()), updated_at = now()
  where id = p_note_id and not is_archived
  returning student_user_id into v_student_id;
  if v_student_id is null then raise exception 'NOTE_NOT_FOUND_OR_ALREADY_ARCHIVED'; end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'student.note.archived', 'student_admin_note', p_note_id::text,
    jsonb_build_object('student_user_id', v_student_id));
  return jsonb_build_object('success', true);
end;
$$;

-- Targeted delivery-metadata minimization. The durable delivery event and every
-- status/entity/timestamp field remain unchanged; only the asserted payload key
-- is replaced. The expected value prevents a stale preflight from changing data.
create or replace function public.admin_redact_payment_admin_delivery_email(
  p_delivery_id uuid,
  p_expected_email text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_changed integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_delivery_id is null or nullif(lower(btrim(p_expected_email)), '') is null then
    raise exception 'DELIVERY_ID_AND_EXPECTED_EMAIL_REQUIRED';
  end if;
  update public.notification_deliveries
  set payload = jsonb_set(payload, '{payer_email}', to_jsonb('[redacted]'::text), false),
      updated_at = now()
  where id = p_delivery_id
    and template = 'payment_success_admin'
    and lower(btrim(payload->>'payer_email')) = lower(btrim(p_expected_email));
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'DELIVERY_REDACTION_ASSERTION_FAILED'; end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'notification.delivery_email_redacted', 'notification_delivery', p_delivery_id::text,
    jsonb_build_object('payload_key', 'payer_email'));
  return jsonb_build_object('success', true, 'delivery_id', p_delivery_id);
end;
$$;

-- Exact-ID-only, all-or-nothing operational reset for the audited test account.
-- Identity, relationships, statuses, amounts, references, adjustment deltas and audit rows are untouched.
create or replace function public.admin_reset_test_account_operational_state(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student_id uuid;
  v_email text;
  v_guardian_count integer;
  v_student_count integer;
  v_link_count integer;
  v_purchase_count integer;
  v_lesson_count integer;
  v_adjustment_count integer;
  v_payment_count integer;
  v_notification_count integer;
  v_contact_count integer;
  v_booking_count integer;
  v_homework_count integer;
  v_note_count integer;
  v_purchase_ids uuid[];
  v_purchase_text_ids text[];
  v_lesson_ids text[];
  v_payment_ids text[];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'MEMBER_ID_REQUIRED'; end if;

  select count(*), min(lower(btrim(email))) into v_guardian_count, v_email
  from public.guardian_accounts where user_id = p_user_id;
  select count(*) into v_student_count
  from public.student_profiles where id = p_user_id or legacy_auth_user_id = p_user_id;
  select id into v_student_id from public.student_profiles
  where id = p_user_id or legacy_auth_user_id = p_user_id limit 1;
  if v_guardian_count <> 1 or v_student_count <> 1 then raise exception 'RESET_IDENTITY_ASSERTION_FAILED'; end if;

  select count(*) into v_link_count from public.guardian_students where guardian_user_id = p_user_id and student_id = v_student_id;
  select count(*), coalesce(array_agg(id), '{}'::uuid[]) into v_purchase_count, v_purchase_ids from public.student_package_purchases where student_user_id = v_student_id;
  v_purchase_text_ids := array(select item::text from unnest(v_purchase_ids) item);
  select count(*), coalesce(array_agg(id::text), '{}'::text[]) into v_lesson_count, v_lesson_ids from public.student_lessons where student_user_id = v_student_id;
  select count(*) into v_adjustment_count from public.student_package_adjustments where student_user_id = v_student_id;
  select count(*), coalesce(array_agg(id::text), '{}'::text[]) into v_payment_count, v_payment_ids
  from public.payment_transactions
  where student_user_id = v_student_id or package_owner_student_id = v_student_id or purchaser_guardian_user_id = p_user_id;
  select count(*) into v_notification_count from public.notification_deliveries
  where lower(btrim(recipient)) = v_email
     or entity_id = p_user_id::text or entity_id = v_student_id::text
     or entity_id = any(v_lesson_ids) or entity_id = any(v_payment_ids)
     or entity_id = any(v_purchase_text_ids);
  select count(*) into v_contact_count from public.contact_requests where lower(btrim(email)) = v_email;
  select count(*) into v_booking_count from public.bookings where student_user_id = v_student_id;
  select count(*) into v_homework_count from public.student_homework where student_user_id = v_student_id;
  select count(*) into v_note_count from public.student_admin_notes where student_user_id = v_student_id;

  if v_link_count <> 1 or v_purchase_count <> 5 or v_lesson_count <> 2 or v_adjustment_count <> 5
     or v_payment_count <> 2 or v_notification_count <> 9 or v_contact_count <> 0
     or v_booking_count <> 0 or v_homework_count <> 0 or v_note_count <> 0 then
    raise exception 'RESET_PREFLIGHT_ASSERTION_FAILED';
  end if;

  update public.student_package_purchases set is_archived = true, archived_at = coalesce(archived_at, now())
  where student_user_id = v_student_id and not is_archived;
  update public.student_lessons set is_archived = true, archived_at = coalesce(archived_at, now()), updated_at = now()
  where student_user_id = v_student_id and not is_archived;
  update public.student_package_adjustments set is_archived = true, archived_at = coalesce(archived_at, now())
  where student_user_id = v_student_id and not is_archived;
  update public.payment_transactions set is_archived = true, archived_at = coalesce(archived_at, now()), archive_reason = 'test_account_operational_reset'
  where (student_user_id = v_student_id or package_owner_student_id = v_student_id or purchaser_guardian_user_id = p_user_id) and not is_archived;
  update public.notification_deliveries set is_archived = true, archived_at = coalesce(archived_at, now())
  where not is_archived and (
    lower(btrim(recipient)) = v_email or entity_id = p_user_id::text or entity_id = v_student_id::text
    or entity_id = any(v_lesson_ids) or entity_id = any(v_payment_ids) or entity_id = any(v_purchase_text_ids)
  );

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'test_account_operational_reset', 'member', p_user_id::text,
    jsonb_build_object('student_id', v_student_id, 'package_rows', v_purchase_count, 'lesson_rows', v_lesson_count,
      'adjustment_rows', v_adjustment_count, 'payment_rows', v_payment_count, 'notification_rows', v_notification_count));

  return jsonb_build_object('success', true, 'student_id', v_student_id, 'package_rows', v_purchase_count,
    'lesson_rows', v_lesson_count, 'adjustment_rows', v_adjustment_count, 'payment_rows', v_payment_count,
    'notification_rows', v_notification_count);
end;
$$;

revoke all on function public.admin_archive_member(uuid) from public, anon;
revoke all on function public.admin_restore_member(uuid) from public, anon;
revoke all on function public.admin_archive_contact_request(uuid) from public, anon;
revoke all on function public.admin_restore_contact_request(uuid) from public, anon;
revoke all on function public.admin_archive_student_note(uuid) from public, anon;
revoke all on function public.admin_redact_payment_admin_delivery_email(uuid,text) from public, anon;
revoke all on function public.admin_reset_test_account_operational_state(uuid) from public, anon;
grant execute on function public.admin_archive_member(uuid) to authenticated;
grant execute on function public.admin_restore_member(uuid) to authenticated;
grant execute on function public.admin_archive_contact_request(uuid) to authenticated;
grant execute on function public.admin_restore_contact_request(uuid) to authenticated;
grant execute on function public.admin_archive_student_note(uuid) to authenticated;
grant execute on function public.admin_redact_payment_admin_delivery_email(uuid,text) to authenticated;
grant execute on function public.admin_reset_test_account_operational_state(uuid) to authenticated;

-- Ordinary administrators may inspect immutable evidence but cannot delete it.
revoke execute on function public.admin_delete_audit_log(bigint) from authenticated;
revoke execute on function public.admin_delete_notification_delivery(uuid) from authenticated;
revoke execute on function public.admin_clear_audit_logs() from authenticated;
revoke execute on function public.admin_clear_contact_history() from authenticated;
revoke execute on function public.admin_purge_deleted_account_residue(boolean) from authenticated;
revoke execute on function public.admin_purge_deleted_account_audit_history(uuid[]) from authenticated;
revoke execute on function public.admin_purge_orphaned_payment_audit(text[],boolean) from authenticated;

-- The former 90-day delivery purge conflicts with the current immutable
-- transactional-delivery policy. Keep the maintenance function service-only,
-- but remove its automatic schedule so delivery evidence is not broadly erased.
do $$
declare v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job_id in select jobid from cron.job where jobname = 'purge-notification-deliveries-daily'
    loop
      perform cron.unschedule(v_job_id);
    end loop;
  end if;
end $$;

-- Canonical entitlement calculations exclude operationally archived rows while
-- keeping every historical amount and lesson delta intact.
create or replace function public.calculate_student_usable_remaining_lessons(p_student_id uuid)
returns integer language sql security definer stable set search_path = '' as $$
  select coalesce(sum(greatest(0, lesson_count - lessons_used)), 0)::integer
  from public.student_package_purchases
  where student_user_id = p_student_id
    and not is_archived
    and status = 'active'
    and (end_date is null or end_date > now());
$$;

create or replace function public.get_student_entitlement_summary(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_total_granted integer := 0; v_total_used integer := 0; v_total_remaining integer := 0;
  v_active_packages jsonb := '[]'::jsonb; v_past_packages jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null and not public.can_access_student(p_student_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(sum(lesson_count),0), coalesce(sum(lessons_used),0),
    coalesce(sum(case when status='active' and lesson_count>lessons_used then lesson_count-lessons_used else 0 end),0)
  into v_total_granted,v_total_used,v_total_remaining
  from public.student_package_purchases where student_user_id=p_student_id and not is_archived;
  select coalesce(jsonb_agg(to_jsonb(p.*)),'[]'::jsonb) into v_active_packages from (
    select spp.*,pp.name_tr package_name_tr,pp.name_en package_name_en
    from public.student_package_purchases spp left join public.pricing_packages pp on pp.id=spp.package_id
    where spp.student_user_id=p_student_id and not spp.is_archived and spp.status='active' and spp.lesson_count>spp.lessons_used
    order by spp.created_at asc,spp.id asc) p;
  select coalesce(jsonb_agg(to_jsonb(p.*)),'[]'::jsonb) into v_past_packages from (
    select spp.*,pp.name_tr package_name_tr,pp.name_en package_name_en
    from public.student_package_purchases spp left join public.pricing_packages pp on pp.id=spp.package_id
    where spp.student_user_id=p_student_id and not spp.is_archived
      and (spp.status in ('completed','expired','cancelled','refunded') or spp.lesson_count<=spp.lessons_used)
    order by spp.created_at desc,spp.id desc) p;
  return jsonb_build_object('student_user_id',p_student_id,'total_granted_lessons',v_total_granted,
    'total_used_lessons',v_total_used,'total_remaining_lessons',v_total_remaining,
    'active_packages',v_active_packages,'past_packages',v_past_packages);
end;
$$;

create or replace function public.admin_get_package_rights_notification_context(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_holder record; v_student_name text; v_packages jsonb; v_total integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select full_name into v_student_name from public.student_profiles where id=p_student_id and archived_at is null;
  if v_student_name is null then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_FOUND'); end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language into v_holder
  from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=p_student_id and gs.active and ga.active and ga.archived_at is null and ga.email_verified_at is not null
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_holder.email is null then return jsonb_build_object('success',false,'error_code','NO_VERIFIED_ACCOUNT_HOLDER'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'name',coalesce(case when v_holder.preferred_language='en' then pp.name_en else pp.name_tr end,
        case when v_holder.preferred_language='en' then p.lesson_count||'-Lesson Package' else p.lesson_count||' Derslik Paket' end),
      'lesson_count',p.lesson_count,'used',p.lessons_used,'remaining',greatest(0,p.lesson_count-p.lessons_used))
      order by p.created_at),'[]'::jsonb),
    coalesce(sum(greatest(0,p.lesson_count-p.lessons_used)),0)::integer
  into v_packages,v_total
  from public.student_package_purchases p left join public.pricing_packages pp on pp.id=p.package_id
  where p.student_user_id=p_student_id and not p.is_archived and p.status='active' and p.lesson_count>p.lessons_used;
  return jsonb_build_object('success',true,'student_id',p_student_id,'student_name',v_student_name,
    'recipient',lower(v_holder.email),'account_holder_name',v_holder.full_name,'locale',coalesce(v_holder.preferred_language,'tr'),
    'total_remaining_lessons',v_total,'packages',v_packages,'current_date',current_date);
end;
$$;

create or replace function public.reject_archived_package_operational_use()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.package_purchase_id is not null and exists (
    select 1 from public.student_package_purchases p where p.id=new.package_purchase_id and p.is_archived
  ) then raise exception 'ARCHIVED_PACKAGE_NOT_OPERATIONAL' using errcode='23514'; end if;
  return new;
end;
$$;
drop trigger if exists trg_reject_archived_package_operational_use on public.student_lessons;
create trigger trg_reject_archived_package_operational_use
before insert or update of package_purchase_id on public.student_lessons
for each row execute function public.reject_archived_package_operational_use();

grant execute on function public.calculate_student_usable_remaining_lessons(uuid) to authenticated, service_role;
revoke all on function public.get_student_entitlement_summary(uuid) from public, anon;
grant execute on function public.get_student_entitlement_summary(uuid) to authenticated, service_role;
revoke all on function public.admin_get_package_rights_notification_context(uuid) from public, anon;
grant execute on function public.admin_get_package_rights_notification_context(uuid) to authenticated;
