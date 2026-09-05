/**
 * REMOVED: student support / ticket system client.
 *
 * support_threads / support_messages and the send-support-email flow were
 * decommissioned -- see supabase/migrations/20260905150000_remove_student_support_ticket_system.sql.
 * The public contact form (contact_requests / create-contact / send-contact-reply)
 * is unaffected and remains the single inbound channel.
 *
 * Emptied rather than deleted so no stale import can resolve; the file can be removed.
 */
export {};
