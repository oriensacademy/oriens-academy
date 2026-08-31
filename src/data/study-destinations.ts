import { examRecords, type ExamCode } from "@/content/exams";
import type { StudyCountry, StudyRegion } from "@/components/discovery/globe-types";

export interface FeaturedCountrySeed {
  id: string;
  iso3: string;
  labelTr: string;
  labelEn: string;
  focus: { lat: number; lng: number; altitude?: number };
  examCodes: ExamCode[];
}

/** Country guidance only. University and requirement truth is runtime DB-only. */
export const FEATURED_COUNTRY_SEEDS: FeaturedCountrySeed[] = [
  { id: "uk", iso3: "GBR", labelTr: "Birleşik Krallık", labelEn: "United Kingdom", focus: { lat: 53.5, lng: -2, altitude: 1.25 }, examCodes: ["A-Level", "IB", "ESAT", "TMUA", "TARA", "UCAT", "IGCSE", "GRE", "GMAT"] },
  { id: "us", iso3: "USA", labelTr: "Amerika Birleşik Devletleri", labelEn: "United States", focus: { lat: 39, lng: -98, altitude: 1.15 }, examCodes: ["SAT", "ACT", "AP", "IB", "MCAT", "GRE", "GMAT"] },
  { id: "canada", iso3: "CAN", labelTr: "Kanada", labelEn: "Canada", focus: { lat: 56, lng: -106, altitude: 1.15 }, examCodes: ["IB", "AP", "SAT", "ACT", "MCAT", "GRE"] },
  { id: "italy", iso3: "ITA", labelTr: "İtalya", labelEn: "Italy", focus: { lat: 42.5, lng: 12.5, altitude: 1.25 }, examCodes: ["IMAT", "SAT", "IB", "ACT", "GMAT", "GRE"] },
  { id: "netherlands", iso3: "NLD", labelTr: "Hollanda", labelEn: "Netherlands", focus: { lat: 52.3, lng: 5.3, altitude: 1.25 }, examCodes: ["OMPT", "IB", "AP", "A-Level", "GMAT", "GRE"] },
  { id: "germany", iso3: "DEU", labelTr: "Almanya", labelEn: "Germany", focus: { lat: 51.1, lng: 10.4, altitude: 1.25 }, examCodes: ["IB", "A-Level", "AP", "GRE", "GMAT"] },
  { id: "switzerland", iso3: "CHE", labelTr: "İsviçre", labelEn: "Switzerland", focus: { lat: 46.8, lng: 8.2, altitude: 1.25 }, examCodes: ["IB", "AP", "A-Level", "GRE", "GMAT"] },
  { id: "france", iso3: "FRA", labelTr: "Fransa", labelEn: "France", focus: { lat: 46.5, lng: 2.5, altitude: 1.25 }, examCodes: ["GMAT", "GRE", "IB", "A-Level", "AP", "SAT"] },
];

const supportedExamCodes = new Set<ExamCode>(examRecords.map((exam) => exam.code));
const fallbackTr = "Bu destinasyon için Oriens’in desteklediği uluslararası sınavlar içinde doğrudan ülke-geneli bir eşleşme bulunamadı. Üniversite ve program koşulları kuruma ve başvuru dönemine göre değişebilir.";
const fallbackEn = "No direct country-wide match was found among the international exams currently supported by Oriens for this destination. University and programme requirements may vary by institution and admission cycle.";

function convertSeed(seed: FeaturedCountrySeed): StudyRegion {
  const country: StudyCountry = { id: seed.id, iso3: seed.iso3, nameTr: seed.labelTr, nameEn: seed.labelEn, lat: seed.focus.lat, lng: seed.focus.lng, universities: [] };
  const examIds = seed.examCodes.filter((code) => supportedExamCodes.has(code));
  return { id: seed.id, countryCode: seed.iso3, labelTr: seed.labelTr, labelEn: seed.labelEn, focus: seed.focus, countries: [country], examIds, hasDirectExams: examIds.length > 0, noMatchMessageTr: fallbackTr, noMatchMessageEn: fallbackEn };
}

export const studyDestinations: StudyRegion[] = FEATURED_COUNTRY_SEEDS.map(convertSeed);

export function resolveStudyDestination(
  iso3Code: string,
  countryNameTr?: string,
  countryNameEn?: string,
  focus?: { lat: number; lng: number },
): StudyRegion {
  const iso3 = iso3Code.toUpperCase().trim();
  const seed = FEATURED_COUNTRY_SEEDS.find((item) => item.iso3 === iso3);
  if (seed) return convertSeed(seed);
  const nameTr = countryNameTr || countryNameEn || iso3;
  const nameEn = countryNameEn || countryNameTr || iso3;
  const countryFocus = focus ?? { lat: 20, lng: 0 };
  return {
    id: iso3.toLowerCase(), countryCode: iso3, labelTr: nameTr, labelEn: nameEn,
    focus: { ...countryFocus, altitude: 1.2 },
    countries: [{ id: iso3.toLowerCase(), iso3, nameTr, nameEn, ...countryFocus, universities: [] }],
    examIds: [], hasDirectExams: false, noMatchMessageTr: fallbackTr, noMatchMessageEn: fallbackEn,
  };
}

export const studyRouteOrigin = { label: "Istanbul", lat: 41.0082, lng: 28.9784 };
