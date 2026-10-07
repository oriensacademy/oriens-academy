-- Keep money and lesson-entitlement refunds coupled under row locks.
-- No existing payment, package, lesson, or refund row is mutated by this migration.

alter table public.payment_refunds
  add column if not exists send_notification boolean not null default false;

drop function if exists public.admin_create_payment_refund_intent(uuid,numeric,integer,text,text);

create function public.admin_create_payment_refund_intent(
  p_transaction_id uuid, p_refund_amount numeric, p_lesson_rights_to_revoke integer,
  p_reason text, p_idempotency_key text, p_send_notification boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_refund public.payment_refunds%rowtype;
  v_amount numeric;
  v_reason text;
  v_key text;
  v_reference text;
  v_refundable numeric;
  v_unused integer;
  v_full_money boolean;
  v_all_unused boolean;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  v_amount:=round(coalesce(p_refund_amount,0),2);
  v_reason:=regexp_replace(btrim(coalesce(p_reason,'')),'\s+',' ','g');
  v_key:=btrim(coalesce(p_idempotency_key,''));
  if char_length(v_key) not between 8 and 100 then return jsonb_build_object('success',false,'error_code','INVALID_IDEMPOTENCY_KEY'); end if;
  select * into v_refund from public.payment_refunds where idempotency_key=v_key;
  if v_refund.id is not null then
    return jsonb_build_object('success',true,'already_exists',true,'refund_id',v_refund.id,'status',v_refund.status,'provider_reference',v_refund.provider_reference);
  end if;
  select * into v_tx from public.payment_transactions where id=p_transaction_id for update;
  if v_tx.id is null then return jsonb_build_object('success',false,'error_code','TRANSACTION_NOT_FOUND'); end if;
  if v_tx.status<>'paid' or v_tx.payment_method<>'card' or v_tx.provider<>'paytr' or v_tx.refund_status='full' then
    return jsonb_build_object('success',false,'error_code','TRANSACTION_NOT_REFUNDABLE');
  end if;
  select * into v_purchase from public.student_package_purchases where payment_transaction_id=v_tx.id for update;
  if v_purchase.id is null then return jsonb_build_object('success',false,'error_code','PACKAGE_PURCHASE_NOT_FOUND'); end if;
  if v_purchase.status<>'active' then return jsonb_build_object('success',false,'error_code','PACKAGE_NOT_REFUNDABLE'); end if;

  v_refundable:=round(v_tx.amount-coalesce(v_tx.refunded_amount,0),2);
  v_unused:=greatest(0,v_purchase.lesson_count-v_purchase.lessons_used);
  if v_amount<=0 or v_amount>v_refundable then return jsonb_build_object('success',false,'error_code','REFUND_AMOUNT_EXCEEDS_AVAILABLE'); end if;
  if coalesce(p_lesson_rights_to_revoke,0)<=0 or p_lesson_rights_to_revoke>v_unused then
    return jsonb_build_object('success',false,'error_code','REFUND_LESSONS_EXCEED_UNUSED');
  end if;
  if char_length(v_reason) not between 3 and 500 then return jsonb_build_object('success',false,'error_code','REFUND_REASON_REQUIRED'); end if;

  v_full_money := v_amount=v_refundable;
  v_all_unused := p_lesson_rights_to_revoke=v_unused;
  if v_full_money and not v_all_unused then return jsonb_build_object('success',false,'error_code','FULL_REFUND_REQUIRES_ALL_UNUSED_LESSONS'); end if;
  if v_all_unused and not v_full_money then return jsonb_build_object('success',false,'error_code','ALL_UNUSED_LESSONS_REQUIRE_FULL_REFUND'); end if;
  if not v_full_money and v_unused-p_lesson_rights_to_revoke<1 then return jsonb_build_object('success',false,'error_code','PARTIAL_REFUND_MUST_KEEP_ONE_LESSON'); end if;

  v_reference:='ORIREF'||upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.payment_refunds(
    payment_transaction_id,package_purchase_id,idempotency_key,provider_reference,
    requested_amount,lesson_rights_to_revoke,reason,created_by,send_notification
  ) values(
    v_tx.id,v_purchase.id,v_key,v_reference,v_amount,p_lesson_rights_to_revoke,
    v_reason,auth.uid(),coalesce(p_send_notification,false)
  ) returning * into v_refund;
  update public.student_package_purchases set status='refund_pending',updated_at=now() where id=v_purchase.id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'payment.refund_intent_created','payment_refund',v_refund.id::text,
    jsonb_build_object('transaction_id',v_tx.id,'amount',v_amount,'lessons',p_lesson_rights_to_revoke,'provider_reference',v_reference,'send_notification',coalesce(p_send_notification,false)));
  return jsonb_build_object('success',true,'already_exists',false,'refund_id',v_refund.id,'status',v_refund.status,'provider_reference',v_reference);
end $$;

create or replace function public.finalize_payment_refund(p_refund_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_refund public.payment_refunds%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_new_refunded numeric;
  v_new_refund_status text;
  v_new_remaining integer;
  v_refundable numeric;
  v_unused integer;
  v_holder record;
  v_learner_name text;
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

  v_refundable:=round(v_tx.amount-coalesce(v_tx.refunded_amount,0),2);
  v_unused:=greatest(0,v_purchase.lesson_count-v_purchase.lessons_used);
  if v_refund.requested_amount>v_refundable then raise exception 'REFUND_AMOUNT_EXCEEDS_AVAILABLE'; end if;
  if v_refund.lesson_rights_to_revoke>v_unused then raise exception 'REFUND_LESSONS_EXCEED_UNUSED'; end if;
  if v_refund.requested_amount=v_refundable and v_refund.lesson_rights_to_revoke<>v_unused then raise exception 'FULL_REFUND_REQUIRES_ALL_UNUSED_LESSONS'; end if;
  if v_refund.lesson_rights_to_revoke=v_unused and v_refund.requested_amount<>v_refundable then raise exception 'ALL_UNUSED_LESSONS_REQUIRE_FULL_REFUND'; end if;
  if v_refund.requested_amount<v_refundable and v_unused-v_refund.lesson_rights_to_revoke<1 then raise exception 'PARTIAL_REFUND_MUST_KEEP_ONE_LESSON'; end if;

  v_new_refunded:=round(coalesce(v_tx.refunded_amount,0)+v_refund.requested_amount,2);
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

  if v_refund.send_notification then
    select ga.user_id,ga.email,ga.full_name,ga.preferred_language,gs.relationship_role into v_holder
    from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
    where gs.student_id=v_purchase.student_user_id and gs.active and ga.active and ga.email_verified_at is not null
      and (v_tx.purchaser_guardian_user_id is null or ga.user_id=v_tx.purchaser_guardian_user_id)
    order by (ga.user_id=v_tx.purchaser_guardian_user_id) desc nulls last,gs.is_primary desc,gs.created_at asc limit 1;
    select full_name into v_learner_name from public.student_profiles where id=v_purchase.student_user_id;
    if v_holder.email is not null then
      perform public.enqueue_email_notification('payment.refunded','payment_refund',v_refund.id::text,v_holder.email,'payment_refunded_account_holder',jsonb_build_object(
        'refund_id',v_refund.id,'reference',v_tx.public_reference,'refund_reference',v_refund.provider_reference,
        'account_holder_name',v_holder.full_name,'learner_name',v_learner_name,'relationship_role',coalesce(v_holder.relationship_role,'other'),
        'refund_amount',v_refund.requested_amount,'currency',v_tx.currency,'package_name',v_purchase.lesson_count||' Ders',
        'revoked_lessons',v_refund.lesson_rights_to_revoke,'remaining_lessons',v_new_remaining,'refund_status',v_new_refund_status,
        'locale',coalesce(v_holder.preferred_language,'tr')
      ),'payment.refunded:'||v_refund.id||':account_holder');
    end if;
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(v_refund.created_by,'payment.refund_finalized','payment_refund',v_refund.id::text,
    jsonb_build_object('transaction_id',v_tx.id,'amount',v_refund.requested_amount,'lessons_revoked',v_refund.lesson_rights_to_revoke,'remaining_lessons',v_new_remaining,'provider_reference',v_refund.provider_reference,'notification_requested',v_refund.send_notification));
  return jsonb_build_object('success',true,'already_finalized',false,'refund_id',v_refund.id,'refund_status',v_new_refund_status,'refunded_amount',v_new_refunded,'remaining_lessons',v_new_remaining,'notification_requested',v_refund.send_notification);
end $$;

revoke all on function public.admin_create_payment_refund_intent(uuid,numeric,integer,text,text,boolean) from public,anon;
grant execute on function public.admin_create_payment_refund_intent(uuid,numeric,integer,text,text,boolean) to authenticated;
revoke all on function public.finalize_payment_refund(uuid) from public,anon,authenticated;
grant execute on function public.finalize_payment_refund(uuid) to service_role;

create or replace function public.admin_get_package_rights_notification_context(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_holder record; v_student_name text; v_packages jsonb; v_total integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select full_name into v_student_name from public.student_profiles where id=p_student_id;
  if v_student_name is null then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_FOUND'); end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language into v_holder
  from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=p_student_id and gs.active and ga.active and ga.email_verified_at is not null
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_holder.email is null then return jsonb_build_object('success',false,'error_code','NO_VERIFIED_ACCOUNT_HOLDER'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'name',p.lesson_count||' Ders','lesson_count',p.lesson_count,'used',p.lessons_used,
      'remaining',greatest(0,p.lesson_count-p.lessons_used)
    ) order by p.created_at),'[]'::jsonb),
    coalesce(sum(greatest(0,p.lesson_count-p.lessons_used)),0)::integer
  into v_packages,v_total
  from public.student_package_purchases p
  where p.student_user_id=p_student_id and p.status='active' and p.lesson_count>p.lessons_used;
  return jsonb_build_object('success',true,'student_id',p_student_id,'student_name',v_student_name,
    'recipient',lower(v_holder.email),'account_holder_name',v_holder.full_name,'locale',coalesce(v_holder.preferred_language,'tr'),
    'total_remaining_lessons',v_total,'packages',v_packages,'current_date',current_date);
end $$;

create or replace function public.admin_send_package_rights_notification(
  p_student_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_context jsonb; v_delivery_id uuid; v_key text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  v_key:=btrim(coalesce(p_idempotency_key,''));
  if char_length(v_key) not between 8 and 120 then return jsonb_build_object('success',false,'error_code','INVALID_IDEMPOTENCY_KEY'); end if;
  v_context:=public.admin_get_package_rights_notification_context(p_student_id);
  if not coalesce((v_context->>'success')::boolean,false) then return v_context; end if;
  v_delivery_id:=public.enqueue_email_notification(
    'package.rights_summary','student',p_student_id::text,v_context->>'recipient','package_rights_summary',v_context,
    'package.rights_summary:'||p_student_id||':'||v_key
  );
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'package.rights_summary_requested','student',p_student_id::text,
    jsonb_build_object('delivery_id',v_delivery_id,'recipient',v_context->>'recipient','total_remaining_lessons',v_context->>'total_remaining_lessons'));
  return jsonb_build_object('success',true,'delivery_id',v_delivery_id,'status','pending','recipient',v_context->>'recipient');
end $$;

revoke all on function public.admin_get_package_rights_notification_context(uuid) from public,anon;
revoke all on function public.admin_send_package_rights_notification(uuid,text) from public,anon;
grant execute on function public.admin_get_package_rights_notification_context(uuid) to authenticated;
grant execute on function public.admin_send_package_rights_notification(uuid,text) to authenticated;

-- Payment success mail also uses entitlement-derived display names.
create or replace function public.queue_payment_success_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_payload jsonb; v_locale text; v_lesson_count integer;
begin
  if new.status='paid' and old.status is distinct from 'paid' and new.payment_method='card' then
    v_locale:=coalesce(new.metadata->>'locale','tr');
    v_lesson_count:=coalesce(nullif(new.metadata->>'lesson_count','')::integer,
      (select lesson_count from public.pricing_packages where id=new.package_id));
    v_payload:=jsonb_build_object(
      'transaction_id',new.id,'reference',new.public_reference,'payer_name',new.payer_name,
      'payer_email',new.payer_email,'package_id',new.package_id,'lesson_count',v_lesson_count,
      'package_name',case when v_locale='en' then v_lesson_count||' Lessons' else v_lesson_count||' Ders' end,
      'student_id',new.package_owner_student_id,'amount',new.amount,'currency',new.currency,
      'paid_at',new.paid_at,'locale',v_locale
    );
    perform public.enqueue_email_notification('payment.success','payment_transaction',new.id::text,new.payer_email,
      'payment_success_guardian',v_payload,'payment.success:'||new.id||':guardian');
    perform public.enqueue_email_notification('payment.success.admin','payment_transaction',new.id::text,'admin@oriens-academy.com',
      'payment_success_admin',v_payload,'payment.success:'||new.id||':admin');
  end if;
  return new;
end $$;
