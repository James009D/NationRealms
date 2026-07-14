import { expect, test } from "@playwright/test";

test("demo nation playable loop stays connected", async ({ page }, testInfo) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1, name: "National Command" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Aurelian Commonwealth profile/i })).toBeVisible();
  await page.getByRole("link", { name: "Events" }).click();
  await expect(page.getByRole("heading", { name: "National Agenda" })).toBeVisible();
  await expect(page.getByText("National Indicators")).toBeVisible();
  await expect(page.getByText("Nation Economy")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current Issues" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Advance Turn" }).click();
  await expect(page.getByRole("heading", { name: "National Turn Report" })).toBeVisible();
  await page.getByRole("link", { name: "News" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Aurelian Commonwealth/i })).toBeVisible();
  await page.getByRole("link", { name: "Feed", exact: true }).click();
  await expect(page).toHaveURL(/\/nation\/demo-nation\/feed/);
  await expect(page.getByRole("heading", { name: "World Dispatches" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create Nation", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "National Command" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  );
  await page.screenshot({ path: `test-results/news-${testInfo.project.name}.png`, fullPage: true });
});

test("event economy resources stay compact and explain themselves", async ({ page }, testInfo) => {
  await page.goto("/nation/demo-nation/events");
  await expect(page.getByText("Nation Economy")).toBeVisible();
  await expect(page.getByText("Tech Level")).toBeVisible();

  const resourceGrid = page.getByLabel("Resource balances");
  await expect(resourceGrid).toBeVisible();
  expect(
    await resourceGrid.evaluate(
      (element) => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight
    )
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  );

  const firstResource = resourceGrid.locator(".event-resource-tile").first();
  await firstResource.hover();
  await expect(firstResource.getByRole("tooltip")).toBeVisible();
  await page.screenshot({ path: `test-results/events-resources-${testInfo.project.name}.png`, fullPage: true });
});

test("strategic map supports drag, zoom, inspection, and legacy redirects", async ({ page }, testInfo) => {
  await page.goto("/nation/demo-nation/map");
  await expect(page).toHaveURL(/\/nation\/demo-nation\?focus=map/);
  const surface = page.getByRole("application", { name: "Interactive strategic world map" });
  await expect(surface).toBeVisible();
  const firstFriendlyTile = surface.locator(".strategic-tile.is-friendly").first();
  await expect(firstFriendlyTile).toBeVisible();

  await firstFriendlyTile.click();
  await expect(page.getByRole("complementary", { name: /Tile .* details/ })).toBeVisible();
  await expect(page.getByText(/^Fertility/)).toBeVisible();
  await page.getByRole("heading", { level: 1, name: "National Command" }).click();
  await expect(page.getByRole("complementary", { name: /Tile .* details/ })).toHaveCount(0);

  const cameraBefore = `${await surface.getAttribute("data-camera-x")},${await surface.getAttribute("data-camera-y")}`;
  const box = await surface.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
  }
  await expect
    .poll(async () => `${await surface.getAttribute("data-camera-x")},${await surface.getAttribute("data-camera-y")}`)
    .not.toBe(cameraBefore);

  await surface.hover();
  await page.mouse.wheel(0, -100);
  await page.screenshot({ path: `test-results/strategic-map-${testInfo.project.name}.png`, fullPage: true });
});

test("nation inbox sends and records a diplomatic offer", async ({ page, request }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Run the correspondence mutation once; responsive coverage is separate."
  );
  const suffix = Date.now().toString(36);
  const name = `E2E Republic ${suffix}`;
  const created = await request.post("/api/nations/create", {
    data: {
      name,
      motto: "Messages cross frontiers",
      capitalName: `Inbox ${suffix}`,
      cultureSummary: "A correspondence test nation.",
      description: "Created by the browser inbox journey.",
      governmentType: "DEMOCRATIC_REPUBLIC",
      economyType: "MIXED_MARKET",
      foundingOrigin: "REVOLUTIONARY_REPUBLIC",
      ideology: {
        authorityLiberty: 50,
        collectivismIndividualism: 50,
        militarismPacifism: 50,
        traditionProgress: 50,
        ecologyIndustry: 50
      },
      cultureTraitIds: [],
      flag: { primaryColor: "#315d68", secondaryColor: "#e0bd67", accentColor: "#ffffff", emblemSymbol: "Star" },
      startingPackageId: "balanced_republic"
    }
  });
  expect(created.ok()).toBe(true);
  const recipientId = (await created.json()).nation.id as string;

  await page.goto("/nation/demo-nation/feed?view=inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Recipient nation").selectOption({ label: name });
  await page.getByLabel("Channel").selectOption("DIPLOMATIC");
  await page.getByLabel("Subject").fill("A frontier understanding");
  await page.getByLabel("Message (Markdown)").fill("Please review this **official proposal**.");
  await page.getByLabel("Offer type").selectOption("NON_AGGRESSION_PROPOSAL");
  await page.getByLabel("Offer title").fill("Frontier Calm");
  await page.getByLabel("Terms (Markdown)").fill("A non-mechanical agreement for the record.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A frontier understanding" })).toBeVisible();

  await page.goto(`/nation/${recipientId}/feed?view=inbox`);
  await page.getByRole("button", { name: /Aurelian Commonwealth.*A frontier understanding/i }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Status: Accepted")).toBeVisible();
});

test("technology page presents the nation's current age", async ({ page }, testInfo) => {
  await page.goto("/nation/demo-nation/technology");
  await expect(page.getByText("Current Technology Age")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Age$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Technology Ages" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Technology Tree" })).toBeVisible();
  await expect(page.getByText("Research Points")).toBeVisible();
  await expect(page.locator(".technology-node")).toHaveCount(26);
  await expect(page.getByRole("progressbar")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  );
  await page.screenshot({ path: `test-results/technology-${testInfo.project.name}.png`, fullPage: true });
});

test("research points unlock a technology atomically", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Run the research mutation once; responsive coverage is separate.");
  await page.goto("/nation/demo-nation/technology");
  await expect(page.getByText("Technology level 55")).toBeVisible();
  const printingPress = page.locator(".technology-node").filter({ hasText: "Printing Press" });
  await expect(printingPress.getByText("Available")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await printingPress.getByRole("button", { name: "Research" }).click();
  await expect(printingPress.getByText("Researched")).toBeVisible();
  await expect(page.getByText("Technology level 59")).toBeVisible();
});

test("primary routes render at responsive sizes", async ({ page }, testInfo) => {
  for (const path of [
    "/",
    "/feed",
    "/create-nation",
    "/nation/demo-nation",
    "/nation/demo-nation/feed",
    "/nation/demo-nation/technology",
    "/nation/demo-nation/map",
    "/nation/demo-nation/development",
    "/nation/demo-nation/settlements",
    "/nation/demo-nation/expansion",
    "/nation/demo-nation/settlements/memory-settlement-demo-location-capital",
    "/login"
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.goto("/nation/demo-nation/development");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  );
  await page.screenshot({ path: `test-results/development-${testInfo.project.name}.png`, fullPage: true });

  await page.goto("/nation/demo-nation/settlements");
  await expect(page.getByRole("heading", { name: "Aurelian Commonwealth Settlements" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage" }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  );

  await page.goto("/register");
  await expect(page.getByText("Persistent account mode is not enabled on this server.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Demo Nation" })).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
});

test("a funded location project completes through turn advancement", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Run the mutation journey once; responsive coverage is separate.");
  await page.goto("/nation/demo-nation/development");
  await expect(page.getByRole("heading", { name: "Aurelian Commonwealth" })).toBeVisible();
  const farmRow = page.getByRole("row").filter({ hasText: "Sunfield Cooperative" });
  page.once("dialog", (dialog) => dialog.accept());
  await farmRow.getByRole("button", { name: "Fund Upgrade" }).click();
  await expect(farmRow.getByText(/Level 4 queued/)).toBeVisible();

  await page.getByRole("link", { name: "Events" }).click();
  for (let index = 0; index < 2; index += 1) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Advance Turn" }).click();
    await expect(page.getByRole("heading", { name: "National Turn Report" })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  }

  await page.getByRole("link", { name: "Development" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Sunfield Cooperative" })).toContainText("Level 4");
  await expect(page.getByText(/Completed \/ Level 3 to 4/i)).toBeVisible();
});
