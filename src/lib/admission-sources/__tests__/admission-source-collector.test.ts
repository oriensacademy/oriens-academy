/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { describe, it, expect } from "vitest";
import { cleanAdmissionHtml } from "../content-cleaner";
import { classifyAdmissionSource } from "../admission-source-classifier";

describe("Admission Source Collection Pipeline", () => {
  describe("Content Cleaner (content-cleaner.ts)", () => {
    it("should clean noise while preserving headings, lists, and tables", () => {
      const rawHtml = `
        <html>
          <head><title>Entry Requirements</title></head>
          <body>
            <nav><a href="/home">Home</a></nav>
            <script>console.log('noise');</script>
            <style>body { color: red; }</style>
            <h1>Undergraduate Entry Requirements</h1>
            <p>We require standard IB or A-Level qualifications.</p>
            <ul>
              <li>IB: 38 points overall</li>
              <li>A-Levels: A*AA</li>
            </ul>
            <table>
              <tr><th>Exam</th><th>Min Score</th></tr>
              <tr><td>IELTS</td><td>7.5</td></tr>
            </table>
            <footer><p>Copyright 2026</p></footer>
          </body>
        </html>
      `;

      const result = cleanAdmissionHtml(rawHtml, "https://www.ox.ac.uk/courses/cs");

      expect(result.sanitizedHtml).toContain("<h1>Undergraduate Entry Requirements</h1>");
      expect(result.sanitizedHtml).toContain("<li>IB: 38 points overall</li>");
      expect(result.sanitizedHtml).toContain("<table>");
      expect(result.sanitizedHtml).not.toContain("<script>");
      expect(result.sanitizedHtml).not.toContain("<nav>");
      expect(result.sanitizedHtml).not.toContain("<footer>");
      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBe(64); // SHA-256 length
    });

    it("should extract valid admission sub-links", () => {
      const html = `
        <div>
          <a href="/admissions/international">International Entry Requirements</a>
          <a href="/admissions/english-language">English Language Policy</a>
          <a href="#top">Back to top</a>
        </div>
      `;

      const result = cleanAdmissionHtml(html, "https://www.cam.ac.uk/courses/comp-sci");

      expect(result.extractedLinks).toHaveLength(2);
      expect(result.extractedLinks[0].url).toBe("https://www.cam.ac.uk/admissions/international");
      expect(result.extractedLinks[1].url).toBe("https://www.cam.ac.uk/admissions/english-language");
    });
  });

  describe("Admission Source Classifier (admission-source-classifier.ts)", () => {
    it("should classify program-level admission page", () => {
      const classified = classifyAdmissionSource(
        "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science",
        "Computer Science BA / MComp",
        "Standard entry requirements: A*AA at A-level with A* in Mathematics.",
        { isProgramPage: true }
      );

      expect(classified.scope).toBe("PROGRAM");
      expect(classified.authorityLevel).toBe("OFFICIAL_PROGRAM_PAGE");
      expect(classified.sourceType).toBe("PROGRAM_ENTRY_REQUIREMENTS");
    });

    it("should classify English Language requirement page", () => {
      const classified = classifyAdmissionSource(
        "https://www.imperial.ac.uk/study/ug/apply/english-language-requirements/",
        "English Language Requirements for Undergraduate Study",
        "IELTS Academic score of 7.0 overall with no element below 6.5 is required."
      );

      expect(classified.scope).toBe("LANGUAGE_REQUIREMENT");
      expect(classified.sourceType).toBe("ENGLISH_LANGUAGE_REQUIREMENTS");
      expect(classified.isEnglishRequirement).toBe(true);
    });

    it("should classify Country-Specific requirement page", () => {
      const classified = classifyAdmissionSource(
        "https://www.unibocconi.eu/wps/wcm/connect/bocconi/international/turkey-qualifications",
        "Admissions for Turkish High School Diploma Holders (Lise Diplomasi)",
        "Candidates from Turkey holding a Lise Diplomasi must have an average of 85%."
      );

      expect(classified.scope).toBe("COUNTRY");
      expect(classified.sourceType).toBe("COUNTRY_SPECIFIC_REQUIREMENTS");
      expect(classified.detectedCountry).toBe("Turkey");
    });

    it("should classify Admission Test page", () => {
      const classified = classifyAdmissionSource(
        "https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/tests/tmua",
        "TMUA Admissions Test Requirement",
        "Applicants for Computer Science must sit the TMUA test in October."
      );

      expect(classified.scope).toBe("QUALIFICATION");
      expect(classified.sourceType).toBe("ADMISSION_TEST_REQUIREMENTS");
      expect(classified.isTestRequirement).toBe(true);
    });
  });
});
