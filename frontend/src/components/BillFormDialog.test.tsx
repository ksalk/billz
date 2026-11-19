import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bill } from "../api";
import * as api from "../api";
import { BillFormDialog } from "./BillFormDialog";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    createBill: vi.fn(),
    updateBill: vi.fn(),
  };
});

const bill: Bill = {
  id: 3,
  name: "Rent",
  amountMinor: 350_000,
  frequency: "monthly",
  interval: 3,
  startDate: "2026-12-01",
  endDate: "2027-12-01",
  category: "Home",
  notes: "Transfer before noon",
  nextDue: "2026-12-01",
  createdAt: "2026-11-01T00:00:00+00:00",
  updatedAt: "2026-11-01T00:00:00+00:00",
};

describe("BillFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.createBill).mockResolvedValue(bill);
    vi.mocked(api.updateBill).mockResolvedValue(bill);
  });

  it("creates a bill from the default monthly form", async () => {
    const onSaved = vi.fn();

    render(() => (
      <BillFormDialog
        bill={null}
        initialDate="2026-12-10"
        currency="PLN"
        onClose={() => undefined}
        onSaved={onSaved}
      />
    ));

    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "  Netflix  " },
    });
    fireEvent.input(screen.getByLabelText("Amount (PLN)"), {
      target: { value: "43,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add bill" }));

    await waitFor(() => {
      expect(api.createBill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Netflix",
          amountMinor: 4300,
          frequency: "monthly",
          interval: 1,
          startDate: "2026-12-10",
          endDate: null,
          category: null,
          notes: null,
        }),
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("edits an existing bill", async () => {
    render(() => (
      <BillFormDialog
        bill={bill}
        currency="PLN"
        onClose={() => undefined}
        onSaved={() => undefined}
      />
    ));

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Rent",
    );
    expect((screen.getByLabelText("Repeats") as HTMLSelectElement).value).toBe(
      "quarterly",
    );

    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Rent updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateBill).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          name: "Rent updated",
          frequency: "monthly",
          interval: 3,
        }),
      );
    });
  });

  it("supports a custom frequency and interval", async () => {
    render(() => (
      <BillFormDialog
        bill={null}
        initialDate="2026-12-10"
        currency="PLN"
        onClose={() => undefined}
        onSaved={() => undefined}
      />
    ));

    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Gym" },
    });
    fireEvent.input(screen.getByLabelText("Amount (PLN)"), {
      target: { value: "99" },
    });
    fireEvent.change(screen.getByLabelText("Repeats"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByLabelText("Frequency"), {
      target: { value: "weekly" },
    });
    fireEvent.input(screen.getByLabelText("Every N periods"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add bill" }));

    await waitFor(() => {
      expect(api.createBill).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: "weekly",
          interval: 3,
        }),
      );
    });
  });

  it("blocks invalid amounts before calling the API", async () => {
    render(() => (
      <BillFormDialog
        bill={null}
        initialDate="2026-12-10"
        currency="PLN"
        onClose={() => undefined}
        onSaved={() => undefined}
      />
    ));

    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Broken" },
    });
    fireEvent.input(screen.getByLabelText("Amount (PLN)"), {
      target: { value: "42.999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add bill" }));

    expect(
      await screen.findByText(
        "Enter a valid amount within the supported range.",
      ),
    ).toBeTruthy();
    expect(api.createBill).not.toHaveBeenCalled();
  });

  it("shows server errors, stays open, and can retry", async () => {
    vi.mocked(api.createBill).mockRejectedValueOnce(
      new api.ApiError(400, "Validation failed", {
        amountMinor: ["Amount is outside the supported range."],
      }),
    );
    const onSaved = vi.fn();

    render(() => (
      <BillFormDialog
        bill={null}
        initialDate="2026-12-10"
        currency="PLN"
        onClose={() => undefined}
        onSaved={onSaved}
      />
    ));

    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "Too much" },
    });
    fireEvent.input(screen.getByLabelText("Amount (PLN)"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add bill" }));

    expect(
      await screen.findByText("Amount is outside the supported range."),
    ).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Add a bill" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add bill" }));

    await waitFor(() => {
      expect(api.createBill).toHaveBeenCalledTimes(2);
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
