# Phase 01 Production Cleanup Manifest — Dry Run Only

Status: **NOT EXECUTED**. This document records a read-only inventory taken on 2026-08-24 from Supabase project `mwbrlfmdpbkmdjroxhcc`. It contains counts and rules only—no emails, UUID lists, passwords, tokens or secrets.

## Identity classification

| Item | Current count | Prompt 2 action | Rule |
|---|---:|---|---|
| `auth.users` | 6 | Delete 5 student users; preserve 1 operational admin | Preserve when `app_metadata.role` is `admin`, `staff` or `teacher`, or the user has an active canonical `admin_profiles` row. Never classify by email text. |
| `admin_profiles` | 1 | PRESERVE | Canonical admin identity/profile record. |
| `student_profiles` | 5 | DELETE STUDENT | All five profiles map to the five non-protected auth users. |
| Unclassified auth users | 0 | STOP/REVIEW if non-zero on cleanup day | Never delete an unclassified auth identity automatically. |
| `admin_password_reset_limits` | restricted by design | PRESERVE | Service role has execute-only access; this table contains hashed cooldown keys, not plaintext credentials. Do not weaken auth controls to count or clear it. |

Re-run counts immediately before Prompt 2. Cleanup must abort unless the protected admin set is non-empty, every proposed auth deletion maps to `student_profiles`, and the preserve/delete ID sets are disjoint.

## Operational/student data

Rows marked DELETE/TRUNCATE are the intended Prompt 2 scope. Zero counts are still listed to keep dependency order explicit.

| Order | Table | Current rows | Action | Why / dependency |
|---:|---|---:|---|---|
| 10 | `homework_student_answers` | 0¹ | DELETE STUDENT | Child of `student_homework` and `homework_questions`; delete before either parent. |
| 11 | `homework_attachments` | 0¹ | DELETE STUDENT/TEST | Delete metadata before storage objects and assignment/homework parents. |
| 12 | `homework_question_options` | 0¹ | DELETE TEST ASSIGNMENT SNAPSHOTS | Child of `homework_questions`; canonical `question_bank.options` is preserved. |
| 13 | `homework_questions` | 0¹ | DELETE TEST ASSIGNMENT SNAPSHOTS | Child of `homework_assignments`; not the reusable library. |
| 14 | `student_homework` | 0 | DELETE STUDENT | Must precede `homework_assignments` because `assignment_id` is restrictive. |
| 15 | `student_admin_notes` | 2 | DELETE STUDENT | Both rows are linked to purge-candidate students. |
| 16 | `student_exam_preferences` | 0 | DELETE STUDENT | Child of `student_profiles`. |
| 17 | `student_destination_preferences` | 0 | DELETE STUDENT | Child of `student_profiles`. |
| 18 | `student_exam_attempts` | 2 | DELETE STUDENT | Both rows are linked to purge-candidate students. |
| 19 | `anonymous_exam_result_claims` | 0 | DELETE TEST/ANONYMOUS | Handover operational test results, including unclaimed rows. |
| 20 | `support_messages` | 3 | DELETE STUDENT | Child of two purge-candidate support threads. Gmail is out of scope. |
| 21 | `support_threads` | 2 | DELETE STUDENT | Both rows are linked to purge-candidate students. |
| 22 | `discount_coupon_redemptions` | 0 | DELETE STUDENT | Operational usage; preserve coupon definitions/templates. |
| 23 | `student_package_adjustments` | 0 | DELETE STUDENT | Child of package purchase; remove before purchase. |
| 24 | `student_lessons` | 0 | DELETE STUDENT | References package purchase/bookings. |
| 25 | `student_package_purchases` | 1 | DELETE STUDENT | Linked to a purge-candidate student and restricts auth deletion. |
| 26 | `payment_transactions` | 0 | DELETE STUDENT/TEST | Delete after purchases/redemptions that restrict/reference it. |
| 27 | `homework_assignments` | 0 | DELETE TEST ASSIGNMENT SNAPSHOTS | Delete after student homework and child question rows. |
| 28 | `bookings` | 0 | DELETE TEST/CONTACT | Public/student appointments; keep availability configuration separate. |
| 29 | `contact_requests` | 2 | DELETE OPERATIONAL | Application contact/quick-contact records. Does not touch Gmail. |
| 30 | `student_profiles` | 5 | DELETE STUDENT | Delete only after all explicit student dependencies above. |
| 31 | `auth.users` | 5 of 6 | DELETE STUDENT | Final identity step, via Admin API, explicit UUID allowlist only. Never `delete all`. |
| 40 | `notification_deliveries` | 105 | TRUNCATE LOG | Application email/delivery log; external Gmail remains untouched. |
| 41 | `audit_logs` | 52 | TRUNCATE LOG | Requested clean operational audit history. |
| 42 | `ingestion_runs` | 1 | TRUNCATE DIAGNOSTIC | Temporary ingestion run history; catalog/source data remains. |
| 43 | `program_quality_audits` | 0 | TRUNCATE DIAGNOSTIC | Operational quality-run history only. |

¹ Direct service-role SELECT is intentionally not granted on these interactive-homework child tables. Their count is provably zero in the current inventory because both possible parent sets are zero (`homework_assignments = 0`, `student_homework = 0`) and the schema requires non-null parent foreign keys/checks. Prompt 2 should count them in a privileged SQL transaction before deletion rather than changing grants.

## Preserve manifest

| Table/data | Current rows | Action | Reason |
|---|---:|---|---|
| `pricing_packages` | 6 | PRESERVE | Customer package catalog. |
| `site_settings` | 10 | PRESERVE | Site/payment/public configuration. |
| `testimonials` | 8 | PRESERVE | Approved site content. |
| `availability_slots` | 0 | PRESERVE | Scheduling configuration; only bookings are cleanup scope. |
| `discount_coupons` / `discount_coupon_packages` | 0 / 0 | PRESERVE | Intentional discount definitions/templates. |
| `countries` / `universities` / `programs` | 8 / 20 / 0 | PRESERVE | University/search catalog. |
| `qualifications` / `fields_of_study` / `search_aliases` | 29 / 23 / 66 | PRESERVE | Search and qualification catalog. |
| `admission_sources` / `admission_requirement_groups` / `admission_requirements` | 0 / 0 / 0 | PRESERVE | Admission content architecture. |
| `admission_source_snapshots` / `university_source_registry` / `university_domains` | 0 / 0 / 0 | PRESERVE | Verified source/catalog infrastructure. |
| `program_external_identifiers` | 0 | PRESERVE | Catalog identity mapping. |
| `question_bank` | 0 | PRESERVE | Canonical Soru Kütüphanesi content. |
| `homework_templates` / `homework_template_questions` | 0 / 0 | PRESERVE | Reusable content/template catalog. |
| `mock_exams` / `mock_exam_questions` | 0 / 0 | PRESERVE | Reusable test/template catalog. |
| Supabase/Google/Turnstile secrets, admin passwords/roles/session configuration | n/a | PRESERVE / DO NOT ROTATE | Outside data cleanup scope. |
| Migrations, SEO/tag config, email templates, logo/icons/site assets | n/a | PRESERVE | Delivery configuration and real site content. |

## Storage

`homework-attachments` is private and currently contains **0 objects**. Prompt 2 rules if objects appear before cleanup:

1. Delete `submissions/{student_uuid}/**` only for the final explicit purge UUID list.
2. Delete `resources/{assignment_uuid}/**` only when that assignment is in the purge list.
3. Preserve template/general resources and all real site/brand assets; stop for review on an unclassified path.
4. Delete DB attachment metadata and storage objects as one reconciled operation, then report remaining orphan counts.

## Required local pre-clean backup

Before Prompt 2 creates any destructive transaction, write a timestamped export under ignored `local-backups/phase-02-cleanup-<timestamp>/`. It must remain local and must not be committed or deployed. Record:

- exact table counts before and after;
- the explicit student/auth UUID allowlist and protected UUID denylist;
- auth totals and role-classification reason (no password hashes, sessions or tokens);
- counts/checksums for preserved `admin_profiles`, `site_settings`, `pricing_packages`, catalog and template tables;
- storage object paths/metadata only, without signed URLs or secrets;
- transaction/result log and rollback/export instructions.

## Prompt 2 safety gates and order

1. Read-only refresh; create local backup; verify checksum/counts for preserve tables.
2. Build protected identities from app metadata plus active `admin_profiles`. Abort on zero admins, overlap, or unclassified users.
3. Begin DB transaction and lock cleanup-relevant rows. Delete child rows in the numbered order above, using explicit IDs or verified foreign-key joins.
4. Delete application logs/diagnostics. Do not touch Gmail, OAuth, secrets or configuration tables.
5. Commit DB cleanup only after preserve counts match the backup.
6. Reconcile/delete scoped Storage objects.
7. Delete the five explicitly allowlisted student auth users one at a time through Supabase Admin Auth; re-check the protected admin after each delete.
8. Produce before/after counts and retained-config checks. Deployment remains a separate explicitly authorized step.
