import { expect, test } from "@playwright/test";

const COLD_RUNS = 5;
const FCP_BUDGET_MS = 600;

test("HTML has a content-shaped first-paint shell before React executes", async ({ page }) => {
  await page.route(/\/assets\/.*\.js(?:\?.*)?$/, (route) => route.abort());
  await page.goto("/welcome", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".app-boot-brand")).toBeVisible();
  await expect(page.locator(".app-boot-card")).toHaveCount(2);
  expect(
    await page.locator("html").evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe("rgb(253, 252, 247)");
});

test("cold /welcome FCP p75 stays within the 0.6 s product budget", async ({
  browser,
  browserName,
}, testInfo) => {
  test.skip(browserName !== "chromium", "CDP cache disabling is Chromium-specific");
  const baseURL = String(testInfo.project.use.baseURL);
  const measurements: number[] = [];

  // Exclude one-time renderer-process startup from the app metric. No app URL
  // or asset is touched here; every measured navigation below remains a fresh,
  // cache-disabled context.
  const warmup = await browser.newPage();
  await warmup.goto("about:blank");
  await warmup.close();

  for (let run = 0; run < COLD_RUNS; run += 1) {
    const context = await browser.newContext({
      locale: "vi-VN",
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

    await page.goto(`${baseURL}/welcome`, { waitUntil: "load" });
    const fcp = await page.waitForFunction(() => {
      const entry = performance.getEntriesByName("first-contentful-paint")[0];
      return entry?.startTime;
    });
    const value = await fcp.jsonValue();
    if (typeof value !== "number") throw new Error("Chromium did not expose a numeric FCP");
    measurements.push(value);
    await context.close();
  }

  const sorted = measurements.toSorted((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
  const p75 = sorted[Math.floor((sorted.length - 1) * 0.75)] ?? Number.POSITIVE_INFINITY;
  const withinBudget = measurements.filter((value) => value <= FCP_BUDGET_MS).length;
  testInfo.annotations.push({
    type: "FCP",
    description: `${measurements.map((value) => value.toFixed(1)).join(", ")} ms; median ${median.toFixed(1)} ms; p75 ${p75.toFixed(1)} ms`,
  });
  expect(withinBudget, `cold FCP samples: ${measurements.join(", ")} ms`).toBeGreaterThanOrEqual(4);
  expect(p75, `cold FCP samples: ${measurements.join(", ")} ms`).toBeLessThanOrEqual(FCP_BUDGET_MS);
});
