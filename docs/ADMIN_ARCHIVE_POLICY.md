# Admin archive and retention policy

Normal admin removal is reversible wherever the record carries customer or
operational history.

- Registered members and contact requests are archived and can be restored.
- Student private notes are archived. Package purchases, lessons, package
  adjustments, payments, and delivery records used by a controlled test-account
  reset are archived without changing their historical values.
- Blog posts, pricing packages, and coupons keep their existing reference-safe
  archive behavior.
- Availability slots may be physically removed only while they are unused and
  have no booking relationship.
- Audit logs and transactional notification deliveries are immutable evidence in
  the ordinary admin UI. Their former individual/bulk delete RPC grants are not
  available to authenticated admins, and automatic delivery-log purging is
  unscheduled.
- Legal account-erasure and restricted service maintenance are separate,
  explicitly authorized workflows; they are not normal admin deletion actions.

Archive actions retain primary keys, relationships, replies, financial fields,
lesson status, adjustment deltas, and audit events.
