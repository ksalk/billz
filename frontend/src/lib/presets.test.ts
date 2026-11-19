import { describe, expect, it } from "vitest";
import { presetFor } from "./presets";

describe("frequency presets", () => {
  it("maps stored schedules to the closest preset", () => {
    expect(presetFor("monthly", 1)).toBe("monthly");
    expect(presetFor("weekly", 2)).toBe("biweekly");
    expect(presetFor("monthly", 3)).toBe("quarterly");
    expect(presetFor("monthly", 6)).toBe("semiannual");
    expect(presetFor("yearly", 1)).toBe("yearly");
  });

  it("falls back to custom for unusual intervals", () => {
    expect(presetFor("monthly", 2)).toBe("custom");
    expect(presetFor("weekly", 3)).toBe("custom");
    expect(presetFor("yearly", 2)).toBe("custom");
  });
});
