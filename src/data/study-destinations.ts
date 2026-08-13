import { examUniversityRelations } from "@/data/exam-university-map";
import type { ExamCode } from "@/content/exams";
import type { StudyCountry, StudyRegion, StudyUniversity } from "@/components/discovery/globe-types";

type RegionSeed = Omit<StudyRegion, "countries" | "examIds"> & { countryNames: string[] };

const regionSeeds: RegionSeed[] = [
  {
    id: "uk",
    labelTr: "Birleşik Krallık",
    labelEn: "United Kingdom",
    focus: { lat: 52.6, lng: -1.8, altitude: 1.25 },
    countryNames: ["United Kingdom"],
  },
  {
    id: "europe",
    labelTr: "Avrupa",
    labelEn: "Europe",
    focus: { lat: 47.5, lng: 8.5, altitude: 1.08 },
    countryNames: ["France", "Italy", "Netherlands", "Switzerland"],
  },
  {
    id: "us",
    labelTr: "Amerika Birleşik Devletleri",
    labelEn: "United States",
    focus: { lat: 40.2, lng: -82, altitude: 1.08 },
    countryNames: ["United States"],
  },
  {
    id: "canada",
    labelTr: "Kanada",
    labelEn: "Canada",
    focus: { lat: 56, lng: -106, altitude: 1.08 },
    countryNames: ["Canada"],
  },
  {
    id: "other",
    labelTr: "Diğer Destinasyonlar",
    labelEn: "Other Destinations",
    focus: { lat: 24, lng: 35, altitude: 0.98 },
    countryNames: [],
  },
];

const countryLabels: Record<string, { tr: string; en: string; id: string }> = {
  "United Kingdom": { tr: "Birleşik Krallık", en: "United Kingdom", id: "united-kingdom" },
  "United States": { tr: "Amerika Birleşik Devletleri", en: "United States", id: "united-states" },
  Canada: { tr: "Kanada", en: "Canada", id: "canada" },
  France: { tr: "Fransa", en: "France", id: "france" },
  Italy: { tr: "İtalya", en: "Italy", id: "italy" },
  Netherlands: { tr: "Hollanda", en: "Netherlands", id: "netherlands" },
  Switzerland: { tr: "İsviçre", en: "Switzerland", id: "switzerland" },
};

function createCountries(countryNames: string[]): StudyCountry[] {
  return countryNames.map((countryName) => {
    const relations = examUniversityRelations.filter((relation) => relation.university.country === countryName);
    const universityMap = new Map<string, StudyUniversity>();

    for (const relation of relations) {
      const key = relation.university.name;
      const existing = universityMap.get(key);
      const examRelation = {
        examId: relation.examCode as ExamCode,
        relationship: relation.relationship,
        programScope: relation.programScope,
        sourceUrl: relation.source.url,
      };
      if (existing) {
        existing.examRelations.push(examRelation);
      } else {
        universityMap.set(key, {
          id: `study-${relation.id}`,
          name: relation.university.name,
          city: relation.university.city,
          country: countryName,
          lat: relation.university.latitude,
          lng: relation.university.longitude,
          examRelations: [examRelation],
        });
      }
    }

    const universities = Array.from(universityMap.values());
    const average = universities.reduce(
      (result, university) => ({ lat: result.lat + university.lat, lng: result.lng + university.lng }),
      { lat: 0, lng: 0 }
    );
    const label = countryLabels[countryName] ?? { tr: countryName, en: countryName, id: countryName.toLowerCase().replaceAll(" ", "-") };

    return {
      id: label.id,
      nameTr: label.tr,
      nameEn: label.en,
      lat: universities.length ? average.lat / universities.length : 0,
      lng: universities.length ? average.lng / universities.length : 0,
      universities,
    };
  });
}

export const studyDestinations: StudyRegion[] = regionSeeds.map(({ countryNames, ...region }) => {
  const countries = createCountries(countryNames);
  const examIds = Array.from(
    new Set(countries.flatMap((country) => country.universities.flatMap((university) => university.examRelations.map((item) => item.examId))))
  );
  return { ...region, countries, examIds };
});

export const studyRouteOrigin = {
  label: "Istanbul",
  lat: 41.0082,
  lng: 28.9784,
};
