import assert from "node:assert/strict";

const baseUrl = (process.env.SEARCH_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

async function search(query) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/search/autocomplete/?q=${encodeURIComponent(query)}`);
  const body = await response.json();
  return { response, body, durationMs: Math.round(performance.now() - startedAt) };
}

function findResult(body, type, title) {
  const groupName = {
    UNIVERSITY: "universities",
    PROGRAM: "programs",
    COUNTRY: "countries",
    QUALIFICATION: "qualifications",
  }[type];
  return body.groups[groupName].find((item) => item.title === title);
}

const exactCases = [
  ["Oxford", "UNIVERSITY", "University of Oxford"],
  ["Cambridge", "UNIVERSITY", "University of Cambridge"],
  ["UCL", "UNIVERSITY", "University College London"],
  ["MIT", "UNIVERSITY", "Massachusetts Institute of Technology"],
  ["Harvard", "UNIVERSITY", "Harvard University"],
  ["Stanford", "UNIVERSITY", "Stanford University"],
  ["SAT", "QUALIFICATION", "SAT Reasoning Test (SAT)"],
  ["IB", "QUALIFICATION", "International Baccalaureate Diploma (IB)"],
  ["TMUA", "QUALIFICATION", "Test of Mathematics for University Admission (TMUA)"],
  ["IMAT", "QUALIFICATION", "International Medical Admissions Test (IMAT)"],
];

const typoCases = [
  ["oxfor", "University of Oxford", 3],
  ["oxfrod", "University of Oxford", 4],
  ["cambrige", "University of Cambridge", 4],
  ["cambrdge", "University of Cambridge", 4],
];

const naturalCases = [
  ["Italy", 1, 0, "Italy"],
  ["UK", 1, 0, "United Kingdom"],
  ["Italy medicine", 1, 0, "Italy"],
  ["UK computer science", 1, 0, "United Kingdom"],
  ["IB 38 computer science UK", 1, 1, "International Baccalaureate Diploma (IB)"],
  ["SAT 1450 USA computer science", 1, 1, "SAT Reasoning Test (SAT)"],
  ["medicine in Italy with IMAT", 1, 1, "International Medical Admissions Test (IMAT)"],
  ["MBA GMAT", 0, 1, "Graduate Management Admission Test (GMAT)"],
  ["universities accepting IB", 0, 1, "International Baccalaureate Diploma (IB)"],
  ["UK universities accepting TMUA", 1, 1, "Test of Mathematics for University Admission (TMUA)"],
];

const report = { exact: [], typos: [], natural: [], performance: [] };

for (const [query, type, title] of exactCases) {
  const { response, body, durationMs } = await search(query);
  assert.equal(response.status, 200, `${query}: HTTP status`);
  assert.equal(body.query, query, `${query}: query must be echoed exactly`);
  assert.ok(body.totalCount > 0, `${query}: must not be empty`);
  const result = findResult(body, type, title);
  assert.ok(result, `${query}: missing ${title}`);
  assert.match(result.id, /^[0-9a-f-]{36}$/i, `${query}: must expose a real database UUID`);
  report.exact.push({ query, id: result.id, title, layer: result.matchLayer });
  report.performance.push({ query, durationMs });
}

for (const [query, title, layer] of typoCases) {
  const { response, body } = await search(query);
  assert.equal(response.status, 200);
  assert.equal(body.query, query);
  const result = findResult(body, "UNIVERSITY", title);
  assert.ok(result, `${query}: missing ${title}`);
  assert.equal(result.matchLayer, layer, `${query}: wrong retrieval layer`);
  report.typos.push({ query, id: result.id, title, layer: result.matchLayer });
}

for (const [query, countryCount, qualificationCount, expectedTitle] of naturalCases) {
  const { response, body } = await search(query);
  assert.equal(response.status, 200);
  assert.equal(body.query, query);
  assert.ok(body.parsedQuery.countriesCount >= countryCount, `${query}: country was not parsed`);
  assert.ok(body.parsedQuery.qualificationsCount >= qualificationCount, `${query}: qualification was not parsed`);
  const entityTitles = [
    ...body.groups.countries,
    ...body.groups.qualifications,
  ].map((item) => item.title);
  assert.ok(entityTitles.includes(expectedTitle), `${query}: missing recognized database entity ${expectedTitle}`);
  assert.equal(body.groups.programs.length, 0, `${query}: must not fabricate program/admission results`);
  report.natural.push({
    query,
    intent: body.intent,
    parsedQuery: body.parsedQuery,
    status: "QUERY_PARSED_SUCCESSFULLY_DATA_NOT_AVAILABLE",
  });
}

const [oxford, sat] = await Promise.all([search("oxford"), search("SAT")]);
assert.equal(oxford.body.query, "oxford", "force-static regression: Oxford query lost");
assert.equal(sat.body.query, "SAT", "force-static regression: SAT query lost");
assert.notDeepEqual(oxford.body.groups, sat.body.groups, "force-static regression: responses must differ");

const empty = await search("");
assert.equal(empty.response.status, 200);
assert.equal(empty.body.query, "");
assert.equal(empty.body.totalCount, 0);

const noMatch = await search("zzzz-no-real-entity-98371");
assert.equal(noMatch.response.status, 200);
assert.equal(noMatch.body.query, "zzzz-no-real-entity-98371");
assert.equal(noMatch.body.totalCount, 0, "non-empty zero-result query must remain a genuine zero result");

const tooLong = await search("x".repeat(121));
assert.equal(tooLong.response.status, 400);
assert.equal(tooLong.body.error, "INVALID_SEARCH_QUERY");

assert.ok(report.performance.every(({ durationMs }) => durationMs < 3000), "search response exceeded 3 seconds");
console.log(JSON.stringify(report, null, 2));
console.log("SEARCH API REGRESSION: PASS");
