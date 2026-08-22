-- Oriens Academy student CRM operations.
-- All privileged mutations are database-authorized and audit logged.

alter table public.student_package_purchases
  alter column payment_transaction_id drop not null,
  add column if not exists price_amount numeric check (price_amount is null or price_amount >= 0),
  add column if not exists currency text not null default 'TRY' check (char_length(currency) = 3),
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'waived', 'refunded')),
  add column if not exists assignment_source text not null default 'payment'
    check (assignment_source in ('payment', 'admin_manual')),
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.student_homework
  add column if not exists assignment_file_url text;
alter table public.bookings
  add column if not exists appointment_subject text;

create unique index if not exists uq_student_lessons_booking
  on public.student_lessons(booking_id) where booking_id is not null;

create table if not exists public.student_admin_notes (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_admin_notes_student
  on public.student_admin_notes(student_user_id, created_at desc);

create trigger trg_student_package_purchases_updated_at before update on public.student_package_purchases
  for each row execute function public.set_updated_at();
create trigger trg_student_admin_notes_updated_at before update on public.student_admin_notes
  for each row execute function public.set_updated_at();

alter table public.student_admin_notes enable row level security;
create policy "Admin private student notes" on public.student_admin_notes for all
  using (public.is_admin()) with check (public.is_admin() and created_by = auth.uid());
grant select, insert, update, delete on public.student_admin_notes to authenticated;
grant insert, update on public.student_package_purchases to authenticated;

create or replace function public.crm_audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action text;
begin
  if tg_table_name = 'student_profiles' then
    v_action := 'student.updated';
  elsif tg_table_name = 'bookings' then
    v_action := case when tg_op = 'INSERT' then 'appointment.created' else 'appointment.updated' end;
  elsif tg_table_name = 'student_homework' then
    if tg_op = 'INSERT' then v_action := 'homework.assigned';
    elsif new.status in ('reviewed', 'completed') and
      (old.status is distinct from new.status or old.teacher_feedback is distinct from new.teacher_feedback)
      then v_action := 'homework.reviewed';
    else return new;
    end if;
  else return new;
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), v_action, tg_table_name,
    case when tg_table_name = 'student_profiles' then new.id::text else new.id::text end,
    case
      when tg_table_name = 'bookings' then jsonb_build_object('status', new.status, 'slot_id', new.slot_id, 'student_linked', new.student_user_id is not null)
      when tg_table_name = 'student_homework' then jsonb_build_object('status', new.status, 'student_user_id', new.student_user_id, 'lesson_id', new.lesson_id)
      else jsonb_build_object('active', new.active, 'target_exam', new.target_exam)
    end
  );
  return new;
end;
$$;

create trigger trg_audit_student_profile after update on public.student_profiles
  for each row execute function public.crm_audit_row();
create trigger trg_audit_appointment after insert or update on public.bookings
  for each row execute function public.crm_audit_row();
create trigger trg_audit_homework after insert or update on public.student_homework
  for each row execute function public.crm_audit_row();

create or replace function public.complete_package_when_fully_used()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lessons_used >= new.lesson_count and new.status = 'active' then
    new.status := 'completed';
  end if;
  if old.status is distinct from new.status and new.status = 'completed' then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'package.completed', 'student_package_purchase', new.id::text,
      jsonb_build_object('student_user_id', new.student_user_id, 'package_id', new.package_id, 'lessons_used', new.lessons_used));
  end if;
  return new;
end;
$$;
create trigger trg_complete_package before update of lessons_used, status on public.student_package_purchases
  for each row execute function public.complete_package_when_fully_used();

create or replace function public.admin_update_student_profile(
  p_student_id uuid, p_full_name text, p_phone text, p_school text,
  p_target_exam text, p_target_university text, p_target_country text,
  p_preferred_language text, p_active boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if nullif(btrim(p_full_name), '') is null or p_preferred_language not in ('tr','en') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT');
  end if;
  update public.student_profiles set
    full_name = left(btrim(p_full_name),100), phone = left(nullif(btrim(p_phone),''),30),
    school = left(nullif(btrim(p_school),''),160), target_exam = left(nullif(btrim(p_target_exam),''),80),
    target_university = left(nullif(btrim(p_target_university),''),160), target_country = left(nullif(btrim(p_target_country),''),120),
    preferred_language = p_preferred_language, active = p_active, updated_at = now()
  where id = p_student_id;
  if not found then return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND'); end if;
  return jsonb_build_object('success', true);
end; $$;

create or replace function public.admin_create_student_booking(
  p_student_id uuid, p_full_name text, p_email text, p_phone text, p_exam text,
  p_subject text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_privacy_consent boolean,
  p_notes text default null, p_status text default 'confirmed'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_booking_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  perform 1 from public.student_profiles where id=p_student_id;
  if not found then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_FOUND'); end if;
  v_result := public.admin_create_booking(p_full_name,p_email,p_phone,p_exam,p_starts_at,p_ends_at,p_privacy_consent,p_notes,p_status);
  if not coalesce((v_result->>'success')::boolean,false) then return v_result; end if;
  v_booking_id := (v_result->>'booking_id')::uuid;
  update public.bookings set student_user_id=p_student_id,
    appointment_subject=left(nullif(btrim(p_subject),''),160),updated_at=now() where id=v_booking_id;
  if not found then raise exception 'BOOKING_LINK_FAILED'; end if;
  return v_result || jsonb_build_object('student_user_id',p_student_id);
end; $$;

create or replace function public.admin_assign_student_package(
  p_student_id uuid, p_package_id text, p_start_date date, p_end_date date,
  p_lesson_count integer, p_price_amount numeric, p_currency text,
  p_payment_status text default 'pending', p_payment_transaction_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_tx public.payment_transactions%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_lesson_count < 1 or p_lesson_count > 1000 or p_price_amount < 0 or
     upper(p_currency) !~ '^[A-Z]{3}$' or p_payment_status not in ('pending','paid','waived') or
     (p_end_date is not null and p_end_date < p_start_date) then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT');
  end if;
  perform 1 from public.student_profiles where id = p_student_id and active;
  if not found then return jsonb_build_object('success', false, 'error_code', 'STUDENT_NOT_FOUND'); end if;
  perform 1 from public.pricing_packages where id = p_package_id;
  if not found then return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND'); end if;
  if p_payment_transaction_id is not null then
    select * into v_tx from public.payment_transactions where id = p_payment_transaction_id for update;
    if v_tx.id is null or v_tx.student_user_id is distinct from p_student_id or v_tx.package_id <> p_package_id or v_tx.status <> 'paid' then
      return jsonb_build_object('success', false, 'error_code', 'PAYMENT_NOT_VERIFIED');
    end if;
  elsif p_payment_status = 'paid' then
    return jsonb_build_object('success', false, 'error_code', 'PAYMENT_APPROVAL_REQUIRED');
  end if;
  insert into public.student_package_purchases(student_user_id, package_id, payment_transaction_id,
    lesson_count, start_date, end_date, price_amount, currency, payment_status, assignment_source, assigned_by)
  values(p_student_id, p_package_id, p_payment_transaction_id, p_lesson_count, p_start_date, p_end_date,
    p_price_amount, upper(p_currency), p_payment_status, 'admin_manual', auth.uid()) returning id into v_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'package.assigned','student_package_purchase',v_id::text,
    jsonb_build_object('student_user_id',p_student_id,'package_id',p_package_id,'lesson_count',p_lesson_count,'payment_status',p_payment_status));
  return jsonb_build_object('success',true,'purchase_id',v_id);
exception when unique_violation then
  return jsonb_build_object('success',false,'error_code','PAYMENT_ALREADY_LINKED');
end; $$;

create or replace function public.admin_complete_student_appointment(
  p_booking_id uuid, p_package_purchase_id uuid, p_title text, p_subject text,
  p_exam_code text, p_duration_minutes integer, p_teacher_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings%rowtype; v_purchase public.student_package_purchases%rowtype; v_lesson_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or v_booking.student_user_id is null then return jsonb_build_object('success',false,'error_code','BOOKING_NOT_LINKED'); end if;
  select id into v_lesson_id from public.student_lessons where booking_id = p_booking_id;
  if v_lesson_id is not null then
    return jsonb_build_object('success',true,'lesson_id',v_lesson_id,'already_completed',true);
  end if;
  if p_duration_minutes < 1 or p_duration_minutes > 600 or nullif(btrim(p_title),'') is null or nullif(btrim(p_subject),'') is null then
    return jsonb_build_object('success',false,'error_code','INVALID_INPUT');
  end if;
  if p_package_purchase_id is not null then
    select * into v_purchase from public.student_package_purchases where id = p_package_purchase_id for update;
    if v_purchase.id is null or v_purchase.student_user_id <> v_booking.student_user_id or v_purchase.status <> 'active' or v_purchase.lessons_used >= v_purchase.lesson_count then
      return jsonb_build_object('success',false,'error_code','PACKAGE_UNAVAILABLE');
    end if;
  end if;
  insert into public.student_lessons(student_user_id,booking_id,package_purchase_id,title,subject,exam_code,
    lesson_date,duration_minutes,status,teacher_note)
  values(v_booking.student_user_id,p_booking_id,p_package_purchase_id,left(btrim(p_title),160),left(btrim(p_subject),160),
    left(nullif(btrim(p_exam_code),''),80),coalesce((select starts_at from public.availability_slots where id=v_booking.slot_id),now()),
    p_duration_minutes,'completed',nullif(btrim(p_teacher_note),'')) returning id into v_lesson_id;
  update public.bookings set status='completed',updated_at=now() where id=p_booking_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'lesson.completed','student_lesson',v_lesson_id::text,
    jsonb_build_object('student_user_id',v_booking.student_user_id,'booking_id',p_booking_id,'package_purchase_id',p_package_purchase_id));
  return jsonb_build_object('success',true,'lesson_id',v_lesson_id,'already_completed',false);
exception when unique_violation then
  select id into v_lesson_id from public.student_lessons where booking_id=p_booking_id;
  return jsonb_build_object('success',true,'lesson_id',v_lesson_id,'already_completed',true);
end; $$;

create or replace function public.activate_paid_package(p_payment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare transaction_row public.payment_transactions%rowtype; package_row public.pricing_packages%rowtype; purchase_id uuid;
begin
  select * into transaction_row from public.payment_transactions where id=p_payment_id and status='paid' for update;
  if not found then raise exception 'Verified paid transaction not found'; end if;
  if transaction_row.student_user_id is null then raise exception 'Student is not linked'; end if;
  select * into package_row from public.pricing_packages where id=transaction_row.package_id;
  if package_row.lesson_count is null then raise exception 'Package lesson count is not configured'; end if;
  insert into public.student_package_purchases(student_user_id,package_id,payment_transaction_id,lesson_count,
    price_amount,currency,payment_status,assignment_source)
  values(transaction_row.student_user_id,transaction_row.package_id,transaction_row.id,package_row.lesson_count,
    transaction_row.amount,transaction_row.currency,'paid','payment')
  on conflict(payment_transaction_id) do update set payment_status='paid',price_amount=excluded.price_amount,currency=excluded.currency
  returning id into purchase_id;
  return purchase_id;
end; $$;
revoke all on function public.activate_paid_package(uuid) from public,anon,authenticated;
grant execute on function public.activate_paid_package(uuid) to service_role;

create or replace function public.admin_review_bank_transfer(p_payment_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tx public.payment_transactions%rowtype; v_purchase_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected') then return jsonb_build_object('success',false,'error_code','INVALID_DECISION'); end if;
  select * into v_tx from public.payment_transactions where id=p_payment_id for update;
  if v_tx.id is null then return jsonb_build_object('success',false,'error_code','NOT_FOUND'); end if;
  if v_tx.payment_method <> 'bank_transfer' or v_tx.provider <> 'manual_bank_transfer' then
    return jsonb_build_object('success',false,'error_code','MANUAL_REVIEW_NOT_ALLOWED');
  end if;
  if v_tx.student_user_id is null then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_LINKED'); end if;
  if v_tx.status = 'paid' and p_decision='approved' then
    select id into v_purchase_id from public.student_package_purchases where payment_transaction_id=p_payment_id;
    return jsonb_build_object('success',true,'purchase_id',v_purchase_id,'already_reviewed',true);
  end if;
  if v_tx.status not in ('pending','processing','requires_action') then return jsonb_build_object('success',false,'error_code','INVALID_STATUS'); end if;
  update public.payment_transactions set status=case when p_decision='approved' then 'paid' else 'failed' end,
    paid_at=case when p_decision='approved' then now() else null end, updated_at=now() where id=p_payment_id;
  if p_decision='approved' then v_purchase_id := public.activate_paid_package(p_payment_id); end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'payment.reviewed','payment_transaction',p_payment_id::text,jsonb_build_object('decision',p_decision,'previous_status',v_tx.status));
  if p_decision='approved' then
    insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'bank_transfer.approved','payment_transaction',p_payment_id::text,jsonb_build_object('decision',p_decision));
  end if;
  return jsonb_build_object('success',true,'purchase_id',v_purchase_id,'already_reviewed',false);
end; $$;

revoke all on function public.admin_update_student_profile(uuid,text,text,text,text,text,text,text,boolean) from public,anon;
revoke all on function public.admin_create_student_booking(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,text,text) from public,anon;
revoke all on function public.admin_assign_student_package(uuid,text,date,date,integer,numeric,text,text,uuid) from public,anon;
revoke all on function public.admin_complete_student_appointment(uuid,uuid,text,text,text,integer,text) from public,anon;
revoke all on function public.admin_review_bank_transfer(uuid,text) from public,anon;
grant execute on function public.admin_update_student_profile(uuid,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.admin_create_student_booking(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,text,text) to authenticated;
grant execute on function public.admin_assign_student_package(uuid,text,date,date,integer,numeric,text,text,uuid) to authenticated;
grant execute on function public.admin_complete_student_appointment(uuid,uuid,text,text,text,integer,text) to authenticated;
grant execute on function public.admin_review_bank_transfer(uuid,text) to authenticated;
