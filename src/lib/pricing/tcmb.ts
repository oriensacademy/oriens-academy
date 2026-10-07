export const EUR_PRICE_RECOMMENDATION_TOLERANCE_PERCENT = 5;
export const TCMB_RATE_CACHE_MS = 45 * 60 * 1000;

export type EurRecommendationStatus = "suitable" | "review" | "missing" | "unavailable";

export interface TcmbEurRate {
  rate: number;
  rateType: "ForexSelling";
  sourceDate: string;
  fetchedAt: string;
  cached: boolean;
}

export function getTcmbEurRecommendation({
  tryAmount,
  manualEur,
  eurTryRate,
}: {
  tryAmount: number;
  manualEur: number | null;
  eurTryRate: number | null;
}) {
  if (!Number.isFinite(tryAmount) || tryAmount <= 0 || eurTryRate === null || !Number.isFinite(eurTryRate) || eurTryRate <= 0) {
    return { suggestedEur: null, differencePercent: null, status: "unavailable" as const };
  }

  const suggestedEur = tryAmount / eurTryRate;
  if (manualEur === null || !Number.isFinite(manualEur) || manualEur <= 0) {
    return { suggestedEur, differencePercent: null, status: "missing" as const };
  }

  const differencePercent = Math.abs(manualEur - suggestedEur) / suggestedEur * 100;
  return {
    suggestedEur,
    differencePercent,
    status: differencePercent <= EUR_PRICE_RECOMMENDATION_TOLERANCE_PERCENT ? "suitable" as const : "review" as const,
  };
}
