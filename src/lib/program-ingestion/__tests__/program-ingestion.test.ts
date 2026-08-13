/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { describe, it, expect } from "vitest";
import { normalizeDegreeLevel, normalizeDuration, normalizeStudyMode, extractDegreeTitle } from "../degree-normalizer";
import { AdapterRegistry } from "../adapter-registry";

describe("Program Ingestion Unit Tests", () => {
  it("should normalize degree levels correctly", () => {
    expect(normalizeDegreeLevel("BSc Computer Science")).toBe("UNDERGRADUATE");
    expect(normalizeDegreeLevel("MSc Data Science")).toBe("POSTGRADUATE_TAUGHT");
    expect(normalizeDegreeLevel("MBA")).toBe("MBA");
    expect(normalizeDegreeLevel("PhD")).toBe("PHD");
  });

  it("should extract degree titles and duration", () => {
    expect(extractDegreeTitle("BSc Computer Science")).toBe("BSC");
    const dur = normalizeDuration("3 years");
    expect(dur.value).toBe(3);
    expect(normalizeStudyMode("Full-Time")).toBe("FULL_TIME");
  });

  it("should resolve adapters for official university domains", () => {
    const registry = new AdapterRegistry();
    expect(registry.getAdapter("https://ox.ac.uk/courses", "ox.ac.uk")).toBeDefined();
    expect(registry.getAdapter("https://cam.ac.uk/courses", "cam.ac.uk")).toBeDefined();
    expect(registry.getAdapter("https://imperial.ac.uk/courses", "imperial.ac.uk")).toBeDefined();
  });
});
