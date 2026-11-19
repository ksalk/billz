import { expect, type Request, type Route, test } from "@playwright/test";

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
  const paidButton = page.getByRole("button", {
    name: "Mark Rent due Nov 19, 2026 as paid",
  });
  await expect(paidButton).toBeVisible();
  await paidButton.click();
  await expect(page.getByRole("group", { name: /Rent, .*Paid/ })).toBeVisible();

  await page.clock.fastForward(900);
  await page
    .getByRole("button", { name: "Reset Rent due Nov 19, 2026 to pending" })
    .click();
  await expect(
    page.getByRole("group", { name: /Rent, .*Pending/ }),
  ).toBeVisible();
  await page.clock.fastForward(900);
  await paidButton.click();
  await expect(page.getByRole("group", { name: /Rent, .*Paid/ })).toBeVisible();

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

  try {
    await page.goto("/bills");
    await expect(page.getByText("Overdue", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    const overdueTile = page.getByRole("group", {
      name: /Overdue bill, .*Overdue/,
    });
    const skipButton = overdueTile.getByRole("button", {
      name: /Mark Overdue bill due .* as skipped/,
    });
    await expect(skipButton).toBeVisible();
    await skipButton.click();
    await expect(
      page.getByRole("group", { name: /Overdue bill, .*Skipped/ }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Bills", exact: true }).click();
    await expect(page.getByText("Dec 5, 2026")).toBeVisible();
  } finally {
    await request.delete(`/api/bills/${bill.id}`);
  }
});

test("calendar remains usable at mobile width", async ({ page, request }) => {
  await page.clock.install({ time: new Date("2026-11-19T12:00:00") });
  const created = await request.post("/api/bills", {
    data: {
      name: "Mobile bill",
      amountMinor: 5000,
      frequency: "monthly",
      interval: 1,
      startDate: "2026-11-19",
      endDate: null,
      category: null,
      notes: null,
    },
  });
  expect(created.ok()).toBeTruthy();
  const bill = (await created.json()) as { id: number };

  try {
    await page.setViewportSize({ width: 980, height: 1000 });
    await page.goto("/calendar");

    const tabletSkip = page.getByRole("button", {
      name: /Mark Mobile bill due .* as skipped/,
    });
    await expect(tabletSkip).toBeVisible();
    expect(
      await tabletSkip.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);

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

    const mobilePaid = dayDialog.getByRole("button", {
      name: /Mark Mobile bill due .* as paid/,
    });
    await expect(mobilePaid).toBeVisible();
    await mobilePaid.click();
    await expect(mobilePaid).toHaveAttribute("aria-pressed", "true");

    await dayDialog
      .getByRole("button", { name: /Details for Mobile bill due/ })
      .click();

    const detailsDialog = page.getByRole("dialog", { name: "Mobile bill" });
    await expect(detailsDialog.getByLabel("Paid on")).toHaveValue("2026-11-19");
    await expect(detailsDialog.getByLabel("Amount paid")).toHaveValue("50.00");
    await detailsDialog.getByLabel("Paid on").fill("2026-11-18");
    await detailsDialog.getByLabel("Amount paid").fill("42.50");

    let releaseRefresh = () => undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let delayRefresh = true;
    const isOccurrenceList = (url: URL) => url.pathname === "/api/occurrences";
    const holdOccurrenceRefresh = async (route: Route) => {
      if (delayRefresh) {
        delayRefresh = false;
        await refreshGate;
      }
      await route.continue();
    };
    await page.route(isOccurrenceList, holdOccurrenceRefresh);

    await detailsDialog.getByRole("button", { name: "Save" }).click();
    await expect(
      detailsDialog.getByRole("button", { name: "Saving…" }),
    ).toBeVisible();
    releaseRefresh();
    await expect(detailsDialog).toBeHidden();
    await page.unroute(isOccurrenceList, holdOccurrenceRefresh);

    const occurrenceResponse = await request.get(
      "/api/occurrences?from=2026-11-19&to=2026-11-19",
    );
    expect(occurrenceResponse.ok()).toBeTruthy();
    const occurrences = (await occurrenceResponse.json()) as Array<{
      billId: number;
      paidOn: string | null;
      amountPaidMinor: number | null;
    }>;
    const saved = occurrences.find((item) => item.billId === bill.id);
    expect(saved?.paidOn).toBe("2026-11-18");
    expect(saved?.amountPaidMinor).toBe(4250);

    await page.getByRole("button", { name: /Open Nov 19, 2026/ }).click();
    const refreshedDay = page.getByRole("dialog");
    await refreshedDay
      .getByRole("button", { name: /Details for Mobile bill due/ })
      .click();

    const refreshedDetails = page.getByRole("dialog", { name: "Mobile bill" });
    await expect(refreshedDetails.getByLabel("Paid on")).toHaveValue(
      "2026-11-18",
    );
    await expect(refreshedDetails.getByLabel("Amount paid")).toHaveValue(
      "42.50",
    );
    await refreshedDetails
      .getByRole("button", { name: "Close payment dialog" })
      .click();

    const activePaid = refreshedDay.getByRole("button", {
      name: /Mark Mobile bill due .* as paid/,
    });
    const activeSkipped = refreshedDay.getByRole("button", {
      name: /Mark Mobile bill due .* as skipped/,
    });
    await expect(activePaid).toHaveAttribute("aria-disabled", "true");
    await expect(activeSkipped).toHaveAttribute("aria-disabled", "true");

    let occurrenceWrites = 0;
    const countOccurrenceWrites = (request: Request) => {
      if (
        request.method() === "PUT" &&
        request.url().includes("/occurrences/")
      ) {
        occurrenceWrites++;
      }
    };
    page.on("request", countOccurrenceWrites);
    await activePaid.dispatchEvent("click");
    await activeSkipped.dispatchEvent("click");
    await page.waitForTimeout(100);
    page.off("request", countOccurrenceWrites);
    expect(occurrenceWrites).toBe(0);

    const preservedResponse = await request.get(
      "/api/occurrences?from=2026-11-19&to=2026-11-19",
    );
    expect(preservedResponse.ok()).toBeTruthy();
    const preservedOccurrences = (await preservedResponse.json()) as Array<{
      billId: number;
      paidOn: string | null;
      amountPaidMinor: number | null;
    }>;
    const preserved = preservedOccurrences.find(
      (item) => item.billId === bill.id,
    );
    expect(preserved?.paidOn).toBe("2026-11-18");
    expect(preserved?.amountPaidMinor).toBe(4250);

    await refreshedDay
      .getByRole("button", { name: "Add bill for this day" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Add a bill" }),
    ).toBeVisible();
    await expect(page.getByLabel("First due date")).toHaveValue("2026-11-19");
  } finally {
    await request.delete(`/api/bills/${bill.id}`);
  }
});
