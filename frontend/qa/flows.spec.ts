/**
 * End-to-end demo flow (mutates data — run `npm run seed` afterwards for a fresh demo).
 * analysis (SSE) → reasons in review card → four-eyes STR approval → command palette.
 */
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("full demo flow works with zero console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message}`));

  // 1. Live analysis over SSE
  await page.goto("/app/analysis");
  await page.getByRole("button", { name: /Analyse all transactions/ }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("main a[href^='/app/review?open=']").first()).toBeVisible();
  await page.screenshot({ path: "qa/screenshots/flow-1-analysis.png" });

  // 2. Four-eyes STR approval: Asha holds to approve, then Ravi completes it
  await page.goto("/app/review");
  const label = await page.locator("[data-selected]").filter({ hasText: "R-STRUCT" }).first().getAttribute("aria-label");
  const decisionNo = label!.match(/Decision (\d+)/)![1];
  const strCard = page.locator(`[aria-label^="Decision ${decisionNo} for"]`);
  await strCard.click();
  await expect(page.getByText("Why it was flagged")).toBeVisible();
  await expect(page.getByText(/just under a reporting limit/)).toBeVisible();
  const hold = page.getByRole("button", { name: /Hold to approve STR/ });
  await expect(hold).toBeVisible();
  await page.screenshot({ path: "qa/screenshots/flow-2-str-panel.png" });
  await hold.hover();
  await page.mouse.down();
  await page.waitForTimeout(1900);
  await page.mouse.up();
  await expect(page.getByText("First approval recorded")).toBeVisible();
  await expect(page.getByText(/1 of 2 approvals/)).toBeVisible();
  await page.keyboard.press("Escape");

  await strCard.click();
  const second = page.getByRole("button", { name: /Hold for 2nd approval/ });
  await second.hover();
  await page.mouse.down();
  await page.waitForTimeout(1900);
  await page.mouse.up();
  await expect(page.getByText(/Four-eyes complete/)).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "qa/screenshots/flow-3-str-approved.png" });
  await page.keyboard.press("Escape");

  // 3. Command palette
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Type a page/).fill("T00042");
  await expect(page.getByRole("option", { name: /T00042/ }).first()).toBeVisible();
  await page.screenshot({ path: "qa/screenshots/flow-7-palette.png" });
  await page.keyboard.press("Escape");

  expect(errors, errors.join("\n")).toEqual([]);
});
