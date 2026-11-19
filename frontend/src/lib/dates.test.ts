import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  calendarDays,
  isoDate,
  parseIsoDate,
  startOfCalendarGrid,
} from "./dates";

describe("dates", () => {
  it("round-trips ISO dates without UTC shifts", () => {
    const date = parseIsoDate("2026-11-18");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(18);
    expect(isoDate(date)).toBe("2026-11-18");
  });

  it("rejects impossible calendar dates instead of rolling them over", () => {
    expect(() => parseIsoDate("2026-02-30")).toThrow();
    expect(() => parseIsoDate("2026-13-01")).toThrow();
  });

  it("builds a Monday-first six-week grid", () => {
    const days = calendarDays(new Date(2026, 10, 1));
    const first = days[0];
    const last = days[41];

    expect(days).toHaveLength(42);
    expect(first).toBeDefined();
    expect(last).toBeDefined();

    if (!first || !last) {
      throw new Error("Expected a full calendar grid");
    }

    expect(isoDate(first)).toBe("2026-10-26");
    expect(isoDate(last)).toBe("2026-12-06");
  });

  it("starts on the month's own Monday when possible", () => {
    expect(isoDate(startOfCalendarGrid(new Date(2026, 5, 1)))).toBe(
      "2026-06-01",
    );
  });

  it("adds days and months across boundaries", () => {
    expect(isoDate(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
    expect(isoDate(addMonths(new Date(2026, 11, 15), 1))).toBe("2027-01-01");
    expect(isoDate(addMonths(new Date(2026, 0, 15), -1))).toBe("2025-12-01");
  });
});
