/**
 * Reversible visibility switches for the current admin workflow.
 *
 * The underlying routes, handlers and data remain intact. Set a switch back to
 * `true` when the corresponding workflow is needed again.
 */
export const ADMIN_UI_FEATURES = {
  showLessonPlanningNavigation: false,
  showFutureLessonPlanning: false,
  showUpcomingSessions: false,
  showNextAppointmentSummary: false,
  showDashboardDatePill: false,
} as const;
