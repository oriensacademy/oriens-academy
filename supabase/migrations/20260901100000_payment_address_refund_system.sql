-- Forward-only PayTR refund intents, signed entitlement adjustments, and durable email events.
-- Historical captured-payment snapshots are deliberately left unchanged.

alter table public.payment_transactions
  add column if not exists refunded_amount numeric not null default 0,
  add column if not exists refund_status text not null default 'none',
  add column if not exists last_refunded_at timestamptz,
  add column if not exists last_refund_reason text,
  add column if not exists paytr_refund_reference text;

alter table public.payment_transactions drop constraint if exists payment_transactions_refunded_amount_check;
alter table public.payment_transactions add constraint payment_transactions_refunded_amount_check
  check (refunded_amount >= 0 and refunded_amount <= amount);
alter table public.payment_transactions drop constraint if exists payment_transactions_refund_status_check;
alter table public.payment_transactions add constraint payment_transactions_refund_status_check
  check (refund_status in ('none','partial','full'));

alter table public.student_package_purchases drop constraint if exists student_package_purchases_lesson_count_check;
alter table public.student_package_purchases add constraint student_package_purchases_lesson_count_check
  check (lesson_count >= 0);
alter table public.student_package_purchases drop constraint if exists student_package_purchases_lessons_used_check;
alter table public.student_package_purchases add constraint student_package_purchases_lessons_used_check
  check (lessons_used >= 0 and lessons_used <= lesson_count);
alter table public.student_package_purchases drop constraint if exists student_package_purchases_status_check;
alter table public.student_package_purchases add constraint student_package_purchases_status_check
  check (status in ('active','completed','expired','cancelled','refunded','refund_pending'));

alter table public.student_package_adjustments
  add column if not exists linked_payment_transaction_id uuid references public.payment_transactions(id) on delete restrict;
alter table public.student_package_adjustments drop constraint if exists student_package_adjustments_lesson_delta_check;
alter table public.student_package_adjustments add constraint student_package_adjustments_lesson_delta_check check (lesson_delta <> 0);
alter table public.student_package_adjustments drop constraint if exists student_package_adjustments_adjustment_type_check;
alter table public.student_package_adjustments add constraint student_package_adjustments_adjustment_type_check
  check (adjustment_type in ('extra_lessons','manual_adjustment','package_assigned','package_reactivated','lesson_completed','past_lesson_added','refund'));

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  package_purchase_id uuid not null references public.student_package_purchases(id) on delete restrict,
  idempotency_key text not null unique,
  provider_reference text not null unique,
  requested_amount numeric not null check (requested_amount > 0),
  lesson_rights_to_revoke integer not null check (lesson_rights_to_revoke > 0),
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'refund_pending'
    check (status in ('refund_pending','provider_calling','provider_succeeded','refund_succeeded','refund_failed','reconciliation_required')),
  provider_response jsonb not null default '{}'::jsonb,
  provider_error_code text,
  provider_error_message text,
  provider_call_started_at timestamptz,
  provider_succeeded_at timestamptz,
  finalized_at timestamptz,
  failed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The table may already have been provisioned empty in an earlier environment.
-- Complete it forward-only rather than assuming CREATE TABLE supplied every column.
alter table public.payment_refunds
  add column if not exists package_purchase_id uuid references public.student_package_purchases(id) on delete restrict,
  add column if not exists idempotency_key text,
  add column if not exists provider_reference text,
  add column if not exists requested_amount numeric,
  add column if not exists lesson_rights_to_revoke integer,
  add column if not exists reason text,
  add column if not exists status text not null default 'refund_pending',
  add column if not exists provider_response jsonb not null default '{}'::jsonb,
  add column if not exists provider_error_code text,
  add column if not exists provider_error_message text,
  add column if not exists provider_call_started_at timestamptz,
  add column if not exists provider_succeeded_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete restrict,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.payment_refunds drop constraint if exists payment_refunds_status_check;
alter table public.payment_refunds add constraint payment_refunds_status_check check (status in ('refund_pending','provider_calling','provider_succeeded','refund_succeeded','refund_failed','reconciliation_required'));
alter table public.payment_refunds drop constraint if exists payment_refunds_requested_amount_check;
alter table public.payment_refunds add constraint payment_refunds_requested_amount_check check (requested_amount > 0);
alter table public.payment_refunds drop constraint if exists payment_refunds_lesson_rights_to_revoke_check;
alter table public.payment_refunds add constraint payment_refunds_lesson_rights_to_revoke_check check (lesson_rights_to_revoke > 0);
create unique index if not exists payment_refunds_idempotency_unique on public.payment_refunds(idempotency_key);
create unique index if not exists payment_refunds_provider_reference_unique on public.payment_refunds(provider_reference);

alter table public.student_package_adjustments
  add column if not exists linked_refund_id uuid references public.payment_refunds(id) on delete restrict;
create unique index if not exists student_package_adjustments_refund_unique
  on public.student_package_adjustments(linked_refund_id) where linked_refund_id is not null;
create index if not exists payment_refunds_transaction_created_idx
  on public.payment_refunds(payment_transaction_id, created_at desc);
create index if not exists payment_refunds_recovery_idx
  on public.payment_refunds(status, updated_at) where status in ('provider_calling','provider_succeeded','reconciliation_required');

alter table public.payment_refunds enable row level security;
drop policy if exists "Admin read refund policy" on public.payment_refunds;
create policy "Admin read refund policy" on public.payment_refunds for select to authenticated using (public.is_admin());
grant select on public.payment_refunds to authenticated;
grant select,insert,update on public.payment_refunds to service_role;

create or replace function public.admin_get_payment_refund_context(p_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tx public.payment_transactions%rowtype; v_purchase public.student_package_purchases%rowtype;
  v_learner_name text; v_refunds jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_tx from public.payment_transactions where id=p_transaction_id;
  if v_tx.id is null then return jsonb_build_object('success',false,'error_code','TRANSACTION_NOT_FOUND'); end if;
  select * into v_purchase from public.student_package_purchases where payment_transaction_id=v_tx.id;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','PACKAGE_PURCHASE_NOT_FOUND'); end if;
  select full_name into v_learner_name from public.student_profiles where id=v_purchase.student_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'status',r.status,'amount',r.requested_amount,'lessons',r.lesson_rights_to_revoke,
    'reason',r.reason,'provider_reference',r.provider_reference,'created_at',r.created_at,
    'finalized_at',r.finalized_at,'admin_actor',r.created_by,'error_code',r.provider_error_code
  ) order by r.created_at desc),'[]'::jsonb) into v_refunds
  from public.payment_refunds r where r.payment_transaction_id=v_tx.id;
  return jsonb_build_object(
    'success',true,'transaction_id',v_tx.id,'reference',v_tx.public_reference,'account_holder',v_tx.payer_name,
    'learner',v_learner_name,'package_id',v_tx.package_id,'paid_amount',v_tx.amount,'currency',v_tx.currency,
    'refunded_amount',v_tx.refunded_amount,'refundable_amount',greatest(0,v_tx.amount-v_tx.refunded_amount),
    'refund_status',v_tx.refund_status,'package_purchase_id',v_purchase.id,'total_lessons',v_purchase.lesson_count,
    'completed_lessons',v_purchase.lessons_used,'remaining_lessons',greatest(0,v_purchase.lesson_count-v_purchase.lessons_used),
    'refunds',v_refunds
  );
end $$;

create or replace function public.admin_create_payment_refund_intent(
  p_transaction_id uuid, p_refund_amount numeric, p_lesson_rights_to_revoke integer,
  p_reason text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tx public.payment_transactions%rowtype; v_purchase public.student_package_purchases%rowtype;
  v_refund public.payment_refunds%rowtype; v_amount numeric; v_reason text; v_key text; v_reference text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  v_amount:=round(coalesce(p_refund_amount,0),2); v_reason:=regexp_replace(btrim(coalesce(p_reason,'')),'\s+',' ','g');
  v_key:=btrim(coalesce(p_idempotency_key,''));
  if char_length(v_key) not between 8 and 100 then return jsonb_build_object('success',false,'error_code','INVALID_IDEMPOTENCY_KEY'); end if;
  select * into v_refund from public.payment_refunds where idempotency_key=v_key;
  if v_refund.id is not null then return jsonb_build_object('success',true,'already_exists',true,'refund_id',v_refund.id,'status',v_refund.status,'provider_reference',v_refund.provider_reference); end if;
  select * into v_tx from public.payment_transactions where id=p_transaction_id for update;
  if v_tx.id is null then return jsonb_build_object('success',false,'error_code','TRANSACTION_NOT_FOUND'); end if;
  if v_tx.status<>'paid' or v_tx.payment_method<>'card' or v_tx.provider<>'paytr' or v_tx.refund_status='full' then
    return jsonb_build_object('success',false,'error_code','TRANSACTION_NOT_REFUNDABLE');
  end if;
  select * into v_purchase from public.student_package_purchases where payment_transaction_id=v_tx.id for update;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','PACKAGE_PURCHASE_NOT_FOUND'); end if;
  if v_purchase.status<>'active' then return jsonb_build_object('success',false,'error_code','PACKAGE_NOT_REFUNDABLE'); end if;
  if v_amount<=0 or v_amount>round(v_tx.amount-v_tx.refunded_amount,2) then return jsonb_build_object('success',false,'error_code','REFUND_AMOUNT_EXCEEDS_AVAILABLE'); end if;
  if coalesce(p_lesson_rights_to_revoke,0)<=0 or p_lesson_rights_to_revoke>(v_purchase.lesson_count-v_purchase.lessons_used) then
    return jsonb_build_object('success',false,'error_code','REFUND_LESSONS_EXCEED_UNUSED');
  end if;
  if char_length(v_reason) not between 3 and 500 then return jsonb_build_object('success',false,'error_code','REFUND_REASON_REQUIRED'); end if;
  v_reference:='ORIREF'||upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.payment_refunds(payment_transaction_id,package_purchase_id,idempotency_key,provider_reference,requested_amount,lesson_rights_to_revoke,reason,created_by)
  values(v_tx.id,v_purchase.id,v_key,v_reference,v_amount,p_lesson_rights_to_revoke,v_reason,auth.uid()) returning * into v_refund;
  -- Reserve the package while the network refund is in flight. Completion RPCs only
  -- consume active packages, so provider success can never leave these rights usable.
  update public.student_package_purchases set status='refund_pending',updated_at=now() where id=v_purchase.id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'payment.refund_intent_created','payment_refund',v_refund.id::text,jsonb_build_object('transaction_id',v_tx.id,'amount',v_amount,'lessons',p_lesson_rights_to_revoke,'provider_reference',v_reference));
  return jsonb_build_object('success',true,'already_exists',false,'refund_id',v_refund.id,'status',v_refund.status,'provider_reference',v_reference);
end $$;

create or replace function public.claim_payment_refund_provider_call(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_refund public.payment_refunds%rowtype; v_tx public.payment_transactions%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_refund from public.payment_refunds where id=p_refund_id for update;
  if v_refund.id is null then return jsonb_build_object('success',false,'error_code','REFUND_NOT_FOUND'); end if;
  select * into v_tx from public.payment_transactions where id=v_refund.payment_transaction_id;
  if v_refund.status='refund_pending' then
    update public.payment_refunds set status='provider_calling',provider_call_started_at=now(),updated_at=now() where id=v_refund.id;
    return jsonb_build_object('success',true,'claimed',true,'status','provider_calling','refund_id',v_refund.id,'merchant_oid',v_tx.public_reference,'return_amount',v_refund.requested_amount,'provider_reference',v_refund.provider_reference);
  end if;
  return jsonb_build_object('success',true,'claimed',false,'status',v_refund.status,'refund_id',v_refund.id,'merchant_oid',v_tx.public_reference,'return_amount',v_refund.requested_amount,'provider_reference',v_refund.provider_reference);
end $$;

create or replace function public.mark_payment_refund_provider_succeeded(p_refund_id uuid,p_provider_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update public.payment_refunds set status='provider_succeeded',provider_response=coalesce(p_provider_response,'{}'::jsonb),provider_succeeded_at=now(),updated_at=now()
  where id=p_refund_id and status='provider_calling';
  if not found and not exists(select 1 from public.payment_refunds where id=p_refund_id and status in ('provider_succeeded','refund_succeeded')) then
    return jsonb_build_object('success',false,'error_code','INVALID_REFUND_STATE');
  end if;
  return jsonb_build_object('success',true,'refund_id',p_refund_id);
end $$;

create or replace function public.mark_payment_refund_failed(p_refund_id uuid,p_error_code text,p_error_message text,p_provider_response jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update public.payment_refunds set status='refund_failed',provider_error_code=left(p_error_code,100),provider_error_message=left(p_error_message,500),provider_response=coalesce(p_provider_response,'{}'::jsonb),failed_at=now(),updated_at=now()
  where id=p_refund_id and status='provider_calling';
  if found then
    update public.student_package_purchases set status='active',updated_at=now()
    where id=(select package_purchase_id from public.payment_refunds where id=p_refund_id) and status='refund_pending';
  end if;
  return jsonb_build_object('success',found,'refund_id',p_refund_id);
end $$;

create or replace function public.finalize_payment_refund(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_refund public.payment_refunds%rowtype; v_tx public.payment_transactions%rowtype; v_purchase public.student_package_purchases%rowtype;
  v_new_refunded numeric; v_new_refund_status text; v_new_remaining integer; v_holder record; v_learner_name text; v_package_name text;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_refund from public.payment_refunds where id=p_refund_id for update;
  if v_refund.id is null then return jsonb_build_object('success',false,'error_code','REFUND_NOT_FOUND'); end if;
  if v_refund.status='refund_succeeded' then return jsonb_build_object('success',true,'already_finalized',true,'refund_id',v_refund.id); end if;
  if v_refund.status<>'provider_succeeded' then return jsonb_build_object('success',false,'error_code','PROVIDER_SUCCESS_REQUIRED','status',v_refund.status); end if;
  select * into v_tx from public.payment_transactions where id=v_refund.payment_transaction_id for update;
  select * into v_purchase from public.student_package_purchases where id=v_refund.package_purchase_id for update;
  if v_tx.id is null or v_purchase.id is null then raise exception 'REFUND_LOCAL_RECORD_MISSING'; end if;
  if v_purchase.status<>'refund_pending' then raise exception 'REFUND_PACKAGE_RESERVATION_MISSING'; end if;
  if v_refund.requested_amount>round(v_tx.amount-v_tx.refunded_amount,2) then raise exception 'REFUND_AMOUNT_EXCEEDS_AVAILABLE'; end if;
  if v_refund.lesson_rights_to_revoke>(v_purchase.lesson_count-v_purchase.lessons_used) then raise exception 'REFUND_LESSONS_EXCEED_UNUSED'; end if;
  v_new_refunded:=round(v_tx.refunded_amount+v_refund.requested_amount,2);
  v_new_refund_status:=case when v_new_refunded>=v_tx.amount then 'full' else 'partial' end;
  v_new_remaining:=v_purchase.lesson_count-v_refund.lesson_rights_to_revoke-v_purchase.lessons_used;
  update public.payment_transactions set refunded_amount=v_new_refunded,refund_status=v_new_refund_status,
    last_refunded_at=now(),last_refund_reason=v_refund.reason,paytr_refund_reference=v_refund.provider_reference,
    status=case when v_new_refund_status='full' then 'refunded' else status end where id=v_tx.id;
  update public.student_package_purchases set lesson_count=lesson_count-v_refund.lesson_rights_to_revoke,
    status=case when v_new_remaining=0 then 'refunded' else 'active' end,updated_at=now() where id=v_purchase.id;
  insert into public.student_package_adjustments(student_user_id,package_purchase_id,adjustment_type,lesson_delta,price_amount,currency,payment_status,notes,created_by,linked_payment_transaction_id,linked_refund_id)
  values(v_purchase.student_user_id,v_purchase.id,'refund',-v_refund.lesson_rights_to_revoke,v_refund.requested_amount,v_tx.currency,'refunded',v_refund.reason,v_refund.created_by,v_tx.id,v_refund.id);
  update public.payment_refunds set status='refund_succeeded',finalized_at=now(),updated_at=now() where id=v_refund.id;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language,gs.relationship_role into v_holder
  from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=v_purchase.student_user_id and gs.active and ga.active
    and (v_tx.purchaser_guardian_user_id is null or ga.user_id=v_tx.purchaser_guardian_user_id)
  order by (ga.user_id=v_tx.purchaser_guardian_user_id) desc nulls last,gs.is_primary desc,gs.created_at asc limit 1;
  select full_name into v_learner_name from public.student_profiles where id=v_purchase.student_user_id;
  select case when coalesce(v_holder.preferred_language,'tr')='en' then name_en else name_tr end into v_package_name from public.pricing_packages where id=v_tx.package_id;
  if v_holder.email is not null then
    perform public.enqueue_email_notification('payment.refunded','payment_refund',v_refund.id::text,v_holder.email,'payment_refunded_account_holder',jsonb_build_object(
      'refund_id',v_refund.id,'reference',v_tx.public_reference,'refund_reference',v_refund.provider_reference,
      'account_holder_name',v_holder.full_name,'learner_name',v_learner_name,'relationship_role',coalesce(v_holder.relationship_role,'other'),
      'refund_amount',v_refund.requested_amount,'currency',v_tx.currency,'package_name',coalesce(v_package_name,v_tx.package_id),
      'revoked_lessons',v_refund.lesson_rights_to_revoke,'remaining_lessons',v_new_remaining,'refund_status',v_new_refund_status,
      'locale',coalesce(v_holder.preferred_language,'tr')
    ),'payment.refunded:'||v_refund.id||':account_holder');
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(v_refund.created_by,'payment.refund_finalized','payment_refund',v_refund.id::text,jsonb_build_object('transaction_id',v_tx.id,'amount',v_refund.requested_amount,'lessons_revoked',v_refund.lesson_rights_to_revoke,'remaining_lessons',v_new_remaining,'provider_reference',v_refund.provider_reference));
  return jsonb_build_object('success',true,'already_finalized',false,'refund_id',v_refund.id,'refund_status',v_new_refund_status,'refunded_amount',v_new_refunded,'remaining_lessons',v_new_remaining);
end $$;

revoke all on function public.admin_get_payment_refund_context(uuid) from public,anon;
revoke all on function public.admin_create_payment_refund_intent(uuid,numeric,integer,text,text) from public,anon;
grant execute on function public.admin_get_payment_refund_context(uuid) to authenticated;
grant execute on function public.admin_create_payment_refund_intent(uuid,numeric,integer,text,text) to authenticated;
revoke all on function public.claim_payment_refund_provider_call(uuid) from public,anon,authenticated;
revoke all on function public.mark_payment_refund_provider_succeeded(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.mark_payment_refund_failed(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.finalize_payment_refund(uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_refund_provider_call(uuid) to service_role;
grant execute on function public.mark_payment_refund_provider_succeeded(uuid,jsonb) to service_role;
grant execute on function public.mark_payment_refund_failed(uuid,text,text,jsonb) to service_role;
grant execute on function public.finalize_payment_refund(uuid) to service_role;
