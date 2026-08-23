-- Migration: 20260823120000_student_exam_attempts_and_anonymous_claims.sql
-- Description: Creates student_exam_attempts and anonymous_exam_result_claims with secure RLS and RPCs

-- 1. Table: student_exam_attempts
create table if not exists public.student_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  exam_code text not null,
  locale text not null check (locale in ('tr', 'en')),
  total_questions integer not null check (total_questions > 0),
  correct_count integer not null check (correct_count >= 0),
  incorrect_count integer not null check (incorrect_count >= 0),
  unanswered_count integer not null check (unanswered_count >= 0),
  accuracy integer not null check (accuracy between 0 and 100),
  performance_tier text check (performance_tier in ('strong', 'moderate', 'foundation')),
  answers jsonb not null default '{}'::jsonb,
  topic_analysis jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  improvement_areas jsonb not null default '[]'::jsonb,
  question_snapshots jsonb not null default '[]'::jsonb,
  recommendation text,
  started_at timestamptz,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_student_exam_attempts_user on public.student_exam_attempts(student_user_id, completed_at desc);
create index if not exists idx_student_exam_attempts_exam on public.student_exam_attempts(exam_code, completed_at desc);

alter table public.student_exam_attempts enable row level security;

create policy "Students can view own exam attempts" on public.student_exam_attempts
  for select using (student_user_id = auth.uid());

create policy "Admins can view all exam attempts" on public.student_exam_attempts
  for select using (public.is_admin());

create policy "Admins can manage all exam attempts" on public.student_exam_attempts
  for all using (public.is_admin()) with check (public.is_admin());

grant select on table public.student_exam_attempts to authenticated;
grant select, insert, update, delete on table public.student_exam_attempts to service_role;

-- 2. Table: anonymous_exam_result_claims
create table if not exists public.anonymous_exam_result_claims (
  id uuid primary key default gen_random_uuid(),
  claim_token text not null unique,
  normalized_email text not null,
  exam_code text not null,
  locale text not null check (locale in ('tr', 'en')),
  attempt_data jsonb not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  claimed_at timestamptz,
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_anon_claims_token on public.anonymous_exam_result_claims(claim_token) where claimed_at is null;
create index if not exists idx_anon_claims_email on public.anonymous_exam_result_claims(normalized_email) where claimed_at is null;

alter table public.anonymous_exam_result_claims enable row level security;

create policy "Admins can view anonymous claims" on public.anonymous_exam_result_claims
  for select using (public.is_admin());

grant select, insert, update on table public.anonymous_exam_result_claims to service_role;

-- 3. RPC: Save student exam attempt (for authenticated students)
create or replace function public.save_student_exam_attempt(
  p_exam_code text,
  p_locale text,
  p_total_questions integer,
  p_correct_count integer,
  p_incorrect_count integer,
  p_unanswered_count integer,
  p_accuracy integer,
  p_performance_tier text,
  p_answers jsonb,
  p_topic_analysis jsonb,
  p_strengths jsonb,
  p_improvement_areas jsonb,
  p_question_snapshots jsonb,
  p_recommendation text default null,
  p_started_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_id uuid;
  v_acc integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'AUTHENTICATION_REQUIRED');
  end if;

  if p_total_questions is null or p_total_questions < 1 or p_total_questions > 100 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_QUESTION_COUNT');
  end if;

  v_acc := coalesce(p_accuracy, 0);
  if v_acc < 0 then v_acc := 0; end if;
  if v_acc > 100 then v_acc := 100; end if;

  insert into public.student_exam_attempts (
    student_user_id,
    exam_code,
    locale,
    total_questions,
    correct_count,
    incorrect_count,
    unanswered_count,
    accuracy,
    performance_tier,
    answers,
    topic_analysis,
    strengths,
    improvement_areas,
    question_snapshots,
    recommendation,
    started_at,
    completed_at
  ) values (
    v_user_id,
    upper(coalesce(nullif(btrim(p_exam_code), ''), 'SAT')),
    case when p_locale = 'en' then 'en' else 'tr' end,
    p_total_questions,
    coalesce(p_correct_count, 0),
    coalesce(p_incorrect_count, 0),
    coalesce(p_unanswered_count, 0),
    v_acc,
    coalesce(p_performance_tier, 'foundation'),
    coalesce(p_answers, '{}'::jsonb),
    coalesce(p_topic_analysis, '[]'::jsonb),
    coalesce(p_strengths, '[]'::jsonb),
    coalesce(p_improvement_areas, '[]'::jsonb),
    coalesce(p_question_snapshots, '[]'::jsonb),
    p_recommendation,
    p_started_at,
    now()
  ) returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'attempt_id', v_id
  );
end;
$$;

-- 4. RPC: Claim anonymous exam result after registration
create or replace function public.claim_anonymous_exam_result(
  p_claim_token text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_claim public.anonymous_exam_result_claims%rowtype;
  v_attempt_id uuid;
  v_data jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'AUTHENTICATION_REQUIRED');
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null then
    return jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND');
  end if;

  select * into v_claim from public.anonymous_exam_result_claims
  where claim_token = p_claim_token
    and claimed_at is null
    and expires_at > now()
  for update;

  if v_claim.id is null then
    return jsonb_build_object('success', false, 'error_code', 'CLAIM_NOT_FOUND_OR_EXPIRED');
  end if;

  -- Ensure email matches normalized email
  if lower(btrim(v_user_email)) <> lower(btrim(v_claim.normalized_email)) then
    return jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH');
  end if;

  v_data := v_claim.attempt_data;

  insert into public.student_exam_attempts (
    student_user_id,
    exam_code,
    locale,
    total_questions,
    correct_count,
    incorrect_count,
    unanswered_count,
    accuracy,
    performance_tier,
    answers,
    topic_analysis,
    strengths,
    improvement_areas,
    question_snapshots,
    recommendation,
    started_at,
    completed_at
  ) values (
    v_user_id,
    v_claim.exam_code,
    v_claim.locale,
    coalesce((v_data->>'total_questions')::integer, 6),
    coalesce((v_data->>'correct_count')::integer, 0),
    coalesce((v_data->>'incorrect_count')::integer, 0),
    coalesce((v_data->>'unanswered_count')::integer, 0),
    coalesce((v_data->>'accuracy')::integer, 0),
    coalesce(v_data->>'performance_tier', 'foundation'),
    coalesce(v_data->'answers', '{}'::jsonb),
    coalesce(v_data->'topic_analysis', '[]'::jsonb),
    coalesce(v_data->'strengths', '[]'::jsonb),
    coalesce(v_data->'improvement_areas', '[]'::jsonb),
    coalesce(v_data->'question_snapshots', '[]'::jsonb),
    v_data->>'recommendation',
    (v_data->>'started_at')::timestamptz,
    v_claim.created_at
  ) returning id into v_attempt_id;

  update public.anonymous_exam_result_claims set
    claimed_at = now(),
    claimed_by_user_id = v_user_id
  where id = v_claim.id;

  return jsonb_build_object(
    'success', true,
    'attempt_id', v_attempt_id
  );
end;
$$;

revoke all on function public.save_student_exam_attempt(text, text, integer, integer, integer, integer, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz) from public, anon;
revoke all on function public.claim_anonymous_exam_result(text) from public, anon;

grant execute on function public.save_student_exam_attempt(text, text, integer, integer, integer, integer, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz) to authenticated;
grant execute on function public.claim_anonymous_exam_result(text) to authenticated;
