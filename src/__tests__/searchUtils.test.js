import { describe, it, expect } from "vitest";
import { normalizeText, matchesSearch } from "../lib/utils";

describe("Search and Normalization Utilities", () => {
  describe("normalizeText", () => {
    it("should convert text to lowercase and remove accents/diacritics", () => {
      expect(normalizeText("Jorge Niño")).toBe("jorge nino");
      expect(normalizeText("José María ÁÉÍÓÚ")).toBe("jose maria aeiou");
      expect(normalizeText("  Ángel   ")).toBe("  angel   ");
    });

    it("should handle falsy and non-string values safely", () => {
      expect(normalizeText("")).toBe("");
      expect(normalizeText(null)).toBe("");
      expect(normalizeText(undefined)).toBe("");
      expect(normalizeText(12345)).toBe("12345");
    });
  });

  describe("matchesSearch", () => {
    it("should return true when search query is empty or whitespace", () => {
      expect(matchesSearch("", "Jorge", "Niño")).toBe(true);
      expect(matchesSearch("   ", "Jorge", "Niño")).toBe(true);
      expect(matchesSearch(null, "Jorge", "Niño")).toBe(true);
    });

    it("should match single word searches", () => {
      expect(matchesSearch("jorge", "Jorge", "Niño", "12345678")).toBe(true);
      expect(matchesSearch("nino", "Jorge", "Niño", "12345678")).toBe(true);
      expect(matchesSearch("niño", "Jorge", "Niño", "12345678")).toBe(true);
      expect(matchesSearch("1234", "Jorge", "Niño", "12345678")).toBe(true);
    });

    it("should match multi-word queries across different fields (e.g. first_name + last_name)", () => {
      expect(matchesSearch("jorge niño", "Jorge", "Niño")).toBe(true);
      expect(matchesSearch("niño jorge", "Jorge", "Niño")).toBe(true);
      expect(matchesSearch("jorge nino", "Jorge", "Niño")).toBe(true);
      expect(matchesSearch("jorge 1234", "Jorge", "Niño", "12345678")).toBe(true);
    });

    it("should handle extra spaces in the search query gracefully", () => {
      expect(matchesSearch("  jorge    niño  ", "Jorge", "Niño")).toBe(true);
    });

    it("should return false if any of the search words are not found", () => {
      expect(matchesSearch("jorge perez", "Jorge", "Niño")).toBe(false);
      expect(matchesSearch("carlos niño", "Jorge", "Niño")).toBe(false);
    });

    it("should handle null or undefined fields safely", () => {
      expect(matchesSearch("jorge", null, undefined, "Jorge", false)).toBe(true);
      expect(matchesSearch("jorge", null, undefined)).toBe(false);
    });
  });
});
