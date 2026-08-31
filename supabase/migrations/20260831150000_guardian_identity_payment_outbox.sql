-- Guardian/account-holder separation, learner ownership, payment identity and durable mail outbox.
-- Forward-only: historical payment snapshot columns are never rewritten.

create table if not exists public.guardian_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null,
  phone text,
  contact_address text,
  preferred_language text not null default 'tr' check (preferred_language in ('tr', 'en')),
  email_verified_at timestamptz,
  active boolean not null default true,
  migration_source text not null default 'native_guardian',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists guardian_accounts_email_unique
  on public.guardian_accounts (lower(email));

alter table public.student_profiles
  add column if not exists legacy_auth_user_id uuid,
  add column if not exists migration_source text not null default 'native_learner';

-- Existing canonical completion functions already update this timestamp; the
-- original lesson table omitted the column, leaving completion broken at runtime.
alter table public.student_lessons add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_student_lessons_updated_at on public.student_lessons;
create trigger trg_student_lessons_updated_at before update on public.student_lessons
  for each row execute function public.set_updated_at();

-- A learner is no longer required to be an auth principal. Existing IDs are preserved.
do $$
declare v_constraint text;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'student_profiles' and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%auth.users%'
  loop
    execute format('alter table public.student_profiles drop constraint %I', v_constraint);
  end loop;
end $$;

create unique index if not exists student_profiles_legacy_auth_user_unique
  on public.student_profiles (legacy_auth_user_id) where legacy_auth_user_id is not null;

create table if not exists public.identity_migration_review (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','resolved','ignored')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  unique(entity_type,entity_id,reason)
);
alter table public.identity_migration_review enable row level security;
create policy "Admin identity migration review" on public.identity_migration_review
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,update on public.identity_migration_review to authenticated;
grant all on public.identity_migration_review to service_role;

-- Classify unsafe rows before any relationship backfill. No name/email matching is used.
insert into public.identity_migration_review(entity_type,entity_id,reason)
select 'student_profile',sp.id::text,
  case when u.id is null then 'NO_MATCHING_AUTH_UUID' else 'ADMIN_AUTH_UUID_COLLISION' end
from public.student_profiles sp
left join auth.users u on u.id=sp.id
where u.id is null or coalesce(u.raw_app_meta_data->>'role','')='admin'
on conflict(entity_type,entity_id,reason) do nothing;

insert into public.identity_migration_review(entity_type,entity_id,reason)
select 'payment_transaction',pt.id::text,'HISTORICAL_OWNER_HAS_NO_LEARNER_PROFILE'
from public.payment_transactions pt
where pt.student_user_id is not null
  and not exists(select 1 from public.student_profiles sp where sp.id=pt.student_user_id)
on conflict(entity_type,entity_id,reason) do nothing;

insert into public.identity_migration_review(entity_type,entity_id,reason)
select 'student_package_purchase',spp.id::text,'HISTORICAL_OWNER_HAS_NO_LEARNER_PROFILE'
from public.student_package_purchases spp
where spp.student_user_id is not null
  and not exists(select 1 from public.student_profiles sp where sp.id=spp.student_user_id)
on conflict(entity_type,entity_id,reason) do nothing;

create table if not exists public.guardian_students (
  guardian_user_id uuid not null references public.guardian_accounts(user_id) on delete restrict,
  student_id uuid not null references public.student_profiles(id) on delete restrict,
  relationship_role text not null default 'guardian' check (relationship_role in ('parent', 'guardian', 'self', 'other')),
  is_primary boolean not null default true,
  active boolean not null default true,
  source text not null default 'native',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guardian_user_id, student_id)
);

create index if not exists guardian_students_student_active_idx
  on public.guardian_students (student_id, guardian_user_id) where active;

-- Safe legacy rule: the profile and non-admin auth principal share the same immutable UUID.
-- Email-confirmation state is copied; no ownership is inferred from names/emails.
insert into public.guardian_accounts (
  user_id, full_name, email, phone, contact_address, preferred_language,
  email_verified_at, active, migration_source
)
select
  u.id,
  sp.full_name,
  lower(u.email),
  sp.phone,
  nullif(btrim(u.raw_user_meta_data->>'contact_address'), ''),
  sp.preferred_language,
  u.email_confirmed_at,
  sp.active,
  'legacy_self_guardian_v1'
from public.student_profiles sp
join auth.users u on u.id = sp.id
where u.email is not null
  and coalesce(u.raw_app_meta_data->>'role', '') <> 'admin'
on conflict (user_id) do nothing;

update public.student_profiles sp
set legacy_auth_user_id = sp.id,
    migration_source = 'legacy_student_account_v1'
where sp.legacy_auth_user_id is null
  and exists (
    select 1 from auth.users u
    where u.id = sp.id and coalesce(u.raw_app_meta_data->>'role', '') <> 'admin'
  );

insert into public.guardian_students (
  guardian_user_id, student_id, relationship_role, is_primary, active, source
)
select ga.user_id, sp.id, 'self', true, true, 'legacy_same_auth_uuid_v1'
from public.guardian_accounts ga
join public.student_profiles sp on sp.legacy_auth_user_id = ga.user_id
where ga.migration_source = 'legacy_self_guardian_v1'
on conflict (guardian_user_id, student_id) do nothing;

-- Academic/entitlement foreign keys now target learner records. NOT VALID preserves any
-- pre-existing orphan/admin-owned historical rows for manual review while protecting new writes.
do $$
declare
  v record;
  v_constraint text;
begin
  for v in
    select * from (values
      ('bookings','student_user_id'),
      ('student_lessons','student_user_id'),
      ('student_homework','student_user_id'),
      ('student_admin_notes','student_user_id'),
      ('discount_coupon_redemptions','student_user_id'),
      ('support_threads','student_user_id'),
      ('student_exam_attempts','student_user_id'),
      ('student_package_purchases','student_user_id'),
      ('student_package_adjustments','student_user_id')
    ) as x(table_name, column_name)
  loop
    if to_regclass('public.' || v.table_name) is null then continue; end if;
    for v_constraint in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = v.table_name and c.contype = 'f'
        and pg_get_constraintdef(c.oid) ilike '%auth.users%'
        and pg_get_constraintdef(c.oid) ilike '%' || v.column_name || '%'
    loop
      execute format('alter table public.%I drop constraint %I', v.table_name, v_constraint);
    end loop;
    begin
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.student_profiles(id) on delete restrict not valid',
        v.table_name, v.table_name || '_' || v.column_name || '_learner_fkey', v.column_name
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

create or replace function public.can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.guardian_students gs
    join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
    where gs.guardian_user_id = auth.uid()
      and gs.student_id = p_student_id
      and gs.active and ga.active
  );
$$;
revoke all on function public.can_access_student(uuid) from public, anon;
grant execute on function public.can_access_student(uuid) to authenticated, service_role;

create or replace function public.save_student_preferences(
  p_student_id uuid, p_exams text[], p_countries text[],
  p_mark_onboarding_completed boolean default true, p_language text default 'tr'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_updated_profile record;
  v_target_exam text := null;
  v_target_country text := null;
  v_lang text := case when lower(trim(coalesce(p_language,''))) in ('en','en-us','en-gb','english') then 'en' else 'tr' end;
begin
  if auth.uid() is null and current_user not in ('postgres','service_role') and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if auth.uid() is not null and not public.can_access_student(p_student_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if coalesce(array_length(p_exams,1),0)>0 then v_target_exam:=p_exams[1]; end if;
  if coalesce(array_length(p_countries,1),0)>0 then v_target_country:=p_countries[1]; end if;
  update public.student_profiles set
    target_exams=coalesce(p_exams,target_exams), target_countries=coalesce(p_countries,target_countries),
    target_exam=coalesce(v_target_exam,target_exam), target_country=coalesce(v_target_country,target_country),
    preferred_language=v_lang,
    onboarding_completed=case when p_mark_onboarding_completed then true else onboarding_completed end,
    updated_at=now()
  where id=p_student_id returning * into v_updated_profile;
  if not found then return jsonb_build_object('success',false,'error_code','STUDENT_NOT_FOUND'); end if;
  return jsonb_build_object('success',true,'profile',row_to_json(v_updated_profile));
end;
$$;
revoke all on function public.save_student_preferences(uuid,text[],text[],boolean,text) from public,anon;
grant execute on function public.save_student_preferences(uuid,text[],text[],boolean,text) to authenticated,service_role;

alter table public.guardian_accounts enable row level security;
alter table public.guardian_students enable row level security;

create policy "Guardian own account read" on public.guardian_accounts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Guardian own account update" on public.guardian_accounts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admin guardian accounts" on public.guardian_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Guardian own learner links read" on public.guardian_students
  for select to authenticated using (guardian_user_id = auth.uid() or public.is_admin());
create policy "Admin guardian learner links" on public.guardian_students
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.guardian_accounts, public.guardian_students to authenticated;
grant update (full_name, phone, contact_address, preferred_language) on public.guardian_accounts to authenticated;
grant all on public.guardian_accounts, public.guardian_students to service_role;

-- Replace direct auth.uid() learner policies with guardian ownership.
drop policy if exists "Student own profile read" on public.student_profiles;
drop policy if exists "Student own profile update" on public.student_profiles;
create policy "Guardian linked learner read" on public.student_profiles
  for select to authenticated using (public.can_access_student(id));
create policy "Guardian linked learner update" on public.student_profiles
  for update to authenticated using (public.can_access_student(id)) with check (public.can_access_student(id));

drop policy if exists "Student own bookings read" on public.bookings;
create policy "Guardian linked bookings read" on public.bookings
  for select to authenticated using (public.can_access_student(student_user_id));
drop policy if exists "Student related slots read" on public.availability_slots;
create policy "Guardian linked booking slots read" on public.availability_slots
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.bookings b
      where b.slot_id=availability_slots.id and public.can_access_student(b.student_user_id)
    )
  );
drop policy if exists "Student own lessons read" on public.student_lessons;
create policy "Guardian linked lessons read" on public.student_lessons
  for select to authenticated using (public.can_access_student(student_user_id));
drop policy if exists "Student own homework read" on public.student_homework;
drop policy if exists "Student own homework submit" on public.student_homework;
create policy "Guardian linked homework read" on public.student_homework
  for select to authenticated using (public.can_access_student(student_user_id));
create policy "Guardian linked homework submit" on public.student_homework
  for update to authenticated using (public.can_access_student(student_user_id)) with check (public.can_access_student(student_user_id));

drop policy if exists "Student own payment transaction read policy" on public.payment_transactions;
drop policy if exists "Student own package purchase read policy" on public.student_package_purchases;

alter table public.payment_transactions
  add column if not exists auth_actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists purchaser_guardian_user_id uuid references public.guardian_accounts(user_id) on delete restrict,
  add column if not exists package_owner_student_id uuid references public.student_profiles(id) on delete restrict,
  add column if not exists payer_address text,
  add column if not exists identity_selection_method text;

create policy "Guardian payment visibility" on public.payment_transactions
  for select to authenticated using (
    public.is_admin()
    or purchaser_guardian_user_id = auth.uid()
    or public.can_access_student(package_owner_student_id)
  );
create policy "Guardian package visibility" on public.student_package_purchases
  for select to authenticated using (public.can_access_student(student_user_id));

drop policy if exists "Students can view own exam attempts" on public.student_exam_attempts;
create policy "Guardian linked exam attempts read" on public.student_exam_attempts
  for select to authenticated using (public.can_access_student(student_user_id));

drop policy if exists "Students can view own exam preferences" on public.student_exam_preferences;
drop policy if exists "Students can insert own exam preferences" on public.student_exam_preferences;
drop policy if exists "Students can delete own exam preferences" on public.student_exam_preferences;
create policy "Guardian linked exam preferences read" on public.student_exam_preferences for select to authenticated using (public.can_access_student(student_user_id));
create policy "Guardian linked exam preferences insert" on public.student_exam_preferences for insert to authenticated with check (public.can_access_student(student_user_id));
create policy "Guardian linked exam preferences delete" on public.student_exam_preferences for delete to authenticated using (public.can_access_student(student_user_id));

drop policy if exists "Students can view own destination preferences" on public.student_destination_preferences;
drop policy if exists "Students can insert own destination preferences" on public.student_destination_preferences;
drop policy if exists "Students can delete own destination preferences" on public.student_destination_preferences;
create policy "Guardian linked destination preferences read" on public.student_destination_preferences for select to authenticated using (public.can_access_student(student_user_id));
create policy "Guardian linked destination preferences insert" on public.student_destination_preferences for insert to authenticated with check (public.can_access_student(student_user_id));
create policy "Guardian linked destination preferences delete" on public.student_destination_preferences for delete to authenticated using (public.can_access_student(student_user_id));

drop policy if exists "student_select_own_support_threads" on public.support_threads;
drop policy if exists "student_insert_own_support_threads" on public.support_threads;
drop policy if exists "student_update_own_support_threads" on public.support_threads;
create policy "Guardian linked support threads read" on public.support_threads for select to authenticated using (public.can_access_student(student_user_id));
create policy "Guardian linked support threads insert" on public.support_threads for insert to authenticated with check (public.can_access_student(student_user_id));
create policy "Guardian linked support threads update" on public.support_threads for update to authenticated using (public.can_access_student(student_user_id)) with check (public.can_access_student(student_user_id));

drop policy if exists "student_select_own_support_messages" on public.support_messages;
drop policy if exists "student_insert_own_support_messages" on public.support_messages;
create policy "Guardian linked support messages read" on public.support_messages for select to authenticated using (
  exists(select 1 from public.support_threads st where st.id=thread_id and public.can_access_student(st.student_user_id))
);
create policy "Guardian linked support messages insert" on public.support_messages for insert to authenticated with check (
  exists(select 1 from public.support_threads st where st.id=thread_id and public.can_access_student(st.student_user_id))
);

drop policy if exists "Student own read adjustments policy" on public.student_package_adjustments;
create policy "Guardian linked package adjustments read" on public.student_package_adjustments for select to authenticated using (public.can_access_student(student_user_id));

-- Interactive homework rows and storage paths are learner-scoped as well.
drop policy if exists "Student read own homework answers" on public.homework_student_answers;
create policy "Guardian linked homework answers read" on public.homework_student_answers for select to authenticated using (
  exists(select 1 from public.student_homework h where h.id=student_homework_id and public.can_access_student(h.student_user_id))
);
drop policy if exists "Student read own homework attachment rows" on public.homework_attachments;
drop policy if exists "Student add own submission attachment rows" on public.homework_attachments;
create policy "Guardian linked homework attachment rows read" on public.homework_attachments for select to authenticated using (
  exists(select 1 from public.student_homework h where public.can_access_student(h.student_user_id) and (h.id=student_homework_id or h.assignment_id=assignment_id))
);
create policy "Guardian linked submission attachment rows insert" on public.homework_attachments for insert to authenticated with check (
  attachment_kind='submission' and uploaded_by=auth.uid() and exists(
    select 1 from public.student_homework h
    where h.id=student_homework_id and public.can_access_student(h.student_user_id)
      and h.status in ('assigned','in_progress','overdue')
  )
);

drop policy if exists "Student upload own homework attachments" on storage.objects;
drop policy if exists "Student read own homework attachments" on storage.objects;
drop policy if exists "Student update own homework attachments" on storage.objects;
drop policy if exists "Student delete own homework attachments" on storage.objects;
create policy "Guardian upload linked homework attachments" on storage.objects for insert to authenticated with check (
  bucket_id='homework-attachments' and (storage.foldername(name))[1]='submissions'
  and exists(select 1 from public.student_profiles sp where sp.id::text=(storage.foldername(name))[2] and public.can_access_student(sp.id))
  and lower(storage.extension(name)) in ('pdf','doc','docx','ppt','pptx','xls','xlsx','png','jpg','jpeg','webp')
);
create policy "Guardian read linked homework attachments" on storage.objects for select to authenticated using (
  bucket_id='homework-attachments' and (
    exists(select 1 from public.student_profiles sp where sp.id::text=(storage.foldername(name))[2] and public.can_access_student(sp.id))
    or exists(
      select 1 from public.homework_attachments a join public.student_homework h on h.assignment_id=a.assignment_id
      where a.storage_path=storage.objects.name and a.attachment_kind='resource' and public.can_access_student(h.student_user_id)
    )
  )
);
create policy "Guardian update linked homework attachments" on storage.objects for update to authenticated
  using (bucket_id='homework-attachments' and exists(select 1 from public.student_profiles sp where sp.id::text=(storage.foldername(name))[2] and public.can_access_student(sp.id)))
  with check (bucket_id='homework-attachments' and exists(select 1 from public.student_profiles sp where sp.id::text=(storage.foldername(name))[2] and public.can_access_student(sp.id)));
create policy "Guardian delete linked homework attachments" on storage.objects for delete to authenticated using (
  bucket_id='homework-attachments' and exists(select 1 from public.student_profiles sp where sp.id::text=(storage.foldername(name))[2] and public.can_access_student(sp.id))
);

create or replace function public.get_student_homework_detail(p_homework_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_homework public.student_homework%rowtype; v_assignment public.homework_assignments%rowtype;
begin
  select * into v_homework from public.student_homework where id=p_homework_id;
  if v_homework.id is null or not public.can_access_student(v_homework.student_user_id) then
    raise exception 'HOMEWORK_NOT_FOUND' using errcode='42501';
  end if;
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
  select * into v_homework from public.student_homework where id=p_homework_id for update;
  if v_homework.id is null or not public.can_access_student(v_homework.student_user_id)
    or v_homework.status not in ('assigned','in_progress','overdue') then
    return jsonb_build_object('success',false,'error_code','HOMEWORK_LOCKED');
  end if;
  for v_answer in select value from jsonb_array_elements(coalesce(p_answers,'[]')) loop
    if exists(select 1 from public.homework_questions q where q.id=(v_answer->>'question_id')::uuid and q.assignment_id=v_homework.assignment_id
      and (nullif(v_answer->>'selected_option_id','') is null or exists(select 1 from public.homework_question_options o where o.id=(v_answer->>'selected_option_id')::uuid and o.question_id=q.id))) then
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
declare v_result jsonb; v_student_id uuid;
begin
  select student_user_id into v_student_id from public.student_homework where id=p_homework_id;
  if v_student_id is null or not public.can_access_student(v_student_id) then
    return jsonb_build_object('success',false,'error_code','HOMEWORK_FORBIDDEN');
  end if;
  v_result:=public.save_homework_draft(p_homework_id,p_answers);
  if not coalesce((v_result->>'success')::boolean,false) then return v_result; end if;
  update public.student_homework set status='submitted',submitted_at=now(),updated_at=now() where id=p_homework_id and student_user_id=v_student_id;
  return jsonb_build_object('success',true,'submitted_at',now());
end; $$;

-- The canonical admin completion RPC performs the single locked FIFO consumption.
-- Keeping the legacy AFTER trigger would consume a second lesson for the same transition.
drop trigger if exists trg_sync_package_usage_from_lesson on public.student_lessons;

create index if not exists payment_transactions_purchaser_idx
  on public.payment_transactions (purchaser_guardian_user_id, created_at desc);
create index if not exists payment_transactions_owner_idx
  on public.payment_transactions (package_owner_student_id, created_at desc);

-- Close the legacy RPC that accepted client-selected payer identity/bank transfer.
-- Historical review RPCs remain available to admins; only new customer creation is revoked.
do $$
declare v_signature text;
begin
  for v_signature in
    select p.oid::regprocedure::text from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_student_checkout'
  loop
    execute 'revoke all on function ' || v_signature || ' from public, anon, authenticated';
    execute 'grant execute on function ' || v_signature || ' to service_role';
  end loop;
end $$;

-- Canonical guardian profile mutation: email and payment snapshots are intentionally excluded.
create or replace function public.update_guardian_profile(
  p_full_name text,
  p_phone text,
  p_contact_address text,
  p_preferred_language text default 'tr'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := regexp_replace(btrim(coalesce(p_phone, '')), '[\s().-]+', '', 'g');
  v_address text := regexp_replace(btrim(coalesce(p_contact_address, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 100 then raise exception 'INVALID_FULL_NAME'; end if;
  if v_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_address) not between 10 and 300 then raise exception 'INVALID_CONTACT_ADDRESS'; end if;
  if p_preferred_language not in ('tr','en') then raise exception 'INVALID_LANGUAGE'; end if;
  if (select count(*) from public.audit_logs
      where actor_user_id = auth.uid() and action = 'guardian.profile_updated'
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'PROFILE_UPDATE_RATE_LIMIT';
  end if;

  update public.guardian_accounts
  set full_name = v_name, phone = v_phone, contact_address = v_address,
      preferred_language = p_preferred_language, updated_at = now()
  where user_id = auth.uid() and active;
  if not found then raise exception 'GUARDIAN_ACCOUNT_NOT_FOUND'; end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'guardian.profile_updated', 'guardian_account', auth.uid()::text,
    jsonb_build_object('fields', jsonb_build_array('full_name','phone','contact_address','preferred_language')));
  return jsonb_build_object('success', true);
end;
$$;
revoke all on function public.update_guardian_profile(text,text,text,text) from public, anon;
grant execute on function public.update_guardian_profile(text,text,text,text) to authenticated;

-- Signup creates a guardian/account holder and an initial legacy-compatible learner.
create or replace function public.create_student_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  if new.email is null or coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then return new; end if;
  v_name := left(regexp_replace(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email,'@',1)), '\s+', ' ', 'g'), 100);
  if char_length(v_name) < 2 then v_name := 'Guardian'; end if;

  insert into public.guardian_accounts(
    user_id, full_name, email, phone, contact_address, preferred_language,
    email_verified_at, active, migration_source
  ) values (
    new.id, v_name, lower(new.email), left(nullif(btrim(new.raw_user_meta_data->>'phone'),''),30),
    left(nullif(btrim(new.raw_user_meta_data->>'contact_address'),''),300),
    case when new.raw_user_meta_data->>'preferred_language'='en' then 'en' else 'tr' end,
    new.email_confirmed_at, (new.email_confirmed_at is not null), 'native_guardian_v1'
  ) on conflict(user_id) do nothing;

  insert into public.student_profiles(
    id, legacy_auth_user_id, migration_source, full_name, email, phone, preferred_language,
    school, target_country, target_university, target_exam
  ) values (
    new.id, new.id, 'signup_initial_learner_v1',
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'learner_name'),''), v_name),100),
    lower(new.email), null, case when new.raw_user_meta_data->>'preferred_language'='en' then 'en' else 'tr' end,
    left(nullif(btrim(new.raw_user_meta_data->>'school'),''),160),
    left(nullif(btrim(new.raw_user_meta_data->>'target_country'),''),120),
    left(nullif(btrim(new.raw_user_meta_data->>'target_university'),''),160),
    left(nullif(btrim(new.raw_user_meta_data->>'target_exam'),''),80)
  ) on conflict(id) do nothing;

  insert into public.guardian_students(guardian_user_id, student_id, relationship_role, is_primary, source)
  values(new.id, new.id, 'self', true, 'signup_initial_learner_v1')
  on conflict(guardian_user_id,student_id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_guardian_auth_state()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.guardian_accounts
  set email = lower(new.email), email_verified_at = new.email_confirmed_at,
      active = (new.email_confirmed_at is not null), updated_at = now()
  where user_id = new.id;
  update public.student_profiles set email = lower(new.email), updated_at = now()
  where legacy_auth_user_id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_changed_student_profile on auth.users;
drop trigger if exists on_auth_user_state_changed_guardian on auth.users;
create trigger on_auth_user_state_changed_guardian
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_guardian_auth_state();

-- Guardian-aware immutable learner ownership checks.
create or replace function public.protect_student_profile_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    if not public.can_access_student(old.id) then raise exception 'LEARNER_PROFILE_FORBIDDEN' using errcode='42501'; end if;
    new.id := old.id; new.email := old.email; new.active := old.active;
    new.created_at := old.created_at; new.legacy_auth_user_id := old.legacy_auth_user_id;
    new.migration_source := old.migration_source;
  end if;
  return new;
end;
$$;

create or replace function public.protect_student_homework_submission()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    if not public.can_access_student(old.student_user_id) then raise exception 'HOMEWORK_FORBIDDEN' using errcode='42501'; end if;
    if old.status not in ('assigned','late','submitted') then raise exception 'HOMEWORK_REVIEW_LOCKED' using errcode='42501'; end if;
    new.id:=old.id; new.student_user_id:=old.student_user_id; new.lesson_id:=old.lesson_id;
    new.title:=old.title; new.description:=old.description; new.due_date:=old.due_date;
    new.teacher_feedback:=old.teacher_feedback; new.created_at:=old.created_at;
    if nullif(btrim(coalesce(new.submission_text,'')),'') is null then raise exception 'HOMEWORK_SUBMISSION_REQUIRED'; end if;
    new.status:='submitted'; new.submitted_at:=now();
  end if;
  return new;
end;
$$;

-- Extend the existing delivery log into a durable, claimable outbox without deleting old rows.
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_status_check check (status in ('pending','processing','sent','failed')),
  add column if not exists template text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists dedupe_key text;
alter table public.notification_deliveries alter column attempt_count set default 0;
create unique index if not exists notification_deliveries_dedupe_unique
  on public.notification_deliveries(dedupe_key) where dedupe_key is not null;
create index if not exists notification_deliveries_pending_idx
  on public.notification_deliveries(next_attempt_at, created_at) where status in ('pending','failed');

create or replace function public.enqueue_email_notification(
  p_event_type text, p_entity_type text, p_entity_id text, p_recipient text,
  p_template text, p_payload jsonb, p_dedupe_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if nullif(btrim(p_recipient),'') is null or nullif(btrim(p_dedupe_key),'') is null then return null; end if;
  insert into public.notification_deliveries(
    event_type, entity_type, entity_id, recipient, provider, status, attempt_count,
    template, payload, next_attempt_at, dedupe_key
  ) values (
    p_event_type, p_entity_type, p_entity_id, lower(btrim(p_recipient)),
    'google_workspace', 'pending', 0, p_template, coalesce(p_payload,'{}'::jsonb), now(), p_dedupe_key
  ) on conflict(dedupe_key) where dedupe_key is not null do update set dedupe_key=excluded.dedupe_key
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.enqueue_email_notification(text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.enqueue_email_notification(text,text,text,text,text,jsonb,text) to service_role;

create or replace function public.claim_email_notifications(p_limit integer default 10)
returns setof public.notification_deliveries
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  return query
  with candidates as (
    select id from public.notification_deliveries
    where status in ('pending','failed') and next_attempt_at <= now() and attempt_count < 8
    order by created_at for update skip locked limit greatest(1,least(p_limit,50))
  ), claimed as (
    update public.notification_deliveries n
    set status='processing', attempt_count=n.attempt_count+1, updated_at=now()
    from candidates c where n.id=c.id returning n.*
  ) select * from claimed;
end;
$$;
revoke all on function public.claim_email_notifications(integer) from public,anon,authenticated;
grant execute on function public.claim_email_notifications(integer) to service_role;

create or replace function public.admin_retry_email_notification(p_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.notification_deliveries set
    status='pending', next_attempt_at=now(), last_error=null, last_error_code=null, updated_at=now()
  where id=p_delivery_id and status in ('failed','pending');
  if not found then return jsonb_build_object('success',false,'error_code','DELIVERY_NOT_RETRYABLE'); end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'notification.retry_requested','notification_delivery',p_delivery_id::text,'{}'::jsonb);
  return jsonb_build_object('success',true,'delivery_id',p_delivery_id);
end;
$$;
revoke all on function public.admin_retry_email_notification(uuid) from public,anon;
grant execute on function public.admin_retry_email_notification(uuid) to authenticated;

create or replace function public.queue_payment_success_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  if new.status='paid' and old.status is distinct from 'paid' and new.payment_method='card' then
    v_payload := jsonb_build_object(
      'transaction_id',new.id,'reference',new.public_reference,'payer_name',new.payer_name,
      'payer_email',new.payer_email,'package_id',new.package_id,'student_id',new.package_owner_student_id,
      'amount',new.amount,'currency',new.currency,'paid_at',new.paid_at,
      'locale',coalesce(new.metadata->>'locale','tr')
    );
    perform public.enqueue_email_notification('payment.success', 'payment_transaction', new.id::text,
      new.payer_email, 'payment_success_guardian', v_payload, 'payment.success:'||new.id||':guardian');
    perform public.enqueue_email_notification('payment.success.admin', 'payment_transaction', new.id::text,
      'admin@oriens-academy.com', 'payment_success_admin', v_payload, 'payment.success:'||new.id||':admin');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_queue_payment_success_email on public.payment_transactions;
create trigger trg_queue_payment_success_email after update of status on public.payment_transactions
  for each row execute function public.queue_payment_success_email();

create or replace function public.queue_manual_package_activation_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_guardian record; v_student_name text; v_package_name text;
begin
  if coalesce(new.assignment_source,'') not in ('admin_manual','manual_bank_transfer','bank_transfer') then return new; end if;
  select ga.user_id,ga.email,ga.full_name,ga.preferred_language into v_guardian
  from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=new.student_user_id and gs.active and ga.active
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_guardian.email is null then return new; end if;
  select full_name into v_student_name from public.student_profiles where id=new.student_user_id;
  select coalesce(case when v_guardian.preferred_language='en' then name_en else name_tr end,new.package_id)
    into v_package_name from public.pricing_packages where id=new.package_id;
  perform public.enqueue_email_notification('package.activated','student_package_purchase',new.id::text,
    v_guardian.email,'package_activated_guardian',jsonb_build_object(
      'purchase_id',new.id,'guardian_name',v_guardian.full_name,'learner_name',v_student_name,
      'package_name',coalesce(v_package_name,new.custom_package_name,new.package_id),
      'granted_lessons',new.lesson_count,'remaining_lessons',greatest(0,new.lesson_count-new.lessons_used),
      'activation_date',new.start_date,'source',new.assignment_source,'locale',v_guardian.preferred_language
    ),'package.activated:'||new.id||':guardian');
  return new;
end;
$$;
drop trigger if exists trg_queue_manual_package_activation_email on public.student_package_purchases;
create trigger trg_queue_manual_package_activation_email after insert on public.student_package_purchases
  for each row execute function public.queue_manual_package_activation_email();

create or replace function public.queue_lesson_completed_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_guardian record; v_purchase record; v_student_name text; v_package_name text;
begin
  if new.status <> 'completed' or old.status='completed' then return new; end if;
  select ga.email,ga.full_name,ga.preferred_language into v_guardian
  from public.guardian_students gs join public.guardian_accounts ga on ga.user_id=gs.guardian_user_id
  where gs.student_id=new.student_user_id and gs.active and ga.active
  order by gs.is_primary desc,gs.created_at asc limit 1;
  if v_guardian.email is null then return new; end if;
  select * into v_purchase from public.student_package_purchases where id=new.package_purchase_id;
  select full_name into v_student_name from public.student_profiles where id=new.student_user_id;
  select coalesce(case when v_guardian.preferred_language='en' then name_en else name_tr end,v_purchase.package_id)
    into v_package_name from public.pricing_packages where id=v_purchase.package_id;
  perform public.enqueue_email_notification('lesson.completed','student_lesson',new.id::text,
    v_guardian.email,'lesson_completed_guardian',jsonb_build_object(
      'lesson_id',new.id,'guardian_name',v_guardian.full_name,'learner_name',v_student_name,
      'lesson_title',new.title,'lesson_date',new.lesson_date,'teacher_note',new.teacher_note,
      'package_name',v_package_name,'remaining_lessons',case when v_purchase.id is null then null else greatest(0,v_purchase.lesson_count-v_purchase.lessons_used) end,
      'total_lessons',v_purchase.lesson_count,'locale',v_guardian.preferred_language
    ),'lesson.completed:'||new.id||':guardian');
  return new;
end;
$$;
drop trigger if exists trg_queue_lesson_completed_email on public.student_lessons;
create constraint trigger trg_queue_lesson_completed_email
  after update on public.student_lessons deferrable initially deferred
  for each row execute function public.queue_lesson_completed_email();

create or replace function public.queue_verified_guardian_welcome_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_guardian public.guardian_accounts%rowtype;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select * into v_guardian from public.guardian_accounts where user_id=new.id and active;
    if v_guardian.user_id is not null then
      perform public.enqueue_email_notification('guardian.welcome','guardian_account',new.id::text,
        v_guardian.email,'guardian_welcome',jsonb_build_object(
          'guardian_name',v_guardian.full_name,'locale',v_guardian.preferred_language
        ),'guardian.welcome:'||new.id||':guardian');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_verified_guardian_welcome on auth.users;
create trigger on_auth_user_verified_guardian_welcome
  after update of email_confirmed_at on auth.users for each row
  execute function public.queue_verified_guardian_welcome_email();

-- Local confirmation behavior. Production Auth dashboard must still be verified separately.
