/**
 * REMOVED: unified web-contact + student-support inbox.
 *
 * The student support/ticket system (support_threads / support_messages) was
 * decommissioned -- see 20260905150000_remove_student_support_ticket_system.sql.
 * This component merged the two channels and had no remaining importer, so it is
 * emptied rather than rewritten. The file can be deleted.
 *
 * The public contact-request inbox lives in src/app/admin/iletisim/page.tsx.
 */
export {};
