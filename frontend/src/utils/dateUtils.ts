import { parse, format, isValid } from "date-fns";

/**
 * Attempt to parse a date string using multiple common formats.
 * Returns a Date object if any format matches, otherwise null.
 *
 * Includes validation:
 * - Year must be between 1900 and 2100
 * - Round-trip check: format(parsed, fmt) must match input to reject false positives
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
    "d-M-yyyy",
    "ddMMyyyy",
    "yyyyMMdd",
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(s, fmt, new Date());
      if (!isValid(parsed)) continue;

      // Year range validation
      const year = parsed.getFullYear();
      if (year < 1900 || year > 2100) continue;

      // Round-trip validation: re-format and compare to input
      const roundTrip = format(parsed, fmt);
      if (roundTrip !== s) continue;

      return parsed;
    } catch {
      // ignore and try next format
    }
  }

  return null;
}
