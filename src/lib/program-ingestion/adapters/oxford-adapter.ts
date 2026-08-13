import { ProgramSourceAdapter, AdapterContext, DiscoveredProgramLink, ExtractedProgramRecord } from "../adapter-interface";
import { canonicalizeUrl } from "../../source-discovery/domain-normalizer";
import { normalizeDegreeLevel, extractDegreeTitle, normalizeDuration, normalizeStudyMode } from "../degree-normalizer";
import { mapProgramToFieldOfStudy } from "../field-mapper";

export class OxfordProgramAdapter implements ProgramSourceAdapter {
  name = "OxfordProgramAdapter";

  canHandle(url: string, domain: string): boolean {
    return domain.includes("ox.ac.uk");
  }

  async discoverProgramLinks(sourceUrl: string, html: string, _ctx: AdapterContext): Promise<DiscoveredProgramLink[]> {
    const baseUrl = sourceUrl;
    const discovered: DiscoveredProgramLink[] = [];
    const seen = new Set<string>();

    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = anchorRegex.exec(html)) !== null) {
      const href = match[1].trim();
      const text = match[2].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");

      if (href.includes("/courses/") || href.includes("/course-listing/") || href.includes("/graduate/courses/")) {
        try {
          const resolved = new URL(href, baseUrl).toString();
          const can = canonicalizeUrl(resolved);
          if (!seen.has(can) && !resolved.endsWith("/courses") && !resolved.endsWith("/courses/")) {
            seen.add(can);
            discovered.push({
              url: resolved,
              title: text,
              anchorText: text,
            });
          }
        } catch {
          // ignore
        }
      }
    }

    return discovered;
  }

  async extractProgram(html: string, pageUrl: string, ctx: AdapterContext): Promise<ExtractedProgramRecord | null> {
    let name: string | null = null;
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      name = h1Match[1].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");
    }

    if (!name || name.length < 3) return null;

    // Clean Oxford title
    name = name.replace(/^Course:\s*/i, "").trim();

    const isGraduate = pageUrl.includes("/graduate/");
    const degreeTitle = extractDegreeTitle(name) || extractDegreeTitle(html) || (isGraduate ? "MSc" : "BA");
    const degreeLevel = isGraduate ? normalizeDegreeLevel(degreeTitle, name, "postgraduate graduate") : normalizeDegreeLevel(degreeTitle, name, "undergraduate");

    const durationInfo = normalizeDuration(html);
    const studyMode = normalizeStudyMode(html);

    const fieldRes = await mapProgramToFieldOfStudy(name);

    const normalizedName = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
    const slug = normalizedName.replace(/\s+/g, "-");

    return {
      universityId: ctx.universityId,
      name,
      normalizedName,
      slug,
      degreeLevel,
      degreeTitle,
      fieldOfStudyId: fieldRes.fieldId,
      studyMode,
      language: "English",
      durationValue: durationInfo.value || (isGraduate ? 1 : 3),
      durationUnit: durationInfo.unit || "YEARS",
      officialProgramUrl: canonicalizeUrl(pageUrl),
      externalId: canonicalizeUrl(pageUrl),
      rawEvidence: {
        university: "University of Oxford",
        name,
        degreeTitle,
        degreeLevel,
        pageUrl,
        extractedAt: new Date().toISOString(),
      },
    };
  }
}
