import fs from "node:fs";
import crypto from "node:crypto";

const content = fs.readFileSync("C:\\Users\\merto\\Desktop\\yorumlar.txt", "utf8");
const lines = content.split(/\r?\n/);
const reviews = [];
let current = null;

const trMonths = {
  "Ocak": "01", "Şubat": "02", "Mart": "03", "Nisan": "04",
  "Mayıs": "05", "Haziran": "06", "Temmuz": "07", "Ağustos": "08",
  "Eylül": "09", "Ekim": "10", "Kasım": "11", "Aralık": "12"
};

function parseDate(dateStr) {
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = trMonths[parts[1]] || "01";
    const year = parts[2];
    return `${year}-${month}-${day}T00:00:00Z`;
  }
  return "2025-01-01T00:00:00Z";
}

function detectExamCode(topic, quote) {
  const combined = `${topic} ${quote}`.toLowerCase();
  if (combined.includes("ib") || combined.includes("international baccalaureate")) return "ib";
  if (combined.includes("ap ") || combined.includes("advanced placement")) return "ap";
  if (combined.includes("sat")) return "sat";
  if (combined.includes("gre")) return "gre";
  if (combined.includes("gmat")) return "gmat";
  if (combined.includes("imat")) return "imat";
  if (combined.includes("tmua")) return "tmua";
  if (combined.includes("esat")) return "esat";
  if (combined.includes("lnat")) return "lnat";
  if (combined.includes("a-level") || combined.includes("a level")) return "a-level";
  if (combined.includes("igcse")) return "igcse";
  if (combined.includes("ompt")) return "ompt";
  return null;
}

function detectLocale(quote) {
  if (quote.includes("teacher") || quote.includes("lesson") || quote.includes("recommend") || quote.includes("mathematics")) {
    return "en";
  }
  return "tr";
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const headerMatch = line.match(/^([^,]+),\s*(\d{1,2}\s+[^\d\s]+\s+\d{4})$/);
  if (headerMatch) {
    if (current) reviews.push(current);
    current = {
      name: headerMatch[1].trim(),
      dateStr: headerMatch[2].trim(),
      topic: "",
      quote: ""
    };
  } else if (line.startsWith("Ders Konusu:")) {
    if (current) {
      current.topic = line.replace("Ders Konusu:", "").trim();
    }
  } else {
    if (current) {
      current.quote = current.quote ? `${current.quote}\n${line}` : line;
    }
  }
}
if (current) reviews.push(current);

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

let sql = `-- Migration: 20260830000002_import_all_testimonials.sql
-- Description: Import all 111 authentic student and parent reviews from yorumlar.txt verbatim without paraphrasing or modification

ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS source_topic TEXT;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

`;

// Top 6 reviews from initial seed to maintain continuity as featured
const topFeaturedNames = ["Ahu G.", "Yasemin T.", "Magomed E.", "Maya I.", "Huseyin M.", "Aslıhan K."];

reviews.forEach((r, idx) => {
  const dateIso = parseDate(r.dateStr);
  const examCode = detectExamCode(r.topic, r.quote);
  const locale = detectLocale(r.quote);
  const isFeatured = topFeaturedNames.includes(r.name) || idx < 6;
  const displayOrder = idx + 1;
  const examSql = examCode ? `'${examCode}'` : "NULL";
  const rawContext = r.topic || "Özel Ders";
  
  // Deterministic UUID for each imported review based on name + dateStr + quote substring
  const hash = crypto.createHash("md5").update(`${r.name}|${r.dateStr}|${r.quote}`).digest("hex");
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

  sql += `INSERT INTO public.testimonials (id, name, quote, context, source_topic, exam_code, locale, active, verified, featured, display_order, created_at)\n`;
  sql += `VALUES ('${uuid}', '${escapeSql(r.name)}', '${escapeSql(r.quote)}', '${escapeSql(rawContext)}', '${escapeSql(r.topic)}', ${examSql}, '${locale}', true, true, ${isFeatured}, ${displayOrder}, '${dateIso}')\n`;
  sql += `ON CONFLICT (id) DO UPDATE SET\n`;
  sql += `  name = EXCLUDED.name,\n`;
  sql += `  quote = EXCLUDED.quote,\n`;
  sql += `  context = EXCLUDED.context,\n`;
  sql += `  source_topic = EXCLUDED.source_topic,\n`;
  sql += `  exam_code = EXCLUDED.exam_code,\n`;
  sql += `  locale = EXCLUDED.locale,\n`;
  sql += `  active = EXCLUDED.active,\n`;
  sql += `  verified = EXCLUDED.verified,\n`;
  sql += `  display_order = EXCLUDED.display_order,\n`;
  sql += `  created_at = EXCLUDED.created_at;\n\n`;
});

fs.writeFileSync("supabase/migrations/20260830000002_import_all_testimonials.sql", sql, "utf8");

// Also export as a static JSON dataset for deterministic offline & SSG rendering
const jsonDataset = reviews.map((r, idx) => {
  const hash = crypto.createHash("md5").update(`${r.name}|${r.dateStr}|${r.quote}`).digest("hex");
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  return {
    id: uuid,
    name: r.name,
    quote: r.quote,
    context: r.topic || "Özel Ders",
    sourceTopic: r.topic,
    dateStr: r.dateStr,
    examCode: detectExamCode(r.topic, r.quote),
    locale: detectLocale(r.quote),
    active: true,
    verified: true,
    featured: topFeaturedNames.includes(r.name) || idx < 6,
    displayOrder: idx + 1,
    createdAt: parseDate(r.dateStr),
  };
});

fs.writeFileSync("src/data/imported-testimonials.json", JSON.stringify(jsonDataset, null, 2), "utf8");
console.log(`Generated migration and JSON dataset with ${reviews.length} authentic reviews.`);
