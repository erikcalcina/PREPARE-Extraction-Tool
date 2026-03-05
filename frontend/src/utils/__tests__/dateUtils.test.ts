import { describe, it, expect } from "vitest";
import { tryParseWithDateFns } from "../dateUtils";

describe("tryParseWithDateFns", () => {
  // Standard formats
  it("parses yyyy-MM-dd", () => {
    const result = tryParseWithDateFns("2024-03-15");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2); // 0-indexed
    expect(result!.getDate()).toBe(15);
  });

  it("parses yyyy/MM/dd", () => {
    const result = tryParseWithDateFns("2024/03/15");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
  });

  it("parses dd/MM/yyyy", () => {
    const result = tryParseWithDateFns("15/03/2024");
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(15);
    expect(result!.getMonth()).toBe(2);
  });

  it("parses d/M/yyyy (single digits)", () => {
    const result = tryParseWithDateFns("5/3/2024");
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(5);
    expect(result!.getMonth()).toBe(2);
  });

  it("parses dd-MM-yyyy", () => {
    const result = tryParseWithDateFns("15-03-2024");
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(15);
  });

  it("parses d-M-yyyy (single digits)", () => {
    const result = tryParseWithDateFns("5-3-2024");
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(5);
  });

  it("parses ddMMyyyy (no separator)", () => {
    const result = tryParseWithDateFns("15032024");
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(15);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getFullYear()).toBe(2024);
  });

  it("parses yyyyMMdd (no separator)", () => {
    const result = tryParseWithDateFns("20240315");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getDate()).toBe(15);
  });

  // Empty / whitespace / garbage
  it("returns null for empty string", () => {
    expect(tryParseWithDateFns("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(tryParseWithDateFns("   ")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(tryParseWithDateFns("not a date")).toBeNull();
    expect(tryParseWithDateFns("abc123")).toBeNull();
    expect(tryParseWithDateFns("hello world")).toBeNull();
  });

  // Ambiguous inputs
  it("rejects 2-digit year formats", () => {
    // These were removed to avoid ambiguity in medical data
    expect(tryParseWithDateFns("15/03/24")).toBeNull();
    expect(tryParseWithDateFns("150324")).toBeNull();
    expect(tryParseWithDateFns("15-3-24")).toBeNull();
  });

  // Year range validation
  it("rejects years before 1900", () => {
    expect(tryParseWithDateFns("1899-01-01")).toBeNull();
    expect(tryParseWithDateFns("01/01/1800")).toBeNull();
  });

  it("rejects years after 2100", () => {
    expect(tryParseWithDateFns("2101-01-01")).toBeNull();
    expect(tryParseWithDateFns("01/01/2200")).toBeNull();
  });

  it("accepts boundary years 1900 and 2100", () => {
    expect(tryParseWithDateFns("1900-01-01")).not.toBeNull();
    expect(tryParseWithDateFns("2100-12-31")).not.toBeNull();
  });

  // Round-trip validation (rejects false positives)
  it("rejects invalid day/month combinations", () => {
    // Feb 30 doesn't exist
    expect(tryParseWithDateFns("30/02/2024")).toBeNull();
    // Month 13 doesn't exist
    expect(tryParseWithDateFns("15/13/2024")).toBeNull();
  });

  // Whitespace trimming
  it("trims leading/trailing whitespace", () => {
    const result = tryParseWithDateFns("  2024-03-15  ");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
  });

  // Edge cases
  it("handles leap year date", () => {
    const result = tryParseWithDateFns("29/02/2024");
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(29);
    expect(result!.getMonth()).toBe(1);
  });

  it("rejects Feb 29 on non-leap year", () => {
    expect(tryParseWithDateFns("29/02/2023")).toBeNull();
  });

  it("rejects partial date strings", () => {
    expect(tryParseWithDateFns("2024-03")).toBeNull();
    expect(tryParseWithDateFns("03/2024")).toBeNull();
  });
});
