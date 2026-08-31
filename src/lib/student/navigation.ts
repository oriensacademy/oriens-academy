export const STUDENT_NAVIGATION = [
  { id: "overview", labelIndex: 0, visible: true },
  { id: "profile", labelIndex: 1, visible: true },
  { id: "lessons", labelIndex: 2, visible: true },
  { id: "homework", labelIndex: 3, visible: false },
  { id: "package", labelIndex: 4, visible: true },
  { id: "payments", labelIndex: 5, visible: true },
  { id: "exam_history", labelIndex: 6, visible: false },
  { id: "support", labelIndex: 7, visible: true },
] as const;

export type StudentSectionId = (typeof STUDENT_NAVIGATION)[number]["id"];
export const VISIBLE_STUDENT_NAVIGATION = STUDENT_NAVIGATION.filter((item) => item.visible);
