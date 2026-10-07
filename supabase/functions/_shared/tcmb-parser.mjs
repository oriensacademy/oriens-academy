// Official TCMB indicative daily exchange-rate feed documented at
// https://www.tcmb.gov.tr/kurlar/today.xml
export const TCMB_DAILY_RATES_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
export const TCMB_EUR_RATE_TYPE = "ForexSelling";

function readTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}

export function parseTcmbEurForexSelling(xml) {
  if (typeof xml !== "string" || xml.length < 100) throw new Error("TCMB_XML_MALFORMED");

  const dateMatch = xml.match(/<Tarih_Date\b[^>]*\bTarih="([^"]+)"/i);
  const eurMatch = xml.match(/<Currency\b[^>]*(?:CurrencyCode|Kod)="EUR"[^>]*>([\s\S]*?)<\/Currency>/i);
  if (!eurMatch) throw new Error("TCMB_EUR_MISSING");

  const unit = Number(readTag(eurMatch[1], "Unit").replace(",", "."));
  const rawRate = Number(readTag(eurMatch[1], TCMB_EUR_RATE_TYPE).replace(",", "."));
  const rate = rawRate / unit;
  if (!Number.isFinite(unit) || unit <= 0 || !Number.isFinite(rate) || rate < 1 || rate > 1000) {
    throw new Error("TCMB_EUR_RATE_INVALID");
  }

  const sourceDate = dateMatch?.[1]?.trim() || "";
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(sourceDate)) throw new Error("TCMB_DATE_INVALID");

  return { rate, rateType: TCMB_EUR_RATE_TYPE, sourceDate };
}
