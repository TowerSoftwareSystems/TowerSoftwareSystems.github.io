// Axe accessibility scan of site/, served by scripts/serve.mjs and driven through
// headless Chromium, so the checks run against real rendering: computed contrast,
// real layout, real focus targets. Serious and critical violations fail; anything
// below that gate is reported without blocking.
//
// It also asserts what the design system promises on small screens: no horizontal
// overflow at 320px and 375px, on both pages.
import { appendFile } from "node:fs/promises";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { startServer } from "./serve.mjs";

// The home page and a path that does not exist, which must come back as the 404
// page with status 404, the way GitHub Pages serves it.
const pages = [
  { path: "/", status: 200, title: "Tower Software Systems | Focused software for specific operations" },
  { path: "/this-page-does-not-exist/", status: 404, title: "Page not found | Tower Software Systems" },
];

const axeViewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

const overflowWidths = [320, 375];

const gatingImpacts = new Set(["serious", "critical"]);

const scans = [];
const failures = [];
const advisories = [];
const needsReview = [];

function describe(label, result) {
  const targets = result.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(", ");
  const more = result.nodes.length > 3 ? ` and ${result.nodes.length - 3} more` : "";
  return `${label}: ${result.id} (${result.impact ?? "ungraded"}) — ${result.help}: ${targets}${more} (${result.helpUrl})`;
}

async function open(page, base, { path, status, title }, label) {
  const response = await page.goto(base + path, { waitUntil: "load" });
  if (response?.status() !== status) failures.push(`${label}: expected HTTP ${status}, got ${response?.status()}`);
  const actualTitle = await page.title();
  if (actualTitle !== title) failures.push(`${label}: expected title "${title}", got "${actualTitle}"`);
}

async function audit(page, label) {
  const { violations, incomplete } = await new AxeBuilder({ page }).analyze();
  const gating = violations.filter((violation) => !violation.impact || gatingImpacts.has(violation.impact));
  const advisory = violations.filter((violation) => violation.impact && !gatingImpacts.has(violation.impact));
  scans.push({ label, gating: gating.length, advisory: advisory.length, review: incomplete.length });
  for (const violation of gating) failures.push(describe(label, violation));
  for (const violation of advisory) advisories.push(describe(label, violation));
  for (const item of incomplete) needsReview.push(describe(label, item));
}

// The page-level test the task names (scrollWidth against innerWidth), plus the
// elements that stick out past the viewport, so a failure says what to fix.
async function overflow(page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth;
    const scrollWidth = document.scrollingElement.scrollWidth;
    const offenders = [];
    for (const element of document.body.querySelectorAll("*")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > viewport + 0.5 || box.left < -0.5) {
        const name = element.tagName.toLowerCase() + (element.className && typeof element.className === "string" ? "." + element.className.trim().split(/\s+/).join(".") : "");
        offenders.push(`${name} [${Math.round(box.left)}..${Math.round(box.right)}]`);
      }
    }
    return { viewport, scrollWidth, offenders };
  });
}

let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  if (/executable doesn't exist/i.test(String(error))) {
    console.error(
      "Accessibility validation failed:\n- Playwright's Chromium is not installed. Run `npx playwright install chromium` once, then re-run `npm run check`."
    );
    process.exit(1);
  }
  throw error;
}

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;

try {
  for (const viewport of axeViewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    for (const target of pages) {
      const label = `${target.path} ${viewport.name}`;
      await open(page, base, target, label);
      await audit(page, label);

      // Colour rules the design system fixes, checked as rendered so a selector that
      // loses on specificity cannot pass the stylesheet check and still paint wrong:
      // the status accent is --orange-text bold, and no footer link is --blue on navy.
      const styleProblems = await page.evaluate(() => {
        const problems = [];
        for (const element of document.querySelectorAll(".record-status")) {
          const style = getComputedStyle(element);
          if (style.color !== "rgb(154, 74, 0)" || style.fontWeight !== "700") {
            problems.push(`.record-status renders ${style.color} weight ${style.fontWeight}, expected --orange-text 700`);
          }
        }
        for (const link of document.querySelectorAll(".site-footer a")) {
          const color = getComputedStyle(link).color;
          if (color !== "rgb(245, 243, 237)") problems.push(`footer link "${link.textContent.trim()}" renders ${color}, expected --paper`);
        }
        return problems;
      });
      for (const problem of styleProblems) failures.push(`${label}: ${problem}`);
      if (target.path === "/" && !(await page.locator(".record-status").count())) failures.push(`${label}: no .record-status found`);

      // The nav is a wrapping row with no toggle, so its one state is what both
      // scans see. If links ever hide behind a toggle, this trips.
      const links = page.locator(".site-nav a");
      const total = await links.count();
      const visible = await page.locator(".site-nav a:visible").count();
      if (total === 0) failures.push(`${label}: no .site-nav links found`);
      else if (visible !== total) failures.push(`${label}: ${total - visible} of ${total} nav links are hidden`);
    }
    await context.close();
  }

  for (const width of overflowWidths) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    for (const target of pages) {
      const label = `${target.path} at ${width}px`;
      await open(page, base, target, label);
      const { viewport, scrollWidth, offenders } = await overflow(page);
      scans.push({ label: `${label} overflow`, gating: scrollWidth > viewport ? 1 : 0, advisory: 0, review: 0 });
      if (scrollWidth > viewport) {
        failures.push(`${label}: horizontal overflow, scrollWidth ${scrollWidth} > innerWidth ${viewport}`);
      }
      if (offenders.length) {
        failures.push(`${label}: elements outside the viewport: ${offenders.slice(0, 5).join(", ")}${offenders.length > 5 ? " and more" : ""}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## Accessibility scan (axe-core) and overflow",
    "",
    "| Page state | Gating | Advisory | Needs review |",
    "| --- | ---: | ---: | ---: |",
    ...scans.map((scan) => `| ${scan.label} | ${scan.gating} | ${scan.advisory} | ${scan.review} |`),
    "",
  ];
  if (failures.length) lines.push("### Blocking failures", "", ...failures.map((failure) => `- ${failure}`), "");
  if (advisories.length) lines.push("### Non-blocking findings", "", ...advisories.map((advisory) => `- ${advisory}`), "");
  if (needsReview.length) lines.push("### Needs manual review", "", ...needsReview.map((item) => `- ${item}`), "");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

for (const scan of scans) {
  const verdict = scan.gating ? "FAIL" : "PASS";
  console.log(`${verdict}  ${scan.label}${scan.advisory ? ` (${scan.advisory} advisory)` : ""}${scan.review ? ` (${scan.review} need review)` : ""}`);
}

if (advisories.length) {
  console.log("\nNon-blocking findings (below the serious/critical gate):\n" + advisories.map((advisory) => `- ${advisory}`).join("\n"));
}

if (needsReview.length) {
  console.log("\nAxe could not decide these without a human:\n" + needsReview.map((item) => `- ${item}`).join("\n"));
}

if (failures.length) {
  console.error("\nAccessibility validation failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  `\nScanned ${pages.length} pages at ${axeViewports.length} viewports with axe-core (no serious or critical violations) ` +
    `and checked overflow at ${overflowWidths.join("px and ")}px.`
);
