/** Records a short video of the signature animations (landing scroll + review queue shared-element open). */
import { test } from "@playwright/test";

test.use({ video: { mode: "on", size: { width: 1280, height: 800 } }, viewport: { width: 1280, height: 800 } });

test("landing + review queue animations", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(2500);
  await page.goto("/app/review", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const card = page.locator("[data-selected]").first();
  await card.click();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
});
