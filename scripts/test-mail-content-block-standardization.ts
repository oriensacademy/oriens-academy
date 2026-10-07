import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NORMAL_CONTENT_BLOCK_STYLE,
  NORMAL_CONTENT_CELL_STYLE,
  normalContentBlock,
  renderAdminAppointmentCreatedEmail,
  renderAdminBookingEmail,
  renderAdminContactEmail,
  renderEmailChangeSecurityNoticeEmail,
  renderStudentAppointmentCancelledEmail,
  renderStudentAppointmentConfirmedEmail,
  renderStudentAppointmentReminderEmail,
  renderStudentAppointmentUpdatedEmail,
  renderStudentBookingEmail,
  renderStudentContactEmail,
  renderStudentLiveLessonLinkEmail,
} from "../supabase/functions/_shared/email/templates";
import { renderPaymentSuccessEmail } from "../supabase/functions/_shared/email/payment-success";

const booking = {
  bookingId: "booking-fixture",
  fullName: "Fixture Student",
  email: "fixture@example.test",
  phone: "+900000000000",
  supportType: "academic",
  examCode: "ib",
  startsAt: "2026-09-22T18:00:00.000Z",
  endsAt: "2026-09-22T19:00:00.000Z",
  locale: "en" as const,
  notes: "BOOKING_CONTENT_MARKER",
  status: "confirmed",
};

const contact = {
  contactId: "contact-fixture",
  fullName: "Fixture Student",
  email: "fixture@example.test",
  phone: "+900000000000",
  subject: "CONTACT_SUBJECT_MARKER",
  message: "CONTACT_CONTENT_MARKER",
  locale: "en" as const,
  createdAt: "2026-09-22T18:00:00.000Z",
  source: "contact_form" as const,
};

const appointment = {
  appointmentId: "appointment-fixture",
  studentName: "Fixture Student",
  studentEmail: "fixture@example.test",
  teacherName: "Fixture Teacher",
  lessonTitle: "LESSON_CONTENT_MARKER",
  startsAt: "2026-09-22T18:00:00.000Z",
  endsAt: "2026-09-22T19:00:00.000Z",
  locationOrMeetingUrl: "https://example.test/lesson",
  notes: "APPOINTMENT_NOTE_MARKER",
  locale: "en" as const,
  previousStartsAt: "2026-09-21T18:00:00.000Z",
  cancellationReason: "CANCELLATION_MARKER",
};

const liveLesson = {
  lessonId: "lesson-fixture",
  studentName: "Fixture Student",
  studentEmail: "fixture@example.test",
  lessonTitle: "LIVE_LESSON_MARKER",
  subject: "Mathematics",
  examCode: "ib",
  lessonDate: "2026-09-22T18:00:00.000Z",
  lessonTimezone: "Europe/Istanbul",
  lessonTimezoneLabel: "TR",
  durationMinutes: 60,
  liveMeetingUrl: "https://example.test/live",
  teacherName: "Fixture Teacher",
  teacherNote: "LIVE_NOTE_MARKER",
  locale: "en" as const,
};

const renderers = [
  ["admin booking", () => renderAdminBookingEmail(booking, "en"), "BOOKING_CONTENT_MARKER"],
  ["student booking", () => renderStudentBookingEmail(booking), "Fixture Student"],
  ["admin contact", () => renderAdminContactEmail(contact, "en"), "CONTACT_CONTENT_MARKER"],
  ["student contact", () => renderStudentContactEmail(contact), "CONTACT_CONTENT_MARKER"],
  ["student appointment confirmed", () => renderStudentAppointmentConfirmedEmail(appointment), "LESSON_CONTENT_MARKER"],
  ["admin appointment created", () => renderAdminAppointmentCreatedEmail(appointment, "en"), "LESSON_CONTENT_MARKER"],
  ["student appointment updated", () => renderStudentAppointmentUpdatedEmail(appointment), "APPOINTMENT_NOTE_MARKER"],
  ["student appointment cancelled", () => renderStudentAppointmentCancelledEmail(appointment), "CANCELLATION_MARKER"],
  ["student appointment reminder", () => renderStudentAppointmentReminderEmail(appointment), "LESSON_CONTENT_MARKER"],
  ["student live lesson", () => renderStudentLiveLessonLinkEmail(liveLesson), "LIVE_NOTE_MARKER"],
  ["email change security notice", () => renderEmailChangeSecurityNoticeEmail({
    oldEmail: "old@example.test",
    newEmailMasked: "n***@example.test",
    changedAt: "2026-09-22T18:00:00.000Z",
    locale: "en",
  }), "old@example.test"],
] as const;

for (const [name, render, marker] of renderers) {
  const result = render();
  assert.ok(result.subject, `${name}: subject missing`);
  assert.ok(result.text, `${name}: text missing`);
  assert.match(result.html, /data-normal-content-block="true"/, `${name}: canonical block missing`);
  assert.match(result.html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${name}: content changed`);
  assert.match(result.html, /info@oriens-academy\.com/, `${name}: footer missing`);
}

const payment = renderPaymentSuccessEmail("guardian", {
  reference: "ORI-VISUAL-QA-001",
  payer_name: "Fixture Student",
  payer_email: "fixture@example.test",
  package_id: "package5",
  lesson_count: 5,
}, "tr");
assert.match(payment.bodyHtml, /background-color:#F7F8F6;border-radius:12px/);
assert.match(payment.bodyHtml, /ORI-VISUAL-QA-001/);

const processSource = readFileSync(
  new URL("../supabase/functions/process-notification-outbox/index.ts", import.meta.url),
  "utf8",
);
assert.match(processSource, /renderLessonReportEmail\(row\.template, p, liveRemaining\)/);
const lessonReportSource = readFileSync(
  new URL("../supabase/functions/_shared/email/lesson-report.ts", import.meta.url),
  "utf8",
);
assert.match(lessonReportSource, /background-color:#F7F7F4;border-radius:12px/);
assert.doesNotMatch(lessonReportSource, /border-left/i);

const lessonInfoFixture = normalContentBlock("<table><tr><td>LESSON_INFO_MARKER</td></tr></table>");
const lessonReportFixture = normalContentBlock("<div>REPORT_CONTENT_MARKER</div>");
for (const [name, html] of [["lesson info", lessonInfoFixture], ["lesson report", lessonReportFixture]]) {
  assert.match(html, new RegExp(`style="${NORMAL_CONTENT_BLOCK_STYLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `${name}: outer style mismatch`);
  assert.match(html, new RegExp(`style="${NORMAL_CONTENT_CELL_STYLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `${name}: padding mismatch`);
}
assert.match(lessonReportFixture, /REPORT_CONTENT_MARKER/);

const security = renderEmailChangeSecurityNoticeEmail({
  oldEmail: "old@example.test",
  newEmailMasked: "n***@example.test",
  locale: "en",
});
assert.match(security.html, /background-color:#FCF9EE;border:1px solid #EBDDB2/);
assert.match(security.html, /mailto:info@oriens-academy\.com/);

console.log(`PASS: ${renderers.length} general render paths use the canonical normal content block.`);
console.log("PASS: payment success uses the customer-approved summary block.");
console.log("PASS: MAIL-027 uses the customer-approved ivory cards without an old left border.");
console.log("PASS: special security warning styling and support CTA remain present.");
