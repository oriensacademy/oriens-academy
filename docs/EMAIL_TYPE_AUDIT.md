# Oriens Academy — Transactional Email Type Audit

Audit date: 2026-08-13. The original controlled inbox has been removed from repository documentation; use `QA_TEST_EMAIL` for future non-production delivery checks.

No synthetic message was sent in this localhost-only phase. The revised templates live inside Supabase Edge Functions; delivering them requires deploying those local changes or copying production email credentials into the local environment. Neither action was authorized. Remote secret *names* are configured, but their values were not exposed. No production or synthetic database rows were created, so no cleanup was necessary.

| Type | Trigger | Recipient source | TR/EN | Branded HTML + text | Idempotency / log | Delivery status |
|---|---|---|---:|---:|---:|---|
| Booking admin notification | Successful booking insert | `notification.booking_email`, canonical fallback | YES | YES | YES | Source/render audited; not sent |
| Booking student acknowledgement | Successful booking insert | Submitted student email | YES | YES | YES | Source/render audited; not sent |
| Contact admin notification | Successful website-contact insert | `notification.contact_email`, canonical fallback | YES | YES | YES | Source/render audited; not sent |
| Contact student acknowledgement | Successful website-contact insert | Submitted student email | YES | YES | YES | Source/render audited; not sent |
| Quick-contact admin notification | Successful quick-contact insert | `notification.contact_email`, canonical fallback | YES | YES | YES, distinct event type | Requires migration/function deployment |
| Quick-contact student acknowledgement | Successful quick-contact insert | Submitted visitor email | YES | YES | YES, distinct event type | Requires migration/function deployment |
| Administrator password reset | Valid protected reset request | Configured administrator identity | YES | YES | YES, rate-limited | Source audited; destructive credential rotation not tested |

## Template and security checks

- Visitor locale drives every student-facing subject, heading, body and summary label.
- Admin templates can render in TR or EN and include the visitor locale.
- User-controlled contact summary fields are HTML-escaped before interpolation.
- Booking/contact delivery writes provider status to `notification_deliveries`; password reset also writes a sanitized audit record.
- Resend calls use deterministic idempotency keys to reduce duplicate sends.
- Public forms retain Turnstile verification and server-side validation.
- Canonical public contact details are `oriensacademy@gmail.com` and `+90 544 293 90 40`.
- The configured sender is read from `RESEND_FROM_EMAIL`; normal notification service retains its existing notification-domain fallback. Password reset fails closed if the sender is absent.

## Authorized post-deployment test matrix

When deployment is explicitly approved, submit one synthetic request for each TR/EN path below to the controlled `QA_TEST_EMAIL`, verify the Resend/provider log and `notification_deliveries`, and then delete only the identified synthetic records:

1. TR booking and EN booking.
2. TR full contact and EN full contact.
3. TR quick contact and EN quick contact.
4. Administrator reset only with the owner present, because it rotates the real credential.
