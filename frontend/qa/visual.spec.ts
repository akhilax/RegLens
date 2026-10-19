/**
 * Visual QA: screenshots every page in dark + light at desktop (1440) and mobile (390) widths,
 * after animations settle, and fails on any console error. Output: qa/screenshots/*.png
 */
import { expect, type Page, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const THEMES = ["dark", "light"] as const;

async function firstDecisionId(page: Page): Promise<number> {
  const res = await page.request.get("/api/review/queue?include_closed=true");
  const queue = (await res.json()) as { id: number; requires_four_eyes: boolean }[];
  return (queue.find((d) => d.requires_four_eyes) ?? queue[0]).id;
}

test("screenshots of every page, both themes, desktop + mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${page.url()} :: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`${page.url()} :: ${err.message}`));

  const layoutIssues: string[] = [];
  const decisionId = await firstDecisionId(page);
  const routes: [string, string][] = [
    ["landing", "/"],
    ["dashboard", "/app"],
    ["transactions", "/app/transactions"],
    ["analysis", "/app/analysis"],
    ["review", "/app/review"],
    ["trace", `/app/decisions/${decisionId}`],
    ["knowledge", "/app/knowledge"],
    ["ask", "/app/ask"],
    ["audit", "/app/audit"],
    ["evaluation", "/app/evaluation"],
    ["not-found", "/app/does-not-exist"],
  ];

  for (const theme of THEMES) {
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("reglens-ui", JSON.stringify({ state: { theme: t, sidebarCollapsed: false, reviewer: "asha" }, version: 0 }));
      } catch {
        /* ignore */
      }
    }, theme);
    await page.emulateMedia({ colorScheme: theme });
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const [name, path] of routes) {
        await page.goto(path, { waitUntil: "networkidle" });
        await page.waitForTimeout(name === "trace" ? 4500 : 2600); // let entrance animations settle
        await page.screenshot({ path: `qa/screenshots/${name}-${theme}-${vp.name}.png` });
        if (vp.name === "desktop" && (name === "landing" || name === "dashboard")) {
          await page.screenshot({ path: `qa/screenshots/${name}-${theme}-${vp.name}-full.png`, fullPage: true });
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) layoutIssues.push(`${name} ${theme} ${vp.name}: horizontal overflow ${overflow}px`);
      }
    }
  }
  expect(errors, errors.join("\n")).toEqual([]);
});
