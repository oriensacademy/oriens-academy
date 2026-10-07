export const LESSON_TIMEZONES = [
  { label: "TR", display: "TR", timeZone: "Europe/Istanbul" },
  { label: "UK", display: "UK", timeZone: "Europe/London" },
  { label: "NL", display: "NL", timeZone: "Europe/Amsterdam" },
  { label: "DE", display: "DE", timeZone: "Europe/Berlin" },
  { label: "US-ET", display: "US — Eastern", timeZone: "America/New_York" },
  { label: "US-CT", display: "US — Central", timeZone: "America/Chicago" },
  { label: "US-MT", display: "US — Mountain", timeZone: "America/Denver" },
  { label: "US-PT", display: "US — Pacific", timeZone: "America/Los_Angeles" },
] as const;

export type LessonTimezoneLabel = (typeof LESSON_TIMEZONES)[number]["label"];

export const DEFAULT_LESSON_TIMEZONE_LABEL: LessonTimezoneLabel = "TR";

export function lessonTimezoneForLabel(label: string | null | undefined) {
  return LESSON_TIMEZONES.find((item) => item.label === label) ?? LESSON_TIMEZONES[0];
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

function parseLocalDateTime(value: string): LocalParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Geçerli bir ders tarihi ve saati seçin.");
  const [, year, month, day, hour, minute] = match.map(Number);
  return { year, month, day, hour, minute };
}

function partsAt(instantMs: number, timeZone: string): LocalParts {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(formatted.find((part) => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function partsAsUtc(parts: LocalParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

/** Converts a wall-clock datetime in an explicit IANA zone to a canonical UTC ISO instant. */
export function localLessonDateTimeToUtc(value: string, timeZone: string): string {
  const wanted = parseLocalDateTime(value);
  const wallClockMs = partsAsUtc(wanted);
  let instantMs = wallClockMs;

  // Resolve the zone offset at the selected instant. Repeating handles offset
  // changes around DST boundaries without consulting the browser's timezone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = partsAt(instantMs, timeZone);
    const correction = wallClockMs - partsAsUtc(observed);
    if (correction === 0) break;
    instantMs += correction;
  }

  const resolved = partsAt(instantMs, timeZone);
  if (Object.keys(wanted).some((key) => wanted[key as keyof LocalParts] !== resolved[key as keyof LocalParts])) {
    throw new Error("Seçilen saat, yaz/kış saati geçişi nedeniyle bu saat diliminde mevcut değil.");
  }
  return new Date(instantMs).toISOString();
}

export function lessonInstantToLocalInput(value: string | Date, timeZone: string): string {
  const parts = partsAt(new Date(value).getTime(), timeZone);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatLessonDateTime(
  value: string | Date,
  locale: "tr" | "en",
  timeZone: string,
  label: string,
) {
  const formatted = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return `${formatted} ${label}`;
}
