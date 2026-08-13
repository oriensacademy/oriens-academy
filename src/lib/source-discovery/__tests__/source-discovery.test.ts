/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { describe, it, expect } from "vitest";
import { isPrivateOrReservedIp } from "../ssrf-fetcher";
import { classifySourceUrl } from "../source-classifier";

describe("Source Discovery Unit Tests", () => {
  it("should enforce SSRF protection rules on IP addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.1.5")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("129.67.1.1")).toBe(false);
  });

  it("should classify source scope and authority", () => {
    const scope = classifySourceUrl("https://www.ox.ac.uk/admissions/undergraduate/courses/entry-requirements", "ox.ac.uk", { title: "Oxford Entry Requirements" });
    expect(scope.isOfficial).toBe(true);
    expect(scope.verificationStatus).toBe("VERIFIED");
  });
});
