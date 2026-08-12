-- Temporary Test Slot Migration for E2E Double-Booking Verification
insert into public.availability_slots (id, starts_at, ends_at, status)
values (
  'ffffffff-1111-4222-8333-aaaaaaaaaaaa',
  now() + interval '2 days',
  now() + interval '2 days 1 hour',
  'available'
)
on conflict (id) do nothing;
