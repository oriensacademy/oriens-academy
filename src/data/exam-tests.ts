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

// Exam-specific topic and question banks
const EXAM_TOPICS_MAP: Record<string, { tr: string; en: string; cat: string }[]> = {
  sat: [
    { tr: "Cebir ve Doğrusal Fonksiyonlar", en: "Algebra & Linear Functions", cat: "algebra" },
    { tr: "İleri Düzey Matematik & Polinomlar", en: "Advanced Math & Polynomials", cat: "advanced-math" },
    { tr: "Problem Çözme ve Veri Analizi", en: "Problem Solving & Data Analysis", cat: "data-analysis" },
    { tr: "Geometri ve Trigonometri", en: "Geometry & Trigonometry", cat: "geometry" },
    { tr: "Metin Yapısı ve Bilgi Çıkarımı", en: "Craft & Structure / Information", cat: "reading-structure" },
    { tr: "Standart İngilizce & İfade Gücü", en: "Standard English Conventions", cat: "writing-grammar" },
  ],
  ib: [
    { tr: "Fonksiyonlar ve Bağıntılar", en: "Functions & Equations", cat: "ib-functions" },
    { tr: "Trigonometri ve Dairesel Fonksiyonlar", en: "Circular Functions & Trig", cat: "ib-trig" },
    { tr: "Diferansiyel ve Türev", en: "Differential Calculus", cat: "ib-diff" },
    { tr: "İntegral ve Alan Hesabı", en: "Integral Calculus", cat: "ib-integral" },
    { tr: "Olasılık ve İstatistik", en: "Probability & Statistics", cat: "ib-stats" },
    { tr: "Vektörler ve Geometri", en: "Vectors & 3D Geometry", cat: "ib-vectors" },
  ],
  ap: [
    { tr: "Limit ve Süreklilik", en: "Limits & Continuity", cat: "ap-limits" },
    { tr: "Türev Kuralları ve Zincir Kuralı", en: "Differentiation & Chain Rule", cat: "ap-diff" },
    { tr: "Türev Uygulamaları ve Optimizasyon", en: "Applications of Differentiation", cat: "ap-diff-app" },
    { tr: "Belirli ve Belirsiz İntegral", en: "Integration & Accumulation", cat: "ap-integral" },
    { tr: "İntegral Uygulamaları ve Hacim", en: "Applications of Integration", cat: "ap-int-app" },
    { tr: "Diferansiyel Denklemler", en: "Differential Equations", cat: "ap-diff-eq" },
  ],
  tmua: [
    { tr: "Mantık ve Matematiksel İspat", en: "Mathematical Logic & Proof", cat: "tmua-logic" },
    { tr: "Cebir ve Denklem Sistemleri", en: "Algebra & Systems of Equations", cat: "tmua-algebra" },
    { tr: "Seriler ve Diziler", en: "Sequences & Series", cat: "tmua-series" },
    { tr: "Kalkülüs ve Eğri Analizi", en: "Calculus & Curve Sketching", cat: "tmua-calculus" },
    { tr: "Geometri ve Koordinat Geometrisi", en: "Coordinate Geometry", cat: "tmua-geom" },
    { tr: "Olasılık ve Sayma Yöntemleri", en: "Probability & Combinatorics", cat: "tmua-prob" },
  ],
  esat: [
    { tr: "Temel Matematik ve Fonksiyonlar", en: "Core Mathematics & Functions", cat: "esat-math" },
    { tr: "Kuvvet, Hareket ve Dinamik", en: "Forces, Motion & Dynamics", cat: "esat-mechanics" },
    { tr: "Enerji, İş ve Güç Dönüşümleri", en: "Energy, Work & Power", cat: "esat-energy" },
    { tr: "Elektrik ve Dalga Fiziği", en: "Electricity & Wave Physics", cat: "esat-waves" },
    { tr: "Atomik Yapı ve Kimyasal Bağlar", en: "Atomic Structure & Bonding", cat: "esat-chemistry" },
    { tr: "Termodinamik ve Madde Halleri", en: "Thermodynamics & States of Matter", cat: "esat-thermo" },
  ],
  imat: [
    { tr: "Hücre Biyolojisi ve Enerji Dönüşümü", en: "Cell Biology & Bioenergetics", cat: "imat-cell" },
    { tr: "Genetik ve Moleküler Kalıtım", en: "Genetics & Molecular Biology", cat: "imat-genetics" },
    { tr: "Organik ve Anorganik Kimya", en: "Organic & General Chemistry", cat: "imat-chem" },
    { tr: "Fizik ve Biyomedikal İlkeler", en: "Physics & Biomechanics", cat: "imat-physics" },
    { tr: "Eleştirel Düşünme ve Mantıksal Akıl Yürütme", en: "Critical Thinking & Logic", cat: "imat-logic" },
    { tr: "Problem Çözme ve Veri Yorumlama", en: "Problem Solving & Data Interpretation", cat: "imat-problem" },
  ],
};

const DEFAULT_TOPICS = [
  { tr: "Temel Kavramlar ve Cebir", en: "Core Concepts & Algebra", cat: "core-algebra" },
  { tr: "Analitik Düşünme ve Fonksiyonlar", en: "Analytical Thinking & Functions", cat: "functions" },
  { tr: "Geometrik ve Sayısal İlişkiler", en: "Geometric & Numerical Relations", cat: "geometry" },
  { tr: "Problem Çözme ve Sayısal Mantık", en: "Problem Solving & Numerical Logic", cat: "problem-solving" },
  { tr: "Veri Yorumlama ve İstatistik", en: "Data Interpretation & Statistics", cat: "data-stats" },
  { tr: "Metin ve Soru Kökü Analizi", en: "Critical Analysis & Structure", cat: "critical-analysis" },
];

function buildQuestionsForExam(exam: ExamCode): ExamTestQuestion[] {
  const code = exam.toLowerCase();
  const topics = EXAM_TOPICS_MAP[code] || DEFAULT_TOPICS;

  const sampleBank: {
    qTr: string;
    qEn: string;
    answersTr: [string, string, string, string];
    answersEn: [string, string, string, string];
    correct: AnswerId;
    expTr: string;
    expEn: string;
  }[] = [
    {
      qTr: "f(x) = 3x - 5 ve g(x) = x² + 2 fonksiyonları için (g ∘ f)(2) değeri kaçtır?",
      qEn: "For functions f(x) = 3x - 5 and g(x) = x² + 2, what is the value of (g ∘ f)(2)?",
      answersTr: ["3", "1", "6", "9"],
      answersEn: ["3", "1", "6", "9"],
      correct: "a",
      expTr: "f(2) = 3(2) - 5 = 1 elde edilir. Ardından g(1) = 1² + 2 = 3 bulunur.",
      expEn: "First evaluate f(2) = 3(2) - 5 = 1. Then evaluate g(1) = 1² + 2 = 3.",
    },
    {
      qTr: "2x² - 8x + 6 = 0 denkleminin kökleri toplamı ve çarpımının oranı kaçtır?",
      qEn: "What is the ratio of the sum of roots to the product of roots for 2x² - 8x + 6 = 0?",
      answersTr: ["3/4", "4/3", "2", "3/2"],
      answersEn: ["3/4", "4/3", "2", "3/2"],
      correct: "b",
      expTr: "Kökler toplamı -b/a = 8/2 = 4; kökler çarpımı c/a = 6/2 = 3 olur. Oran 4/3'tür.",
      expEn: "Sum of roots is -b/a = 8/2 = 4; product of roots is c/a = 6/2 = 3. The ratio is 4/3.",
    },
    {
      qTr: "Bir torbada 4 mavi ve 6 kırmızı bilye bulunmaktadır. Geri konulmaksızın art arda çekilen iki bilyenin ikisinin de mavi olma olasılığı nedir?",
      qEn: "A bag contains 4 blue and 6 red marbles. What is the probability of drawing two blue marbles in succession without replacement?",
      answersTr: ["4/25", "1/5", "2/15", "6/25"],
      answersEn: ["4/25", "1/5", "2/15", "6/25"],
      correct: "c",
      expTr: "İlk bilyenin mavi gelme olasılığı 4/10 = 2/5, ikincinin mavi gelme olasılığı 3/9 = 1/3'tür. (2/5) × (1/3) = 2/15.",
      expEn: "Probability of first blue is 4/10 = 2/5; second blue is 3/9 = 1/3. Multiplying gives (2/5) × (1/3) = 2/15.",
    },
    {
      qTr: "Bir dik üçgende hipotenüs uzunluğu 10 birim ve bir dik kenar 6 birim ise, bu kenara komşu açının kosinüs değeri nedir?",
      qEn: "In a right triangle with hypotenuse 10 and one leg of 6 units, what is the cosine of the angle adjacent to this leg?",
      answersTr: ["0.8", "0.75", "1.33", "0.6"],
      answersEn: ["0.8", "0.75", "1.33", "0.6"],
      correct: "d",
      expTr: "Kosinüs = Komşu / Hipotenüs = 6 / 10 = 0.6.",
      expEn: "Cosine = Adjacent / Hypotenuse = 6 / 10 = 0.6.",
    },
    {
      qTr: "lim (x → 2) (x² - 4) / (x - 2) limitinin değeri kaçtır?",
      qEn: "What is the value of the limit lim (x → 2) (x² - 4) / (x - 2)?",
      answersTr: ["4", "0", "2", "Tanımsız / Undefined"],
      answersEn: ["4", "0", "2", "Undefined"],
      correct: "a",
      expTr: "(x² - 4) = (x - 2)(x + 2). Sadeleştirme sonrası lim (x → 2) (x + 2) = 4.",
      expEn: "Factor the numerator (x - 2)(x + 2). Cancel (x - 2) to get lim (x → 2) (x + 2) = 4.",
    },
    {
      qTr: "Aşağıdaki yargılardan hangisi bir argümanda mantıksal tutarlılığı sağlamak için en temel gerekliliktir?",
      qEn: "Which of the following is the most fundamental requirement for logical consistency in an argument?",
      answersTr: [
        "İddianın genel kabul gören popüler bir görüş olması",
        "Öncüllerin sonucu doğrudan ve çelişkisiz desteklemesi",
        "Kullanılan dilin teknik ve karmaşık olması",
        "Sonucun tüm olası istisnaları içermesi",
      ],
      answersEn: [
        "The claim being a popular consensus view",
        "Premises directly and non-contradictorily supporting the conclusion",
        "Using complex and specialized vocabulary",
        "The conclusion accounting for every edge exception",
      ],
      correct: "b",
      expTr: "Mantıksal geçerlilik, öncüllerin çelişki barındırmadan sonucu zorunlu kılmasıyla sağlanır.",
      expEn: "Logical validity requires that the premises consistently and non-contradictorily lead to the conclusion.",
    },
  ];

  return Array.from({ length: EXAM_TEST_QUESTION_COUNT }, (_, index) => {
    const qData = sampleBank[index % sampleBank.length];
    const tData = topics[index % topics.length];
    const qNum = index + 1;

    return {
      id: `${code}-q-${qNum}`,
      exam,
      topic: { tr: tData.tr, en: tData.en },
      recommendationCategory: tData.cat,
      question: {
        tr: `Soru ${qNum} (${exam.toUpperCase()} · ${tData.tr}): ${qData.qTr}`,
        en: `Question ${qNum} (${exam.toUpperCase()} · ${tData.en}): ${qData.qEn}`,
      },
      answers: [
        { id: "a", label: { tr: qData.answersTr[0], en: qData.answersEn[0] } },
        { id: "b", label: { tr: qData.answersTr[1], en: qData.answersEn[1] } },
        { id: "c", label: { tr: qData.answersTr[2], en: qData.answersEn[2] } },
        { id: "d", label: { tr: qData.answersTr[3], en: qData.answersEn[3] } },
      ],
      correctAnswer: qData.correct,
      explanation: { tr: qData.expTr, en: qData.expEn },
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
    const label = question.topic?.[locale] || question.topic?.tr || question.topic?.en || `Konu ${qNum}`;

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
      questionText: question.question?.[locale] || question.question?.tr || "",
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation?.[locale] || question.explanation?.tr || "",
      answers: question.answers,
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

