import { ProgramSourceAdapter, AdapterContext, DiscoveredProgramLink, ExtractedProgramRecord } from "./adapter-interface";
import { canonicalizeUrl, isWithinOfficialDomainBoundary } from "../source-discovery/domain-normalizer";
import { normalizeDegreeLevel, extractDegreeTitle, normalizeDuration, normalizeStudyMode } from "./degree-normalizer";
import { mapProgramToFieldOfStudy } from "./field-mapper";

export class GenericHtmlProgramAdapter implements ProgramSourceAdapter {
  name = "GenericHtmlProgramAdapter";

  canHandle(url: string, domain: string): boolean {
    return isWithinOfficialDomainBoundary(url, domain);
  }

  async discoverProgramLinks(html: string, baseUrl: string, ctx: AdapterContext): Promise<DiscoveredProgramLink[]> {
    const discovered: DiscoveredProgramLink[] = [];
    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    const programKeywords = [
      "/course/", "/courses/", "/program/", "/programs/", "/degree/", "/degrees/",
      "/undergraduate/courses/", "/graduate/courses/", "/study/courses/", "/corsi-di-studio/"
    ];

    let match: RegExpExecArray | null;
    const seenUrls = new Set<string>();

    while ((match = anchorRegex.exec(html)) !== null) {
      const hrefRaw = match[1].trim();
      const rawAnchor = match[2].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");

      if (!hrefRaw || hrefRaw.startsWith("#") || hrefRaw.startsWith("javascript:") || hrefRaw.startsWith("mailto:") || hrefRaw.startsWith("tel:")) {
        continue;
      }

      try {
        const resolved = new URL(hrefRaw, baseUrl).toString();
        const lowerUrl = resolved.toLowerCase();

        if (isWithinOfficialDomainBoundary(resolved, ctx.officialDomain)) {
          const isMatch = programKeywords.some((kw) => lowerUrl.includes(kw));

          if (isMatch) {
            const canUrl = canonicalizeUrl(resolved);
            if (!seenUrls.has(canUrl)) {
              seenUrls.add(canUrl);
              discovered.push({
                url: resolved,
                title: rawAnchor,
                anchorText: rawAnchor,
              });
            }
          }
        }
      } catch {
        // Skip malformed
      }
    }

    return discovered;
  }

  async extractProgram(html: string, pageUrl: string, ctx: AdapterContext): Promise<ExtractedProgramRecord | null> {
    // Extract Page Title or H1
    let title: string | null = null;
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      title = h1Match[1].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");
    } else {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");
        // Strip university name suffix if present
        title = title.split("|")[0].split("-")[0].trim();
      }
    }

    if (!title || title.length < 3 || title.toLowerCase().includes("page not found") || title.toLowerCase().includes("courses")) {
      return null;
    }

    const degreeTitle = extractDegreeTitle(title) || extractDegreeTitle(html);
    const degreeLevel = normalizeDegreeLevel(degreeTitle, title, html);

    const { value: durationValue, unit: durationUnit } = normalizeDuration(html);
    const studyMode = normalizeStudyMode(html);

    // Language extraction (check for Italian, German, French, default to English if university in US/UK)
    let language = "English";
    if (ctx.officialDomain.endsWith(".it")) language = "Italian";
    else if (ctx.officialDomain.endsWith(".ch") || ctx.officialDomain.endsWith(".de")) language = "German";

    const fieldRes = await mapProgramToFieldOfStudy(title);

    const normalizedName = title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
    const slug = normalizedName.replace(/\s+/g, "-");

    return {
      universityId: ctx.universityId,
      name: title,
      normalizedName,
      slug,
      degreeLevel,
      degreeTitle,
      fieldOfStudyId: fieldRes.fieldId,
      studyMode,
      language,
      durationValue,
      durationUnit,
      officialProgramUrl: canonicalizeUrl(pageUrl),
      externalId: canonicalizeUrl(pageUrl),
      rawEvidence: {
        title,
        degreeTitle,
        degreeLevel,
        fieldConfidence: fieldRes.confidence,
        pageUrl,
        extractedAt: new Date().toISOString(),
      },
    };
  }
}
