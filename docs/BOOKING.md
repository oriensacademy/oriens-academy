# Oriens Academy - Booking & Availability Architecture (Phase 2)

This document details the architecture, atomic reservation model, Edge Functions, database migration, and security guarantees for the booking system.

---

## 1. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Oriens Academy Frontend                    │
│             (/tr/randevu  ↔  /en/booking)                      │
└────────────────┬───────────────────────────────▲──────────────┘
                 │                               │
       POST /create-booking             GET /booking-availability
                 │                               │
                 ▼                               │
┌───────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                    │
│                                                               │
│  ┌───────────────────────────┐   ┌──────────────────────────┐ │
│  │   create-booking (POST)   │   │ booking-availability GET │ │
│  │ (Validation & Service RPC)│   │ (Filtered Public DTOs)   │ │
│  └─────────────┬─────────────┘   └──────────────────────────┘ │
└────────────────┼──────────────────────────────────────────────┘
                 │
           RPC Execution
       (service_role key)
                 │
                 ▼
┌───────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  public.reserve_booking_slot() [SECURITY DEFINER]       │  │
│  │  - Row lock: SELECT FOR UPDATE on availability_slots    │  │
│  │  - Status check: status = 'available' AND starts_at > now │  │
│  │  - Update availability_slots.status = 'booked'           │  │
│  │  - Insert public.bookings (status = 'pending')          │  │
│  │  - Insert public.audit_logs ('booking.created')         │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Partial Unique Index: idx_bookings_active_slot_unique  │  │
│  │  ON bookings (slot_id) WHERE status IN active_statuses  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Double-Booking Guarantee (Atomic DB Operations)

Concurrent bookings for the same appointment slot are prevented at the database level through a 2-tier defense:

1. **Row-Level Lock (`SELECT ... FOR UPDATE`)**:
   Inside `public.reserve_booking_slot()`, the target slot row is locked exclusively within a single transaction. If two requests attempt to book the same slot simultaneously, one blocks until the first completes. The second request evaluates `v_slot.status <> 'available'` and returns error code `SLOT_UNAVAILABLE`.

2. **Partial Unique Index**:
   ```sql
   create unique index idx_bookings_active_slot_unique
     on public.bookings (slot_id)
     where slot_id is not null
       and status in ('pending', 'confirmed', 'completed', 'no_show');
   ```
   Even if an unexpected query bypasses RPC, PostgreSQL enforces that no active slot can be linked to more than one active booking. Cancelled bookings do not consume the slot.

---

## 3. Edge Functions

### `booking-availability`
- **Method**: `GET` / `POST`
- **Authentication**: Gateway `--no-verify-jwt` (Public endpoint)
- **Role**: Returns clean DTO list of future available slots (`id`, `startsAt`, `endsAt`).
- **RLS Protection**: `availability_slots` is filtered by RLS (`status = 'available' AND starts_at > now()`). No internal notes, admin metadata, or user IDs are exposed.

### `create-booking`
- **Method**: `POST`
- **Authentication**: Gateway `--no-verify-jwt` (Public endpoint)
- **Role**: Validates payload fields (lengths, email format, exam codes, required privacy consent) and invokes `public.reserve_booking_slot` using trusted `service_role` credentials.
- **Error Mapping**:
  - `200 OK`: Booking created with status `pending`.
  - `400 Bad Request`: Payload validation failed (`INVALID_SLOT_ID`, `INVALID_EMAIL`, `PRIVACY_CONSENT_REQUIRED`).
  - `409 Conflict`: Slot unavailable / concurrent reservation conflict (`SLOT_UNAVAILABLE`).

---

## 4. Security & Permissions

- `public.reserve_booking_slot` RPC: `REVOKE EXECUTE ON FUNCTION public.reserve_booking_slot FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role;`
- Anonymous/browser connections cannot directly invoke `reserve_booking_slot` or read/write `bookings` table.
- All public booking interactions proceed strictly through Edge Functions.

---

## 5. Production Launch TODO

> [!WARNING]
> **Turnstile Requirement Before Production Launch**:
> `create-booking` is currently deployed with payload validation and rate/origin defense. Before driving production marketing campaigns, Cloudflare Turnstile verification (`turnstileToken`) MUST be enabled in `create-booking` to prevent automated bot spam attacks.
