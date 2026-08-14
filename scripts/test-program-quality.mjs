import assert from "node:assert/strict";
import {
  classifyProgramPage,
  isPotentialProgramDetailLink,
} from "../src/lib/program-ingestion/program-page-classifier.ts";
import { GenericHtmlProgramAdapter } from "../src/lib/program-ingestion/generic-adapter.ts";

const validFixtures = [
  {
    name: "BSc",
    url: "https://example.edu/courses/computer-science-bsc",
    html: "<h1>Computer Science BSc</h1><p>Course duration: 3 years</p><h2>Modules</h2><h2>Entry requirements</h2>",
  },
  {
    name: "MSc",
    url: "https://imperial.ac.uk/study/courses/postgraduate-taught/advanced-computing",
    html: "<h1>Advanced Computing</h1><script type='application/ld+json'>{\"@type\":\"Course\"}</script><p>1 year full-time MSc</p>",
  },
  {
    name: "MBA",
    url: "https://example.edu/programs/mba",
    html: "<h1>Master of Business Administration (MBA)</h1><p>Duration 2 years</p><h2>Curriculum</h2>",
  },
  {
    name: "PhD",
    url: "https://postgraduate.study.cam.ac.uk/courses/directory/abc123",
    html: "<h1>PhD in Engineering</h1><p>Programme duration 3 years</p><h2>Entry requirements</h2>",
  },
];

const invalidFixtures = [
  ["open days", "https://example.edu/courses/open-days", "<h1>Open days and events</h1><p>Book an event date</p>"],
  ["selection criteria", "https://example.edu/admissions/selection-criteria", "<h1>Selection criteria</h1><p>BA and MSc applicants can read our requirements.</p>"],
  ["how to apply", "https://example.edu/apply", "<h1>How to apply</h1><p>Application requirements for all degree programmes.</p>"],
  ["fees", "https://example.edu/fees-and-funding", "<h1>Fees and funding</h1><p>Tuition fees for BSc and MSc students.</p>"],
  ["news", "https://example.edu/news/new-course", "<h1>News</h1><p>A new PhD course was announced today.</p>"],
  ["general admissions", "https://example.edu/admissions", "<h1>Admissions</h1><p>Entry requirements for BA, MSc and PhD applicants.</p>"],
  ["course index", "https://example.edu/courses", "<h1>Course search</h1><a>Computer Science BSc</a><a>Physics MSc</a>"],
  ["faq", "https://example.edu/faq", "<h1>Frequently asked questions</h1><p>How long is an MBA?</p>"],
];

for (const fixture of validFixtures) {
  const result = classifyProgramPage(fixture);
  assert.ok(["VALID", "LIKELY_VALID"].includes(result.decision), `${fixture.name} should be accepted: ${JSON.stringify(result)}`);
}

for (const [name, url, html] of invalidFixtures) {
  const result = classifyProgramPage({ url, html });
  assert.equal(result.decision, "INVALID", `${name} must be rejected: ${JSON.stringify(result)}`);
}

assert.equal(isPotentialProgramDetailLink("https://ox.ac.uk/admissions/graduate/courses/open-days-and-events", "Open days and events"), false);
assert.equal(isPotentialProgramDetailLink("https://ox.ac.uk/admissions/graduate/courses/dphil-biochemistry", "DPhil in Biochemistry"), true);
assert.equal(isPotentialProgramDetailLink("https://imperial.ac.uk/study/courses/compare", "Which course is right for you?"), false);
assert.equal(isPotentialProgramDetailLink("https://imperial.ac.uk/study/courses/postgraduate-taught/advanced-computing", "Advanced Computing"), true);

const adapter = new GenericHtmlProgramAdapter();
const context = {
  universityId: "00000000-0000-0000-0000-000000000001",
  universityName: "Fixture University",
  officialDomain: "example.edu",
  sourceId: "00000000-0000-0000-0000-000000000002",
  sourceUrl: "https://example.edu/courses",
};
const catalog = `
  <a href="/courses/computer-science-bsc">Computer Science BSc</a>
  <a href="/courses/open-days">Open days and events</a>
  <a href="/admissions/how-to-apply">How to apply</a>
  <a href="/courses">Course search</a>
`;
const discovered = await adapter.discoverProgramLinks(catalog, context.sourceUrl, context);
assert.deepEqual(discovered.map((link) => link.url), ["https://example.edu/courses/computer-science-bsc"]);

const extractedValid = await adapter.extractProgram(validFixtures[0].html, validFixtures[0].url, context);
const extractedInvalid = await adapter.extractProgram(invalidFixtures[0][2], invalidFixtures[0][1], context);
assert.equal(extractedValid?.name, "Computer Science BSc");
assert.equal(extractedInvalid, null);

console.log(`PROGRAM CLASSIFIER FIXTURES: PASS (${validFixtures.length} valid, ${invalidFixtures.length} invalid)`);
console.log("PROGRAM ADAPTER PIPELINE FIXTURE: PASS");
