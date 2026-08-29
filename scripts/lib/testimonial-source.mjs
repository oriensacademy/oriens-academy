import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const MONTHS = {
  Ocak: "01",
  Şubat: "02",
  Mart: "03",
  Nisan: "04",
  Mayıs: "05",
  Haziran: "06",
  Temmuz: "07",
  Ağustos: "08",
  Eylül: "09",
  Ekim: "10",
  Kasım: "11",
  Aralık: "12",
};

function normalizeField(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""))
    .join("\n")
    .trim();
}

export function sourceHash(record) {
  const identity = [record.author, record.dateText, record.topic, record.body]
    .map(normalizeField)
    .join("\u001f");
  return createHash("sha256").update(identity, "utf8").digest("hex");
}

export function parseTurkishDate(dateText) {
  const match = normalizeField(dateText).match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/u);
  if (!match || !MONTHS[match[2]]) throw new Error(`Unsupported source date: ${dateText}`);
  return `${match[3]}-${MONTHS[match[2]]}-${match[1].padStart(2, "0")}`;
}

export function parseTestimonialSource(file) {
  const lines = readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  const starts = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index].trim().match(/^(.+),\s*(\d{1,2}\s+\S+\s+\d{4})$/u);
    if (header && lines[index + 1].trim().startsWith("Ders Konusu:")) {
      starts.push({ index, author: header[1].trim(), dateText: header[2].trim() });
    }
  }

  const records = starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    const topic = lines[start.index + 1].trim().replace(/^Ders Konusu:\s*/u, "");
    const body = normalizeField(lines.slice(start.index + 2, end).join("\n"));
    const record = {
      author: normalizeField(start.author),
      dateText: normalizeField(start.dateText),
      dateIso: parseTurkishDate(start.dateText),
      topic: normalizeField(topic),
      body,
    };
    return { ...record, sourceHash: sourceHash(record), rawBlockIndex: position + 1 };
  });

  const valid = records.filter((record) => record.author && record.topic && record.body);
  const uniqueByHash = new Map();
  for (const record of valid) if (!uniqueByHash.has(record.sourceHash)) uniqueByHash.set(record.sourceHash, record);
  return {
    lineCount: lines.length,
    rawBlocks: records,
    validRecords: valid,
    uniqueRecords: [...uniqueByHash.values()],
    duplicateBlocks: valid.length - uniqueByHash.size,
  };
}

export function detectExamCode(topic, body) {
  const combined = `${topic} ${body}`.toLowerCase();
  for (const [needle, code] of [
    ["international baccalaureate", "ib"], [" ib ", "ib"], ["advanced placement", "ap"],
    [" sat", "sat"], ["gre", "gre"], ["gmat", "gmat"], ["imat", "imat"],
    ["tmua", "tmua"], ["esat", "esat"], ["lnat", "lnat"], ["a-level", "a-level"],
    ["igcse", "igcse"], ["ompt", "ompt"],
  ]) if (combined.includes(needle)) return code;
  return null;
}

export function detectLocale(body) {
  return /\b(teacher|lesson|recommend|mathematics|physics|university)\b/i.test(body) ? "en" : "tr";
}

