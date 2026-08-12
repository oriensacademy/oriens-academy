-- Cleanup test data created during E2E verification
delete from public.audit_logs
where entity_type = 'booking'
  and metadata->>'slot_id' = 'ffffffff-1111-4222-8333-aaaaaaaaaaaa';

delete from public.bookings
where slot_id = 'ffffffff-1111-4222-8333-aaaaaaaaaaaa';

delete from public.availability_slots
where id = 'ffffffff-1111-4222-8333-aaaaaaaaaaaa';
