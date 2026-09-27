# Personal website: phase 1 design

Date: 2026-09-27
Status: approved design; CEO review and engineering review complete; ready for the implementation plan
Review record: CEO review decisions are cited as D1 to D29, engineering review decisions as E1 to E23 (section 13).

## 1. Purpose

A personal portfolio for Ceylan Akyol, a QA automation engineer who is employed and expects to start job hunting within about two months.

**Primary goal:** help land a better role. Recruiters and hiring managers should understand who Ceylan is, verify their certifications, and download the CV or make contact.

**Later goals, all in the backlog:** companies buying Ceylan's tools or consulting (C), a reputation in the QA community (D), and revenue from QA learners (B).

**The idea that shapes phase 1:** the site is itself the portfolio project. Every promise it makes is traceable to the checks that prove it, and every public claim about testing is precisely true.

### Success criteria

- A hiring manager who lands on the page understands within about 90 seconds who Ceylan is and what they are good at.
- Every certification with a public credential page can be verified in one click.
- The CV downloads in one click from the top of the page.
- Mobile Lighthouse scores in CI: performance at least 95; accessibility, best practices and SEO at 100.
- Zero automated WCAG 2.2 AA violations reported by axe, in both themes.
- Every pre-deploy requirement in section 8 is covered by at least one check that ran against a non-empty, expected set, or nothing deploys.
- Content (certifications, about text, photo, CV) can be changed without touching layout code.
- A content edit is live within 10 minutes of saving.
- Hosting costs $0 per month.

### Constraints

- English only. No i18n routing.
- No accounts, payments, forms or stored user data.
- Claude Code builds everything. Ceylan supplies the facts about themself and reviews the result.
- Live in roughly 4 to 6 weeks, before job applications start. All accepted scope ships at launch (D10). The first production deploy happens at launch (E21).

## 2. Scope

### In phase 1

| Item | Notes |
|---|---|
| Home page `/` | Hero with photo, about, certifications, proof strip, contact |
| Quality page `/quality` | Traceability matrix, trends, mutation summary, suites, deploy integrity |
| CV `/cv.pdf` | Static file, replaced through the CMS; a public version (E18) |
| Not found page `/404` | Custom page returning a real 404 status |
| Link previews | Open Graph image, JSON-LD, favicon (D7) |
| Git-based content with Pages CMS | Content as files in the repo, optional browser editor |
| CI/CD with a full test suite | Nothing deploys unless every check passes |
| Reviewer README, decision log, runbook | For hiring managers reading the repo, and for recovery (D4, D27) |

### Backlog (not designed here)

- Projects section, once at least one tool is finished and public
- Study hub: ISTQB and other QA certification guides, plus interview prep. Claude drafts; Ceylan fact-checks and adds their own experience before anything is published. Never copy official ISTQB syllabus text or sample questions.
- Mock exams
- Services or tools page for companies
- Experimentation QA demo project (feature flags, bucketing tests), as a portfolio project, not on this site
- Preview deploys for pull requests (worth adding when the study hub arrives)
- Custom domain migration: `TODOS.md` P1, **before the URL is put on a CV that gets sent out** (kept after E20)
- Post-launch polish (print stylesheet, security.txt, HTML CV, accessibility statement): `TODOS.md`, P3

### Considered and rejected

- **Railway hosting:** no meaningful free tier, and a running server adds cost and attack surface for a site with nothing dynamic.
- **Vercel:** the free plan does not allow commercial use, which matters once C comes out of the backlog.
- **Traditional CMS (Strapi, Payload, WordPress):** needs a database and hosting for a single editor who already works in git.
- **An experience section:** the CV covers it for phase 1.
- **A/B testing as a showcase:** traffic is far too low for a meaningful result, and it would need cookies and client-side JavaScript.
- **Quality history on a git branch written by CI (D9):** rejected in favor of folding history into `quality.json`, which keeps CI read-only.
- **Scope reduction to a minimal site (E1):** offered and declined; the tested showcase is the deliverable.

### Accepted risks

- **Authorship (D5):** no sign-off checkpoints and no public AI-assistance line. Ceylan must be able to explain every test decision in interviews; the decision log is the preparation.
- **First deploy at launch (E21):** no week-1 walking skeleton. Secrets, edge headers, smoke tests and history bootstrap are first exercised in production at launch. Mitigation: `wrangler dev` parity, the runbook, and `wrangler rollback`.
- **Domain after launch (E20):** the site launches on `workers.dev`; the migration in `TODOS.md` needs a redirect Worker and re-sharing of cached previews.

## 3. Architecture

```
 Pages CMS ──commit──┐
 IDE ─────push───────┼──▶ GitHub repo (public, main)
                     │            │
                     │            ▼  ci.yml   permissions: contents read; timeout-minutes on every job
     ┌───────────────┴────────────────────────────────────────────────────────────┐
     │  job: logic              job: fixture                 job: real              │
     │  vitest unit+component   fixture build + og.png       real build + og.png    │
     │  stryker (src/lib)       dist scan                    dist scan, manifest    │
     │  main: dashboard upload  wrangler dev                  stand-in quality.json  │
     │   (version = SHA)        playwright in container      (tests only, E12)      │
     │                          (5 projects), axe, visual,   @real, axe, lhci,      │
     │                          lhci                         links                  │
     │  artifacts: reports      artifacts: reports,          artifacts: site-real,  │
     │                          lhci-fixture                 manifest-real,         │
     │                                                       lhci-real, reports     │
     └──────────┬───────────────────────┬──────────────────────────┬────────────────┘
                └────────────▶ job: report ◀────────────────────────┘   (actions: read)
                               non-empty evidence + traceability gate
                               quality.json + history (retry, fallback, E19)
                               bundles gate CLI (Node built-ins only)
                               artifacts: quality-json, gate-cli
                                        │  main only
                                        ▼
                               job: deploy  (environment: production, no npm install)
                               gate-cli: verify site-real vs manifest-real,
                               placeholders, stale SHA; copy quality.json in;
                               pinned wrangler (token only in this step)
                                        │
                                        ▼
                          Cloudflare Workers static assets
                          ceylan-akyol.<account>.workers.dev
                                        │
                                        ▼
                    smoke.yml after deploy and daily: live checks +
                    live hash check of every manifest file (REQ-DEPLOY-01)
```

- **Framework:** Astro, static output, no adapter. Config: `build.format: 'file'`, `trailingSlash: 'never'` (E22), `build.inlineStylesheets: 'never'`, `vite.build.assetsInlineLimit: 0` so scripts are never inlined into HTML (E3, commented in config).
- **Client JavaScript:** first-party client JavaScript is limited to reading `/quality.json` on `/` and `/quality`, bundled by Astro to `/_astro/*.js`. Both pages are fully usable without it. The Cloudflare Web Analytics beacon is the only third-party script; it is included only in the real build. JSON-LD is a non-executable data block and is not client JavaScript.
- **Shared data code (E6, E7):** one `quality.json` schema in `zod/mini` in `src/lib/quality-schema.ts`, used by the CI writer, the tests and the browser. One browser loader, `src/lib/quality-client.ts`, fetches once per page, validates, sets states, and hands typed data to one small renderer per data block.
- **Hosting:** Cloudflare Workers with static assets, deployed with `wrangler deploy`. Worker name `ceylan-akyol`, which sets the `workers.dev` URL. `not_found_handling` is `404-page`; default `html_handling` serves `quality.html` at `/quality`. Free tier.
- **Repository:** public on GitHub. Commits use a repo-local personal email (D16).
- **Tooling:** pnpm and Node 22 LTS, pinned in `packageManager` and `.nvmrc`.
- **Fonts:** Schibsted Grotesk (SIL Open Font License), self-hosted through Fontsource, weights 400, 500 and 800 only, Latin subset (D26). A TTF copy lives in `src/og/fonts/` for OG image generation, since satori cannot read WOFF2.
- **OG image:** satori and @resvg/resvg-js in a static endpoint, with sharp for photo conversion (D7).
- **Analytics:** Cloudflare Web Analytics. No cookies, no consent banner.

## 4. Pages

Approved mockups: `assets/quality-mockups.html` and `assets/quality-mockups.png` (proof strip, `/quality` desktop, dark mode, `/quality` at 375px). Home page layout: `assets/direction-b-layout.png`, with the approved ring in `assets/photo-mark.svg`. The proof strip and verdict text in the mockups predate E13; the wording in this section wins.

### Terms used on both pages (E13)

- **Test:** one test case in the suite (a Vitest or Playwright test).
- **Test run:** one execution of a test in one Playwright project. One test run in 5 projects is 5 test runs.
- **Browser engines:** Chromium, Firefox and WebKit. **Device profiles:** desktop Chromium, desktop Firefox, desktop WebKit, emulated iPhone (WebKit) and emulated Pixel (Chromium).

`/quality` shows these definitions in one short glossary line, and both pages use the words exactly this way.

### `/` (single page)

In order, top to bottom:

1. **Hero:** name, title, a one-sentence tagline, a **Download CV (PDF)** button, and links to LinkedIn, GitHub and email. The photo sits on the right, inside the rose brush mark (section 6). On narrow screens the photo moves above the name. The name scales down so a 40-character name never overflows (D19).
2. **About:** a few short paragraphs rendered from Markdown.
3. **Certifications:** a heading with the note "A tick means you can verify it with the issuer." Then one entry per visible certification, newest first (rules in section 5). With zero visible certifications the whole section is omitted (D19).
4. **Proof strip (D3, E2, E13):** heading "How this site is tested" and one sentence built from `/quality.json`: "This site's code passed **N test runs** across 3 browser engines and 5 device profiles, with **0 automated accessibility violations** (axe) and a Lighthouse mobile score of **N** in CI." Below it, a link: "See every requirement and the tests behind it".
   - **Test runs:** passed (test, project) executions in the fixture build, excluding unit and `@smoke` tests.
   - **Accessibility violations:** axe violation count on the real build, both themes.
   - **Lighthouse mobile score:** the real build's median performance score from CI.
   - **States:** `data-state` on the root is `unavailable` in the server-rendered markup (link only). The loader upgrades it to `ready` when `/quality.json` loads and validates; any failure leaves it `unavailable`. The loader always sets `data-settled="true"` in a `finally` block (E14). The strip reserves its final height so loading causes no layout shift.
5. **Contact:** email, LinkedIn and GitHub again.
6. **Footer:** "This site is tested on every change. See how", linking to `/quality`.

There are no navigation links or "coming soon" placeholders for backlog items.

### `/quality`

Reads like a signed test report, not a dashboard. In order:

1. **Verdict:** heading "How this site is tested", then "Every promise this site makes is tied to the checks that prove it. This build covered **all N requirements** with **N tests** (**N test runs**), and nothing ships unless every one passes." Beside it: deploy time, commit (linked), the CI run, and the source. Then the glossary line (E13) and one sentence explaining the two builds: behavior is tested on fixed test content in every engine and device profile; the real content is checked for accessibility, performance, links and key behavior before deploy.
2. **Requirements (the traceability matrix, D6):** one row per requirement, each with the brush tick, the requirement ID and text, and coverage (test count, suites, device profiles). Covering tests link to GitHub permalinks pinned to the deployed commit, using `file:line` from the reporters. There is no pass or fail column, because only fully green builds deploy; the page says so. Below 640px each row becomes a stacked block (D19).
3. **Deploy integrity (E15):** "The previous deploy was verified live: every file served matched the tested build (N files, checked at time)." Read from `quality.json`, which carries the result of the last post-deploy hash check. On the first deploy it says the check runs after this deploy.
4. **Over time (D8):** three trend lines for the last 50 deploys: test runs passed, mutation score, Lighthouse mobile score. With fewer than 3 data points it shows "Trends appear after 3 deploys. This is deploy N." (D19).
5. **Mutation testing:** one sentence: "Stryker changed the business logic N times to plant deliberate bugs. The tests caught N." Plus a link to this commit's report on the Stryker Dashboard, shown only when that upload succeeded (D11, D13, E16).
6. **The suites:** a short description of each suite.
7. **Pipeline duration** of the deployed run (D25).

All data blocks use the loader's state pattern, including `data-settled`. Charts and rows are built with DOM APIs and `textContent` only: no `innerHTML`, no `style` attributes (D24).

Claims on this page must match what the pipeline does. For example, it says "mutation-tested business logic", never "mutation-tested site".

### `/cv.pdf`

The CV as a static file at a stable URL, so links in old emails keep working. It is a public version with no phone number or home address (E18). Served with `Cache-Control: no-cache` so an updated CV is never stale (D18).

### `/404`

A short, custom not-found page with a link home. It returns HTTP 404 and carries a noindex robots tag.

### Metadata and previews (D7)

- `/` and `/quality`: Open Graph, Twitter card and canonical tags, all absolute URLs built from Astro `site`, without trailing slashes (E22).
- `/` also carries JSON-LD `Person` (name, jobTitle, image, `sameAs` LinkedIn and GitHub). The serializer escapes `<` as `<` (D21).
- `/og.png`: 1200x630 image from a static endpoint `src/pages/og.png.ts`, built from the photo, name, title and brush mark. The photo is converted to PNG with sharp first.
- Favicon: SVG brush mark with a `prefers-color-scheme` media query in an internal `<style>` (allowed, E22), plus 180x180 and 32x32 PNG fallbacks.

## 5. Content model

All content lives in `src/content/` and is validated by Astro content collection schemas (Zod). Invalid content fails the build with a plain-language message, so a bad edit never reaches the live site.

### `profile.md`

Frontmatter:

| Field | Required | Rule |
|---|---|---|
| name | yes | non-empty |
| title | yes | non-empty |
| tagline | yes | at most 160 characters |
| photo | yes | jpg, png, webp or avif; at least 800px on the short side (D14); no GPS or other identifying EXIF data (E18) |
| photoAlt | yes | non-empty |
| email | yes | valid email |
| linkedinUrl | yes | valid URL |
| githubUrl | yes | valid URL |
| placeholder | no | boolean; while true, deploy refuses (launch gate) |

Body: the About text in Markdown.

### `certifications/*.yaml` (one file per certification)

| Field | Required | Rule |
|---|---|---|
| name | yes | non-empty |
| issuer | yes | non-empty |
| issueDate | yes | valid date |
| expiryDate | no | valid date, not before issueDate |
| credentialId | no | shown on the entry when present |
| verifyUrl | no | valid URL when present |
| badge | no | jpg, png, webp or avif (D14); no GPS EXIF (E18) |
| hidden | no | boolean, default false |
| placeholder | no | boolean; while true, deploy refuses (launch gate) |

The CV must be a PDF (D14) and a public version without phone number or home address (E18).

**Display rules** (pure functions in `src/lib/`, unit and mutation tested):

- Entries with `hidden: true` are not rendered.
- Visible entries are sorted by `issueDate`, newest first.
- An entry is expired when `expiryDate` is strictly before today. An entry expiring today is still valid. Expired entries show an "Expired" label.
- An entry gets the ink tick and a **Verify credential** link only when `verifyUrl` is present.
- Functions take `today` as a parameter and never read the system clock.

### Launch gate

Real content starts as placeholder files marked `placeholder: true`. The deploy job refuses while any content file still has that flag, so fake content cannot go live.

### CMS and personal data

- **Pages CMS** (pagescms.org), configured by `.pages.yml` at the repo root, with forms that mirror the schemas above. Media fields accept only the allowed types (D14). Saving commits to `main`, which runs the pipeline.
- A unit test checks that `.pages.yml` and the Zod schemas define the same fields with the same required flags.
- **Committed files are permanent (E18).** A CMS upload is committed before CI runs, so the EXIF check blocks deployment but cannot keep a file out of history. Strip metadata before uploading (command in the runbook). For IDE commits, a local pre-commit hook runs the same EXIF check.

## 6. Visual design

Direction B, "Proof marks": a reviewer's rose ink on warm petal paper.

### Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FFF6F5` | `#1E1117` | page background |
| `--ink` | `#2C1822` | `#F8E8EB` | main text |
| `--muted` | `#7D5F69` | `#B8949F` | secondary text |
| `--rose-mark` | `#CF3F68` | `#F0729A` | brush mark, ticks, primary button background |
| `--rose-text` | `#B8325A` | `#F0729A` | link text, "Verify credential" |
| `--coral` | `#F08A5D` | `#F4A07C` | end of the brush gradient |
| `--peach` | `#F7B596` | `#C9785C` | second brush pass |
| `--blush` | `#FBE1E3` | `#2E1A23` | behind the photo |
| `--line` | `#F1D9DC` | `#3A2530` | hairlines between rows |

Checked contrast ratios (light): ink on bg 15.7, muted on bg 5.3, rose-text on bg 5.4, white on rose-mark 4.6. (Dark): ink 15.5, muted 6.8, rose 6.6. `--rose-mark` at 4.3 on the light bg is below AA for body text, so it is only used for marks, large text and the button background. In dark mode the primary button uses dark text on `--rose-mark`. The axe suite enforces contrast.

Dark mode follows `prefers-color-scheme`. There is no manual toggle in phase 1.

### Type

- One family: **Schibsted Grotesk**, weights 400, 500 and 800.
- Name: weight 800, tight tracking (about -0.035em), very large (about 96px desktop, 60px mobile), set on two lines.
- Numbers in the proof strip, verdict and trends use weight 800 inside regular sentences, with tabular figures.
- Sentence case everywhere. No all-caps labels.

### The brush mark and ticks

- Two tapered brush strokes circle the photo. The main stroke goes from rose to coral and overshoots past its start. A thinner peach second pass runs loosely underneath. Geometry: `assets/photo-mark.svg`, turned into an inline SVG component whose colors come from the tokens.
- The same brush style draws the ticks. A tick means one thing everywhere: this was checked. It appears next to verifiable certifications and next to every requirement on `/quality`.

### Motion

- One moment only: on page load the main stroke draws itself, followed by the second pass, about 900ms total. The brush is filled geometry, so the draw-in uses an SVG mask whose centerline stroke animates `stroke-dashoffset`. CSS only.
- With `prefers-reduced-motion: reduce` the mark is shown complete.
- No other animation. Hover and focus states change color only.

### Layout and accessibility

- Left-aligned content, max width about 1120px, 16px side gutters on mobile, no horizontal scroll at 375px.
- A skip link, a visible focus ring (2px `--rose-text` outline with offset), and a logical tab order.
- Semantic HTML: one `h1` per page, `h2` for sections.

### Performance budget (D26, E22)

- Only three font weights, Latin subset; only the 800 weight is preloaded.
- Hero photo at displayed sizes, AVIF and WebP, `fetchpriority="high"`.
- First-party JavaScript under 5 KB **brotli-compressed**, measured by a build test on the emitted bundle. Home page under 250 KB total transfer.
- Lighthouse CI asserts score and byte budgets, so a regression names its cause. Rerun policy: if only the performance score misses 95 on a single job, that job may be rerun once; the rerun and both scores are recorded in the job summary. A second miss is a real failure.

## 7. Pipeline

All workflows run on GitHub Actions. Third-party actions are pinned to commit SHAs and updated by Dependabot. Workflow-level `permissions: contents: read`; the report job adds `actions: read` (E19). Every job sets `timeout-minutes` at about twice its normal duration (E9).

### `ci.yml`: every push to `main` and every pull request

Five jobs; the first three run in parallel (D25). Budget: under 10 minutes from push to live; the measured duration is recorded in `quality.json`.

1. **logic:** install (lockfile enforced), `astro check`, Vitest unit and component tests (JSON reporter), a build test for the JS budget, StrykerJS on `src/lib/` (fails below 90). On `main` only, Stryker uploads to the Stryker Dashboard with version set to the full commit SHA, using the repository secret `STRYKER_DASHBOARD_API_KEY`; the job outputs whether the upload succeeded (E16).
2. **fixture:** runs inside the official Playwright container whose tag is derived from the Playwright version in the lockfile (E23). Build with fixture content (`tests/fixtures/content/`, plus a valid fixture `quality.json`), including `/og.png` and the test-only states page (D20). Dist scan. Serve with `wrangler dev`. Playwright E2E and axe in five projects (desktop Chromium, Firefox, WebKit; emulated iPhone and Pixel), sharded by project. Visual regression on desktop Chromium and emulated Pixel, both themes. Lighthouse on `/` and `/quality`. Uploads reports and `lhci-fixture` (E4).
3. **real:** build with real content. Dist scan. Write the SHA-256 manifest of every file (D22). Upload `site-real` and `manifest-real` (E5). Then, for testing only, serve the build with a stand-in `quality.json` next to it (the current live file if valid, otherwise the valid fixture) (E12); an assertion confirms `site-real` contains no `quality.json`. `@real` Playwright subset on Chromium (D23), axe in both themes, Lighthouse on `/` and `/quality`, internal link check. Uploads reports and `lhci-real`.
4. **report:** needs 1 to 3. Checks evidence (section 8), builds the traceability matrix and runs the gate. Writes `quality.json` with merged history (section 8), the mutation link only if the logic job's upload succeeded, and the last live hash result. Bundles the gate CLI (manifest verify, placeholder check, stale-SHA check) into one JavaScript file that uses only Node built-ins. Uploads `quality-json` and `gate-cli`.
5. **deploy:** `main` only, environment `production`, `concurrency: { group: deploy-main, cancel-in-progress: false }`. No `pnpm install` (E17). Downloads `site-real`, `manifest-real`, `quality-json` and `gate-cli`. Runs `gate-cli`: refuse if `site-real` differs from `manifest-real`; refuse if any content has `placeholder: true`; skip with a job summary note if `github.sha` is no longer the head of `main`. Copies `quality.json` into the site. Runs a pinned wrangler with install scripts disabled; `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are passed only to that step. The token is scoped to Workers Scripts Edit on one account.

**Dist scan** (both builds, HTML files only): fail on any `style=` attribute (any case), any `<style` element, any inline `<script>` other than `type="application/ld+json"`, and, in the real build, the presence of the states page (D21). It also asserts that it scanned a non-zero number of files including `index.html`.

### `smoke.yml`: after each deploy, and daily (D27)

Playwright tests tagged `@smoke` against the live URL: homepage loads, photo renders, `/cv.pdf` returns a PDF, `/404` returns 404, security and cache headers are present (D18), `/quality.json` parses with the expected top-level keys, `/og.png` returns `image/png`. The post-deploy run also fetches every path in the deployed manifest and compares SHA-256 hashes (REQ-DEPLOY-01, E15); its result is uploaded as an artifact that the next report job records in `quality.json`. After a deploy, a failure sends GitHub's failed-workflow email. On the daily run, a failure opens or updates one "Live site is failing" issue, which closes itself when the check passes again. This workflow has `issues: write`.

### `links-weekly.yml`: scheduled weekly (D15)

Checks every external URL, including each `verifyUrl`, with 3 retries and backoff. A link is reported only after failing on two consecutive weekly runs. Reports go to one "Broken external links" issue that is updated in place, holds the state between runs in its body, and closes itself when everything passes. It never blocks deploys. LinkedIn URLs are excluded. This workflow has `issues: write`.

### `visual-baselines.yml`: manual (E23)

`workflow_dispatch` only. Regenerates visual baselines inside the same Playwright container and uploads them as an artifact for review; no local Docker needed.

### Other

- Dependabot for npm and GitHub Actions updates, with all Playwright packages grouped into one PR (E23). Its pull requests go through `ci.yml`, which never reaches the `production` environment.
- Scheduled workflows in public repositories are disabled by GitHub after 60 days without repository activity. A monthly keepalive keeps them enabled, and the runbook describes how to check and re-enable them (E23).
- GitHub account 2FA is on, since Pages CMS signs in through GitHub (D17).

## 8. Testing strategy and evidence

### Two builds

| Build | Content source | Used for |
|---|---|---|
| Fixture | `tests/fixtures/content/` and a valid fixture `quality.json` | E2E behavior, axe, visual regression, Lighthouse on populated data |
| Real | `src/content/`, with a test-only stand-in `quality.json` (E12) | `@real` E2E, axe, Lighthouse, links, deployment |

The content directory is chosen at build time by an environment variable. The glob loader resolves `base` from the working directory, and a wrong path silently yields an empty collection; the `@real` check that rendered certifications equal the non-hidden files on disk catches this before deploy.

Fixture content is fixed and covers: an expired certification, one expiring today, a hidden one, one with every optional field empty, one with a very long name, one without a badge, a 40-character profile name, a WebP profile photo and an AVIF badge (so the sharp to satori conversion is exercised).

Content states that need different data (zero certifications, one, many; sparse and full history; matrix at many rows) are tested with the Astro Container API in Vitest, and rendered for screenshots on a test-only states page that exists only in the fixture build (D20). The Container API is experimental; Dependabot bumps that break it fail on their PR, never on `main`.

Missing, malformed, oversized and hostile `quality.json` variants are served with Playwright `page.route('**/quality.json')` against the fixture build. The hostile variant contains HTML in test names, huge and negative numbers and wrong types; oversized variants exceed the schema limits. Tests assert that nothing is injected and invalid data stays `unavailable` (D24, E10).

**Waiting rule (E14):** tests wait for `data-settled="true"`, then assert the exact expected state: `ready` for the valid fixture, `unavailable` for missing, malformed, oversized and hostile data. A unit test proves the loader sets `data-settled` on every path. The analytics beacon is blocked in every CI run (Playwright `page.route`, Lighthouse `blockedUrlPatterns`).

### Suites

| Suite | Tool | Runs on | What it checks |
|---|---|---|---|
| Unit | Vitest | `src/lib/` | certification rules, schema drift, traceability builder and evidence checks, history merge, fallbacks and upgrades, `quality.json` schema and limits, loader states, JSON-LD escaping, dist scan, manifest verify, placeholder check, stale-SHA check, issue state logic, EXIF check, timeout fallback |
| Component | Vitest + Astro Container API | components | empty, single, many and long-text states |
| Build | Vitest | emitted bundle | first-party JS under 5 KB brotli; scripts are external files |
| Mutation | StrykerJS + Vitest runner | `src/lib/` | threshold 90, expected at or near 100 |
| E2E | Playwright, 5 projects, in the Playwright container | fixture build | hero, CV, certification rules, proof strip and `/quality` states, previews, canonical URLs, 404, headers, keyboard, reduced motion, no console errors |
| `@real` | Playwright, Chromium | real build | hero, CV is a PDF, certification count equals non-hidden files, 404, headers |
| Accessibility | @axe-core/playwright | both builds, light and dark | zero automated WCAG 2.2 AA violations |
| Visual regression | Playwright screenshots | fixture build, desktop Chromium and emulated Pixel | each page and the states page, both themes; baselines regenerated by `visual-baselines.yml` |
| Performance | Lighthouse CI, mobile, `numberOfRuns: 3` | both builds, `/` and `/quality` | score and byte budgets; the real build's median is recorded |
| Links | link checker (JSON report) | real build | internal links on every run; external links weekly |
| Smoke | Playwright `@smoke` | live URL | section 7, including live hash verification |

### Traceability (D6)

- **Registry:** `tests/requirements.ts` lists every requirement with `id`, `text`, `source`, optional `checks` for coverage that does not come from a tagged test (`lighthouse`, `links`, `dist-scan`), and a `phase` of `pre-deploy` (default) or `post-deploy`.
- **Tags:** one token everywhere, `@REQ-XXX-NN`. Playwright takes it through `{ tag }`; Vitest puts it at the start of the test name.
- **Evidence rules (E15):** a check counts only if it examined a non-empty, expected set.
  - `lighthouse`: reads `.lighthouseci/assertion-results.json` and the LHR files from `lhci-real` and `lhci-fixture` (E4); requires both URLs times 3 runs per build.
  - Playwright: the merged report must contain all 5 project names; a missing shard means not covered.
  - `links`: the report must show more than 0 links checked.
  - `dist-scan`: the scan output must list a non-zero number of files including `index.html`.
  - A missing, unreadable or empty report means not covered.
- **Coverage rules:** a pre-deploy requirement is covered when at least one non-skipped tagged test ran and passed, or a declared check ran and passed under the evidence rules. Skipped and `fixme` tests do not count. A test that runs in several projects counts once, with its projects listed. `@smoke` tests are excluded from the gate.
- **Post-deploy requirements:** REQ-DEPLOY-01 is verified by `smoke.yml` after each deploy. It is not part of the pre-deploy gate; `/quality` shows its most recent result, labeled as the previous deploy's.
- **Gate:** CI fails when a pre-deploy requirement has zero coverage, when a test uses a tag that is not in the registry, or when a Vitest or Playwright test (excluding `@smoke`) has no requirement tag. The failure names the requirement or test in the job summary.
- **Builder:** pure logic in `src/lib/traceability.ts`, unit tested and inside the Stryker scope, so the gate itself is mutation tested.

**Initial requirements:**

| ID | Requirement | Covered by |
|---|---|---|
| REQ-HERO-01 | Hero shows name, title, tagline and photo with alt text | E2E, @real |
| REQ-CV-01 | CV downloads in one click from the hero; `/cv.pdf` is served as `application/pdf` | E2E, @real |
| REQ-CONTACT-01 | Email, LinkedIn and GitHub links are present in the hero and in Contact | E2E |
| REQ-CERT-01 | Visible certifications are sorted newest first | unit, E2E |
| REQ-CERT-02 | Hidden certifications are not rendered | unit, E2E |
| REQ-CERT-03 | Expired only when expiry is strictly before today; expired entries are labeled | unit, E2E |
| REQ-CERT-04 | Tick and Verify link appear only when `verifyUrl` is present | unit, E2E |
| REQ-STATE-01 | Empty, sparse and overflow states render as specified (D19) | component, visual |
| REQ-CONTENT-01 | Invalid content, including disallowed file types and small photos, fails the build | unit |
| REQ-CONTENT-02 | CMS config and content schemas define the same fields | unit |
| REQ-PRIV-01 | Images with GPS or identifying EXIF data fail the build | unit |
| REQ-A11Y-01 | Zero automated WCAG 2.2 AA axe violations in light and dark themes | axe |
| REQ-A11Y-02 | Skip link, logical tab order and visible focus | E2E |
| REQ-A11Y-03 | Reduced motion shows the brush mark without animation | E2E |
| REQ-PERF-01 | Mobile Lighthouse in CI: performance at least 95, other categories 100, byte budgets met | check: lighthouse |
| REQ-PERF-02 | First-party JavaScript under 5 KB brotli, and never inlined | build |
| REQ-LINK-01 | No broken internal links | check: links |
| REQ-NF-01 | Unknown paths return the custom 404 page with status 404 | E2E, @real |
| REQ-URL-01 | `/quality` and `/quality/` resolve to one canonical URL without a trailing slash | E2E |
| REQ-SEC-01 | Security headers are present on every page | E2E, @real |
| REQ-SEC-02 | Data rendered from `quality.json` cannot inject markup | E2E |
| REQ-CSP-01 | Built HTML has no `style` attributes, no `<style>` elements, no inline scripts other than JSON-LD, and no states page in the real build | check: dist-scan |
| REQ-CACHE-01 | Mutable files revalidate; fingerprinted assets are cached immutably | E2E |
| REQ-QUAL-01 | `/quality` and the proof strip render data, and degrade to a clear message when data is missing, invalid or oversized | E2E |
| REQ-QUAL-02 | `quality.json` conforms to its schema and limits, and older versions upgrade without losing history | unit |
| REQ-QUAL-03 | History survives transient fetch failures (retry, last-main fallback) and resets only when no history exists | unit |
| REQ-PREV-01 | Pages have Open Graph and JSON-LD metadata, and the preview image is served | E2E |
| REQ-HEALTH-01 | No console errors (including CSP violations) on any page and data state | E2E |
| REQ-VIS-01 | Pages match approved visual baselines for each viewport and theme | visual |
| REQ-TRACE-01 | The traceability builder, evidence checks and gate compute coverage correctly | unit, mutation |
| REQ-GATE-01 | The dist scanner detects every forbidden pattern | unit, mutation |
| REQ-GATE-02 | Manifest verification rejects any changed, missing or extra file | unit, mutation |
| REQ-GATE-03 | The placeholder check finds any `placeholder: true` content | unit, mutation |
| REQ-GATE-04 | The stale-SHA check skips deploys of superseded commits | unit, mutation |
| REQ-OPS-01 | Issue logic opens, updates and closes the monitoring issues correctly | unit, mutation |
| REQ-DEPLOY-01 | Every file served live matches the tested build (post-deploy) | smoke, post-deploy |

### `quality.json`

- Written by the report job after all suites pass. Fields: `schemaVersion`, commit, build time, CI run URL, pipeline duration, per-suite counts and key numbers (tests, test runs, axe violations, Lighthouse scores, mutation score and counts), the Stryker report URL when that upload succeeded, the traceability matrix, the last live hash result, and `history`.
- **Schema (E6, E10):** one `zod/mini` schema in `src/lib/quality-schema.ts`, with limits: at most 200 requirements, 50 history points, 500 test names per requirement, 200 characters per string. Anything larger is rejected.
- **History (D9, D28, E9, E19):** before deploy, the report job fetches the live `/quality.json` with a 10-second timeout.
  - A 404 means no history yet: start from this run.
  - Any other failure (timeout, 5xx, invalid): retry 3 times with backoff; if still failing, use the `quality-json` artifact of the last successful `main` run; only if that is also unavailable, start from this run with a job-summary warning.
  - Older `schemaVersion` entries are upgraded with tested functions. This run is appended and the last 50 are kept.
  - Two runs deploying close together can drop one history point; this is accepted and recorded in the decision log.
  - History never blocks a deploy.
- Served with `Cache-Control: no-cache` (D18).

## 9. Security

A `_headers` file sets, for every path:

- `Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that disables unused features

Caching (D18): `Cache-Control: no-cache` on `/cv.pdf`, `/quality.json` and `/og.png`; `public, max-age=31536000, immutable` on `/_astro/*`.

The smoke suite checks the headers; the target is an A on securityheaders.com.

**Secrets:** `CLOUDFLARE_API_TOKEN` (scoped to Workers Scripts Edit on one account) and `CLOUDFLARE_ACCOUNT_ID` live only in the `production` environment and are passed only to the wrangler step of a job that installs no npm dependencies (E17). `STRYKER_DASHBOARD_API_KEY` is a repository secret used only on `main` in the logic job; it can only overwrite this project's dashboard reports (E16).

**Threats considered:** malicious Markdown via a compromised CMS session (CSP and dist scan); a compromised action or package stealing the deploy token (SHA pinning, least-privilege permissions, no install in deploy); JSON-LD breakout (escaped serializer); account takeover (GitHub 2FA); personal data in public history (EXIF check, public CV, runbook guidance, E18).

The email address is shown as a plain `mailto:` link. Some spam is accepted as the cost of a one-click contact.

## 10. Failure modes

| Failure | Result |
|---|---|
| Invalid content or disallowed file saved through the CMS | Build fails with a plain message; the previous version stays live |
| Image with GPS or identifying EXIF uploaded | Build fails; the file is already in git history, so the runbook's removal steps apply |
| `.pages.yml` and schema drift apart | Unit test fails in CI |
| Any test suite or the traceability gate fails | No deploy; the job summary names the failing requirement or test |
| A check's report is missing, empty or incomplete (for example a missing Playwright shard) | Requirement counted as not covered; no deploy |
| Content path misconfigured, collection silently empty | `@real` count check fails; no deploy |
| OG image generation fails | Build fails; no deploy |
| Placeholder content remains | Deploy refuses |
| Build artifact differs from its manifest | Deploy refuses |
| Live site differs from the tested build | Post-deploy smoke fails; email; recovery per runbook |
| A newer commit reached `main` during the run | Deploy skipped with a note; the newer run deploys |
| Live `quality.json` returns 404 | History starts from this run |
| Live `quality.json` times out, returns 5xx or is invalid | Retry, then last-main artifact, then reset with a warning; deploy continues |
| Stryker Dashboard upload fails | Report link omitted from `/quality`; warning; deploy continues |
| Lighthouse performance misses 95 once by runner noise | One recorded rerun; a second miss fails |
| A CI step hangs | `timeout-minutes` ends the job with a clear failure |
| Deploy succeeds but the live site is broken | Smoke fails and GitHub emails Ceylan; recovery per runbook |
| Live site breaks between deploys | Daily smoke opens a "Live site is failing" issue |
| Scheduled workflows disabled after 60 quiet days | Prevented by the monthly keepalive; runbook explains the check |
| Dependabot bumps Playwright | Container tag follows the lockfile; grouped PR passes or fails as one |
| An issuer changes a credential URL | Weekly link check reports it after two consecutive failures |
| `quality.json` missing, malformed, oversized or hostile in the browser | Data blocks settle as `unavailable`; nothing is injected |
| Photo fails to load | The blush circle with the ink mark remains; alt text is present |

### Runbook (D27)

`docs/runbook.md` covers:
- rolling back with `wrangler rollback` **and** reverting the bad commit in git (otherwise the next CMS save redeploys it)
- re-running CI, and the one-rerun policy for Lighthouse noise
- where each warning appears
- regenerating visual baselines with `visual-baselines.yml`
- the 60-day scheduled-workflow rule and how to re-enable workflows
- stripping photo metadata before upload, and that committed files stay in public history (removal means rewriting history)
- swapping in the custom domain

## 11. Repository documentation (D4)

- `README.md`, written for hiring managers: what the site proves, the live `/quality` link, how to run each suite, where each suite lives, how the traceability matrix works, the public-CV rule, and how to change `site` when the domain moves.
- `docs/decisions/NNNN-title.md`, one page each: 0001 two builds; 0002 visual regression only on fixtures; 0003 mutation testing scoped to `src/lib`; 0004 deploy the tested artifact and verify it live; 0005 Pages CMS over a headless CMS; 0006 Workers over Railway and Vercel; 0007 traceability tagging and evidence rules; 0008 quality history in `quality.json`, including the accepted lost-point race.
- `docs/runbook.md` (section 10).

## 12. Inputs Ceylan must provide

- A photo (head and shoulders, good light, at least 800px on the short side, JPG, PNG, WebP or AVIF, with location metadata removed) and its alt text
- Each certification: name, issuer, issue date, expiry date if any, credential ID if any, verification URL if any, badge image if any
- The CV as a PDF: a public version without phone number or home address
- The job title as it should appear, and material for the tagline and About text (Claude drafts them, Ceylan approves)
- LinkedIn URL, GitHub username and a contact email

Accounts, all free: GitHub (with 2FA), Cloudflare, Pages CMS (GitHub login) and Stryker Dashboard (GitHub login).

## 13. Engineering review decisions (2026-09-27)

| ID | Decision |
|---|---|
| E1 | Full approved scope kept; reduction offered and declined |
| E2, E13 | Proof strip and verdict wording use "tests", "test runs", "3 browser engines and 5 device profiles", "automated (axe)" and "in CI", with a shared glossary |
| E3 | `vite.build.assetsInlineLimit: 0` so scripts are never inlined; build test proves it |
| E4 | Lighthouse reads `.lighthouseci/`; separate `lhci-fixture` and `lhci-real` artifacts; the real median is recorded |
| E5 | Immutable artifacts: `site-real`, `manifest-real` from real; `quality-json` from report; deploy assembles |
| E6 | One `zod/mini` schema shared by CI, tests and browser |
| E7 | One browser loader with one renderer per data block |
| E8 | Gate and ops logic as pure functions in `src/lib`, unit and mutation tested, with REQ-GATE-01 to 04 and REQ-OPS-01 |
| E9 | 10-second history fetch timeout; `timeout-minutes` on every job |
| E10 | Schema size limits; oversized data rejected |
| E11 | Outside voice run by an independent Claude subagent; its findings became E12 to E23 |
| E12 | Real-build tests use a stand-in `quality.json` that never enters the artifact |
| E14 | `data-settled` marker; tests wait for it and assert the exact state |
| E15 | Evidence rules require non-empty expected sets; REQ-DEPLOY-01 verified live after deploy |
| E16 | Stryker key as a repository secret; upload from logic on `main`, versioned by commit SHA |
| E17 | Deploy job installs no npm packages; bundled gate CLI and pinned wrangler; token scoped and step-local |
| E18 | EXIF/GPS check, public CV rule, runbook guidance, local pre-commit hook |
| E19 | History: 404 starts fresh; other failures retry, then use the last main artifact, then reset |
| E20 | Keep launching on `workers.dev`; domain migration stays a P1 TODO |
| E21 | No walking skeleton; first production deploy at launch (accepted risk) |
| E22 | JS budget in brotli bytes via build test; `build.format: 'file'` with `trailingSlash: 'never'`; dist scan covers HTML only (SVG favicon style allowed); one-rerun Lighthouse policy |
| E23 | Playwright container tag from the lockfile; grouped Playwright updates; manual baseline workflow; monthly keepalive for scheduled workflows |
