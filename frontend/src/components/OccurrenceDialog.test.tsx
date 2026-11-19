import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Occurrence } from "../api";
import * as api from "../api";
import { OccurrenceDialog } from "./OccurrenceDialog";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    saveOccurrence: vi.fn(),
    resetOccurrence: vi.fn(),
  };
});

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
  onClose = vi.fn(),
  onSaved = vi.fn(),
  onSaveFailed = vi.fn(),
) {
  render(() => (
    <OccurrenceDialog
      occurrence={item}
      currency="PLN"
      onClose={onClose}
      onSaved={onSaved}
      onSaveFailed={onSaveFailed}
    />
  ));

  return { onClose, onSaved, onSaveFailed };
}

describe("OccurrenceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.saveOccurrence).mockResolvedValue({
      ...occurrence,
      status: "paid",
    });
    vi.mocked(api.resetOccurrence).mockResolvedValue();
  });

  it("saves a paid occurrence with the entered date and amount", async () => {
    const { onSaved } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Paid" }));
    fireEvent.input(screen.getByLabelText("Paid on"), {
      target: { value: "2026-12-02" },
    });
    fireEvent.input(screen.getByLabelText("Amount paid"), {
      target: { value: "3400,50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.saveOccurrence).toHaveBeenCalledWith(7, "2026-12-01", {
        status: "paid",
        paidOn: "2026-12-02",
        amountMinor: 340_050,
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("resets a paid occurrence to pending", async () => {
    const { onSaved } = renderDialog({ ...occurrence, status: "paid" });

    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.resetOccurrence).toHaveBeenCalledWith(7, "2026-12-01");
    });
    expect(api.saveOccurrence).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("saves a skipped occurrence", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Skipped" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.saveOccurrence).toHaveBeenCalledWith(7, "2026-12-01", {
        status: "skipped",
      });
    });
  });

  it("rejects an invalid amount before calling the API", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Paid" }));
    fireEvent.input(screen.getByLabelText("Amount paid"), {
      target: { value: "not money" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Enter an amount with up to two decimals."),
    ).toBeTruthy();
    expect(api.saveOccurrence).not.toHaveBeenCalled();
  });

  it("shows server validation errors that are not tied to a visible field", async () => {
    vi.mocked(api.saveOccurrence).mockRejectedValue(
      new api.ApiError(400, "Validation failed", {
        status: ["Status must be paid or skipped."],
      }),
    );
    const { onSaveFailed } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Paid" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Status must be paid or skipped."),
    ).toBeTruthy();
    expect(onSaveFailed).not.toHaveBeenCalled();
  });

  it("requests reconciliation when a save may have committed", async () => {
    const onSaveFailed = vi.fn();
    vi.mocked(api.saveOccurrence).mockRejectedValue(
      new api.ApiError(500, "Server error"),
    );
    renderDialog(occurrence, vi.fn(), vi.fn(), onSaveFailed);

    fireEvent.click(screen.getByRole("button", { name: "Paid" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSaveFailed).toHaveBeenCalled();
    });
    expect(
      await screen.findByText(
        "Could not confirm this payment. Check the calendar before retrying.",
      ),
    ).toBeTruthy();
  });
});
