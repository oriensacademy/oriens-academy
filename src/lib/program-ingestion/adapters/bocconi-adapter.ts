import { ProgramSourceAdapter, AdapterContext, DiscoveredProgramLink, ExtractedProgramRecord } from "../adapter-interface";
import { canonicalizeUrl } from "../../source-discovery/domain-normalizer";
import { normalizeDuration, normalizeStudyMode } from "../degree-normalizer";
import { mapProgramToFieldOfStudy } from "../field-mapper";

export class BocconiProgramAdapter implements ProgramSourceAdapter {
  name = "BocconiProgramAdapter";

  canHandle(url: string, domain: string): boolean {
    return domain.includes("unibocconi.it") || domain.includes("unibocconi.eu");
  }

  async discoverProgramLinks(html: string, baseUrl: string, ctx: AdapterContext): Promise<DiscoveredProgramLink[]> {
    const discovered: DiscoveredProgramLink[] = [];
    const seen = new Set<string>();

    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = anchorRegex.exec(html)) !== null) {
      const href = match[1].trim();
      const text = match[2].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");

      if (href.includes("/corsi-di-studio/") || href.includes("/bachelor") || href.includes("/master") || href.includes("/phd")) {
        try {
          const resolved = new URL(href, baseUrl).toString();
          const can = canonicalizeUrl(resolved);
          if (!seen.has(can)) {
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

    const isMaster = pageUrl.includes("/master") || name.toLowerCase().includes("master");
    const isPhd = pageUrl.includes("/phd") || name.toLowerCase().includes("phd");
    const degreeTitle = isPhd ? "PhD" : isMaster ? "MSc" : "BSc";
    const degreeLevel = isPhd ? "PHD" : isMaster ? "POSTGRADUATE_TAUGHT" : "UNDERGRADUATE";

    const durationInfo = normalizeDuration(html);
    const studyMode = normalizeStudyMode(html);

    const fieldRes = await mapProgramToFieldOfStudy(name);

    const normalizedName = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
    const slug = normalizedName.replace(/\s+/g, "-");

    const language = name.toLowerCase().includes("italian") ? "Italian" : "English";

    return {
      universityId: ctx.universityId,
      name,
      normalizedName,
      slug,
      degreeLevel,
      degreeTitle,
      fieldOfStudyId: fieldRes.fieldId,
      studyMode,
      language,
      durationValue: durationInfo.value || (isMaster ? 2 : 3),
      durationUnit: durationInfo.unit || "YEARS",
      officialProgramUrl: canonicalizeUrl(pageUrl),
      externalId: canonicalizeUrl(pageUrl),
      rawEvidence: {
        university: "Bocconi University",
        name,
        degreeTitle,
        degreeLevel,
        pageUrl,
        extractedAt: new Date().toISOString(),
      },
    };
  }
}
