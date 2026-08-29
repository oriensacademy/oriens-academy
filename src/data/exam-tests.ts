import { examCodes } from "@/content/shared";
import type { ExamCode } from "@/content/exams";
import type { Locale } from "@/content/dictionaries";
import examQuestionsSource from "./exam-tests-source.json" with { type: "json" };

export type AnswerId = "a" | "b" | "c" | "d";
export type LocalizedText = Record<Locale, string>;

export interface AnswerOption {
  id: AnswerId;
  label: LocalizedText;
}

export interface ExamTestQuestion {
  id: string;
  exam: ExamCode;
  topic: LocalizedText;
  questionLanguage?: "en" | "tr";
  question: LocalizedText;
  answers: AnswerOption[];
  correctAnswer: AnswerId;
  explanation: LocalizedText;
  recommendationCategory: string;
}

export interface ExamTest {
  exam: ExamCode;
  questions: ExamTestQuestion[];
}

export interface TopicResult {
  category: string;
  label: string;
  correct: number;
  total: number;
  accuracy: number;
  status: "strong" | "moderate" | "improve";
}

export interface QuestionBreakdownItem {
  id: string;
  questionNumber: number;
  topic: string;
  questionText: string;
  selectedAnswer: AnswerId | null;
  correctAnswer: AnswerId;
  isCorrect: boolean;
  explanation: string;
  answers: AnswerOption[];
  questionLanguage?: "en" | "tr";
}

export interface TestResult {
  examCode: ExamCode;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  accuracy: number;
  performanceTier: "strong" | "moderate" | "foundation";
  topics: TopicResult[];
  strengths: string[];
  improvementAreas: string[];
  breakdown: QuestionBreakdownItem[];
}

export const EXAM_TEST_QUESTION_COUNT = 6;

type RawQuestion = {
  topic: string;
  cat: string;
  q: string;
  answers: [string, string, string, string];
  correct: AnswerId;
  exp: string;
};

const rawBank = examQuestionsSource as unknown as Record<string, RawQuestion[]>;

function buildQuestionsForExam(exam: ExamCode): ExamTestQuestion[] {
  const code = exam.toLowerCase();
  const rawList = rawBank[code] || [];

  return rawList.map((item, index) => {
    const qNum = index + 1;
    // Canonical rule: Topic labels for international exams remain English in both TR and EN UI
    const englishTopic = item.topic;

    return {
      id: `${code}-q-${qNum}`,
      exam,
      topic: { tr: englishTopic, en: englishTopic },
      recommendationCategory: item.cat,
      questionLanguage: "en",
      question: {
        tr: item.q,
        en: item.q,
      },
      answers: [
        { id: "a", label: { tr: item.answers[0], en: item.answers[0] } },
        { id: "b", label: { tr: item.answers[1], en: item.answers[1] } },
        { id: "c", label: { tr: item.answers[2], en: item.answers[2] } },
        { id: "d", label: { tr: item.answers[3], en: item.answers[3] } },
      ],
      correctAnswer: item.correct,
      explanation: {
        tr: item.exp,
        en: item.exp,
      },
    };
  });
}

export const examTests: Record<ExamCode, ExamTest> = Object.fromEntries(
  examCodes.map((exam) => [exam, { exam, questions: buildQuestionsForExam(exam) }])
) as Record<ExamCode, ExamTest>;

export function calculateTestResult(
  test?: ExamTest | null,
  answers: Record<string, AnswerId | undefined> = {},
  locale: Locale = "tr"
): TestResult {
  const topicMap = new Map<string, { category: string; label: string; correct: number; total: number }>();
  let correct = 0;
  let answered = 0;
  const questions = Array.isArray(test?.questions) ? test.questions.filter(Boolean) : [];
  const breakdown: QuestionBreakdownItem[] = [];

  questions.forEach((question, idx) => {
    if (!question) return;
    const qNum = idx + 1;
    const selectedAnswer = answers[question.id] || null;
    const isValidAnswer = question.answers.some((answer) => answer.id === selectedAnswer);
    if (isValidAnswer) answered += 1;
    const isCorrect = Boolean(isValidAnswer && selectedAnswer === question.correctAnswer);
    if (isCorrect) correct += 1;

    const categoryKey = question.recommendationCategory || `topic-${qNum}`;
    const label = question.topic?.[locale] || question.topic?.en || question.topic?.tr || `Topic ${qNum}`;

    const existing = topicMap.get(categoryKey) ?? {
      category: categoryKey,
      label,
      correct: 0,
      total: 0,
    };
    existing.total += 1;
    if (isCorrect) existing.correct += 1;
    topicMap.set(categoryKey, existing);

    breakdown.push({
      id: question.id,
      questionNumber: qNum,
      topic: label,
      questionText: question.question?.en || question.question?.tr || "",
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation?.en || question.explanation?.tr || "",
      answers: question.answers,
      questionLanguage: question.questionLanguage || "en",
    });
  });

  const total = questions.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const boundedAccuracy = Math.min(100, Math.max(0, accuracy));

  const topics: TopicResult[] = Array.from(topicMap.values()).map((t) => {
    const acc = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
    const status: TopicResult["status"] = acc >= 80 ? "strong" : acc >= 50 ? "moderate" : "improve";
    return {
      category: t.category,
      label: t.label,
      correct: t.correct,
      total: t.total,
      accuracy: acc,
      status,
    };
  });

  const strengths = topics.filter((t) => t.status === "strong").map((t) => t.label);
  const improvementAreas = topics.filter((t) => t.status === "improve" || t.status === "moderate").map((t) => t.label);

  const performanceTier: TestResult["performanceTier"] =
    boundedAccuracy >= 75 ? "strong" : boundedAccuracy >= 40 ? "moderate" : "foundation";

  return {
    examCode: test?.exam || "SAT",
    correct,
    incorrect: Math.max(0, answered - correct),
    unanswered: Math.max(0, total - answered),
    total,
    accuracy: boundedAccuracy,
    performanceTier,
    topics,
    strengths,
    improvementAreas,
    breakdown,
  };
}
