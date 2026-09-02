export interface LessonAdjustmentPreview {
  oldLessonCount: number;
  newLessonCount: number;
  lessonsUsed: number;
  oldRemaining: number;
  newRemaining: number;
  valid: boolean;
}

export function previewLessonAdjustment(
  lessonCount: number,
  lessonsUsed: number,
  lessonDelta: number
): LessonAdjustmentPreview {
  const oldRemaining = lessonCount - lessonsUsed;
  const newLessonCount = lessonCount + lessonDelta;
  const newRemaining = newLessonCount - lessonsUsed;
  return {
    oldLessonCount: lessonCount,
    newLessonCount,
    lessonsUsed,
    oldRemaining,
    newRemaining,
    valid: Number.isInteger(lessonDelta) && lessonDelta !== 0 && newLessonCount >= 0 && newRemaining >= 0,
  };
}
