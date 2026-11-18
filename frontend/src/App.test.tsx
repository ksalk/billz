import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the product name", () => {
    const { unmount } = render(() => <App />);

    expect(screen.getByRole("heading", { name: "Billz" })).toBeTruthy();

    unmount();
  });
});
