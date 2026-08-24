/**
 * Canonical verified official university website domains.
 * STRICT POLICY:
 * - Only verified official university root/admissions domains are allowed.
 * - No search engines, no Wikipedia, no third-party ranking/aggregator sites.
 * - If a university is not in this explicit verified registry, it must render as non-clickable text.
 */

export const VERIFIED_OFFICIAL_UNIVERSITY_URLS: Record<string, string> = {
  "Massachusetts Institute of Technology (MIT)": "https://www.mit.edu",
  "MIT": "https://www.mit.edu",
  "Harvard University": "https://www.harvard.edu",
  "Bocconi University": "https://www.unibocconi.it",
  "University of Oxford": "https://www.ox.ac.uk",
  "University of Cambridge": "https://www.cam.ac.uk",
  "ETH Zurich": "https://ethz.ch",
  "Delft University of Technology (TU Delft)": "https://www.tudelft.nl",
  "Imperial College London": "https://www.imperial.ac.uk",
  "University of Edinburgh": "https://www.ed.ac.uk",
  "University of Milan (UniMi)": "https://www.unimi.it",
  "Sapienza University of Rome": "https://www.uniroma1.it",
  "University of Amsterdam (UvA)": "https://www.uva.nl",
  "Erasmus University Rotterdam": "https://www.eur.nl",
  "INSEAD": "https://www.insead.edu",
  "London Business School (LBS)": "https://www.london.edu",
};

/**
 * Returns the verified official website URL for the university name,
 * or null if no verified official domain is registered.
 */
export function getVerifiedOfficialUniversityUrl(universityName?: string | null): string | null {
  if (!universityName) return null;
  const trimmed = universityName.trim();
  if (VERIFIED_OFFICIAL_UNIVERSITY_URLS[trimmed]) {
    return VERIFIED_OFFICIAL_UNIVERSITY_URLS[trimmed];
  }

  // Case-insensitive / normalized lookup
  const lower = trimmed.toLowerCase();
  for (const [name, url] of Object.entries(VERIFIED_OFFICIAL_UNIVERSITY_URLS)) {
    if (name.toLowerCase() === lower) {
      return url;
    }
  }

  return null;
}
