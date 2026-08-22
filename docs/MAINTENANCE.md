# Operational Maintenance

This checklist separates work performed in the Oriens admin panel from developer/database work and external-platform ownership. Never include credentials in tickets, screenshots or this repository.

## Weekly

- **Admin / appointments:** review pending and upcoming bookings, confirm status transitions, check availability coverage and investigate duplicate/conflict reports.
- **Admin / leads:** review new and in-progress contact requests; confirm package context appears where applicable; resolve or classify spam deliberately.
- **Admin / email delivery:** inspect failed `notification_deliveries`, record the provider error, verify the parent request still exists and retry only through an approved process.
- **Admin / audit:** scan recent audit events for unexpected pricing, testimonial, settings or booking changes.
- **External / Cloudflare Pages:** check the latest production deployment status and edge metrics.
- **External / Supabase:** review database, Auth and Edge Function health/logs; watch resource limits and repeated Turnstile/email failures.

## Monthly

- Run `npm audit --omit=dev`, review advisories in context, and upgrade in a tested branch.
- Run `npm run lint` and `npm run build` from a clean checkout with documented environment variables.
- Review administrator membership, JWT roles and active `admin_profiles`; remove departed access through the secure identity process.
- Verify pricing and testimonial public visibility against admin records and TR/EN presentation.
- Review ingestion/source freshness, program quality quarantine and official admission-source verification dates if the admission/search system is in active use.
- Check Cloudflare Pages environment ownership, Supabase backups/point-in-time-recovery settings and retention appropriate to the subscribed plans. Backup availability is an external plan/configuration responsibility, not implemented by repository code.
- Check Search Console indexing/coverage, sitemap health and major canonical/hreflang issues.
- Check GA4/GTM events after consent and verify no PII has been added to event payloads.
- Verify `oriens-academy.com` and `www` TLS, redirect and DNS health. Registrar/DNS access remains external.

## Quarterly or Before a Release

- Review Node/Next/React/Supabase/Cloudflare compatibility and release notes.
- Exercise TR/EN home, exam hub/detail, pricing, contact, booking and legal routes at desktop and mobile widths.
- Test keyboard navigation, focus, reduced motion, long localized strings and the complete contact email rendering.
- Test all public Turnstile actions against the intended hostname and verify production fails closed with invalid tokens.
- Test booking concurrency/slot conflict handling on a controlled non-production database.
- Test admin login/logout/recovery, route navigation and tab-focus state preservation without exposing credentials.
- Verify Resend sending-domain status, sender identity, owner recipients, TR/EN templates and idempotency behavior.
- Review RLS/grants from the complete migration chain, especially after adding a table/RPC/route handler.
- Run a tracked-file secret scan and desktop-path scan before client delivery.

## Admin-Managed Operations

| Module | Routine work | Data |
|---|---|---|
| Dashboard | Operational summary and failed-delivery alert | Aggregated Supabase queries |
| Randevular | Create/review/update appointments | `bookings`, `availability_slots`, booking RPCs |
| Öğrenciler | Review consolidated contact/booking history | Contact and booking data |
| İletişim | Qualify/resolve leads and package interest | `contact_requests` |
| Müsaitlik | Add single/bulk slots, block availability | `availability_slots` |
| Fiyatlandırma | Manage package text, prices, order and active/featured state | `pricing_packages` |
| İçerik | Manage verified localized testimonials | `testimonials` |
| Bildirimler | Inspect sent/failed email attempts | `notification_deliveries` |
| Denetim | Review immutable operation history | `audit_logs` |
| Ayarlar | Maintain owner recipients and supported site settings | `site_settings` |

Use explicit save/cancel flows. Do not edit PII or operational tables through ad-hoc SQL when the admin workflow exists.

## Developer-Managed Content

- Homepage, header/footer and general localized copy: `src/content/tr`, `src/content/en`, `src/config/contact.ts`.
- Exam codes/categories/relationships: `src/content/shared.ts`, `src/content/exams.ts`.
- Exam TR/EN summaries/details: locale `exams.ts` and `exam-details.ts`.
- About, pricing fallback and university-support copy: locale content files.
- Destination and university relationships: `src/data/study-destinations.ts`, `src/data/exam-university-map.ts`.
- Exam visual/Lottie mapping: `src/data/exam-visuals.ts` and `public/animations`.
- SEO route mapping: `src/lib/routes.ts`, localized page metadata, `src/app/sitemap.ts`, `robots.ts`, `JsonLd.tsx`.
- Email templates: `supabase/functions/_shared/email/templates.ts`; dispatch behavior: `email/service.ts`.
- Database schema/permissions: new ordered migration only; never edit migration history already applied remotely unless following an approved repair procedure.

## Incident Playbooks

### Stored request but no email

1. Find the parent booking/contact in admin.
2. Inspect both expected delivery rows and `last_error_code`.
3. Check Resend status, verified domain, sender and Edge Function secret availability.
4. Correct configuration; resend through an approved idempotent/manual procedure.
5. Do not create a second visitor request to compensate.

### Public form rejected

1. Distinguish validation, Turnstile, CORS/origin and database/RPC errors.
2. Confirm frontend and Edge Function point to the same intended Supabase environment.
3. Validate hostname/action and clock/token expiry.
4. Review sanitized Edge Function logs; never paste tokens or PII into public tickets.

### Admin cannot enter

1. Confirm Supabase Auth user exists and session endpoints are healthy.
2. Verify JWT `app_metadata.role` (not user-editable metadata).
3. Verify active admin profile and RLS grants.
4. Use the protected recovery flow or secure platform administration; never store a temporary password in source control.

### Search/data quality problem

1. Confirm runtime API and Supabase availability.
2. Check program active/quarantine status, aliases, sources and freshness/conflict metadata.
3. Run the relevant read-only quality/regression script before ingestion.
4. Use service-role ingestion only with explicit target verification and a recovery plan.

## Dependency and QA Tooling

The permanent package scripts are documented in README. Additional `scripts/` files cover browser CDP regression, local admin CRUD, search/admission parsing, ingestion and quality audits. They are maintained developer tools, not an automatic test framework. Read their environment requirements and whether they mutate data before execution. Evidence belongs in ignored `test-results/` and should be deleted before handoff.

### Handoff audit baseline (2026-08-14)

`npm audit --omit=dev` reports three high-severity production dependency findings: the direct `next` package is affected through its bundled `postcss`, and the dependency tree also contains an affected `sharp`. The audit's automatic remediation is Next.js 16.3.1, a semver-major framework migration from the current 15.5.23. Do not apply that migration directly in production: upgrade on a branch, follow the repository's generated `AGENTS.md` instruction to consult the installed Next.js documentation, then repeat lint, build, route, image-processing and Cloudflare Pages deployment tests. Re-run the audit first because advisory and patched-version data changes over time.

## External Ownership and Secure Transfer

Transfer these separately: administrator credentials; Supabase organization/project; Cloudflare Pages / DNS account; domain registrar and DNS; Google Workspace Mail; Cloudflare Turnstile; GA4/GTM; Search Console. Confirm billing owner, recovery contacts and least-privilege roles. Never place access exports, recovery codes or screenshots containing secrets in `docs/references`.
