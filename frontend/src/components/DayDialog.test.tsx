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

function renderDialog(
  item: Occurrence = occurrence,
  options: {
    onSetStatus?: (
      occurrence: Occurrence,
      status: "paid" | "skipped" | "pending",
    ) => void;
    onShowDetails?: (occurrence: Occurrence) => void;
    actionError?: string | null;
    onDismissError?: () => void;
    locked?: boolean;
  } = {},
) {
  const onSetStatus = options.onSetStatus ?? vi.fn();
  const onShowDetails = options.onShowDetails ?? vi.fn();
  const onDismissError = options.onDismissError ?? vi.fn();

  render(() => (
    <DayDialog
      date={new Date(2026, 11, 1)}
      today="2026-12-19"
      occurrences={[item]}
      currency="PLN"
      busyKey={null}
      locked={options.locked ?? false}
      actionError={options.actionError ?? null}
      actionNotice=""
      onDismissError={onDismissError}
      onClose={() => undefined}
      onSetStatus={onSetStatus}
      onShowDetails={onShowDetails}
      onAdd={() => undefined}
    />
  ));

  return { onSetStatus, onShowDetails, onDismissError };
}

describe("DayDialog", () => {
  it("runs quick payment actions from the day list", () => {
    const { onSetStatus } = renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Mark Rent due .* as paid/ }),
    );
    expect(onSetStatus).toHaveBeenCalledWith(occurrence, "paid");

    fireEvent.click(
      screen.getByRole("button", { name: /Mark Rent due .* as skipped/ }),
    );
    expect(onSetStatus).toHaveBeenCalledWith(occurrence, "skipped");
  });

  it("resets a handled occurrence with the explicit Reset button", () => {
    const paid = { ...occurrence, status: "paid" as const };
    const { onSetStatus } = renderDialog(paid);

    fireEvent.click(
      screen.getByRole("button", { name: /Reset Rent due .* to pending/ }),
    );

    expect(onSetStatus).toHaveBeenCalledWith(paid, "pending");
  });

  it("marks the current status unavailable", () => {
    const paid = { ...occurrence, status: "paid" as const };
    const { onSetStatus } = renderDialog(paid);

    const paidButton = screen.getByRole("button", {
      name: /Mark Rent due .* as paid/,
    });
    const skippedButton = screen.getByRole("button", {
      name: /Mark Rent due .* as skipped/,
    });

    expect(paidButton.getAttribute("aria-disabled")).toBe("true");
    expect(skippedButton.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(paidButton);
    fireEvent.click(skippedButton);

    expect(onSetStatus).not.toHaveBeenCalled();
  });

  it("opens details for custom paid date and amount", () => {
    const { onShowDetails } = renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Details for Rent due/ }),
    );

    expect(onShowDetails).toHaveBeenCalledWith(occurrence);
  });

  it("shows and dismisses action errors", () => {
    const onDismissError = vi.fn();
    renderDialog(occurrence, {
      actionError: "Could not save this payment.",
      onDismissError,
    });

    expect(screen.getByText("Could not save this payment.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismissError).toHaveBeenCalled();
  });
});
