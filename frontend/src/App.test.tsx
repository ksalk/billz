import { render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders navigation and the empty calendar", async () => {
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/config")) {
          return jsonResponse({ currency: "PLN" });
        }

        return jsonResponse([]);
      }),
    );

    render(() => <App />);

    expect(screen.getByRole("link", { name: "Billz calendar" })).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Calendar" })).toBeTruthy();
    expect(await screen.findByText(/Nothing is due/)).toBeTruthy();
  });
});
