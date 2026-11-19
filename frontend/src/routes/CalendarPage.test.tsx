import { createMemoryHistory, MemoryRouter, Route } from "@solidjs/router";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Occurrence } from "../api";
import * as api from "../api";
import CalendarPage from "./CalendarPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    getConfig: vi.fn(),
    getOccurrences: vi.fn(),
    saveOccurrence: vi.fn(),
    resetOccurrence: vi.fn(),
  };
});

const baseOccurrence: Occurrence = {
  billId: 1,
  billName: "Rent",
  amountMinor: 350_000,
  dueDate: "2026-11-30",
  status: "pending",
  paidOn: null,
  amountPaidMinor: null,
  category: "Home",
};

let current: Occurrence;

function renderPage() {
  const history = createMemoryHistory();
  history.set({ value: "/calendar", scroll: false, replace: true });

  render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={CalendarPage} />
    </MemoryRouter>
  ));
}

describe("CalendarPage payment actions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 19, 12, 0, 0));
    vi.clearAllMocks();
    current = { ...baseOccurrence };

    vi.mocked(api.getConfig).mockResolvedValue({ currency: "PLN" });
    vi.mocked(api.getOccurrences).mockImplementation(async () => [current]);
    vi.mocked(api.resetOccurrence).mockImplementation(async () => {
      current = {
        ...current,
        status: "pending",
        paidOn: null,
        amountPaidMinor: null,
      };
    });
    vi.mocked(api.saveOccurrence).mockImplementation(
      async (_billId, _dueDate, input) => {
        current = {
          ...current,
          status: input.status,
          paidOn: input.paidOn ?? null,
          amountPaidMinor:
            input.status === "paid"
              ? (input.amountMinor ?? current.amountMinor)
              : null,
        };

        return current;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks a tile paid with today's date and the current bill amount", async () => {
    renderPage();

    const paidButton = await screen.findByRole("button", {
      name: /Mark Rent due .* as paid/,
    });
    paidButton.focus();
    fireEvent.click(paidButton);

    await waitFor(() => {
      expect(api.saveOccurrence).toHaveBeenCalledWith(1, "2026-11-30", {
        status: "paid",
        paidOn: "2026-11-19",
      });
    });
    expect(
      await screen.findByRole("group", { name: /Rent, .*Paid/ }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Rent due Nov 30, 2026 marked paid.",
    );
    expect(document.activeElement).toBe(paidButton);
  });

  it("resets a paid tile with the explicit Reset control", async () => {
    current = {
      ...baseOccurrence,
      status: "paid",
      paidOn: "2026-11-19",
      amountPaidMinor: 350_000,
    };

    renderPage();

    const resetButton = await screen.findByRole("button", {
      name: /Reset Rent due .* to pending/,
    });
    resetButton.focus();
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(api.resetOccurrence).toHaveBeenCalledWith(1, "2026-11-30");
    });
    expect(api.saveOccurrence).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("group", { name: /Rent, .*Pending/ }),
    ).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Open Nov 30, 2026/ }),
    );
  });

  it("does not overwrite a paid occurrence when Paid is clicked again", async () => {
    current = {
      ...baseOccurrence,
      status: "paid",
      paidOn: "2026-11-19",
      amountPaidMinor: 350_000,
    };

    renderPage();

    const paidButton = await screen.findByRole("button", {
      name: /Mark Rent due .* as paid/,
    });
    const skippedButton = screen.getByRole("button", {
      name: /Mark Rent due .* as skipped/,
    });
    expect(paidButton.getAttribute("aria-disabled")).toBe("true");
    expect(skippedButton.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(paidButton);
    fireEvent.click(skippedButton);

    expect(api.saveOccurrence).not.toHaveBeenCalled();
    expect(api.resetOccurrence).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /Rent, .*Paid/ })).toBeTruthy();
  });

  it("ignores a second action during the post-action lock", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Mark Rent due .* as paid/ }),
    );

    expect(
      await screen.findByRole("group", { name: /Rent, .*Paid/ }),
    ).toBeTruthy();

    const resetButton = screen.getByRole("button", {
      name: /Reset Rent due .* to pending/,
    });
    expect(resetButton.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(resetButton);

    expect(api.saveOccurrence).toHaveBeenCalledTimes(1);
    expect(api.resetOccurrence).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /Rent, .*Paid/ })).toBeTruthy();
  });

  it("keeps the old status and shows the API error when saving fails", async () => {
    vi.mocked(api.saveOccurrence).mockRejectedValue(
      new api.ApiError(400, "Invalid request", {
        dueDate: ["Due date does not match the bill schedule."],
      }),
    );

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Mark Rent due .* as paid/ }),
    );

    expect(
      await screen.findByText(
        "Rent due Nov 30, 2026: Due date does not match the bill schedule.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: /Rent, .*Pending/ })).toBeTruthy();
  });

  it("opens the custom payment dialog from the day list", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Open .* 1 bills/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Details for Rent due/ }),
    );

    expect(await screen.findByRole("heading", { name: "Rent" })).toBeTruthy();
  });
});
