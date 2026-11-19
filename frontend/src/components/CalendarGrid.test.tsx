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

function renderGrid(
  items: Occurrence[],
  options: {
    onSetStatus?: (
      occurrence: Occurrence,
      status: "paid" | "skipped" | "pending",
    ) => void;
    busyKey?: string | null;
    locked?: boolean;
  } = {},
) {
  return render(() => (
    <CalendarGrid
      month={new Date(2026, 11, 1)}
      today="2026-12-19"
      occurrences={items}
      currency="PLN"
      busyKey={options.busyKey ?? null}
      locked={options.locked ?? false}
      onSetStatus={options.onSetStatus ?? (() => undefined)}
      onSelectDay={() => undefined}
      onAddForDay={() => undefined}
    />
  ));
}

describe("CalendarGrid", () => {
  it("renders due tiles with status labels and quick actions", () => {
    const onSetStatus = vi.fn();
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

    renderGrid(items, { onSetStatus });

    const overdue = screen.getByRole("group", {
      name: /Netflix, .*Overdue/,
    });
    const paid = screen.getByRole("group", { name: /Rent, .*Paid/ });

    expect(overdue.classList.contains("tile-overdue")).toBe(true);
    expect(paid.classList.contains("tile-paid")).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: /Mark Netflix due .* as paid/ }),
    );
    expect(onSetStatus).toHaveBeenCalledWith(items[0], "paid");
    expect(screen.queryByRole("button", { name: /Reset Netflix/ })).toBeNull();
  });

  it("resets a handled occurrence with the explicit Reset control", () => {
    const onSetStatus = vi.fn();
    const item = occurrence({
      billName: "Rent",
      status: "paid",
      paidOn: "2026-12-10",
      amountPaidMinor: 350_000,
      amountMinor: 350_000,
    });

    renderGrid([item], { onSetStatus });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Reset Rent due .* to pending/,
      }),
    );

    expect(onSetStatus).toHaveBeenCalledWith(item, "pending");
  });

  it("marks the current status unavailable", () => {
    const onSetStatus = vi.fn();
    const item = occurrence({
      billName: "Rent",
      status: "paid",
      paidOn: "2026-12-10",
      amountPaidMinor: 350_000,
      amountMinor: 350_000,
    });

    renderGrid([item], { onSetStatus });

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

  it("shows a more link when a day has more than two bills", () => {
    const items = [
      occurrence({ billId: 1, billName: "One", dueDate: "2026-12-20" }),
      occurrence({ billId: 2, billName: "Two", dueDate: "2026-12-20" }),
      occurrence({ billId: 3, billName: "Three", dueDate: "2026-12-20" }),
      occurrence({ billId: 4, billName: "Four", dueDate: "2026-12-20" }),
    ];

    renderGrid(items);

    expect(screen.getByRole("button", { name: "+2 more" })).toBeTruthy();
    expect(screen.getByRole("group", { name: /Two, .*Pending/ })).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Four, .*Pending/ })).toBeNull();
  });

  it("marks quick actions unavailable while another action is saving", () => {
    const item = occurrence({ billName: "Rent" });

    renderGrid([item], {
      busyKey: "1:2026-12-10",
    });

    const paidButton = screen.getByRole("button", {
      name: /Mark Rent due .* as paid/,
    });

    expect(paidButton.getAttribute("aria-disabled")).toBe("true");
  });

  it("marks quick actions unavailable during the post-action lock", () => {
    const item = occurrence({ billName: "Rent" });

    renderGrid([item], { locked: true });

    const paidButton = screen.getByRole("button", {
      name: /Mark Rent due .* as paid/,
    });

    expect(paidButton.getAttribute("aria-disabled")).toBe("true");
  });
});
