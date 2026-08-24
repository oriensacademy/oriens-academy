import { retrieveSearchResults } from 'file:///c:/Users/merto/Desktop/oriens-academy.com/src/lib/search/retrieval-engine.ts';

const queries = [
  'oxfor',
  'oxford',
  'cambridge',
  'harvard',
  'mit',
  'stanford',
  'ucl',
  'imperial',
  'toronto',
  'ubc',
  'eth',
  'epfl',
  'tu munich',
  'tum'
];

console.log("==================================================");
console.log("TESTING SEARCH RETRIEVAL ENGINE (FALLBACK / DATABASE COMPATIBLE)");
console.log("==================================================\n");

let allPassed = true;

for (const query of queries) {
  const result = retrieveSearchResults(query, 5);
  const unis = result.groups.universities;
  const topUni = unis[0];
  
  if (!topUni) {
    console.error(`[FAIL] Query '${query}' returned 0 universities!`);
    allPassed = false;
    continue;
  }
  
  console.log(`[PASS] '${query}' -> ${topUni.title} | officialUrl: ${topUni.officialUrl || 'MISSING'}`);
  
  if (!topUni.officialUrl || !topUni.officialUrl.startsWith('https://')) {
    console.error(`  --> ERROR: Missing or invalid officialUrl for '${topUni.title}'`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log("\nALL SEARCH TESTS PASSED SUCCESSFULLY!");
} else {
  console.error("\nSOME SEARCH TESTS FAILED!");
  process.exit(1);
}
