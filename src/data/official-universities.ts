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
  "Stanford University": "https://www.stanford.edu",
  "Princeton University": "https://www.princeton.edu",
  "Yale University": "https://www.yale.edu",
  "Columbia University": "https://www.columbia.edu",
  "University of California, Berkeley (UC Berkeley)": "https://www.berkeley.edu",
  "University of Oxford": "https://www.ox.ac.uk",
  "University of Cambridge": "https://www.cam.ac.uk",
  "Imperial College London": "https://www.imperial.ac.uk",
  "University College London (UCL)": "https://www.ucl.ac.uk",
  "London School of Economics (LSE)": "https://www.lse.ac.uk",
  "King's College London (KCL)": "https://www.kcl.ac.uk",
  "University of Edinburgh": "https://www.ed.ac.uk",
  "University of Warwick": "https://warwick.ac.uk",
  "Durham University": "https://www.durham.ac.uk",
  "University of Toronto": "https://www.utoronto.ca",
  "University of British Columbia (UBC)": "https://www.ubc.ca",
  "McGill University": "https://www.mcgill.ca",
  "Bocconi University": "https://www.unibocconi.it",
  "University of Milan (UniMi)": "https://www.unimi.it",
  "Sapienza University of Rome": "https://www.uniroma1.it",
  "Politecnico di Milano": "https://www.polimi.it",
  "Politecnico di Torino": "https://www.polito.it",
  "University of Bologna": "https://www.unibo.it",
  "University of Pavia": "https://www.unipv.it",
  "University of Padua": "https://www.unipd.it",
  "Delft University of Technology (TU Delft)": "https://www.tudelft.nl",
  "University of Amsterdam (UvA)": "https://www.uva.nl",
  "Erasmus University Rotterdam": "https://www.eur.nl",
  "Technical University of Munich (TUM)": "https://www.tum.de",
  "LMU Munich": "https://www.lmu.de",
  "Heidelberg University": "https://www.uni-heidelberg.de",
  "ETH Zurich": "https://ethz.ch",
  "EPFL": "https://www.epfl.ch",
  "University of Zurich": "https://www.uzh.ch",
  "INSEAD": "https://www.insead.edu",
  "Sorbonne University": "https://www.sorbonne-universite.fr",
  "École Polytechnique": "https://www.polytechnique.edu",
  "London Business School (LBS)": "https://www.london.edu",
  "The American University in Cairo (AUC)": "https://www.aucegypt.edu",
  "AUC": "https://www.aucegypt.edu",
  "Cairo University": "https://cu.edu.eg",
  "Ain Shams University": "https://www.asu.edu.eg",
  "University of Melbourne": "https://www.unimelb.edu.au",
  "University of Sydney": "https://www.sydney.edu.au",
  "Australian National University (ANU)": "https://www.anu.edu.au",
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
