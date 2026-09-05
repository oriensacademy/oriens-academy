// The student support/ticket section was removed together with the
// support_threads/support_messages system (20260905150000). Nothing replaces it:
// students reach the academy through the public contact form.
export const STUDENT_NAVIGATION = [
  { id: "overview", labelIndex: 0, visible: true },
  { id: "profile", labelIndex: 1, visible: true },
  { id: "lessons", labelIndex: 2, visible: true },
  { id: "package", labelIndex: 3, visible: true },
  { id: "payments", labelIndex: 4, visible: true },
] as const;

export type StudentSectionId = (typeof STUDENT_NAVIGATION)[number]["id"];
export const VISIBLE_STUDENT_NAVIGATION = STUDENT_NAVIGATION.filter((item) => item.visible);
