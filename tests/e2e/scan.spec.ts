import { expect, test } from "@playwright/test";

test("starts scan and exposes whole-site exports", async ({ page }) => {
  await page.route("**/api/scans/active", async (route) => {
    await route.fulfill({ contentType: "application/json", body: "null" });
  });
  await page.route("**/api/scans", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ id: "scan-1", targetUrl: "https://example.com", status: "queued" }),
      });
    }
  });
  await page.route("**/api/scans/scan-1/pages", async (route) => {
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/scans/scan-1/cancel", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "scan-1", targetUrl: "https://example.com", status: "canceled" }),
    });
  });
  await page.route("**/api/scans/scan-1/events", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"scan_state","progress":{"scanId":"scan-1"}}\n\n',
    });
  });

  await page.goto("/");
  await page.getByLabel("Website URL").fill("https://example.com");
  await page.getByLabel("Sitemap URL (optional)").fill("https://example.com/sitemap.xml");
  await page.getByRole("button", { name: "Start scan" }).click();

  await expect(page.getByText("Scan queued")).toBeVisible();
  await expect(page.locator(".export-disabled").first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Partial results")).toBeVisible();
  await expect(page.getByRole("link", { name: "Whole-site JSON" })).toHaveAttribute(
    "href",
    "/api/scans/scan-1/export/json",
  );
  await expect(page.getByRole("link", { name: "Whole-site Markdown" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Whole-site CSV" })).toBeVisible();
});
