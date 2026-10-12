# Tower Software Systems website: rules for changes

These rules apply to every change in this repository, whoever makes it. `npm run check` enforces most of them; the rest are on you.

## What this is

- The public website of Tower Software Systems: one content page (`site/index.html`) and an error page (`site/404.html`). Its job is to tell someone who meets the name who the company is, that it is real, what it makes, where to write, and where the product lives.
- `site/` is the only folder GitHub Pages serves. Nothing outside it is ever deployed.
- Nothing is pushed, deployed, or changed on GitHub (repository, Pages or organization settings), and no DNS record is changed, without the owner's approval.

## This repository is public

Nothing internal goes anywhere in it: not in pages, README, docs, code comments, validator patterns, or commit messages. That excludes account or hosted-zone identifiers, mail-routing and DNS provider details, registration numbers and dates, legal or attorney documents, private repository paths, issue or pull request numbers and links, founder or other personal details, and internal response targets.

## Product claims

- The Tower WMS website's own guardrails are the authority for anything said about Tower WMS. This site says less than www.towerwms.com, never more and never something different. If a product statement here disagrees with www.towerwms.com, this site is wrong.
- Describe Tower WMS exactly as "currently in early access". Never state or imply general availability or production-readiness, a launch or general-availability date, a customer count, current customer use, or any customer name or hint. No testimonials, logos, endorsements or case studies.
- Promise nothing: no access, timing, uptime, availability, backups, retention, support levels, response times, certifications, security guarantees, compliance, refunds or savings.
- No prices: no price, dollar figure, tier name, implementation fee or fee language anywhere, including `og.png`. Link https://www.towerwms.com/pricing/ instead.
- No unsupported capabilities: no OCR, customer or warehouse portals, APIs, invoice-system integrations, alerts, automated accessorial generation, or document or photo storage.
- Product detail beyond the lines already on the page (the step-by-step workflow, reports, billing states, scanning, labels, accounts, exports, roles, comparisons, captures) stays on www.towerwms.com, so the two sites cannot drift.
- Value statements are intended operational outcomes, never guaranteed savings or error elimination.
- Voice: direct, operational, specific, restrained. Never use: revolutionary, seamless, AI-powered, all-in-one, cutting-edge, world-class, best-in-class, leading. Keep out "only product", "one product" and "white-label".
- The positioning line "Marked cargo in. Ticketed cargo out. Billable days in between." is a lede, never a heading.
- Every factual statement on the site has a row in `docs/claim-inventory.md` with a public citation. Add or change the row in the same change as the statement.

## Company facts

- Allowed: Tower Software Systems is a trade name of Moral Support Studios LLC, a Missouri limited liability company. Tower WMS is a product of Tower Software Systems.
- Not allowed: team size or headcount, founder or personal names, founding year, registration date or number, address or city, funding, partners, years of experience.
- Never claim or hint at attorney review of anything.

## Links and contact

- External links are exactly the allow-list in `scripts/validate.mjs`: https://www.towerwms.com/, https://www.towerwms.com/pricing/, https://github.com/TowerSoftwareSystems, and GitHub Docs "What is GitHub Pages?". No query string or fragment on any of them.
- Never link demo.towerwms.com, app.towerwms.com or any other application host, a sign-in page, or the product's legal documents.
- The company address is `mailto:hello@towersoftwaresystems.com`, bare, with no prefilled subject or body. `support@towerwms.com` may be named, bare, for existing Tower WMS customers and users only; never route prospects to it. `hello@towerwms.com` never appears here: getting started with Tower WMS happens on www.towerwms.com.
- Wherever the site invites someone to write, it says that writing starts a conversation only and does not create an account or guarantee access.

## Page furniture

- No JavaScript, forms, accounts, cookies, analytics, tracking, remote fonts, scripts or stylesheets, CDN assets, iframes or embeds. The footer says so, and `scripts/validate.mjs` keeps it true. Every page must work fully with JS disabled.
- Every asset URL is root-relative, so the 404 page works at any depth.
- No manifest, no `CNAME` file and no dark mode. The custom domain is a later, separate change; the README describes it.
- No stock photography, gradients or decorative effects. Never reuse towerwms.com's `og.png` or its product captures.

## Design system

The Tower WMS house system, shared with www.towerwms.com. `scripts/validate.mjs` fails on a value outside these lists, so treat one as a defect, not a preference.

- Type: `--font-ui` for prose; `--font-data` for numbers, dates and marks, with `font-variant-numeric: tabular-nums`.
- Font sizes: 10, 12, 13, 14, 16, 19, 24, 30px, and `clamp(32px, 5vw, 42px)` for the display. Nothing else.
- Font weights: 400 and 700. 600 is allowed only as a softer bold, never as a separate level from 700.
- Palette: the custom properties in `:root` of `site/styles.css`. `--blue` is every interactive element on a light ground. `--orange` is for objects and rules only, never text; `--orange-text` is its text-size counterpart.
- The footer is the one reversed block, filled with `--ink`. Its links are `--paper` with their underline (`.site-footer a { color: var(--paper); }`), its legal lines are `--hairline`, and its focus ring is `--paper`. `--blue` on that navy is 2.1:1; never restore it there.
- Spacing: 8px unit, steps 8/16/24/32/48/64/96. Section padding 96px desktop, 56px mobile.
- Shell 1120px, prose measure 68ch, border-radius 2px at most, and one hairline: `1px solid var(--hairline)`.
- Light only. One CSS file.
- The wordmark is the approved stacked-plate lockup, shipped only as the inline SVG outlines in the `#tower-lockup` symbol, labelled "Tower Software Systems". Never render it in a live font, and never set "Software Systems" text beside it. The favicon is the house mark: a navy square with three paper bars.

## Before you finish

- Run `npm run check`. It must pass. Do not weaken a check to make it pass unless the rule itself changed, and say so in the commit.
- After any layout or CSS change, visually inspect at least one desktop (1280px) and one mobile (375px) render, and 320px when widths are involved.
- If the sharing card's content changes, regenerate `site/og.png` with `scripts/generate-og.ps1` and look at it.
