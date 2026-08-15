import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface FieldMappingResult {
  fieldId: string | null;
  fieldName: string | null;
  confidence: "EXACT" | "ALIAS" | "RULE_BASED" | "NEEDS_REVIEW" | "UNMAPPED";
}

let cachedFields: Array<{ id: string; name: string; slug: string; aliases: string[] }> | null = null;

export async function mapProgramToFieldOfStudy(
  programName: string,
  supabaseClient?: SupabaseClient
): Promise<FieldMappingResult> {
  const normName = programName.toLowerCase().trim();

  // Load fields of study cache
  if (!cachedFields) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "";
    if (!supabaseKey) throw new Error("A Supabase key is required to map fields of study.");
    const client = supabaseClient || createClient(supabaseUrl, supabaseKey);

    const { data } = await client.from("fields_of_study").select("id, name, slug, aliases").eq("active", true);
    cachedFields = data || [];
  }

  // 1. Exact Name Match
  for (const field of cachedFields) {
    if (field.name.toLowerCase() === normName) {
      return { fieldId: field.id, fieldName: field.name, confidence: "EXACT" };
    }
  }

  // 2. Alias Match
  for (const field of cachedFields) {
    if (field.aliases && Array.isArray(field.aliases)) {
      for (const alias of field.aliases) {
        if (alias.toLowerCase() === normName) {
          return { fieldId: field.id, fieldName: field.name, confidence: "ALIAS" };
        }
      }
    }
  }

  // 3. Substring / Rule-Based Match
  const rules: Array<{ pattern: RegExp; slug: string }> = [
    { pattern: /\b(computer science|computing|software engineering|artificial intelligence|data science)\b/i, slug: "computer-science" },
    { pattern: /\b(medicine|medical science|clinical medicine|surgery|mbbs)\b/i, slug: "medicine" },
    { pattern: /\b(economics|econometrics|macroeconomics)\b/i, slug: "economics" },
    { pattern: /\b(electrical|electronic) engineering\b/i, slug: "electrical-engineering" },
    { pattern: /\b(mechanical) engineering\b/i, slug: "mechanical-engineering" },
    { pattern: /\b(civil|structural) engineering\b/i, slug: "civil-engineering" },
    { pattern: /\b(chemical|biochemical) engineering\b/i, slug: "chemical-engineering" },
    { pattern: /\b(law|llb|jurisprudence|legal studies)\b/i, slug: "law" },
    { pattern: /\b(business|management|business administration|mba)\b/i, slug: "business-administration" },
    { pattern: /\b(finance|financial economics|banking)\b/i, slug: "finance" },
    { pattern: /\b(psychology|psychological sciences)\b/i, slug: "psychology" },
    { pattern: /\b(physics|astrophysics|quantum)\b/i, slug: "physics" },
    { pattern: /\b(chemistry|chemical sciences)\b/i, slug: "chemistry" },
    { pattern: /\b(biological|biology|biochemistry|biomedical|biotechnology)\b/i, slug: "biology" },
    { pattern: /\b(mathematics|pure math|applied math|statistics)\b/i, slug: "mathematics" },
    { pattern: /\b(architecture|urban planning|architectural)\b/i, slug: "architecture" },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(normName)) {
      const match = cachedFields.find((f) => f.slug === rule.slug);
      if (match) {
        return { fieldId: match.id, fieldName: match.name, confidence: "RULE_BASED" };
      }
    }
  }

  return { fieldId: null, fieldName: null, confidence: "UNMAPPED" };
}
