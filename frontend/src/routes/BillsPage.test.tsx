import { createMemoryHistory, MemoryRouter, Route } from "@solidjs/router";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bill } from "../api";
import * as api from "../api";
import { addDays, isoDate } from "../lib/dates";
import BillsPage from "./BillsPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    getConfig: vi.fn(),
    getBills: vi.fn(),
    createBill: vi.fn(),
    updateBill: vi.fn(),
    deleteBill: vi.fn(),
  };
});

const today = new Date();
const bills: Bill[] = [
  {
    id: 1,
    name: "Rent",
    amountMinor: 350_000,
    frequency: "monthly",
    interval: 1,
    startDate: "2026-12-01",
    endDate: null,
    category: "Home",
    notes: null,
    nextDue: isoDate(addDays(today, -10)),
    createdAt: "2026-11-01T00:00:00+00:00",
    updatedAt: "2026-11-01T00:00:00+00:00",
  },
  {
    id: 2,
    name: "Gym",
    amountMinor: 9900,
    frequency: "monthly",
    interval: 3,
    startDate: "2026-12-10",
    endDate: null,
    category: "Health",
    notes: null,
    nextDue: isoDate(addDays(today, 10)),
    createdAt: "2026-11-01T00:00:00+00:00",
    updatedAt: "2026-11-01T00:00:00+00:00",
  },
];

function renderPage(initialPath = "/bills") {
  const history = createMemoryHistory();
  history.set({ value: initialPath, scroll: false, replace: true });

  render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={BillsPage} />
    </MemoryRouter>
  ));
}

describe("BillsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getConfig).mockResolvedValue({ currency: "PLN" });
    vi.mocked(api.getBills).mockResolvedValue(bills);
    vi.mocked(api.deleteBill).mockResolvedValue();
  });

  it("renders the bill table with schedule, category and overdue state", async () => {
    renderPage();

    expect(await screen.findByText("Rent")).toBeTruthy();
    expect(screen.getByText("Gym")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Schedule" })).toBeTruthy();
    expect(screen.getByText("Monthly on the 1st")).toBeTruthy();
    expect(screen.getByText("Quarterly on the 10th")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getAllByText("Overdue")).toHaveLength(1);
  });

  it("opens the edit form from a row", async () => {
    renderPage();

    const edit = await screen.findByRole("button", { name: "Edit Rent" });
    fireEvent.click(edit);

    expect(await screen.findByText("Edit bill")).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Rent",
    );
  });

  it("confirms deletion before calling the API", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete Rent" }));
    expect(await screen.findByText("Delete Rent?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete bill" }));

    await waitFor(() => {
      expect(api.deleteBill).toHaveBeenCalledWith(1);
    });
  });

  it("shows the empty state", async () => {
    vi.mocked(api.getBills).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No bills yet")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add your first bill" }),
    ).toBeTruthy();
  });

  it("opens the add form with the date from the query string", async () => {
    vi.mocked(api.getBills).mockResolvedValue([]);
    renderPage("/bills?new=2026-12-01");

    expect(
      await screen.findByRole("heading", { name: "Add a bill" }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("First due date") as HTMLInputElement).value,
    ).toBe("2026-12-01");
  });

  it("ignores an invalid new-bill date", async () => {
    vi.mocked(api.getBills).mockResolvedValue([]);
    renderPage("/bills?new=not-a-date");

    expect(await screen.findByText("No bills yet")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Add a bill" })).toBeNull();
  });

  it("treats a delete race as success", async () => {
    vi.mocked(api.deleteBill).mockRejectedValue(
      new api.ApiError(404, "Bill not found"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete Rent" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete bill" }));

    await waitFor(() => {
      expect(screen.queryByText("Delete Rent?")).toBeNull();
    });
    expect(screen.queryByText("Bill not found")).toBeNull();
  });
});
