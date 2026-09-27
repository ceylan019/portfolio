# Personal website: phase 1 design

Date: 2026-09-27
Status: awaiting review

## 1. Purpose

A personal portfolio for Ceylan Akyol, a QA automation engineer who is employed and expects to start job hunting within about two months.

**Primary goal:** help land a better role. Recruiters and hiring managers should understand who Ceylan is, verify their certifications, and download the CV or make contact.

**Later goals, all in the backlog:** companies buying Ceylan's tools or consulting (C), a reputation in the QA community (D), and revenue from QA learners (B).

**The idea that shapes phase 1:** the site is itself the portfolio project. A small site, built and tested the way a strong QA engineer would build and test it, with the evidence public and checkable.

### Success criteria

- A hiring manager who lands on the page understands within about 90 seconds who Ceylan is and what they are good at.
- Every certification with a public credential page can be verified in one click.
- The CV downloads in one click from the top of the page.
- Mobile Lighthouse scores: performance at least 95; accessibility, best practices and SEO at 100.
- Zero WCAG 2.2 AA violations reported by axe, in both themes.
- Content (certifications, about text, photo, CV) can be changed without touching layout code.
- Hosting costs $0 per month.

### Constraints

- English only. No i18n routing.
- No accounts, payments, forms or stored user data.
- Claude Code builds everything. Ceylan supplies the facts about themself and reviews the result.
- Live in roughly 4 to 6 weeks, before job applications start.

## 2. Scope

### In phase 1

| Item | Notes |
|---|---|
| Home page `/` | Hero with photo, about, certifications, contact |
| Quality page `/quality` | The test and pipeline showcase |
| CV `/cv.pdf` | Static file, replaced through the CMS |
| Not found page `/404` | Custom page returning a real 404 status |
| Git-based content with Pages CMS | Content as files in the repo, optional browser editor |
| CI/CD with a full test suite | Nothing deploys unless every check passes |

### Backlog (not designed here)

- Projects section, once at least one tool is finished and public
- Study hub: ISTQB and other QA certification guides, plus interview prep. Claude drafts; Ceylan fact-checks and adds their own experience before anything is published. Never copy official ISTQB syllabus text or sample questions.
- Mock exams
- Services or tools page for companies
- Experimentation QA demo project (feature flags, bucketing tests), as a portfolio project, not on this site
- Preview deploys for pull requests (worth adding when the study hub arrives)
- Custom domain: buy it (Cloudflare Registrar suggested) **before the URL is put on a CV that gets sent out**

### Considered and rejected

- **Railway hosting:** no meaningful free tier, and a running server adds cost and attack surface for a site with nothing dynamic.
- **Vercel:** the free plan does not allow commercial use, which matters once C comes out of the backlog.
- **Traditional CMS (Strapi, Payload, WordPress):** needs a database and hosting for a single editor who already works in git.
- **An experience section:** the CV covers it for phase 1.
- **A/B testing as a showcase:** the traffic is far too low for a meaningful result, and it would need cookies and client-side JavaScript that the rest of the design avoids.

## 3. Architecture

```
 Ceylan ──edit──▶ Pages CMS ─┐
 Ceylan ──push──▶ IDE ───────┼──▶ GitHub repo (public, main)
                             │           │
                             │           ▼
                             │    GitHub Actions: test ─▶ deploy
                             │           │
                             │           ▼
                             │    Cloudflare Workers static assets
                             │    <name>.<account>.workers.dev
                             │           │
                             │           ▼
                             └── post-deploy smoke tests on the live URL
```

- **Framework:** Astro, static output, no adapter. Every page except `/quality` ships with no client JavaScript.
- **Hosting:** Cloudflare Workers with static assets, deployed with `wrangler deploy`. `not_found_handling` is set to `404-page`. Free tier.
- **Address:** the free `workers.dev` subdomain until the domain is bought.
- **Repository:** public on GitHub. The public repo and its CI history are part of the showcase.
- **Fonts:** Schibsted Grotesk (SIL Open Font License), self-hosted through Fontsource so the page makes no third-party requests and the Content Security Policy stays strict.
- **Analytics:** Cloudflare Web Analytics. No cookies, no consent banner.

## 4. Pages

### `/` (single page)

In order, top to bottom:

1. **Hero:** name, title, a one-sentence tagline, a **Download CV (PDF)** button, and links to LinkedIn, GitHub and email. The photo sits on the right, inside the rose brush mark (section 6). On narrow screens the photo moves above the name.
2. **About:** a few short paragraphs rendered from Markdown.
3. **Certifications:** a heading with the note "A tick means you can verify it with the issuer." Then one entry per visible certification, newest first. See section 5 for the rules.
4. **Contact:** email, LinkedIn and GitHub again, for people who reach the bottom.
5. **Footer:** "This site is tested on every change. See how", linking to `/quality`.

There are no navigation links or "coming soon" placeholders for backlog items.

### `/quality`

Explains the testing approach and reports real results from the CI run that produced the deployed build:

- one block per category: unit, mutation, E2E, accessibility, visual regression, Lighthouse, links, security headers
- each block shows what is checked, the latest numbers, and a link to the test code for that category
- links to the public repo, the latest GitHub Actions run and the Stryker Dashboard report
- the build date and commit hash

Numbers come from `/quality.json` (section 8), loaded by a small inline script. If the file is missing or malformed, the page still renders the explanations and shows "Latest results are unavailable" in place of the numbers.

Claims on this page must match what the pipeline actually does. For example, it says "mutation-tested business logic", never "mutation-tested site".

### `/cv.pdf`

The CV as a static file at a stable URL, so links in old emails keep working.

### `/404`

A short, custom not-found page with a link home. It returns HTTP 404.

## 5. Content model

All content lives in `src/content/` and is validated by Astro content collection schemas (Zod). Invalid content fails the build, so a bad edit never reaches the live site.

### `profile.md`

Frontmatter:

| Field | Required | Rule |
|---|---|---|
| name | yes | non-empty |
| title | yes | non-empty |
| tagline | yes | at most 160 characters |
| photo | yes | image file, optimized at build time to AVIF and WebP |
| photoAlt | yes | non-empty |
| email | yes | valid email |
| linkedinUrl | yes | valid URL |
| githubUrl | yes | valid URL |

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
| badge | no | image file |
| hidden | no | boolean, default false |

**Display rules** (pure functions in `src/lib/`, unit and mutation tested):

- Entries with `hidden: true` are not rendered.
- Visible entries are sorted by `issueDate`, newest first.
- An entry is expired when `expiryDate` is strictly before today. An entry expiring today is still valid. Expired entries show an "Expired" label.
- An entry gets the ink tick and a **Verify credential** link only when `verifyUrl` is present.
- Functions take `today` as a parameter and never read the system clock.

### CMS

- **Pages CMS** (pagescms.org), configured by `.pages.yml` at the repo root, with forms that mirror the schemas above. Photo, badge and CV uploads go to the right folders. Saving commits to `main`, which runs the pipeline.
- A unit test checks that `.pages.yml` and the Zod schemas define the same fields with the same required flags, so the two cannot drift apart.

## 6. Visual design

Direction B, "Proof marks": a reviewer's rose ink on warm petal paper. The layout reference is `assets/direction-b-layout.png`. Its ring is an earlier draft; the approved ring is `assets/photo-mark.svg`.

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

Checked contrast ratios (light): ink on bg 15.7, muted on bg 5.3, rose-text on bg 5.4, white on rose-mark 4.6. (Dark): ink 15.5, muted 6.8, rose 6.6. `--rose-mark` at 4.3 on bg is below AA for body text, so it is only used for marks, large text and the button background, never for small text. The axe suite enforces this.

Dark mode follows `prefers-color-scheme`. There is no manual toggle in phase 1.

### Type

- One family: **Schibsted Grotesk**.
- Name: weight 800, tight tracking (about -0.035em), very large (about 96px desktop, 60px mobile), set on two lines.
- Title: weight 500. Body: weight 400, line length under 70 characters.
- Sentence case everywhere. No all-caps labels.

### The brush mark

- Two tapered brush strokes circling the photo. The main stroke goes from rose to coral and overshoots past its start. A thinner peach second pass runs loosely underneath.
- Source geometry: `assets/photo-mark.svg`. In the build it becomes an inline SVG component whose colors come from the tokens above.
- The same brush style is used for the certification ticks.
- Ink marks appear in exactly two places: around the photo, and next to verifiable certifications. No other decoration.

### Motion

- One moment only: on page load the main stroke draws itself once, followed by the second pass. About 900ms total.
- With `prefers-reduced-motion: reduce` the mark is shown complete, with no animation.
- No scroll or entrance animations anywhere else. Hover and focus states change color only.

### Layout and accessibility

- Left-aligned content, max width about 1120px, 16px side gutters on mobile, no horizontal scroll.
- A skip link, a visible focus ring (2px `--rose-text` outline with offset), and a logical tab order.
- Semantic HTML: one `h1` (the name), `h2` for sections.

## 7. Pipeline

All workflows run on GitHub Actions.

### `ci.yml`: every push to `main` and every pull request

1. Install dependencies (lockfile enforced).
2. `astro check` for types.
3. Unit tests (Vitest), including the schema drift test.
4. Mutation tests (StrykerJS on `src/lib/`). Fails below a score of 90.
5. Build the **fixture** site and the **real** site (section 8).
6. Serve both with `wrangler dev` so `_headers` and 404 handling match production.
7. Playwright E2E, axe accessibility and visual regression.
8. Lighthouse CI against the budgets.
9. Internal link check.
10. Write `quality.json` into the real build's output folder.
11. On `main` only, if everything passed: `wrangler deploy` the real build as-is. It is exactly the build that was tested, plus `quality.json`.
12. Publish the mutation report to the Stryker Dashboard.

### `smoke.yml`: after each deploy

Playwright tests tagged `@smoke` run against the live URL: the homepage loads, the photo renders, `/cv.pdf` returns a PDF, `/404` returns 404, and the security headers are present. A failure sends GitHub's standard failed-workflow email. Rollback is manual with `wrangler rollback`.

### `links-weekly.yml`: scheduled weekly

Checks every external URL, including each `verifyUrl`. On failure it opens a GitHub issue. It never blocks deploys. LinkedIn URLs are excluded because LinkedIn blocks automated requests.

### Other

- Dependabot for npm and GitHub Actions updates. Its pull requests go through `ci.yml`.
- Secrets: `CLOUDFLARE_API_TOKEN` (scoped to Workers deploys), `CLOUDFLARE_ACCOUNT_ID` and `STRYKER_DASHBOARD_API_KEY`, all stored as GitHub Actions secrets.

## 8. Testing strategy

### Two builds

| Build | Content source | Used for |
|---|---|---|
| Fixture | `tests/fixtures/content/` | E2E behavior and visual regression |
| Real | `src/content/` | a11y, Lighthouse, links, smoke, and deployment |

The content directory is chosen at build time by an environment variable. Fixture content is fixed and covers the edge cases: an expired certification, one expiring today, a hidden one, one with every optional field empty, one with a very long name, and one without a badge.

Visual regression runs only on the fixture build. On real content, every CMS edit would change the screenshots and fail CI.

### Suites

| Suite | Tool | Runs on | What it checks |
|---|---|---|---|
| Unit | Vitest | `src/lib/` | sorting, expiry at the boundary, hidden filtering, tick rule, schema drift |
| Mutation | StrykerJS + Vitest runner | `src/lib/` | threshold 90; expected at or near 100 |
| E2E | Playwright: Chromium, Firefox, WebKit, iPhone and Pixel viewports | fixture build | hero content, CV link returns a PDF, entry fields, hidden absent, expired labeled, tick only with `verifyUrl`, 404 status, no console errors |
| Accessibility | @axe-core/playwright | both builds, light and dark | zero WCAG 2.2 AA violations; skip link, tab order and focus visibility tested by keyboard |
| Visual regression | Playwright screenshots | fixture build | each page × viewport × theme; baselines generated in the official Playwright Docker image; `npm run test:visual:update` refreshes them |
| Performance | Lighthouse CI, mobile preset | real build | perf ≥ 95; a11y, best practices, SEO = 100 |
| Links | link checker | real build | internal links on every run; external links weekly |
| Smoke | Playwright `@smoke` | live URL | see section 7 |

### `quality.json`

Written by CI after all suites pass. Fields: commit hash, build time, CI run URL, and per suite the test count, pass status and key numbers (mutation score, Lighthouse scores, axe violation count). `/quality` renders it. The schema is validated by a unit test.

## 9. Security

A `_headers` file sets, for every path:

- `Content-Security-Policy`: `default-src 'self'`, with a hash for the one inline script on `/quality` and an allowance for the Cloudflare Web Analytics beacon; `frame-ancestors 'none'`
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that disables unused features

The smoke suite checks these headers, and the target is an A on securityheaders.com.

The email address is shown as a plain `mailto:` link. Some spam is accepted as the cost of a one-click contact. Obfuscation would need JavaScript and would weaken the CSP.

## 10. Failure modes

| Failure | Result |
|---|---|
| Invalid content saved through the CMS | Build fails on schema validation; the previous version stays live |
| `.pages.yml` and schema drift apart | Unit test fails in CI |
| Any test suite fails | No deploy; the previous version stays live |
| Deploy succeeds but the live site is broken | Smoke tests fail and GitHub emails Ceylan; `wrangler rollback` restores the previous version |
| An issuer changes a credential URL | Weekly link check opens a GitHub issue |
| `quality.json` missing or malformed | `/quality` still renders, with "Latest results are unavailable" |
| Photo fails to load | The blush circle with the ink mark remains; alt text is present |

## 11. Inputs Ceylan must provide

- A photo (head and shoulders, good light, at least 800px square) and its alt text
- Each certification: name, issuer, issue date, expiry date if any, credential ID if any, verification URL if any, badge image if any
- The CV as a PDF
- The job title as it should appear, and material for the tagline and About text (Claude drafts them, Ceylan approves)
- LinkedIn URL, GitHub username and a contact email

Accounts, all free: GitHub, Cloudflare, Pages CMS (GitHub login) and Stryker Dashboard (GitHub login).
