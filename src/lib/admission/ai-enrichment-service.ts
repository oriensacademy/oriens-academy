/**
 * Server-side admission evidence enrichment contract.
 *
 * AI is optional and may only classify or summarize official evidence supplied
 * by a controlled job. It never invents a requirement, URL, score, or programme
 * scope, and it is never called from search or map interactions.
 */

export type AdmissionRequirementStatus =
  | "required"
  | "accepted"
  | "recommended"
  | "alternative"
  | "not_required"
  | "unknown";

export interface OfficialAdmissionEvidence {
  universityName: string;
  examCode: string;
  officialSourceUrl: string;
  sourceTitle: string;
  sourceText: string;
  programmeName?: string;
  admissionsCycle?: string;
  retrievedAt: string;
}

export interface AdmissionEnrichmentCandidate {
  status: AdmissionRequirementStatus;
  scope: "university" | "faculty" | "programme";
  summaryTr: string;
  summaryEn: string;
  sourceExcerpt: string;
  confidence: "needs_review";
  officialSourceUrl: string;
  admissionsCycle?: string;
}

export type SupportedAiProvider = "OPENAI" | "ANTHROPIC" | "GEMINI";

export function detectConfiguredAiProvider(): SupportedAiProvider | null {
  if (process.env.OPENAI_API_KEY) return "OPENAI";
  if (process.env.ANTHROPIC_API_KEY) return "ANTHROPIC";
  if (process.env.GEMINI_API_KEY) return "GEMINI";
  return null;
}

export function isOfficialEvidence(evidence: OfficialAdmissionEvidence): boolean {
  try {
    const url = new URL(evidence.officialSourceUrl);
    return url.protocol === "https:" && Boolean(url.hostname) && evidence.sourceText.trim().length >= 40;
  } catch {
    return false;
  }
}

/**
 * Safe deterministic fallback used when no provider is configured. It records an
 * evidence candidate for human review without making a public factual claim.
 */
export function createNeedsReviewCandidate(
  evidence: OfficialAdmissionEvidence,
): AdmissionEnrichmentCandidate | null {
  if (!isOfficialEvidence(evidence)) return null;
  return {
    status: "unknown",
    scope: evidence.programmeName ? "programme" : "university",
    summaryTr: `${evidence.examCode} koşulu resmi kaynak üzerinden inceleniyor.`,
    summaryEn: `${evidence.examCode} evidence is pending review of the official source.`,
    sourceExcerpt: evidence.sourceText.trim().slice(0, 500),
    confidence: "needs_review",
    officialSourceUrl: evidence.officialSourceUrl,
    admissionsCycle: evidence.admissionsCycle,
  };
}
