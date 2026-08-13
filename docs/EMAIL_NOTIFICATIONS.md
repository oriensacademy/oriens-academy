# Oriens Academy - Transactional Email Notifications Architecture (Phase 3)

This document details the transactional email notification architecture, Resend integration, outbox logging model, admin configuration, failure semantics, and Telegram removal across the project.

---

## 1. Overview & Provider

- **Transactional Provider**: Resend (`https://api.resend.com/emails`)
- **No Telegram**: Telegram is completely removed from all plans, code, and documentation. All operational notifications are delivered via email.
- **Decoupled Failure Semantics**: Email notification dispatch operates asynchronously. If Resend is unconfigured or returns an API error, **database storage of bookings and contact requests ALWAYS remains 100% intact**. Email failures never roll back database transactions or return false errors to public visitors.

---

## 2. Configuration & Secrets

Operational secrets are managed strictly via Supabase Edge Function Secrets:

```bash
# Set secrets via Supabase CLI (Do NOT commit real keys to source control)
npx supabase secrets set RESEND_API_KEY=re_your_real_api_key
npx supabase secrets set RESEND_FROM_EMAIL="Oriens Academy <notifications@notify.oriens-academy.com>"
```

### Private Recipient Configuration

Notification recipient addresses are stored in the private `site_settings` table (`is_public = false`). They cannot be queried by public anonymous connections.

- `notification.booking_email`: admin-editable; application fallback `{"email": "oriensacademy@gmail.com"}`
- `notification.contact_email`: admin-editable; application fallback `{"email": "oriensacademy@gmail.com"}`
- `notification.admin_locale`: `{"locale": "tr"}`

Admin panel settings UI (future phase) will update these rows directly.

---

## 3. Notification Deliveries Outbox (`notification_deliveries`)

All email send attempts (successes and failures) are logged to the `notification_deliveries` database table for auditability:

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary Key |
| `channel` | `text` | Default `'email'` |
| `event_type` | `text` | e.g. `'booking.created.admin_notification'`, `'contact.created.student_acknowledgement'` |
| `entity_type` | `text` | `'booking'` or `'contact_request'` |
| `entity_id` | `text` | Booking UUID or Contact Request UUID |
| `recipient` | `text` | Target email address |
| `provider` | `text` | `'resend'` |
| `provider_message_id` | `text` | Resend API returned message ID (if successful) |
| `status` | `text` | `'sent'` or `'failed'` |
| `attempt_count` | `integer` | Default `1` |
| `last_error_code` | `text` | Error code if delivery failed (e.g. `'RESEND_API_KEY_MISSING'`, `'RECIPIENT_NOT_CONFIGURED'`) |
| `created_at` | `timestamptz` | Log creation timestamp |
| `sent_at` | `timestamptz` | Timestamp when email was accepted by provider |

---

## 4. Email Templates & Wording

Templates are located in `supabase/functions/_shared/email/templates.ts`:

1. **Admin Booking Notification**: Contains visitor full name, email, phone, support type, exam details, requested appointment time (formatted), notes, and locale.
2. **Student Booking Acknowledgement**:
   - *Turkish Wording*: "Görüşme talebiniz başarıyla alınmıştır. Seçtiğiniz zaman dilimi kaydedilmiş olup ekip arkadaşlarımız talebinizi inceleyerek en kısa sürede sizinle iletişime geçecektir." (Explicitly states pending confirmation).
   - *English Wording*: "Your initial consultation request with Oriens Academy has been successfully received. Our team will review your requested time slot and reach out shortly."
3. **Admin Contact Notification**: Contains visitor name, email, phone, subject, message, and locale.
4. **Student Contact Acknowledgement**:
   - *Turkish Wording*: "Mesajınız alındı. Oriens Academy ile iletişime geçtiğiniz için teşekkür ederiz."
   - *English Wording*: "Thank you for contacting Oriens Academy. Your message has been received."

---

## 5. Idempotency

All transactional emails passed to Resend include an `Idempotency-Key` header derived from the parent record:
- Booking Admin: `booking-admin-<BOOKING_ID>`
- Booking Student: `booking-student-<BOOKING_ID>`
- Contact Admin: `contact-admin-<CONTACT_ID>`
- Contact Student: `contact-student-<CONTACT_ID>`

This prevents duplicate emails in case of network retries.
