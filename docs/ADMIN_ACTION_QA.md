# Oriens Academy — Admin Action QA Matrix

This document records actual recovery-phase evidence. No credentials are stored here. A control is not marked PASS merely because its handler exists.

| Module | Action | Implementation evidence | Browser evidence | Status |
|---|---|---|---|---|
| Auth | Login form starts empty | Controlled email/password state initializes to empty strings | Blank email/password and safe placeholders verified at 1024px | PASS |
| Auth | Forgot password navigation | Login links to `/admin/forgot-password`; form calls Supabase reset API | Navigation, blank field, and disabled empty submission verified | PASS (DELIVERY REQUIRES ACCOUNT) |
| Auth | Reset password | Route validates matching passwords and calls `supabase.auth.updateUser` | Pending authenticated recovery-link test | REQUIRES AUTH LINK |
| Auth | Logout | Admin header/sidebar invoke the auth context sign-out flow | Pending authenticated owner-session test | REQUIRES AUTH |
| Dashboard | Module cards | Real Next.js links target bookings, contacts, availability, pricing, content, notifications, audit, and settings | All protected route targets returned and redirected unauthenticated users to login | PASS (AUTH GUARD) |
| Dashboard | Metric cards | Cards link to their corresponding business modules and use real queried counts | Pending authenticated owner-session test | REQUIRES AUTH |
| Bookings | Filters and detail controls | Handlers query and update booking status through the admin data layer | Requires authenticated DB test data | REQUIRES AUTH + DATA |
| Contacts | Filters, details, status controls | Handlers query and update contact status through the admin data layer | Requires authenticated DB test data | REQUIRES AUTH + DATA |
| Availability | Create, bulk-create, delete | Modal and action handlers call availability functions with validation | Requires authenticated DB test data | REQUIRES AUTH + DATA |
| Pricing | Create/edit/delete | Modal and action handlers use the pricing data layer | Requires authenticated DB test data | REQUIRES AUTH + DATA |
| Content | Testimonial create/edit/delete | Modal and action handlers use the testimonial data layer | Requires authenticated DB test data | REQUIRES AUTH + DATA |
| Notifications | List/detail controls | Page and detail sheet query notification delivery records | Requires authenticated DB test data | REQUIRES AUTH + DATA |
| Settings | Notification recipients | Validated settings handlers persist through `site_settings` | Requires authenticated DB test data | REQUIRES AUTH + DATA |
| Settings | Change account email | Calls `supabase.auth.updateUser({ email })`; field starts empty | Requires authenticated owner-session test | REQUIRES AUTH |
| Settings | Change account password | Calls `supabase.auth.updateUser({ password })`; fields start empty | Requires authenticated owner-session test | REQUIRES AUTH |

## Safety note

No fake records are created for QA. Destructive or identity-changing actions remain unexecuted without an authenticated owner session and explicit test data.
