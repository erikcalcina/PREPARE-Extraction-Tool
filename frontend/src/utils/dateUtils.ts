import { parse, isValid } from "date-fns";

/**
 * Attempt to parse a date string using multiple common formats.
 * Returns a Date object if any format matches, otherwise null.
 */
export function tryParseWithDateFns(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;

  const formats = [
    "yyyy-MM-dd",
    "yyyy/MM/dd",
    "dd/MM/yyyy",
    "d/M/yyyy",
    "dd-MM-yyyy",
    "d-M-yy",
    "d-M-yyyy",
    "ddMMyyyy",
    "ddMMyy",
    "yyyyMMdd",
    "d/M/yy",
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(s, fmt, new Date());
      if (isValid(parsed)) return parsed;
    } catch {
      // ignore and try next format
    }
  }

  return null;
}
