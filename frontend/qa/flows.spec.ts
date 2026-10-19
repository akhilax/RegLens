/**
 * End-to-end demo flow (mutates data — run `npm run seed` afterwards for a fresh demo).
 * analysis (SSE) → four-eyes STR approval → KB amendment impact → audit verify/tamper → RAG Q&A → command palette.
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
  await expect(page.getByText("100%", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("main a[href^='/app/decisions/']").first()).toBeVisible();
  await page.screenshot({ path: "qa/screenshots/flow-1-analysis.png" });

  // 2. Four-eyes STR approval: Asha holds to approve, then Ravi completes it
  await page.goto("/app/review");
  const label = await page.locator("[data-selected]").filter({ hasText: "R-STRUCT" }).first().getAttribute("aria-label");
  const decisionNo = label!.match(/Decision (\d+)/)![1];
  const strCard = page.locator(`[aria-label^="Decision ${decisionNo} for"]`);
  await strCard.click();
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

  await page.getByRole("button", { name: "Switch reviewer" }).click();
  await page.getByRole("menuitem", { name: /Ravi Kulkarni/ }).click();
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

  // 3. Regulation version change → diff → impacted decisions
  await page.goto("/app/knowledge");
  await page.getByRole("button", { name: /Load demo amendment/ }).click();
  await expect(page.getByText("Impacted decisions")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/v1 → v2/)).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "qa/screenshots/flow-4-kb-impact.png", fullPage: true });

  // 4. Audit integrity + tamper simulation
  await page.goto("/app/audit");
  await page.getByRole("button", { name: /Verify integrity/ }).click();
  await expect(page.getByText(/blocks verified/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Simulate tampering/ }).click();
  await expect(page.getByText(/broken at #/)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "qa/screenshots/flow-5-audit-tamper.png" });

  // 5. RAG Q&A with citations
  await page.goto("/app/ask");
  await page.getByRole("button", { name: "When must a Cash Transaction Report be filed?" }).click();
  await expect(page.getByText(/citation\(s\) verified/)).toBeVisible({ timeout: 30_000 });
  await page.locator("button[title='Show source clause']").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "qa/screenshots/flow-6-ask.png" });

  // 6. Command palette
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Type a page/).fill("T00042");
  await expect(page.getByRole("option", { name: /T00042/ }).first()).toBeVisible();
  await page.screenshot({ path: "qa/screenshots/flow-7-palette.png" });
  await page.keyboard.press("Escape");

  expect(errors, errors.join("\n")).toEqual([]);
});
