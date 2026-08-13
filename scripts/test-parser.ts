import { parseQuery } from "../src/lib/search/query-parser";

interface TestCase {
  query: string;
  expectedIntent?: string;
  expectedCountry?: string;
  expectedQualCode?: string;
  expectedScore?: number;
  expectedField?: string;
  expectedUniversity?: string;
}

const TEST_CASES: TestCase[] = [
  { query: "Cambridge", expectedIntent: "UNIVERSITY_SEARCH", expectedUniversity: "University of Cambridge" },
  { query: "UCL", expectedIntent: "UNIVERSITY_SEARCH", expectedUniversity: "University College London" },
  { query: "UK", expectedIntent: "COUNTRY_SEARCH", expectedCountry: "GB" },
  { query: "Italy", expectedIntent: "COUNTRY_SEARCH", expectedCountry: "IT" },
  { query: "SAT", expectedIntent: "QUALIFICATION_SEARCH", expectedQualCode: "SAT" },
  { query: "IB", expectedIntent: "QUALIFICATION_SEARCH", expectedQualCode: "IB" },
  { query: "TMUA", expectedIntent: "QUALIFICATION_SEARCH", expectedQualCode: "TMUA" },
  { query: "medicine", expectedIntent: "PROGRAM_SEARCH", expectedField: "Medicine" },
  { query: "computer science", expectedIntent: "PROGRAM_SEARCH", expectedField: "Computer Science" },
  { query: "Italy medicine", expectedIntent: "DISCOVERY_SEARCH", expectedCountry: "IT", expectedField: "Medicine" },
  { query: "UK engineering", expectedIntent: "DISCOVERY_SEARCH", expectedCountry: "GB", expectedField: "Engineering" },
  { query: "Cambridge computer science", expectedIntent: "DISCOVERY_SEARCH", expectedUniversity: "University of Cambridge", expectedField: "Computer Science" },
  { query: "IB 38", expectedIntent: "ELIGIBILITY_SEARCH", expectedQualCode: "IB", expectedScore: 38 },
  { query: "SAT 1450", expectedIntent: "ELIGIBILITY_SEARCH", expectedQualCode: "SAT", expectedScore: 1450 },
  { query: "IB 38 UK", expectedIntent: "ELIGIBILITY_SEARCH", expectedQualCode: "IB", expectedScore: 38, expectedCountry: "GB" },
  { query: "IB 38 computer science UK", expectedIntent: "ELIGIBILITY_SEARCH", expectedQualCode: "IB", expectedScore: 38, expectedCountry: "GB", expectedField: "Computer Science" },
  { query: "SAT 1450 USA computer science", expectedIntent: "ELIGIBILITY_SEARCH", expectedQualCode: "SAT", expectedScore: 1450, expectedCountry: "US", expectedField: "Computer Science" },
  { query: "medicine Italy IMAT", expectedIntent: "DISCOVERY_SEARCH", expectedCountry: "IT", expectedQualCode: "IMAT", expectedField: "Medicine" },
  { query: "MBA GMAT", expectedIntent: "QUALIFICATION_SEARCH", expectedQualCode: "GMAT", expectedField: "Business Administration" },
  { query: "universities accepting IB", expectedIntent: "QUALIFICATION_SEARCH", expectedQualCode: "IB" },
  { query: "UK universities accepting TMUA", expectedIntent: "QUALIFICATION_SEARCH", expectedQualCode: "TMUA", expectedCountry: "GB" },
  
  // Typo Tolerance Tests
  { query: "Cambrige", expectedIntent: "UNIVERSITY_SEARCH", expectedUniversity: "University of Cambridge" },
  { query: "Univeristy of Cambridge", expectedIntent: "UNIVERSITY_SEARCH", expectedUniversity: "University of Cambridge" },
  { query: "computre science", expectedIntent: "PROGRAM_SEARCH", expectedField: "Computer Science" },
  { query: "medcine", expectedIntent: "PROGRAM_SEARCH", expectedField: "Medicine" },
];

function runTests() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — ENGLISH QUERY PARSER TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const res = parseQuery(tc.query);
    const checks: string[] = [];
    let ok = true;

    if (tc.expectedIntent && res.intent !== tc.expectedIntent) {
      ok = false;
      checks.push(`Intent mismatch: expected ${tc.expectedIntent}, got ${res.intent}`);
    }

    if (tc.expectedCountry) {
      const match = res.countries.find((c) => c.iso2 === tc.expectedCountry);
      if (!match) {
        ok = false;
        checks.push(`Country mismatch: expected ${tc.expectedCountry}, got [${res.countries.map((c) => c.iso2).join(", ")}]`);
      }
    }

    if (tc.expectedUniversity) {
      const match = res.universities.find((u) => u.name === tc.expectedUniversity);
      if (!match) {
        ok = false;
        checks.push(`University mismatch: expected ${tc.expectedUniversity}, got [${res.universities.map((u) => u.name).join(", ")}]`);
      }
    }

    if (tc.expectedQualCode) {
      const match = res.qualifications.find((q) => q.code === tc.expectedQualCode);
      if (!match) {
        ok = false;
        checks.push(`Qualification mismatch: expected ${tc.expectedQualCode}, got [${res.qualifications.map((q) => q.code).join(", ")}]`);
      }
    }

    if (tc.expectedScore !== undefined) {
      const match = res.qualifications.find((q) => q.code === tc.expectedQualCode && q.score === tc.expectedScore);
      if (!match) {
        ok = false;
        checks.push(`Score mismatch: expected ${tc.expectedQualCode} ${tc.expectedScore}, got [${res.qualifications.map((q) => `${q.code}:${q.score}`).join(", ")}]`);
      }
    }

    if (tc.expectedField) {
      const match = res.fieldsOfStudy.find((f) => f.name === tc.expectedField);
      if (!match) {
        ok = false;
        checks.push(`Field mismatch: expected ${tc.expectedField}, got [${res.fieldsOfStudy.map((f) => f.name).join(", ")}]`);
      }
    }

    if (ok) {
      passed++;
      console.log(`✓ PASS: "${tc.query}" -> Intent: ${res.intent} (${Math.round(res.confidence * 100)}% conf)`);
    } else {
      failed++;
      console.error(`✗ FAIL: "${tc.query}"`);
      for (const err of checks) {
        console.error(`  - ${err}`);
      }
    }
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (${TEST_CASES.length} Total)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
