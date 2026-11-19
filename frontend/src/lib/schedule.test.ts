import { describe, expect, it } from "vitest";
import { ordinal, scheduleSummary } from "./schedule";

describe("schedule summaries", () => {
  it("describes monthly schedules and month-end clamping", () => {
    expect(
      scheduleSummary({
        frequency: "monthly",
        interval: 1,
        startDate: "2026-12-01",
      }),
    ).toBe("Monthly on the 1st");
    expect(
      scheduleSummary({
        frequency: "monthly",
        interval: 1,
        startDate: "2026-01-31",
      }),
    ).toBe("Monthly on the 31st (or month end)");
    expect(
      scheduleSummary({
        frequency: "monthly",
        interval: 3,
        startDate: "2026-02-15",
      }),
    ).toBe("Quarterly on the 15th");
    expect(
      scheduleSummary({
        frequency: "monthly",
        interval: 6,
        startDate: "2026-02-15",
      }),
    ).toBe("Every 6 months on the 15th");
  });

  it("describes weekly, yearly and one-off schedules", () => {
    expect(
      scheduleSummary({
        frequency: "weekly",
        interval: 2,
        startDate: "2026-11-20",
      }),
    ).toBe("Every 2 weeks on Friday");
    expect(
      scheduleSummary({
        frequency: "yearly",
        interval: 1,
        startDate: "2026-04-12",
      }),
    ).toBe("Yearly on 12 April");
    expect(
      scheduleSummary({
        frequency: "once",
        interval: 1,
        startDate: "2026-12-15",
      }),
    ).toBe("One-off on 15 December 2026");
  });

  it("uses correct ordinal suffixes", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ]);
  });
});
