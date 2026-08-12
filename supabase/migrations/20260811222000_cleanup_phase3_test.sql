-- Cleanup test contact request and delivery outbox logs
delete from public.notification_deliveries
where entity_type = 'contact_request'
  and entity_id = '2231de5b-671d-447f-b8b6-a2ddca87868a';

delete from public.contact_requests
where id = '2231de5b-671d-447f-b8b6-a2ddca87868a';
