export type ProgramPageDecision = "VALID" | "LIKELY_VALID" | "NEEDS_REVIEW" | "INVALID";

export type ProgramAuditClassification =
  | "VALID_PROGRAM"
  | "LIKELY_VALID_PROGRAM"
  | "INVALID_NAVIGATION_PAGE"
  | "INVALID_INFORMATION_PAGE"
  | "INVALID_ADMISSIONS_PAGE"
  | "INVALID_EVENT_PAGE"
  | "INVALID_NEWS_PAGE"
  | "INVALID_CATEGORY_PAGE"
  | "INVALID_SEARCH_PAGE"
  | "AMBIGUOUS_NEEDS_REVIEW";

export interface ProgramPageClassification {
  decision: ProgramPageDecision;
  classification: ProgramAuditClassification;
  confidence: number;
  title: string;
  score: number;
  positiveSignals: string[];
  negativeSignals: string[];
  reasons: string[];
}

export interface ProgramPageInput {
  html: string;
  url: string;
  title?: string | null;
}

const DEGREE_PATTERN = /\b(?:ba|bsc|beng|meng|msci|mchem|mphys|mmath|mbbs|mb\s*bchir|llb|msc|ma|mphil|mres|mba|phd|dphil|edd|pgce|pgdip|postgraduate diploma|bachelor(?:'s)?|master(?:'s)?|doctor(?:al|ate)?|laurea)\b/i;
const DURATION_PATTERN = /\b(?:duration|course length|programme length|full[- ]time|part[- ]time|\d+\s*(?:years?|months?|terms?|semesters?))\b/i;
const CURRICULUM_PATTERN = /\b(?:curriculum|course structure|programme structure|modules?|what you(?:'|’)ll study|study plan|piano studi)\b/i;
const ENTRY_PATTERN = /\b(?:entry requirements?|admission requirements?|academic requirements?|how to apply|application requirements?)\b/i;
const CODE_PATTERN = /\b(?:course|programme|program)\s*(?:code|id)\s*[:#]?\s*[a-z0-9-]{3,}\b/i;
const STRUCTURED_PATTERN = /["']@type["']\s*:\s*["'](?:Course|EducationalOccupationalProgram)["']/i;

const TITLE_CATEGORIES: Array<{ pattern: RegExp; classification: ProgramAuditClassification; signal: string }> = [
  { pattern: /\b(?:open days?|events?|visit us)\b/i, classification: "INVALID_EVENT_PAGE", signal: "event title" },
  { pattern: /\b(?:news|press release|latest stories)\b/i, classification: "INVALID_NEWS_PAGE", signal: "news title" },
  { pattern: /\b(?:admissions?|ammissioni|selection criteria|how to apply|application guide|admission requirements?|who is eligible)\b/i, classification: "INVALID_ADMISSIONS_PAGE", signal: "admissions title" },
  { pattern: /\b(?:find (?:a|your) course|course search|subject a-z|course listing|degree programs|explore programs|departments offering courses|department directory|research courses|taught courses|postgraduate qualifications|lauree magistrali|lauree triennali|master universitari|master specialistici|master(?:'|’s)? programs|school of management)\b/i, classification: "INVALID_CATEGORY_PAGE", signal: "catalog/index title" },
  { pattern: /\b(?:fees?|funding|fee status|student life|accommodation|contact us|frequently asked questions|faq|where do i start|changes to courses|choosing what to study|how to choose a course|how you will learn|learning at|personalised learning|careers and graduate prospects|about your studies|recruitment and engagement|housing and dining|key program dates|activities during|benefits of participating|what .* can do for you|what to expect|part-time study at|summer school|opportunit[aà] internazionali|piano studi|dopo la laurea)\b/i, classification: "INVALID_INFORMATION_PAGE", signal: "generic information title" },
];

const NEGATIVE_PATHS: Array<{ pattern: RegExp; classification: ProgramAuditClassification; signal: string }> = [
  { pattern: /\/(?:open-days?|events?|visit)(?:\/|$)/i, classification: "INVALID_EVENT_PAGE", signal: "event URL" },
  { pattern: /\/(?:news|stories|press)(?:\/|$)/i, classification: "INVALID_NEWS_PAGE", signal: "news URL" },
  { pattern: /\/(?:admissions?|apply|application|selection-criteria|who-is-eligible)(?:\/|$)/i, classification: "INVALID_ADMISSIONS_PAGE", signal: "admissions URL" },
  { pattern: /\/(?:fees?|funding|student-life|accommodation|contact|faq|help-centre)(?:\/|$)/i, classification: "INVALID_INFORMATION_PAGE", signal: "information URL" },
  { pattern: /\/(?:search|compare|find-your-course|course-listing|departments|qualifications|research-courses|taught-courses|open-courses)(?:\/|$)/i, classification: "INVALID_CATEGORY_PAGE", signal: "catalog/index URL" },
];

function decodeText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function extractProgramPageTitle(html: string): string {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return decodeText(h1);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeText(title).split("|")[0].trim() : "";
}

function detailTemplateSignal(url: URL): string | null {
  const path = url.pathname.toLowerCase().replace(/\/$/, "");
  if (/ox\.ac\.uk$/.test(url.hostname) && /\/admissions\/graduate\/courses\/(?:dphil-|msc-|mst-|mphil-|mpp-|mba-|pgdip-|cdt-)/.test(path)) return "Oxford program detail template";
  if (/undergraduate\.study\.cam\.ac\.uk$/.test(url.hostname) && /\/courses\/.+-(?:ba-hons|bsc-hons|meng|mamsci)$/.test(path)) return "Cambridge undergraduate detail template";
  if (/postgraduate\.study\.cam\.ac\.uk$/.test(url.hostname) && /\/courses\/directory\/[a-z0-9]+$/.test(path)) return "Cambridge postgraduate directory detail";
  if (/imperial\.ac\.uk$/.test(url.hostname) && /\/study\/courses\/(?:undergraduate|postgraduate-taught|postgraduate-research)\/[a-z0-9-]+$/.test(path)) return "Imperial program detail template";
  if (/unibocconi\.(?:it|eu)$/.test(url.hostname) && /\/corsi-di-studio\/(?:lauree-triennali|lauree-magistrali|master-universitari)\/[a-z0-9-]+$/.test(path)) return "Bocconi program detail template";
  if (/unibocconi\.(?:it|eu)$/.test(url.hostname) && /\/corsi-di-studio\/[a-z0-9-]+$/.test(path) && !/\/(?:lauree-triennali|lauree-magistrali|master-universitari|summer-school|sda-bocconi-school-management)$/.test(path)) return "Bocconi program detail template";
  return null;
}

export function classifyProgramPage(input: ProgramPageInput): ProgramPageClassification {
  const html = input.html || "";
  const title = decodeText(input.title || extractProgramPageTitle(html));
  const text = decodeText(html).slice(0, 500_000);
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  let score = 0;
  let negativeClassification: ProgramAuditClassification | null = null;
  let hasNegativeTitle = false;

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(input.url);
  } catch {
    negativeSignals.push("invalid URL");
    negativeClassification = "INVALID_INFORMATION_PAGE";
    score -= 6;
  }

  for (const category of TITLE_CATEGORIES) {
    if (category.pattern.test(title)) {
      negativeSignals.push(category.signal);
      negativeClassification = category.classification;
      hasNegativeTitle = true;
      score -= 7;
      break;
    }
  }

  if (parsedUrl) {
    const template = detailTemplateSignal(parsedUrl);
    if (template) {
      positiveSignals.push(template);
      score += 4;
    } else {
      for (const category of NEGATIVE_PATHS) {
        if (category.pattern.test(parsedUrl.pathname)) {
          negativeSignals.push(category.signal);
          negativeClassification ||= category.classification;
          score -= 4;
          break;
        }
      }
    }
  }

  const titleHasDegree = DEGREE_PATTERN.test(title);
  if (titleHasDegree) {
    positiveSignals.push("explicit degree award in page title");
    score += 5;
  }
  if (STRUCTURED_PATTERN.test(html)) {
    positiveSignals.push("program-specific structured data");
    score += 6;
  }
  if (DEGREE_PATTERN.test(text)) {
    positiveSignals.push("degree award evidence in page content");
    score += 2;
  }
  if (CODE_PATTERN.test(text)) {
    positiveSignals.push("program/course code");
    score += 2;
  }
  if (DURATION_PATTERN.test(text)) {
    positiveSignals.push("duration or study-mode evidence");
    score += 1;
  }
  if (CURRICULUM_PATTERN.test(text)) {
    positiveSignals.push("program-specific curriculum evidence");
    score += 1;
  }
  if (ENTRY_PATTERN.test(text)) {
    positiveSignals.push("entry/application evidence");
    score += 1;
  }

  const hasStrongPositive = titleHasDegree || positiveSignals.some((signal) =>
    signal.includes("structured data") || signal.includes("detail template") || signal.includes("directory detail")
  );

  if (negativeClassification && (hasNegativeTitle || (!titleHasDegree && !STRUCTURED_PATTERN.test(html)))) {
    return {
      decision: "INVALID",
      classification: negativeClassification,
      confidence: Math.min(0.99, 0.8 + negativeSignals.length * 0.05),
      title,
      score,
      positiveSignals,
      negativeSignals,
      reasons: [...negativeSignals, "no overriding program-specific evidence"],
    };
  }

  if (score >= 7 && hasStrongPositive) {
    return {
      decision: "VALID",
      classification: "VALID_PROGRAM",
      confidence: Math.min(0.99, 0.75 + score / 50),
      title,
      score,
      positiveSignals,
      negativeSignals,
      reasons: positiveSignals,
    };
  }

  if (score >= 4 && hasStrongPositive && negativeSignals.length === 0) {
    return {
      decision: "LIKELY_VALID",
      classification: "LIKELY_VALID_PROGRAM",
      confidence: Math.min(0.89, 0.6 + score / 50),
      title,
      score,
      positiveSignals,
      negativeSignals,
      reasons: positiveSignals,
    };
  }

  return {
    decision: "NEEDS_REVIEW",
    classification: "AMBIGUOUS_NEEDS_REVIEW",
    confidence: 0.5,
    title,
    score,
    positiveSignals,
    negativeSignals,
    reasons: ["insufficient positive evidence for automatic activation", ...negativeSignals],
  };
}

export function isPotentialProgramDetailLink(url: string, anchorText = ""): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const title = decodeText(anchorText);
  if (TITLE_CATEGORIES.some(({ pattern }) => pattern.test(title))) return false;
  const template = detailTemplateSignal(parsed);
  if (!template && NEGATIVE_PATHS.some(({ pattern }) => pattern.test(parsed.pathname))) return false;

  const path = parsed.pathname.toLowerCase().replace(/\/$/, "");
  if (/\/(?:courses?|programs?|degrees?|corsi-di-studio)$/.test(path)) return false;
  if (template) return true;
  if (DEGREE_PATTERN.test(title)) return true;

  return /\/(?:course|courses|program|programs|degree|degrees)\/[a-z0-9-]{3,}$/i.test(path) && title.length >= 4;
}
