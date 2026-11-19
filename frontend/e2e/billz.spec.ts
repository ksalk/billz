import { expect, test } from "@playwright/test";

test("adds, edits, pays and deletes a bill", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-19T12:00:00") });
  await page.goto("/calendar");

  await expect(
    page.getByRole("heading", { name: "November 2026" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Bills", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All bills" })).toBeVisible();

  await page.getByRole("button", { name: "Add bill" }).click();
  const addDialog = page.getByRole("dialog");
  await expect(
    addDialog.getByRole("heading", { name: "Add a bill" }),
  ).toBeVisible();
  await addDialog.getByLabel("Name").fill("Rent");
  await addDialog.getByLabel("Amount (PLN)").fill("3500,00");
  await addDialog.getByLabel("Category (optional)").fill("Home");
  await expect(addDialog.getByLabel("First due date")).toHaveValue(
    "2026-11-19",
  );
  await addDialog.getByRole("button", { name: "Add bill" }).click();
  await expect(addDialog).toBeHidden();

  await expect(
    page.getByRole("cell", { name: "Rent", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Monthly on the 19th")).toBeVisible();
  await expect(page.getByText("Home")).toBeVisible();

  await page.getByRole("button", { name: "Edit Rent" }).click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog.getByText("Edit bill")).toBeVisible();
  await expect(editDialog.getByRole("heading", { name: "Rent" })).toBeVisible();
  await editDialog.getByLabel("Amount (PLN)").fill("3600,00");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByText("PLN 3,600.00")).toBeVisible();

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  const pendingTile = page.getByRole("button", { name: /Rent, .*Pending/ });
  await expect(pendingTile).toBeVisible();
  await pendingTile.click();

  const paymentDialog = page.getByRole("dialog");
  await paymentDialog.getByRole("button", { name: "Paid" }).click();
  await expect(paymentDialog.getByLabel("Paid on")).toHaveValue("2026-11-19");
  await paymentDialog.getByRole("button", { name: "Save" }).click();
  await expect(paymentDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Rent, .*Paid/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Bills", exact: true }).click();
  await expect(page.getByText("Dec 19, 2026")).toBeVisible();

  await page.getByRole("button", { name: "Delete Rent" }).click();
  const confirmDialog = page.getByRole("dialog");
  await expect(confirmDialog.getByText("Delete Rent?")).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Delete bill" }).click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByText("No bills yet")).toBeVisible();
});

test("shows overdue bills and can skip them", async ({ page, request }) => {
  await page.clock.install({ time: new Date("2026-11-19T12:00:00") });
  const created = await request.post("/api/bills", {
    data: {
      name: "Overdue bill",
      amountMinor: 1200,
      frequency: "monthly",
      interval: 1,
      startDate: "2026-11-05",
      endDate: null,
      category: null,
      notes: null,
    },
  });
  expect(created.ok()).toBeTruthy();
  const bill = (await created.json()) as { id: number };

  await page.goto("/bills");
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  const overdueTile = page.getByRole("button", {
    name: /Overdue bill, .*Overdue/,
  });
  await expect(overdueTile).toBeVisible();
  await overdueTile.click();

  const paymentDialog = page.getByRole("dialog");
  await paymentDialog.getByRole("button", { name: "Skipped" }).click();
  await paymentDialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("button", { name: /Overdue bill, .*Skipped/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Bills", exact: true }).click();
  await expect(page.getByText("Dec 5, 2026")).toBeVisible();

  await request.delete(`/api/bills/${bill.id}`);
});

test("calendar remains usable at mobile width", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-19T12:00:00") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calendar");

  await expect(
    page.getByRole("heading", { name: "November 2026" }),
  ).toBeVisible();

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(noHorizontalOverflow).toBe(true);

  await page.getByRole("button", { name: "Next month" }).click();
  await expect(
    page.getByRole("heading", { name: "December 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(
    page.getByRole("heading", { name: "November 2026" }),
  ).toBeVisible();

  const dayButton = page.getByRole("button", { name: /Open Nov 19, 2026/ });
  const box = await dayButton.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

  await dayButton.click();
  const dayDialog = page.getByRole("dialog");
  await expect(
    dayDialog.getByRole("heading", { name: "Nov 19, 2026" }),
  ).toBeVisible();
  await dayDialog
    .getByRole("button", { name: "Add bill for this day" })
    .click();

  await expect(page.getByRole("heading", { name: "Add a bill" })).toBeVisible();
  await expect(page.getByLabel("First due date")).toHaveValue("2026-11-19");
});
