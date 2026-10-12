// Guardrail validator for site/, the only folder GitHub Pages serves. Zero
// dependencies: `node scripts/validate.mjs`, also run as `npm run validate:site`
// and inside `npm run check` in CI before every deploy.
//
// Each check prints PASS or FAIL with its findings. A FAIL is a defect in the site,
// not in the check: fix the page. Change a check only when the rule it enforces has
// changed, and say so in the commit.

// The origin that serves the site. Every canonical, sharing, sitemap and robots URL
// is built from this one constant. If a custom domain replaces it, change it here and
// then change the URLs in site/ until this script passes again.
const canonicalOrigin = "https://towersoftwaresystems.github.io";

import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../site/", import.meta.url)));
const ogGenerator = resolve(fileURLToPath(new URL("./generate-og.ps1", import.meta.url)));

// Everything GitHub Pages will serve. Anything else in site/ fails, which keeps out
// scripts, a manifest, a CNAME file, and pages nobody reviewed.
const expectedFiles = ["404.html", "favicon.svg", "index.html", "og.png", "robots.txt", "sitemap.xml", "styles.css"];
const pages = ["index.html", "404.html"];
const indexablePages = new Set(["index.html"]);

// The only places a link may leave the site: exact URLs, so no query string or
// fragment can ride along.
const allowedLinks = new Set([
  "https://www.towerwms.com/",
  "https://www.towerwms.com/pricing/",
  "https://github.com/TowerSoftwareSystems",
  "https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages",
]);

// Bare addresses only. support@ is named for existing Tower WMS customers and users.
const allowedMailto = new Set(["mailto:hello@towersoftwaresystems.com", "mailto:support@towerwms.com"]);
const allowedAddresses = new Set(["hello@towersoftwaresystems.com", "support@towerwms.com"]);

// Hosts and addresses this site never names: the guest demo, the application host,
// and the product site's getting-started address (that flow lives on towerwms.com).
const forbiddenStrings = ["demo.towerwms.com", "app.towerwms.com", "hello@towerwms.com"];

// Namespace URIs are identifiers, not links.
const namespaceUris = new Set(["http://www.w3.org/2000/svg", "http://www.sitemaps.org/schemas/sitemap/0.9"]);

// The approved stacked-plate lockup, outlines only.
const lockupSymbol = `<symbol id="tower-lockup" viewBox="0 0 664 100">
  <path d="M0 10h48v20H0zM0 40h72v20H0zM0 70h96v20H0z"></path>
  <path d="M136 0h84v18h-33v82h-18V18h-33z"></path>
  <path fill-rule="evenodd" d="M240 50a46 50 0 1 0 92 0 46 50 0 1 0-92 0zm18 0a28 32 0 1 1 56 0 28 32 0 1 1-56 0z"></path>
  <path d="M352 0h20l14 62 14-62h20l14 62 14-62h20l-24 100h-22l-13-56-13 56h-22z"></path>
  <path d="M488 0h78v18h-60v23h54v18h-54v23h60v18h-78z"></path>
  <path d="M586 0h18v100h-18z"></path>
  <path fill-rule="evenodd" d="M604 0h26a30 26 0 0 1 0 52h-26zm0 18v16h26a12 8 0 0 0 0-16z"></path>
  <path d="M600 52h30l34 48h-30z"></path>
</symbol>`;
const lockupLabel = "Tower Software Systems";

// The house favicon: a navy square with three paper bars, single colour.
const faviconSvg = `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="#142536"/>
  <g fill="#f5f3ed">
    <rect x="14" y="16" width="16" height="8"/>
    <rect x="14" y="28" width="26" height="8"/>
    <rect x="14" y="40" width="36" height="8"/>
  </g>
</svg>
`;

// The required status line, matched case-insensitively in the home page's visible text.
const requiredStatusLine = "currently in early access";

// "guarantee" and "general availability" may appear only inside these disclosures,
// which say what writing does NOT do or that no date is set. Anything else that
// mentions a guarantee or availability is a promise.
const approvedDisclosures = [
  "It does not create an account or guarantee access.",
  "It does not create an account, place an order, create an agreement, or guarantee access.",
  "with no general-availability date set",
];

// Copy rules, matched on visible text plus meta content, alt, title and aria-label
// values, with hyphens and whitespace flattened to single spaces.
const copyRules = [
  {
    name: "banned word",
    pattern: /\b(?:revolutionary|seamless(?:ly)?|ai powered|all in one|cutting edge|world class|best in class|leading)\b/i,
  },
  {
    name: "promise",
    pattern: /\b(?:guarantee[sd]?|uptime|SLA|generally available|production ready|now available|launch(?:ed|es|ing)?|24\/7|response times?|support (?:level|hours)|backups?|retention|certified|certifications?|compliant|compliance|SOC ?2|HIPAA|refunds?|money ?back|risk free|free trial|savings?|save (?:time|money)|error free|eliminates?|general availability|available (?:now|today)|now live|is live|out of early access|released|availability|warrant(?:y|ies|ed)?|promise[sd]?)\b/i,
  },
  {
    // Commercial terms that www.towerwms.com also keeps off its pages. Some overlap the
    // promise and price rules; a match then reports twice.
    name: "commercial claim",
    pattern: /\b(?:money ?back|full refunds?|refund guarantee|free trial|risk free|discount(?:ed|s)?|coupons?|promo(?:tional)? (?:code|price|pricing|rate)|introductory (?:price|pricing|rate)|launch (?:price|pricing)|early access (?:price|prices|pricing|rate)|price lock(?:ed)?|locked (?:price|rate)|cancel any ?time|month to month|uptime|SLA|response times?|24\/7|dedicated database|paid pilots?|unlimited)\b/i,
  },
  {
    name: "attorney-review claim",
    pattern: /\b(?:(?:attorney|lawyer|counsel|legal(?:ly)?) (?:reviewed|approved)|(?:reviewed|approved) by (?:an? )?(?:attorney|lawyer|counsel))\b/i,
  },
  {
    name: "price or fee language",
    pattern: /\b(?:fees?|per (?:month|year|user|seat|facility)|monthly|annually|discount(?:ed|s)?|promo(?:tional)?|introductory|price lock(?:ed)?|USD|dollars?)\b|\/(?:month|year|mo|yr)\b/i,
  },
  {
    // Case-sensitive: the capitalized words are the Tower WMS tier names.
    name: "tier name",
    pattern: /\b(?:Standard|Professional|Enterprise)\b/,
  },
  {
    name: "customer claim",
    pattern: /\b(?:trusted by|used by|relied on by|testimonials?|case stud(?:y|ies)|endorse(?:d|ment|ments)?|our clients)\b/i,
  },
  {
    name: "unverifiable company fact",
    pattern: /\b(?:founded|founder|since (?:19|20)\d\d|headquarter(?:s|ed)?|team of|employees|headcount|funded|funding|investors?|partners?|partnership|years of experience)\b/i,
  },
  {
    name: "unsupported capability",
    pattern: /\b(?:OCR|portals?|APIs?|integrations?|integrates?|alerts?|accessorials?|(?:document|photo) storage|AI|machine learning)\b/i,
  },
  {
    name: "retired or drifting phrase",
    pattern: /\b(?:private evaluation|only product|one product|white label|full workflow|all in one)\b/i,
  },
];

// The design system's value lists. scripts/validate.mjs is where they are enforced;
// the header comment of site/styles.css is where they are explained.
const allowedFontSizes = new Set(["10px", "12px", "13px", "14px", "16px", "19px", "24px", "30px", "clamp(32px, 5vw, 42px)"]);
const allowedWeights = new Set(["400", "600", "700"]);
const allowedSpacing = new Set(["0", "auto", "8px", "16px", "24px", "32px", "48px", "56px", "64px", "96px"]);
const allowedRadius = new Set(["0", "2px"]);
const allowedBorders = new Set([
  "0",
  "none",
  "1px solid var(--hairline)",
  "1px solid var(--ink)",
  "1px solid var(--blue)",
  "4px solid var(--orange)",
]);

// WCAG 2.x thresholds, each held with a 0.3 margin as on towerwms.com, so a pair
// fails while it is merely tight rather than after it has already failed.
const WCAG_TEXT = 4.5;
const WCAG_OBJECT = 3;
const CONTRAST_MARGIN = 0.3;
const contrastFloors = [
  { fg: "--ink", bg: "--paper", threshold: WCAG_TEXT, where: "headings, record values, .not-block text" },
  { fg: "--ink", bg: "--panel", threshold: WCAG_TEXT, where: "headings inside .product" },
  { fg: "--ink-body", bg: "--paper", threshold: WCAG_TEXT, where: "body copy" },
  { fg: "--ink-body", bg: "--panel", threshold: WCAG_TEXT, where: "body copy inside .product" },
  { fg: "--ink-muted", bg: "--paper", threshold: WCAG_TEXT, where: ".lede, .meta, .label, record terms" },
  { fg: "--ink-muted", bg: "--panel", threshold: WCAG_TEXT, where: ".lede and .label inside .product" },
  { fg: "--blue", bg: "--paper", threshold: WCAG_TEXT, where: "links and nav on the page ground" },
  { fg: "--blue", bg: "--panel", threshold: WCAG_TEXT, where: "links inside .product" },
  { fg: "--orange-text", bg: "--paper", threshold: WCAG_TEXT, where: ".record-status" },
  { fg: "--paper", bg: "--ink", threshold: WCAG_TEXT, where: "footer links, .skip-link, .button:hover" },
  { fg: "--hairline", bg: "--ink", threshold: WCAG_TEXT, where: "footer legal lines" },
  { fg: "--paper", bg: "--blue", threshold: WCAG_TEXT, where: ".button label" },
  { fg: "--orange", bg: "--paper", threshold: WCAG_OBJECT, where: ".artifact and .status-block 4px marking rule" },
  { fg: "--orange", bg: "--panel", threshold: WCAG_OBJECT, where: ".status-block rule against the .product panel" },
  { fg: "--ink", bg: "--panel", threshold: WCAG_OBJECT, where: ".not-block 1px boundary on the panel" },
  { fg: "--blue", bg: "--paper", threshold: WCAG_OBJECT, where: ".button boundary" },
];
// The pair that justifies the reversed footer's paper links. If it ever passes, the
// footer rule needs a deliberate review, not a silent edit.
const contrastCeilings = [{ fg: "--blue", bg: "--ink", below: WCAG_TEXT, where: "the reversed footer" }];

// --------------------------------------------------------------------------------

const results = [];

async function check(name, run) {
  let findings;
  try {
    findings = await run();
  } catch (error) {
    findings = [`check crashed: ${error?.message ?? error}`];
  }
  results.push({ name, findings });
}

// Line endings are compared as git stores them (LF, per .gitattributes) and a leading
// byte-order mark is ignored, so an editor's CRLF save cannot fail a byte-exact check
// locally that CI, reading the committed file, would pass.
const normalizeText = (text) => text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
const read = async (name) => normalizeText(await readFile(join(root, name), "utf8"));

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

// Numeric references decode first, and soft hyphens and zero-width characters vanish,
// so "&#36;49" or "seam&shy;less" is checked as the reader sees it.
function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&shy;|[\u00ad\u200b-\u200d\u2060]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Rendered text only: no comments, script or style bodies, or tags. Inline tags vanish
// without a space, so a word split by markup ("seam<em>less</em>") is read whole;
// every other tag becomes a space.
function visibleText(html) {
  return decodeEntities(
    stripComments(html)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/?(?:a|em|strong|b|i|span|abbr|small)\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Visible text plus the attribute values a reader or a share card shows.
function copyText(html) {
  const attributes = Array.from(
    stripComments(html).matchAll(/\s(?:content|alt|title|aria-label)="([^"]*)"/g),
    (match) => decodeEntities(match[1])
  );
  return [visibleText(html), ...attributes].join(" \n ");
}

function flatten(text) {
  return text.replace(/[\s\u2010-\u2012-]+/g, " ");
}

function attributes(tag) {
  const map = new Map();
  for (const [, name, value] of tag.matchAll(/\s([a-zA-Z:-]+)="([^"]*)"/g)) map.set(name.toLowerCase(), value);
  return map;
}

function tags(html, name) {
  return Array.from(stripComments(html).matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi")), (match) => match[0]);
}

function metaValues(html, key, value) {
  return tags(html, "meta")
    .map(attributes)
    .filter((attrs) => attrs.get(key) === value)
    .map((attrs) => attrs.get("content"));
}

function normalizeMarkup(text) {
  return text.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

// --------------------------------------------------------------------------------

const entries = await readdir(root, { withFileTypes: true });
const html = {};
for (const page of pages) {
  try {
    html[page] = await read(page);
  } catch {
    html[page] = "";
  }
}

await check("Served files: site/ holds exactly the expected files", () => {
  const findings = [];
  const present = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)).sort();
  for (const name of expectedFiles) if (!present.includes(name)) findings.push(`missing site/${name}`);
  for (const name of present) if (!expectedFiles.includes(name)) findings.push(`unexpected site/${name} (update expectedFiles only if this is a reviewed addition)`);
  return findings;
});

await check("No scripts, forms, embeds, inline styles or storage", async () => {
  const findings = [];
  for (const page of pages) {
    const source = stripComments(html[page]);
    // Handlers, javascript: URLs, storage calls and vendor hosts can only act from
    // inside a tag, so they are matched against tag markup alone, and prose may name
    // them ("no JavaScript", "nothing in localStorage"). Elements are matched anywhere.
    const markup = Array.from(source.matchAll(/<[a-z!](?:[^>"']|"[^"]*"|'[^']*')*>/gi), (match) => match[0]).join("\n");
    for (const [pattern, label, scanned] of [
      [/<script\b/i, "a <script> element", source],
      [/<noscript\b/i, "a <noscript> element", source],
      [/<form\b/i, "a <form> element", source],
      [/<(?:input|textarea|select|button)\b/i, "a form control", source],
      [/<iframe\b/i, "an <iframe>", source],
      [/<object\b/i, "an <object>", source],
      [/<embed\b/i, "an <embed>", source],
      [/<style\b/i, "a <style> element", source],
      [/<base\b/i, "a <base> element", source],
      [/\sstyle="/i, "an inline style attribute", source],
      [/\son[a-z]+\s*=/i, "an inline event handler", markup],
      [/javascript:/i, "a javascript: URL", markup],
      [/http-equiv="refresh"/i, "a meta refresh", source],
      [/document\.cookie|localStorage|sessionStorage|indexedDB|navigator\.sendBeacon/i, "a storage or beacon API", markup],
      [/google-analytics|googletagmanager|gtag\(|fbq\(|facebook\.net|hotjar|clarity\.ms|segment\.com|mixpanel|posthog|plausible|matomo/i, "a tracking vendor", markup],
    ]) {
      if (pattern.test(scanned)) findings.push(`${page}: contains ${label}`);
    }
  }
  const css = await read("styles.css").catch(() => "");
  if (/@import\b/i.test(css)) findings.push("styles.css: @import loads another stylesheet");
  if (/@font-face\b/i.test(css)) findings.push("styles.css: @font-face; the site uses the system font stacks only");
  if (/url\(/i.test(css.replace(/\/\*[\s\S]*?\*\//g, ""))) findings.push("styles.css: url() loads a resource; the stylesheet loads nothing");
  return findings;
});

await check("Resources are local and root-relative", () => {
  const findings = [];
  for (const page of pages) {
    const source = stripComments(html[page]);
    for (const [, attribute, value] of source.matchAll(/\s(src|srcset|poster|data)="([^"]*)"/gi)) {
      findings.push(`${page}: ${attribute}="${value}"; this site loads no images, media or objects from markup`);
    }
    for (const tag of tags(source, "link")) {
      const attrs = attributes(tag);
      const rel = attrs.get("rel");
      const href = attrs.get("href") ?? "";
      if (rel === "canonical") continue;
      if (!href.startsWith("/") || href.startsWith("//")) findings.push(`${page}: <link rel="${rel}"> href is not root-relative: ${href}`);
    }
    const stylesheets = tags(source, "link").map(attributes).filter((attrs) => attrs.get("rel") === "stylesheet");
    if (stylesheets.length !== 1 || stylesheets[0].get("href") !== "/styles.css") {
      findings.push(`${page}: must link exactly one stylesheet, /styles.css`);
    }
    const icons = tags(source, "link").map(attributes).filter((attrs) => attrs.get("rel") === "icon");
    if (icons.length !== 1 || icons[0].get("href") !== "/favicon.svg" || icons[0].get("type") !== "image/svg+xml") {
      findings.push(`${page}: must carry <link rel="icon" href="/favicon.svg" type="image/svg+xml">`);
    }
  }
  return findings;
});

await check("Links: allow-listed external URLs and bare approved mailto only", () => {
  const findings = [];
  for (const page of pages) {
    // <area> links too: an image-map hotspot leaves the site like any <a>.
    for (const tag of tags(html[page], "(?:a|area)")) {
      const href = attributes(tag).get("href");
      if (href === undefined) {
        if (/^<a\b/i.test(tag)) findings.push(`${page}: <a> without href`);
        continue;
      }
      if (href.startsWith("#")) continue;
      if (href.startsWith("/") && !href.startsWith("//")) {
        if (/[?]/.test(href)) findings.push(`${page}: internal link carries a query string: ${href}`);
        continue;
      }
      if (href.toLowerCase().startsWith("mailto:")) {
        if (!allowedMailto.has(href)) findings.push(`${page}: mailto is not a bare approved address: ${href}`);
        continue;
      }
      if (!allowedLinks.has(href)) findings.push(`${page}: external link outside the allow-list (exact URL, no query or fragment): ${href}`);
    }
  }
  return findings;
});

await check("No stray URLs, hosts or addresses in served text", async () => {
  const findings = [];
  const textFiles = expectedFiles.filter((name) => [".html", ".css", ".txt", ".xml", ".svg"].includes(extname(name)));
  for (const name of textFiles) {
    const source = await read(name).catch(() => "");
    const scanned = name.endsWith(".html") ? stripComments(source) : source;
    for (const forbidden of forbiddenStrings) {
      if (scanned.toLowerCase().includes(forbidden)) findings.push(`${name}: names ${forbidden}`);
    }
    for (let [url] of scanned.matchAll(/\bhttps?:\/\/[^\s"'<>)]+/gi)) {
      // A URL ending a sentence keeps its full stop out of the comparison.
      url = url.replace(/[.,;:!?]+$/, "");
      const allowed =
        namespaceUris.has(url) ||
        allowedLinks.has(url) ||
        url === `${canonicalOrigin}/` ||
        url === `${canonicalOrigin}/og.png` ||
        url === `${canonicalOrigin}/sitemap.xml`;
      if (!allowed) findings.push(`${name}: URL outside the allow-list: ${url}`);
    }
    for (const [address] of scanned.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
      if (!allowedAddresses.has(address.toLowerCase())) findings.push(`${name}: email address outside the approved two: ${address}`);
    }
  }
  return findings;
});

await check("No prices or dollar figures", async () => {
  const findings = [];
  for (const name of expectedFiles.filter((file) => /\.(?:html|css|txt|xml|svg)$/.test(file))) {
    const source = await read(name).catch(() => "");
    const scanned = name.endsWith(".html") ? stripComments(source) : source;
    for (const [match] of scanned.matchAll(/[$\u20ac\u00a3\uff04]\s?\.?\d[\d,.]*/g)) findings.push(`${name}: money figure ${match}`);
    // The pages again as a reader sees them, so an entity ("&#36;49") cannot hide a figure.
    if (name.endsWith(".html")) {
      for (const [match] of copyText(source).matchAll(/[$\u20ac\u00a3\uff04]\s?\.?\d[\d,.]*/g)) findings.push(`${name}: money figure in copy ${match}`);
    }
    const spelled = scanned.match(/\b(?:usd|us\$)\s?\d|\d[\d,.]*\s?(?:usd|dollars?)\b/i);
    if (spelled) findings.push(`${name}: amount in words: ${spelled[0]}`);
  }
  return findings;
});

await check("Copy guardrails: banned words, promises and unsupported claims", () => {
  const findings = [];
  for (const page of pages) {
    let text = flatten(copyText(html[page]));
    for (const sentence of approvedDisclosures) text = text.split(flatten(sentence)).join(" ");
    for (const { name, pattern } of copyRules) {
      const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      for (const [match] of text.matchAll(global)) findings.push(`${page}: ${name}: "${match}"`);
    }
  }
  return findings;
});

await check(`Status line: "Currently in early access" on the home page`, () => {
  const text = visibleText(html["index.html"]).toLowerCase();
  return text.includes(requiredStatusLine) ? [] : [`index.html: visible text lacks "${requiredStatusLine}"`];
});

await check("Head metadata: lang, title, description, canonical, Open Graph, Twitter", () => {
  const findings = [];
  for (const page of pages) {
    const source = stripComments(html[page]);
    const fail = (message) => findings.push(`${page}: ${message}`);
    if (!/<html lang="en">/.test(source)) fail('missing <html lang="en">');
    if (!/<meta charset="UTF-8">/.test(source)) fail('missing <meta charset="UTF-8">');
    if (!/<meta name="viewport" content="width=device-width, initial-scale=1.0">/.test(source)) fail("missing or changed viewport meta");
    const titles = Array.from(source.matchAll(/<title>([^<]*)<\/title>/g), (match) => match[1].trim());
    if (titles.length !== 1 || !titles[0]) fail("needs exactly one non-empty <title>");
    const title = titles[0];

    const metaKeys = tags(source, "meta")
      .map(attributes)
      .map((attrs) => attrs.get("name") ?? attrs.get("property"))
      .filter(Boolean);
    for (const key of new Set(metaKeys)) {
      if (metaKeys.filter((other) => other === key).length > 1) fail(`meta ${key} appears more than once`);
    }
    const one = (key, value) => metaValues(source, key, value)[0];
    if (!one("name", "description")?.trim()) fail("missing meta description");
    if (one("name", "theme-color") !== "#f5f3ed") fail('theme-color must be "#f5f3ed"');
    if (one("name", "color-scheme") !== "light") fail('color-scheme must be "light" (light only)');

    const canonicals = tags(source, "link").map(attributes).filter((attrs) => attrs.get("rel") === "canonical");
    const ogKeys = metaKeys.filter((key) => key.startsWith("og:") || key.startsWith("twitter:"));

    if (!indexablePages.has(page)) {
      if (one("name", "robots") !== "noindex,follow") fail('robots must be "noindex,follow"');
      if (canonicals.length) fail("an error page carries no canonical link");
      if (ogKeys.length) fail(`an error page carries no sharing metadata; found ${ogKeys.join(", ")}`);
      continue;
    }

    if (one("name", "robots") !== "index,follow") fail('robots must be "index,follow"');
    const expectedUrl = `${canonicalOrigin}/${page.replace(/index\.html$/, "")}`;
    if (canonicals.length !== 1 || canonicals[0].get("href") !== expectedUrl) fail(`canonical must be ${expectedUrl}`);

    const og = (key) => one("property", `og:${key}`);
    const tw = (key) => one("name", `twitter:${key}`);
    const expectations = [
      ["og:type", og("type"), "website"],
      ["og:site_name", og("site_name"), "Tower Software Systems"],
      ["og:title", og("title"), title],
      ["og:url", og("url"), expectedUrl],
      ["og:image", og("image"), `${canonicalOrigin}/og.png`],
      ["og:image:width", og("image:width"), "1200"],
      ["og:image:height", og("image:height"), "630"],
      ["twitter:card", tw("card"), "summary_large_image"],
      ["twitter:title", tw("title"), og("title")],
      ["twitter:description", tw("description"), og("description")],
      ["twitter:image", tw("image"), og("image")],
      ["twitter:image:alt", tw("image:alt"), og("image:alt")],
    ];
    for (const [key, actual, expected] of expectations) {
      if (actual === undefined) fail(`missing ${key}`);
      else if (actual !== expected) fail(`${key} is "${actual}", expected "${expected}"`);
    }
    if (!og("description")?.trim()) fail("missing og:description");
    if (!og("image:alt")?.trim()) fail("missing og:image:alt");
  }
  return findings;
});

await check("Internal links, anchors and ids resolve", () => {
  const findings = [];
  const present = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  for (const page of pages) {
    const source = stripComments(html[page]);
    const ids = Array.from(source.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
    for (const id of new Set(ids)) if (ids.filter((other) => other === id).length > 1) findings.push(`${page}: duplicate id "${id}"`);
    const idSet = new Set(ids);
    for (const [, tagName, href] of source.matchAll(/<(a|use|link)\b[^>]*\shref="([^"]*)"/g)) {
      if (href.startsWith("#")) {
        if (!idSet.has(decodeURIComponent(href.slice(1)))) findings.push(`${page}: <${tagName}> points at missing #${href.slice(1)}`);
        continue;
      }
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const [path, fragment] = href.split("#");
      const file = path === "/" ? "index.html" : path.replace(/^\//, "").replace(/\/$/, "/index.html");
      if (!present.has(file)) findings.push(`${page}: <${tagName}> href ${href} resolves to no served file`);
      if (fragment) {
        const targetIds = new Set(Array.from(stripComments(html[file] ?? "").matchAll(/\sid="([^"]+)"/g), (match) => match[1]));
        if (!targetIds.has(fragment)) findings.push(`${page}: ${href} points at a missing anchor`);
      }
    }
    if (!source.includes('<a class="skip-link" href="#main-content">Skip to main content</a>')) findings.push(`${page}: missing the skip link`);
    if (!source.includes('<main id="main-content" tabindex="-1">')) findings.push(`${page}: missing <main id="main-content" tabindex="-1">`);
  }
  return findings;
});

await check("Shared wordmark, header lockup and footer", () => {
  const findings = [];
  const footers = {};
  for (const page of pages) {
    const source = stripComments(html[page]);
    const symbol = source.match(/<symbol id="tower-lockup"[\s\S]*?<\/symbol>/)?.[0];
    if (!symbol || normalizeMarkup(symbol) !== normalizeMarkup(lockupSymbol)) findings.push(`${page}: #tower-lockup symbol differs from the approved outlines`);
    const lockups = tags(source, "svg").map(attributes).filter((attrs) => attrs.get("class") === "lockup");
    if (lockups.length !== 2) findings.push(`${page}: expected the lockup twice (header and footer); found ${lockups.length}`);
    for (const attrs of lockups) {
      if (attrs.get("aria-label") !== lockupLabel || attrs.get("role") !== "img") findings.push(`${page}: lockup must be role="img" aria-label="${lockupLabel}"`);
    }
    footers[page] = source.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
    if (!footers[page]) findings.push(`${page}: missing <footer class="site-footer">`);
  }
  const [first, ...rest] = pages;
  for (const page of rest) {
    if (footers[page] && footers[first] && footers[page] !== footers[first]) findings.push(`${page}: footer differs from ${first}; the footer is identical on every page`);
  }
  return findings;
});

await check("Sitemap and robots.txt agree with the pages", async () => {
  const findings = [];
  const sitemap = await read("sitemap.xml").catch(() => "");
  const robots = await read("robots.txt").catch(() => "");
  const locs = Array.from(sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), (match) => match[1]);
  const expectedLocs = [...indexablePages].map((page) => `${canonicalOrigin}/${page.replace(/index\.html$/, "")}`);
  if (!sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) findings.push("sitemap.xml: missing XML declaration");
  if (JSON.stringify(locs) !== JSON.stringify(expectedLocs)) findings.push(`sitemap.xml: <loc> entries ${JSON.stringify(locs)} should be exactly ${JSON.stringify(expectedLocs)}`);
  const lines = robots.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of ["User-agent: *", "Allow: /", `Sitemap: ${canonicalOrigin}/sitemap.xml`]) {
    if (!lines.includes(line)) findings.push(`robots.txt: missing "${line}"`);
  }
  if (lines.some((line) => /^disallow:/i.test(line))) findings.push("robots.txt: has a Disallow line; the 404 is kept out by its noindex, not by robots");
  return findings;
});

await check("og.png is a clean 1200x630 PNG", async () => {
  const findings = [];
  let bytes;
  try {
    bytes = await readFile(join(root, "og.png"));
  } catch {
    return ["og.png: missing"];
  }
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return ["og.png: not a PNG (bad signature)"];
  if (bytes.subarray(12, 16).toString("latin1") !== "IHDR") return ["og.png: first chunk is not IHDR"];
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 1200 || height !== 630) findings.push(`og.png: ${width}x${height}, expected 1200x630`);
  if (bytes.length > 200 * 1024) findings.push(`og.png: ${Math.round(bytes.length / 1024)} KB exceeds the 200 KB budget`);
  // Only the chunks that draw the image are allowed. Every other chunk (tEXt, iTXt,
  // zTXt, eXIf, tIME, iCCP and the rest) is where a tool name, a path, a profile name
  // or a timestamp would ride along.
  const renderingChunks = ["IHDR", "PLTE", "IDAT", "IEND", "sRGB", "gAMA", "pHYs", "cHRM"];
  for (let offset = 8; offset + 8 <= bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("latin1");
    if (!renderingChunks.includes(type)) findings.push(`og.png: unexpected ${type} chunk`);
    offset += 12 + length;
  }
  const latin = bytes.toString("latin1");
  for (const marker of ["C:\\", "/Users/", "/home/", "xmpmeta"]) if (latin.includes(marker)) findings.push(`og.png: contains "${marker}"`);
  return findings;
});

// og.png's pixels cannot be read here, so the text it carries is checked where it is
// written: the whole of scripts/generate-og.ps1, comments included, gets the copy
// rules, the money pattern, and the host, address and URL allow-lists.
await check("Sharing card text: scripts/generate-og.ps1 passes the copy rules", async () => {
  const findings = [];
  let text;
  try {
    text = normalizeText(await readFile(ogGenerator, "utf8"));
  } catch {
    return ["scripts/generate-og.ps1: missing"];
  }
  const fail = (rule, match) => findings.push(`generate-og.ps1: ${rule}: "${match}" (its text is drawn on og.png)`);
  const flat = flatten(text);
  for (const { name, pattern } of copyRules) {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    for (const [match] of flat.matchAll(global)) fail(name, match);
  }
  for (const [match] of text.matchAll(/[$\u20ac\u00a3\uff04]\s?\.?\d[\d,.]*/g)) fail("money figure", match);
  for (const forbidden of forbiddenStrings) if (text.toLowerCase().includes(forbidden)) fail("never named", forbidden);
  for (const [address] of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    if (!allowedAddresses.has(address.toLowerCase())) fail("email address outside the approved two", address);
  }
  for (let [url] of text.matchAll(/\bhttps?:\/\/[^\s"'<>)]+/gi)) {
    url = url.replace(/[.,;:!?]+$/, "");
    if (!allowedLinks.has(url) && url !== `${canonicalOrigin}/`) fail("URL outside the allow-list", url);
  }
  return findings;
});

await check("favicon.svg is the house mark", async () => {
  const svg = await read("favicon.svg").catch(() => "");
  return svg === faviconSvg ? [] : ["favicon.svg: differs from the approved navy square with three paper bars"];
});

await check("Stylesheet: type scale, weights, spacing, radius, rules, palette, light only", async () => {
  const findings = [];
  const css = await read("styles.css").catch(() => "");
  if (!css) return ["styles.css: missing or empty"];
  const scannable = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const fail = (message) => findings.push(`styles.css: ${message}`);

  if (/prefers-color-scheme/i.test(scannable)) fail("prefers-color-scheme found; the site is light only");
  if (/color-scheme\s*:\s*(?!light\s*[;}])/i.test(scannable)) fail("color-scheme other than light");

  // Flat rules only. The declaration scan below reads innermost blocks, so a
  // declaration beside a nested rule would never be checked; nesting fails instead.
  // A rule inside an at-rule (@media, @supports) is still flat.
  const openBlocks = [];
  let prelude = "";
  for (const character of scannable) {
    if (character === "{") {
      const outer = openBlocks.at(-1);
      const inner = prelude.trim().replace(/\s+/g, " ");
      if (outer !== undefined && !outer.startsWith("@")) fail(`nested rule "${inner}" inside "${outer}"; the house system uses flat rules`);
      openBlocks.push(inner);
      prelude = "";
    } else if (character === "}") {
      openBlocks.pop();
      prelude = "";
    } else if (character === ";") {
      prelude = "";
    } else {
      prelude += character;
    }
  }

  // The palette is one :root block; a second one would hold tokens no contrast pair
  // ever checks.
  const rootMentions = (scannable.match(/:root\b/g) ?? []).length;
  if (rootMentions !== 1) fail(`:root appears ${rootMentions} times; the palette lives in exactly one :root block`);

  // Properties that carry nothing but a colour: outside :root their value is a token.
  const colourOnly = /^(?:color|background(?:-color)?|fill|stroke|outline-color|border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?-color|text-decoration-color|caret-color|accent-color)$/;
  const tokenValue = /^(?:var\(--[a-z0-9-]+\)|currentcolor|transparent|inherit|none)$/i;

  const weightsUsed = new Set();
  for (const [, selector, body] of scannable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const where = selector.trim().replace(/\s+/g, " ");
    for (const [, property, rawValue] of body.matchAll(/([a-z-]+)\s*:\s*([^;]+)/g)) {
      const value = rawValue.trim().replace(/\s+/g, " ");
      if (property === "font") fail(`"font" shorthand in "${where}" hides its size and weight from this check`);
      if (property === "font-size" && !allowedFontSizes.has(value)) fail(`font-size ${value} in "${where}" is not in the type scale`);
      if (property === "font-weight") {
        weightsUsed.add(value);
        if (!allowedWeights.has(value)) fail(`font-weight ${value} in "${where}" is outside 400/600/700`);
      }
      if (/^(?:(?:padding|margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)$/.test(property)) {
        for (const step of value.split(" ")) if (!allowedSpacing.has(step)) fail(`${property}: ${step} in "${where}" is not an 8px-scale step`);
      }
      if (/radius$/.test(property) && !value.split(" ").every((step) => allowedRadius.has(step))) fail(`${property}: ${value} in "${where}" exceeds the 2px maximum`);
      if (/^border(?:-(?:top|right|bottom|left|inline|block))?$/.test(property) && !allowedBorders.has(value)) {
        fail(`${property}: ${value} in "${where}" is not a sanctioned rule or boundary`);
      }
      if (/^border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?-(?:width|style)$/.test(property)) {
        fail(`${property} in "${where}" bypasses the sanctioned border shorthands`);
      }
      if (/gradient\(/i.test(value)) fail(`${property}: ${value} in "${where}" is a gradient; the house system has none`);
      if (/^(?:box-shadow|text-shadow|filter|backdrop-filter|mix-blend-mode|font-variation-settings)$/.test(property)) {
        fail(`${property} in "${where}" is a decorative effect or a hidden weight; the house system has none`);
      }
      if (property.startsWith("--") && !/:root/.test(where)) fail(`custom property ${property} in "${where}"; tokens are defined only in :root`);
      if (!/:root/.test(where) && colourOnly.test(property) && !tokenValue.test(value)) {
        fail(`${property}: ${value} in "${where}" must be a var(--token)`);
      }
      if (!/:root/.test(where)) {
        const literal = value
          .replace(/var\(\s*--[a-z0-9-]+\s*\)/gi, " ")
          .match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|red|blue|green|orange|navy|gray|grey)\b/i);
        if (literal && /color|background|border|outline|fill|stroke|shadow|decoration/.test(property)) {
          fail(`${property}: ${value} in "${where}" paints a colour outside the palette; use a var(--token)`);
        }
      }
    }
  }
  if (weightsUsed.has("600") && weightsUsed.has("700")) fail("600 and 700 both appear; they must never be two levels");

  if (!/\.site-footer a\s*\{[^}]*color:\s*var\(--paper\)/.test(scannable)) {
    fail(".site-footer a { color: var(--paper); } is required: --blue on the --ink footer is 2.1:1");
  }

  const rootBlock = scannable.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const palette = new Map();
  // Every token except the --font-* stacks is a colour, written as opaque 6-digit hex
  // so the contrast pairs below can measure it.
  for (const [, name, value] of rootBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) {
    if (name.startsWith("--font-")) continue;
    if (!/^#[0-9a-f]{6}$/i.test(value.trim())) fail(`palette token ${name} is not opaque 6-digit hex`);
    else palette.set(name, value.trim().toLowerCase());
  }
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    const [R, G, B] = [r, g, b].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  const ratio = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const covered = new Set();
  for (const { fg, bg, threshold, where } of contrastFloors) {
    covered.add(fg).add(bg);
    if (!palette.has(fg) || !palette.has(bg)) {
      fail(`contrast pair ${fg} on ${bg} names a missing palette token (${where})`);
      continue;
    }
    const value = ratio(palette.get(fg), palette.get(bg));
    if (value < threshold + CONTRAST_MARGIN) fail(`${fg} on ${bg} is ${value.toFixed(2)}:1, under ${(threshold + CONTRAST_MARGIN).toFixed(2)}:1 (${where})`);
  }
  for (const { fg, bg, below, where } of contrastCeilings) {
    covered.add(fg).add(bg);
    if (palette.has(fg) && palette.has(bg) && ratio(palette.get(fg), palette.get(bg)) >= below) {
      fail(`${fg} on ${bg} now clears ${below}:1; revisit ${where} rule deliberately`);
    }
  }
  for (const name of palette.keys()) if (!covered.has(name)) fail(`palette token ${name} is in no contrast pair`);
  return findings;
});

// --------------------------------------------------------------------------------

let failed = 0;
for (const { name, findings } of results) {
  console.log(`${findings.length ? "FAIL" : "PASS"}  ${name}`);
  for (const finding of findings) console.log(`        - ${finding}`);
  if (findings.length) failed += 1;
}
console.log(
  failed
    ? `\nSite validation failed: ${failed} of ${results.length} checks.`
    : `\nSite validation passed: ${results.length} checks on ${pages.length} pages and ${expectedFiles.length} served files.`
);
process.exit(failed ? 1 : 0);
