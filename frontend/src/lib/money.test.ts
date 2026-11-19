import { describe, expect, it } from "vitest";
import { minorToInput, parseAmountToMinor } from "./money";

describe("money", () => {
  it("parses dot and comma decimals into minor units", () => {
    expect(parseAmountToMinor("12.34", "PLN")).toBe(1234);
    expect(parseAmountToMinor("12,34", "PLN")).toBe(1234);
    expect(parseAmountToMinor("12", "PLN")).toBe(1200);
    expect(parseAmountToMinor("0.5", "PLN")).toBe(50);
    expect(parseAmountToMinor(" 1 234,56 ", "PLN")).toBe(123456);
  });

  it("respects currencies without decimal subunits", () => {
    expect(parseAmountToMinor("1234", "JPY")).toBe(1234);
    expect(parseAmountToMinor("12.5", "JPY")).toBeNull();
    expect(minorToInput(1234, "JPY")).toBe("1234");
  });

  it("respects currencies with three decimal subunits", () => {
    expect(parseAmountToMinor("1.234", "KWD")).toBe(1234);
    expect(parseAmountToMinor("1.2345", "KWD")).toBeNull();
    expect(minorToInput(1234, "KWD")).toBe("1.234");
  });

  it("rejects malformed or out-of-range amounts", () => {
    expect(parseAmountToMinor("", "PLN")).toBeNull();
    expect(parseAmountToMinor("12.345", "PLN")).toBeNull();
    expect(parseAmountToMinor("1,234.56", "PLN")).toBeNull();
    expect(parseAmountToMinor("-1", "PLN")).toBeNull();
    expect(parseAmountToMinor("10 000 000 000", "PLN")).toBeNull();
  });

  it("formats minor units for editing", () => {
    expect(minorToInput(0, "PLN")).toBe("0.00");
    expect(minorToInput(350_000, "PLN")).toBe("3500.00");
    expect(minorToInput(1, "PLN")).toBe("0.01");
  });
});
