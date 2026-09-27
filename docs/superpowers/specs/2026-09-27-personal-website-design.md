# Personal website: phase 1 design

Date: 2026-09-27
Status: approved design, CEO review complete (selective expansion); engineering review next
Review record: decisions are cited as D1 to D29 from the CEO review on 2026-09-27.

## 1. Purpose

A personal portfolio for Ceylan Akyol, a QA automation engineer who is employed and expects to start job hunting within about two months.

**Primary goal:** help land a better role. Recruiters and hiring managers should understand who Ceylan is, verify their certifications, and download the CV or make contact.

**Later goals, all in the backlog:** companies buying Ceylan's tools or consulting (C), a reputation in the QA community (D), and revenue from QA learners (B).

**The idea that shapes phase 1:** the site is itself the portfolio project. Every promise it makes is traceable to the checks that prove it in the deployed build, and that evidence is public.

### Success criteria

- A hiring manager who lands on the page understands within about 90 seconds who Ceylan is and what they are good at.
- Every certification with a public credential page can be verified in one click.
- The CV downloads in one click from the top of the page.
- Mobile Lighthouse scores: performance at least 95; accessibility, best practices and SEO at 100.
- Zero WCAG 2.2 AA violations reported by axe, in both themes.
- Every requirement in section 8 is covered by at least one passing check, or nothing deploys.
- Content (certifications, about text, photo, CV) can be changed without touching layout code.
- A content edit is live within 10 minutes of saving.
- Hosting costs $0 per month.

### Constraints

- English only. No i18n routing.
- No accounts, payments, forms or stored user data.
- Claude Code builds everything. Ceylan supplies the facts about themself and reviews the result.
- Live in roughly 4 to 6 weeks, before job applications start. All accepted scope ships at launch (D10).

## 2. Scope

### In phase 1

| Item | Notes |
|---|---|
| Home page `/` | Hero with photo, about, certifications, proof strip, contact |
| Quality page `/quality` | Traceability matrix, trends, mutation summary, suites |
| CV `/cv.pdf` | Static file, replaced through the CMS |
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
- Custom domain migration: tracked in `TODOS.md` as P1, **before the URL is put on a CV that gets sent out**
- Post-launch polish (print stylesheet, security.txt, HTML CV, accessibility statement): `TODOS.md`, P3

### Considered and rejected

- **Railway hosting:** no meaningful free tier, and a running server adds cost and attack surface for a site with nothing dynamic.
- **Vercel:** the free plan does not allow commercial use, which matters once C comes out of the backlog.
- **Traditional CMS (Strapi, Payload, WordPress):** needs a database and hosting for a single editor who already works in git.
- **An experience section:** the CV covers it for phase 1.
- **A/B testing as a showcase:** traffic is far too low for a meaningful result, and it would need cookies and client-side JavaScript.
- **Authorship sign-off checkpoints and a public AI-assistance line (D5):** declined. Known risk: Ceylan must be able to explain every test decision in interviews; the decision log is the preparation for that.
- **Quality history on a git branch written by CI (D9):** rejected in favor of folding history into `quality.json`, which keeps CI read-only.

## 3. Architecture

```
 Pages CMS ──commit──┐
 IDE ─────push───────┼──▶ GitHub repo (public, main)
                     │            │
                     │            ▼  ci.yml   permissions: contents read
     ┌───────────────┴──────────────────────────────────────────────────────┐
     │  job: logic          job: fixture               job: real            │
     │  vitest, component   fixture build + og.png     real build + og.png  │
     │  tests, stryker      dist scan                  dist scan, manifest  │
     │                      wrangler dev               wrangler dev         │
     │                      playwright (5 shards)      @real, axe,          │
     │                      e2e, axe, visual           lighthouse, links    │
     └──────────┬───────────────────┬──────────────────────┬────────────────┘
                └──────────▶ job: report ◀─────────────────┘
                             traceability gate, stryker upload (D13),
                             quality.json + merged history (D9, D12, D28)
                                      │  main only
                                      ▼
                             job: deploy  (environment: production)
                             manifest check (D22), placeholder gate,
                             head SHA guard, wrangler deploy
                                      │
                                      ▼
                        Cloudflare Workers static assets
                        ceylan-akyol.<account>.workers.dev
                                      │
                                      ▼
                  smoke.yml after deploy and daily (D27)
```

- **Framework:** Astro, static output, no adapter.
- **Client JavaScript:** first-party client JavaScript is limited to reading `/quality.json` on `/` and `/quality`, bundled by Astro to `/_astro/*.js`. Both pages are fully usable without it. The Cloudflare Web Analytics beacon is the only third-party script; it is included only in the real build. JSON-LD is a non-executable data block and is not client JavaScript.
- **Hosting:** Cloudflare Workers with static assets, deployed with `wrangler deploy`. Worker name `ceylan-akyol`, which sets the `workers.dev` URL. `not_found_handling` is `404-page`. Free tier.
- **Repository:** public on GitHub. Commits use a repo-local personal email (D16).
- **Tooling:** pnpm and Node 22 LTS, pinned in `packageManager` and `.nvmrc`.
- **Fonts:** Schibsted Grotesk (SIL Open Font License), self-hosted through Fontsource, weights 400, 500 and 800 only, Latin subset (D26). A TTF copy lives in `src/og/fonts/` for OG image generation, since satori cannot read WOFF2.
- **OG image:** satori and @resvg/resvg-js in a static endpoint, with sharp for photo conversion (D7).
- **Analytics:** Cloudflare Web Analytics. No cookies, no consent banner.

## 4. Pages

Approved mockups: `assets/quality-mockups.html` and `assets/quality-mockups.png` (proof strip, `/quality` desktop, dark mode, `/quality` at 375px). Home page layout: `assets/direction-b-layout.png`, with the approved ring in `assets/photo-mark.svg`.

### `/` (single page)

In order, top to bottom:

1. **Hero:** name, title, a one-sentence tagline, a **Download CV (PDF)** button, and links to LinkedIn, GitHub and email. The photo sits on the right, inside the rose brush mark (section 6). On narrow screens the photo moves above the name. The name scales down so a 40-character name never overflows (D19).
2. **About:** a few short paragraphs rendered from Markdown.
3. **Certifications:** a heading with the note "A tick means you can verify it with the issuer." Then one entry per visible certification, newest first (rules in section 5). With zero visible certifications the whole section is omitted (D19).
4. **Proof strip (D3):** heading "How this site is tested" and one sentence built from `/quality.json`: "This page passed **N checks** in 5 browsers, has **0 accessibility violations**, and scores **N** for mobile performance." Below it, a link: "See every requirement and the tests behind it".
   - **E2E checks:** the count of passed (test, project) executions in the fixture build, excluding unit and `@smoke` tests.
   - **Accessibility violations:** axe violation count on the real build, both themes.
   - **Mobile performance:** the real build's median Lighthouse performance score.
   - **States** (`data-state` on the root): the server-rendered markup is `unavailable` and shows only the link. The script upgrades it to `ready` when `/quality.json` loads and validates. Any failure leaves it `unavailable`. The strip reserves its final height so loading causes no layout shift.
5. **Contact:** email, LinkedIn and GitHub again.
6. **Footer:** "This site is tested on every change. See how", linking to `/quality`.

There are no navigation links or "coming soon" placeholders for backlog items.

### `/quality`

Reads like a signed test report, not a dashboard. In order:

1. **Verdict:** heading "How this site is tested", then "Every promise this site makes is tied to the checks that prove it. This build passed **all N requirements** with **N checks**, and nothing ships unless every one passes." Beside it: deploy time, commit (linked), the CI run, and the source.
2. **Requirements (the traceability matrix, D6):** one row per requirement, each with the brush tick, the requirement ID and text, and coverage (check count, suites, browsers or projects). Covering tests link to GitHub permalinks pinned to the deployed commit, using `file:line` from the reporters. There is no pass or fail column, because only fully green builds deploy; the page says so. Below 640px each row becomes a stacked block (D19).
3. **Over time (D8):** three trend lines for the last 50 deploys: checks passed, mutation score, mobile performance. With fewer than 3 data points it shows "Trends appear after 3 deploys. This is deploy N." (D19).
4. **Mutation testing:** one sentence: "Stryker changed the business logic N times to plant deliberate bugs. The tests caught N." Plus a link to the full Stryker Dashboard report, shown only when the upload succeeded (D11, D13).
5. **The suites:** a short description of each suite.
6. **Pipeline duration** of the deployed run (D25).

All data blocks follow the proof strip's state pattern. Charts and rows are built with DOM APIs and `textContent` only: no `innerHTML`, no `style` attributes (D24).

Claims on this page must match what the pipeline does. For example, it says "mutation-tested business logic", never "mutation-tested site".

### `/cv.pdf`

The CV as a static file at a stable URL, so links in old emails keep working. Served with `Cache-Control: no-cache` so an updated CV is never stale (D18).

### `/404`

A short, custom not-found page with a link home. It returns HTTP 404 and carries a noindex robots tag.

### Metadata and previews (D7)

- `/` and `/quality`: Open Graph, Twitter card and canonical tags, all absolute URLs built from Astro `site`.
- `/` also carries JSON-LD `Person` (name, jobTitle, image, `sameAs` LinkedIn and GitHub). The serializer escapes `<` as `<` (D21).
- `/og.png`: 1200x630 image from a static endpoint `src/pages/og.png.ts`, built from the photo, name, title and brush mark. The photo is converted to PNG with sharp first.
- Favicon: SVG brush mark with a `prefers-color-scheme` media query inside, plus 180x180 and 32x32 PNG fallbacks.

## 5. Content model

All content lives in `src/content/` and is validated by Astro content collection schemas (Zod). Invalid content fails the build with a plain-language message, so a bad edit never reaches the live site.

### `profile.md`

Frontmatter:

| Field | Required | Rule |
|---|---|---|
| name | yes | non-empty |
| title | yes | non-empty |
| tagline | yes | at most 160 characters |
| photo | yes | jpg, png, webp or avif; at least 800px on the short side (D14) |
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
| badge | no | jpg, png, webp or avif (D14) |
| hidden | no | boolean, default false |
| placeholder | no | boolean; while true, deploy refuses (launch gate) |

The CV must be a PDF (D14).

**Display rules** (pure functions in `src/lib/`, unit and mutation tested):

- Entries with `hidden: true` are not rendered.
- Visible entries are sorted by `issueDate`, newest first.
- An entry is expired when `expiryDate` is strictly before today. An entry expiring today is still valid. Expired entries show an "Expired" label.
- An entry gets the ink tick and a **Verify credential** link only when `verifyUrl` is present.
- Functions take `today` as a parameter and never read the system clock.

### Launch gate

Real content starts as placeholder files marked `placeholder: true`. The deploy job refuses while any content file still has that flag, so fake content cannot go live.

### CMS

- **Pages CMS** (pagescms.org), configured by `.pages.yml` at the repo root, with forms that mirror the schemas above. Media fields accept only the allowed types (D14). Saving commits to `main`, which runs the pipeline.
- A unit test checks that `.pages.yml` and the Zod schemas define the same fields with the same required flags.

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

### Performance budget (D26)

- Only three font weights, Latin subset; only the 800 weight is preloaded.
- Hero photo at displayed sizes, AVIF and WebP, `fetchpriority="high"`.
- First-party JavaScript under 5 KB. Home page under 250 KB total.
- Lighthouse CI asserts these byte budgets, so a regression names its cause.

## 7. Pipeline

All workflows run on GitHub Actions. Third-party actions are pinned to commit SHAs and updated by Dependabot. Workflow-level `permissions: contents: read` (D17).

### `ci.yml`: every push to `main` and every pull request

Four jobs, the first three in parallel (D25). Budget: under 10 minutes from push to live; the measured duration is recorded in `quality.json`.

1. **logic:** install (lockfile enforced), `astro check`, Vitest unit and component tests (JSON reporter), StrykerJS on `src/lib/` (fails below 90).
2. **fixture:** build with fixture content (`tests/fixtures/content/`, plus a valid fixture `quality.json`), including `/og.png` and the test-only states page (D20). Scan `dist/` (below). Serve with `wrangler dev`. Playwright E2E and axe in five projects (Chromium, Firefox, WebKit, iPhone, Pixel), sharded by project. Visual regression on Chromium desktop and one mobile project, both themes. Lighthouse on `/` and `/quality`.
3. **real:** build with real content. Scan `dist/`, then write the SHA-256 manifest of every file (D22). Serve with `wrangler dev`. `@real` Playwright subset on Chromium (D23), axe in both themes, Lighthouse on `/` and `/quality`, internal link check. Upload the build and manifest as an artifact.
4. **report:** needs 1 to 3. Build the traceability matrix from all reports and run the gate (section 8). On `main`, upload the mutation report to the Stryker Dashboard; record its URL only on success (D13). Write `quality.json` into the real build, merging history from the live site (section 8).
5. **deploy:** `main` only, environment `production` (holds `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `STRYKER_DASHBOARD_API_KEY`, restricted to `main`). `concurrency: { group: deploy-main, cancel-in-progress: false }`. Steps: verify the manifest (refuse on any difference other than `quality.json`); refuse if any content has `placeholder: true`; skip with a job summary note if `github.sha` is no longer the head of `main` (`git ls-remote`); `wrangler deploy`.

**Dist scan** (both builds): fail on any `style=` attribute, any `<style` element, any inline `<script>` other than `type="application/ld+json"`, and, in the real build, the presence of the states page (D21).

### `smoke.yml`: after each deploy, and daily (D27)

Playwright tests tagged `@smoke` against the live URL: homepage loads, photo renders, `/cv.pdf` returns a PDF, `/404` returns 404, security and cache headers are present (D18), `/quality.json` parses with the expected top-level keys, `/og.png` returns `image/png`. After a deploy, a failure sends GitHub's failed-workflow email. On the daily run, a failure opens or updates one "Live site is failing" issue, which closes itself when the check passes again. This workflow alone has `issues: write`.

### `links-weekly.yml`: scheduled weekly (D15)

Checks every external URL, including each `verifyUrl`, with 3 retries and backoff. A link is reported only after failing on two consecutive weekly runs. Reports go to one "Broken external links" issue that is updated in place, holds the state between runs in its body, and closes itself when everything passes. It never blocks deploys. LinkedIn URLs are excluded. This workflow alone has `issues: write`.

### Other

- Dependabot for npm and GitHub Actions updates. Its pull requests go through `ci.yml`, which never reaches the `production` environment.
- GitHub account 2FA is on, since Pages CMS signs in through GitHub (D17).

## 8. Testing strategy and evidence

### Two builds

| Build | Content source | Used for |
|---|---|---|
| Fixture | `tests/fixtures/content/` and a valid fixture `quality.json` | E2E behavior, axe, visual regression, Lighthouse on populated data |
| Real | `src/content/` | `@real` E2E, axe, Lighthouse, links, deployment |

The content directory is chosen at build time by an environment variable. Fixture content is fixed and covers: an expired certification, one expiring today, a hidden one, one with every optional field empty, one with a very long name, one without a badge, and a 40-character profile name.

Content states that need different data (zero certifications, one, many; sparse and full history; matrix at many rows) are tested with the Astro Container API in Vitest, and rendered for screenshots on a test-only states page that exists only in the fixture build (D20).

Missing, malformed and hostile `quality.json` variants are served with Playwright `page.route('**/quality.json')` against the fixture build. The hostile variant contains HTML in test names, huge and negative numbers, wrong types, and a 10,000-row matrix; tests assert that nothing is injected, invalid data falls back to `unavailable`, and the page stays responsive (D24).

Tests wait for `data-state` to be `ready` or `unavailable` before screenshots and axe runs. The analytics beacon is blocked in every CI run (Playwright `page.route`, Lighthouse `blockedUrlPatterns`).

### Suites

| Suite | Tool | Runs on | What it checks |
|---|---|---|---|
| Unit | Vitest | `src/lib/`, scripts | sorting, expiry at the boundary, hidden filtering, tick rule, schema drift, traceability builder, history merge and upgrades, JSON-LD escaping, `quality.json` schema |
| Component | Vitest + Astro Container API | components | empty, single, many and long-text states |
| Mutation | StrykerJS + Vitest runner | `src/lib/` | threshold 90, expected at or near 100 |
| E2E | Playwright, 5 projects | fixture build | hero, CV, certification rules, proof strip and `/quality` states, previews, 404, headers, keyboard, reduced motion, no console errors |
| `@real` | Playwright, Chromium | real build | hero, CV is a PDF, certification count equals content files, 404, headers |
| Accessibility | @axe-core/playwright | both builds, light and dark | zero WCAG 2.2 AA violations |
| Visual regression | Playwright screenshots | fixture build, Chromium desktop and one mobile project | each page and the states page, both themes; baselines generated in the official Playwright Docker image; `pnpm test:visual:update` refreshes them |
| Performance | Lighthouse CI, mobile, `numberOfRuns: 3` | both builds, `/` and `/quality` | score budgets and byte budgets; the real build's median is recorded |
| Links | link checker (JSON report) | real build | internal links on every run; external links weekly |
| Smoke | Playwright `@smoke` | live URL | see section 7 |

### Traceability (D6)

- **Registry:** `tests/requirements.ts` lists every requirement with `id`, `text`, `source`, and optional `checks` for coverage that does not come from a tagged test (`lighthouse`, `links`, `dist-scan`, `manifest`).
- **Tags:** one token everywhere, `@REQ-XXX-NN`. Playwright takes it through `{ tag }`; Vitest puts it at the start of the test name.
- **Check inputs:** `lighthouse` reads `.lhci/assertion-results.json`, `links` reads the link checker's JSON report, `dist-scan` reads the scan's JSON output, and `manifest` is enforced by the deploy job itself. A missing or unreadable report means not covered.
- **Coverage rules:** a requirement is covered when at least one non-skipped tagged test ran and passed, or a declared check ran and passed. Skipped and `fixme` tests do not count. A test that runs in several projects counts once, with its projects listed. `@smoke` tests are excluded.
- **Gate:** CI fails when a requirement has zero coverage, when a test uses a tag that is not in the registry, or when a Vitest or Playwright test (excluding `@smoke`) has no requirement tag. The failure names the requirement or test in the job summary.
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
| REQ-A11Y-01 | Zero WCAG 2.2 AA axe violations in light and dark themes | axe |
| REQ-A11Y-02 | Skip link, logical tab order and visible focus | E2E |
| REQ-A11Y-03 | Reduced motion shows the brush mark without animation | E2E |
| REQ-PERF-01 | Mobile Lighthouse: performance at least 95, other categories 100, byte budgets met | check: lighthouse |
| REQ-LINK-01 | No broken internal links | check: links |
| REQ-NF-01 | Unknown paths return the custom 404 page with status 404 | E2E, @real |
| REQ-SEC-01 | Security headers are present on every page | E2E, @real |
| REQ-SEC-02 | Data rendered from `quality.json` cannot inject markup | E2E |
| REQ-CSP-01 | Built output has no `style` attributes, no `<style>` elements, no inline scripts other than JSON-LD, and no states page in the real build | check: dist-scan |
| REQ-CACHE-01 | Mutable files revalidate; fingerprinted assets are cached immutably | E2E |
| REQ-QUAL-01 | `/quality` and the proof strip render data, and degrade to a clear message when data is missing or invalid | E2E |
| REQ-QUAL-02 | `quality.json` conforms to its schema, and older versions upgrade without losing history | unit |
| REQ-PREV-01 | Pages have Open Graph and JSON-LD metadata, and the preview image is served | E2E |
| REQ-HEALTH-01 | No console errors (including CSP violations) on any page and data state | E2E |
| REQ-VIS-01 | Pages match approved visual baselines for each viewport and theme | visual |
| REQ-TRACE-01 | The traceability builder and gate compute coverage correctly | unit, mutation |
| REQ-DEPLOY-01 | The deployed files are exactly the tested files plus `quality.json` | check: manifest |

### `quality.json`

- Written by the report job after all suites pass. Fields: `schemaVersion`, commit, build time, CI run URL, pipeline duration, per-suite counts and key numbers (E2E executions, axe violations, Lighthouse scores, mutation score and counts), the Stryker report URL when the upload succeeded, the traceability matrix, and `history`.
- **History (D9, D12, D28):** before deploy, the report job fetches the live `/quality.json`, upgrades older `schemaVersion` entries with tested upgrade functions, appends this run, and keeps the last 50. If the live file is missing, unreadable or invalid, history starts from this run and the job summary says so. This never blocks a deploy.
- The schema is validated by a unit test. Served with `Cache-Control: no-cache` (D18).

## 9. Security

A `_headers` file sets, for every path:

- `Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that disables unused features

Caching (D18): `Cache-Control: no-cache` on `/cv.pdf`, `/quality.json` and `/og.png`; `public, max-age=31536000, immutable` on `/_astro/*`.

Astro is configured with `build.inlineStylesheets: 'never'`, and the dist scan enforces the no-inline rules. The smoke suite checks the headers; the target is an A on securityheaders.com.

Threats considered: malicious Markdown via a compromised CMS session (blocked by the CSP and the dist scan); a compromised action or package stealing the deploy token (SHA pinning, `production` environment, least-privilege permissions); JSON-LD breakout (escaped serializer); account takeover (GitHub 2FA).

The email address is shown as a plain `mailto:` link. Some spam is accepted as the cost of a one-click contact.

## 10. Failure modes

| Failure | Result |
|---|---|
| Invalid content or disallowed file saved through the CMS | Build fails with a plain message; the previous version stays live |
| `.pages.yml` and schema drift apart | Unit test fails in CI |
| Any test suite or the traceability gate fails | No deploy; the job summary names the failing requirement or test |
| OG image generation fails | Build fails; no deploy |
| Placeholder content remains | Deploy refuses |
| Build artifact differs from the tested manifest | Deploy refuses |
| A newer commit reached `main` during the run | Deploy skipped with a note; the newer run deploys |
| Live `quality.json` unreadable during history merge | History restarts from this run; warning in the job summary; deploy continues |
| Stryker Dashboard upload fails | Report link omitted from `/quality`; warning; deploy continues |
| Deploy succeeds but the live site is broken | Smoke fails and GitHub emails Ceylan; recovery per `docs/runbook.md` |
| Live site breaks between deploys | Daily smoke opens a "Live site is failing" issue |
| An issuer changes a credential URL | Weekly link check reports it after two consecutive failures |
| `quality.json` missing, malformed or hostile in the browser | Data blocks stay in the `unavailable` state; nothing is injected |
| Photo fails to load | The blush circle with the ink mark remains; alt text is present |

### Runbook (D27)

`docs/runbook.md` covers: rolling back with `wrangler rollback` **and** reverting the bad commit in git (otherwise the next CMS save redeploys it); re-running CI; where each warning appears; and swapping in the custom domain.

## 11. Repository documentation (D4)

- `README.md`, written for hiring managers: what the site proves, the live `/quality` link, how to run each suite, where each suite lives, how the traceability matrix works, and how to change `site` when the domain moves.
- `docs/decisions/NNNN-title.md`, one page each: 0001 two builds; 0002 visual regression only on fixtures; 0003 mutation testing scoped to `src/lib`; 0004 deploy the tested artifact; 0005 Pages CMS over a headless CMS; 0006 Workers over Railway and Vercel; 0007 traceability tagging; 0008 quality history in `quality.json`.
- `docs/runbook.md` (section 10).

## 12. Inputs Ceylan must provide

- A photo (head and shoulders, good light, at least 800px on the short side, JPG, PNG, WebP or AVIF) and its alt text
- Each certification: name, issuer, issue date, expiry date if any, credential ID if any, verification URL if any, badge image if any
- The CV as a PDF
- The job title as it should appear, and material for the tagline and About text (Claude drafts them, Ceylan approves)
- LinkedIn URL, GitHub username and a contact email

Accounts, all free: GitHub (with 2FA), Cloudflare, Pages CMS (GitHub login) and Stryker Dashboard (GitHub login).
