# TowerSoftwareSystems.github.io

Source for https://towersoftwaresystems.github.io/, the website of Tower Software Systems, the company behind Tower WMS (https://www.towerwms.com/). Static HTML and one stylesheet: no scripts, forms, cookies, analytics or tracking. `node scripts/validate.mjs` checks the pages. `docs/claim-inventory.md` lists every factual statement on the site and its public source.

## Repository layout

| Path | What it is |
|---|---|
| `site/` | The only folder GitHub Pages serves: `index.html`, `404.html`, `styles.css`, `favicon.svg`, `og.png`, `robots.txt`, `sitemap.xml`. |
| `scripts/validate.mjs` | Guardrail check of `site/`: links, copy, metadata, sitemap and robots, the sharing image, and the design-system value lists. No dependencies. Also `npm run validate:site`. |
| `scripts/validate-a11y.mjs` | axe-core scan in headless Chromium at 1280px and 375px, rendered-colour checks, and horizontal-overflow checks at 320px and 375px. |
| `scripts/serve.mjs` | Zero-dependency local server for `site/` on 127.0.0.1, with the 404 page for missing paths. |
| `scripts/generate-og.ps1` | Draws `site/og.png`, the 1200x630 sharing card (Windows, System.Drawing). |
| `docs/claim-inventory.md` | Every factual statement on the site and its public source. |
| `AGENTS.md` | Rules for changing this repository. |
| `.github/workflows/pages.yml` | Validates every push to `main` and every pull request; deploys `site/` from `main`. |
| `.github/workflows/weekly-check.yml` | Runs the same checks every week and on demand; never deploys. |

## Local development

Needs Node.js 20.6 or later; CI uses the version in `.nvmrc`.

```sh
npm ci
npx playwright install chromium
npm run serve    # http://127.0.0.1:4321/
npm run check    # html-validate, scripts/validate.mjs, then the axe and overflow scan
```

To serve on another port, set `PORT`: `PORT=8080 npm run serve` in a POSIX shell, or `$env:PORT=8080; npm run serve` in PowerShell.

After changing anything the sharing card shows, regenerate it in Windows PowerShell and look at the result before committing:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-og.ps1
```

## How deploys work

`.github/workflows/pages.yml` ("Validate and deploy") has two jobs:

1. **check** runs on every push to `main`, every pull request, and on demand: `npm ci`, `npm audit --audit-level=high`, the Playwright Chromium install, and `npm run check`. On a push to `main` or a manual run on `main` it then uploads `site/`, and only `site/`, as the Pages artifact.
2. **deploy** runs after a passing check, only for a push to `main` or a manual run on `main`, and publishes that artifact with `actions/deploy-pages`. Pull requests never deploy.

Deploying runs queue one at a time as whole runs, check and deploy together, so an older commit never deploys over a newer one. A newer pending run replaces an older pending one, and a deploy in progress is never cancelled.

`.github/workflows/weekly-check.yml` ("Weekly check") runs the same checks every Monday and on demand, so a new advisory or a browser change surfaces even when nobody pushes. It never uploads or deploys. GitHub stops scheduled workflows in a public repository after 60 days without repository activity; `gh workflow enable weekly-check.yml` resumes it. Because the schedule lives in its own workflow, that never affects deploys.

Because only `site/` is uploaded, the README, docs and scripts never become URLs, and Jekyll never runs. Every action is pinned to a full commit SHA, and Dependabot proposes npm and action updates weekly.

## Going live (one time)

None of this has been done yet. Each step changes GitHub, so take them only once the site is approved.

1. Create the public repository (GitHub Pages on the Free plan needs a public repository), with no initial files:

   ```sh
   gh repo create TowerSoftwareSystems/TowerSoftwareSystems.github.io --public
   ```

2. Push `main`:

   ```sh
   git remote add origin https://github.com/TowerSoftwareSystems/TowerSoftwareSystems.github.io.git
   git push -u origin main
   ```

   The run this push starts passes its checks but stops at "Configure Pages", because Pages is not switched on yet. That is expected.

3. Set the Pages source to GitHub Actions:

   ```sh
   gh api -X POST repos/TowerSoftwareSystems/TowerSoftwareSystems.github.io/pages -f build_type=workflow
   ```

4. Run the workflow again and confirm the first deploy:

   ```sh
   gh workflow run pages.yml --ref main
   gh run watch
   ```

   Then open https://towersoftwaresystems.github.io/ and a missing path such as https://towersoftwaresystems.github.io/nope/, which should show the 404 page.

5. Confirm that only `main` can deploy:

   ```sh
   gh api repos/TowerSoftwareSystems/TowerSoftwareSystems.github.io/environments/github-pages --jq .deployment_branch_policy
   gh api repos/TowerSoftwareSystems/TowerSoftwareSystems.github.io/environments/github-pages/deployment-branch-policies --jq '.branch_policies[].name'
   ```

   The first should show `custom_branch_policies: true`, and the second should list only `main`. If not, set Settings → Environments → github-pages → Deployment branches and tags → Selected branches and tags → `main`. That is a repository-settings change, so it needs approval like the steps above.

## Custom domain later

The site is served from `towersoftwaresystems.github.io` for now. To move it to `towersoftwaresystems.com` later, follow GitHub's guide "Managing a custom domain for your GitHub Pages site", in this order:

1. **Verify the domain for the organization first** (organization Settings → Pages → Add a domain, then the TXT record GitHub shows). Verification stops anyone else's Pages site from claiming the domain or its immediate subdomains.
2. **Add the custom domain in this repository's Pages settings before creating the DNS records**, as GitHub recommends, so the records never point at GitHub without this site claiming them. A workflow deploy needs no `CNAME` file.
3. **Create the DNS records** at the domain's DNS host:
   - apex `A`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - apex `AAAA`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `www` `CNAME`: `towersoftwaresystems.github.io`

   Do not add wildcard records, and leave the mail records alone. The apex TXT record set already holds the domain's SPF value for email. If you edit apex TXT records for any reason, keep that value, or mail from the domain stops passing SPF.
4. **Enforce HTTPS** in the Pages settings once the certificate is issued, which can take up to 24 hours.
5. **Move the canonical origin.** Change `canonicalOrigin` at the top of `scripts/validate.mjs` to `https://towersoftwaresystems.com`, then update until `npm run check` passes: the canonical link, `og:url`, `og:image` and `twitter:image` in `site/index.html`, the `<loc>` in `site/sitemap.xml`, and the `Sitemap:` line in `site/robots.txt`. Also update the host drawn on the sharing card (in `scripts/generate-og.ps1`, then regenerate `site/og.png`) and the hosting entries in `docs/claim-inventory.md`.

   Then search for the old host with `git grep -nF towersoftwaresystems.github.io` and update every remaining hit (the first paragraph of this README, the "served from" line above, and the introduction of `docs/claim-inventory.md`), except the `www` CNAME target in step 3, the one-time "Going live" steps, and this step.
