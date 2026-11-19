import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import type { Occurrence } from "../api";
import { DayDialog } from "./DayDialog";

const occurrence: Occurrence = {
  billId: 7,
  billName: "Rent",
  amountMinor: 350_000,
  dueDate: "2026-12-01",
  status: "pending",
  paidOn: null,
  amountPaidMinor: null,
  category: "Home",
};

describe("DayDialog", () => {
  it("lists the day's bills and forwards actions", () => {
    const onSelectOccurrence = vi.fn();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(() => (
      <DayDialog
        date={new Date(2026, 11, 1)}
        today="2026-12-19"
        occurrences={[occurrence]}
        currency="PLN"
        onClose={onClose}
        onSelectOccurrence={onSelectOccurrence}
        onAdd={onAdd}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: /Rent/ }));
    expect(onSelectOccurrence).toHaveBeenCalledWith(occurrence);

    fireEvent.click(
      screen.getByRole("button", { name: "Add bill for this day" }),
    );
    expect(onAdd).toHaveBeenCalled();
  });
});
