import { examCodes } from "@/content/shared";
import type { ExamCode } from "@/content/exams";
import type { Locale } from "@/content/dictionaries";

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
  question: LocalizedText;
  answers: AnswerOption[];
  correctAnswer: AnswerId;
  explanation: LocalizedText;
  recommendationCategory: "topic-a" | "topic-b" | "topic-c";
}

export interface ExamTest {
  exam: ExamCode;
  questions: ExamTestQuestion[];
}

export interface TopicResult {
  category: ExamTestQuestion["recommendationCategory"];
  label: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface TestResult {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  topics: TopicResult[];
}

const topicSequence = ["topic-a", "topic-b", "topic-c", "topic-a", "topic-b", "topic-c"] as const;
const correctSequence: AnswerId[] = ["a", "b", "c", "d", "a", "b"];

function topicText(topic: (typeof topicSequence)[number]): LocalizedText {
  const suffix = topic.slice(-1).toUpperCase();
  return { tr: `Konu ${suffix}`, en: `Topic ${suffix}` };
}

function createQuestion(exam: ExamCode, index: number): ExamTestQuestion {
  const number = index + 1;
  const topic = topicSequence[index] ?? "topic-a";
  return {
    id: `${exam.toLowerCase()}-placeholder-${number}`,
    exam,
    topic: topicText(topic),
    question: {
      tr: `Örnek Soru ${number} — Lorem ipsum dolor sit amet?`,
      en: `Sample Question ${number} — Lorem ipsum dolor sit amet?`,
    },
    answers: (["a", "b", "c", "d"] as AnswerId[]).map((id, optionIndex) => ({
      id,
      label: {
        tr: `Örnek seçenek ${optionIndex + 1}`,
        en: `Placeholder option ${optionIndex + 1}`,
      },
    })),
    correctAnswer: correctSequence[index] ?? "a",
    explanation: {
      tr: "Örnek açıklama — nihai soru içeriğiyle birlikte güncellenecektir.",
      en: "Placeholder explanation — to be updated with the final question content.",
    },
    recommendationCategory: topic,
  };
}

export const examTests: Record<ExamCode, ExamTest> = Object.fromEntries(
  examCodes.map((exam) => [exam, { exam, questions: Array.from({ length: 6 }, (_, index) => createQuestion(exam, index)) }])
) as Record<ExamCode, ExamTest>;

export function calculateTestResult(test: ExamTest, answers: Record<string, AnswerId>, locale: Locale): TestResult {
  const topicMap = new Map<string, TopicResult>();
  let correct = 0;
  const questions = test?.questions ?? [];
  for (const question of questions) {
    const isCorrect = answers[question.id] === question.correctAnswer;
    if (isCorrect) correct += 1;
    const existing = topicMap.get(question.recommendationCategory) ?? {
      category: question.recommendationCategory,
      label: question.topic?.[locale] ?? question.topic?.tr ?? "Genel",
      correct: 0,
      total: 0,
      accuracy: 0,
    };
    existing.total += 1;
    if (isCorrect) existing.correct += 1;
    existing.accuracy = Math.round((existing.correct / Math.max(1, existing.total)) * 100);
    topicMap.set(question.recommendationCategory, existing);
  }
  const total = Math.max(1, questions.length);
  return {
    correct,
    incorrect: questions.length - correct,
    total: questions.length,
    accuracy: Math.round((correct / total) * 100),
    topics: Array.from(topicMap.values()),
  };
}
