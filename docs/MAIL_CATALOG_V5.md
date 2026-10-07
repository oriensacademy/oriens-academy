# Mail Catalog V5

The canonical generated catalog is `C:/Users/merto/Desktop/mail-v5.xlsx`, produced by `scripts/generate-mail-v5.mjs` and validated by `scripts/test-mail-v5-excel.mjs`.

- Active: 26
- Inactive: 1
- Total: 27
- MAIL-040: decommissioned; no producer
- MAIL-043: `package_rights_summary`, manual current-rights summary
- MAIL-044: `past_lesson_confirmation_manual`, optional manual past-lesson confirmation

MAIL-044 is queued only inside `admin_record_completed_lesson` when the admin explicitly selects **E-posta gönder**. Its dedupe key is derived from the completed lesson ID. It does not trigger MAIL-027 or MAIL-040.

Customer-facing subjects and H1s omit the redundant `| Oriens Academy` branding suffix. Dynamic content separators remain where they carry information.
