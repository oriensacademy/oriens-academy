-- Oriens Academy payment foundation.
-- No PAN, CVV, magnetic-stripe data, 3DS password or other card secrets are stored.

alter table public.pricing_packages
  add column if not exists purchase_mode text not null default 'consultation_only'
  check (purchase_mode in ('consultation_only', 'purchasable'));

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid references auth.users(id) on delete set null,
  package_id text not null references public.pricing_packages(id) on delete restrict,
  public_reference text not null unique,
  status_token_hash text not null,
  provider text not null,
  provider_transaction_id text unique,
  amount numeric not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  status text not null default 'pending'
    check (status in ('pending', 'requires_action', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_method text not null check (payment_method in ('card', 'bank_transfer')),
  installment_count integer check (installment_count is null or installment_count > 0),
  payer_name text,
  payer_email text,
  payer_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.student_package_purchases (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid references auth.users(id) on delete restrict,
  package_id text not null references public.pricing_packages(id) on delete restrict,
  payment_transaction_id uuid not null unique references public.payment_transactions(id) on delete restrict,
  lesson_count integer not null check (lesson_count > 0),
  lessons_used integer not null default 0 check (lessons_used >= 0 and lessons_used <= lesson_count),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_transactions_status_created
  on public.payment_transactions(status, created_at desc);
create index if not exists idx_payment_transactions_student
  on public.payment_transactions(student_user_id, created_at desc);
create index if not exists idx_student_package_purchases_student
  on public.student_package_purchases(student_user_id, created_at desc);

create trigger trg_payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_updated_at();

alter table public.payment_transactions enable row level security;
alter table public.student_package_purchases enable row level security;

create policy "Admin payment transaction read policy"
  on public.payment_transactions for select
  using (public.is_admin());
create policy "Student own payment transaction read policy"
  on public.payment_transactions for select
  using (student_user_id = auth.uid());
create policy "Admin package purchase read policy"
  on public.student_package_purchases for select
  using (public.is_admin());
create policy "Student own package purchase read policy"
  on public.student_package_purchases for select
  using (student_user_id = auth.uid());

grant select on table public.payment_transactions to authenticated;
grant select on table public.student_package_purchases to authenticated;
grant select, insert, update on table public.payment_transactions to service_role;
grant select, insert, update on table public.student_package_purchases to service_role;

insert into public.site_settings (key, value, is_public)
values
  ('payment.bank_account_holder', '{"value": ""}'::jsonb, true),
  ('payment.bank_name', '{"value": ""}'::jsonb, true),
  ('payment.iban', '{"value": ""}'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.activate_paid_package(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_row public.payment_transactions%rowtype;
  package_row public.pricing_packages%rowtype;
  purchase_id uuid;
begin
  select * into transaction_row from public.payment_transactions
  where id = p_payment_id and status = 'paid' for update;
  if not found then raise exception 'Verified paid transaction not found'; end if;

  select * into package_row from public.pricing_packages where id = transaction_row.package_id;
  if package_row.lesson_count is null then raise exception 'Package lesson count is not configured'; end if;

  insert into public.student_package_purchases (
    student_user_id, package_id, payment_transaction_id, lesson_count
  ) values (
    transaction_row.student_user_id, transaction_row.package_id, transaction_row.id, package_row.lesson_count
  )
  on conflict (payment_transaction_id) do update set payment_transaction_id = excluded.payment_transaction_id
  returning id into purchase_id;
  return purchase_id;
end;
$$;

revoke all on function public.activate_paid_package(uuid) from public, anon, authenticated;
grant execute on function public.activate_paid_package(uuid) to service_role;

