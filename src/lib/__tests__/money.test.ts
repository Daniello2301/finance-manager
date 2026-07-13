import { describe, expect, it } from "vitest";
import { formatMoney, fromMinorUnits, toMinorUnits } from "@/lib/money";

describe("money", () => {
  describe("toMinorUnits / fromMinorUnits (COP, 0-decimal)", () => {
    it("round-trips a whole COP amount unchanged", () => {
      const minor = toMinorUnits(500000, "COP");
      expect(minor).toBe(500000);
      expect(fromMinorUnits(minor, "COP")).toBe(500000);
    });

    it("rounds a fractional COP input to the nearest integer", () => {
      expect(toMinorUnits(500000.6, "COP")).toBe(500001);
    });

    it("is case-insensitive on the currency code", () => {
      expect(toMinorUnits(1000, "cop")).toBe(1000);
    });
  });

  describe("formatMoney", () => {
    it("formats a COP amount with the currency symbol", () => {
      const formatted = formatMoney(1300000, "COP");
      expect(formatted).toContain("1.300.000");
    });

    it("formats zero correctly", () => {
      expect(formatMoney(0, "COP")).toContain("0");
    });

    it("formats a negative amount (credit card debt)", () => {
      const formatted = formatMoney(-300000, "COP");
      expect(formatted).toContain("300.000");
      expect(formatted).toContain("-");
    });
  });

  describe("unsupported currency", () => {
    it("throws a clear error for a currency not in the exponent map", () => {
      expect(() => toMinorUnits(10, "USD")).toThrow(/moneda no soportada/i);
    });
  });
});
