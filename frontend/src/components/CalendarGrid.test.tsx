import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import type { Occurrence } from "../api";
import { CalendarGrid } from "./CalendarGrid";

function occurrence(overrides: Partial<Occurrence>): Occurrence {
  return {
    billId: 1,
    billName: "Netflix",
    amountMinor: 4300,
    dueDate: "2026-12-10",
    status: "pending",
    paidOn: null,
    amountPaidMinor: null,
    category: null,
    ...overrides,
  };
}

describe("CalendarGrid", () => {
  it("renders due tiles with status labels and calls the tile handler", () => {
    const onSelectOccurrence = vi.fn();
    const items = [
      occurrence({ billId: 1, billName: "Netflix", status: "pending" }),
      occurrence({
        billId: 2,
        billName: "Rent",
        status: "paid",
        paidOn: "2026-12-10",
        amountPaidMinor: 350_000,
        amountMinor: 350_000,
      }),
    ];

    render(() => (
      <CalendarGrid
        month={new Date(2026, 11, 1)}
        today="2026-12-19"
        occurrences={items}
        currency="PLN"
        onSelectOccurrence={onSelectOccurrence}
        onSelectDay={() => undefined}
        onAddForDay={() => undefined}
      />
    ));

    const overdue = screen.getByRole("button", { name: /Netflix, .*Overdue/ });
    const paid = screen.getByRole("button", { name: /Rent, .*Paid/ });

    expect(overdue.classList.contains("tile-overdue")).toBe(true);
    expect(paid.classList.contains("tile-paid")).toBe(true);

    fireEvent.click(overdue);
    expect(onSelectOccurrence).toHaveBeenCalledWith(items[0]);
  });

  it("shows a more link when a day has more than three bills", () => {
    const items = [
      occurrence({ billId: 1, billName: "One" }),
      occurrence({ billId: 2, billName: "Two" }),
      occurrence({ billId: 3, billName: "Three" }),
      occurrence({ billId: 4, billName: "Four" }),
    ];

    render(() => (
      <CalendarGrid
        month={new Date(2026, 11, 1)}
        today="2026-12-19"
        occurrences={items}
        currency="PLN"
        onSelectOccurrence={() => undefined}
        onSelectDay={() => undefined}
        onAddForDay={() => undefined}
      />
    ));

    expect(screen.getByRole("button", { name: "+1 more" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Four, .*Pending/ }),
    ).toBeNull();
  });
});
