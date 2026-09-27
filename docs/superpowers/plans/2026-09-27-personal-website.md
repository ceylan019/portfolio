# Personal Website Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy Ceylan Akyol's QA portfolio: a static Astro site on Cloudflare Workers whose every public claim is traceable to the tests and checks that prove it.

**Architecture:** Pure, mutation-tested TypeScript logic in `src/lib` (certification rules, `quality.json` schema, history, traceability, deploy gates). An Astro 6 static site (home, `/quality`, 404, OG image) rendered from content collections and styled from `DESIGN.md` tokens, with a tiny client loader that upgrades server-rendered fallbacks with live numbers. A five-job GitHub Actions pipeline builds a fixture site and a real site, tests both, gates on traceability, and deploys the tested artifact to Workers static assets from a job that installs nothing.

**Tech Stack:** Node 22 LTS, pnpm, Astro 6, TypeScript, Zod 4 (`zod/mini` for the shared quality schema, `astro/zod` for content), Vitest, Astro Container API, Playwright with @axe-core/playwright, StrykerJS (Vitest runner), Lighthouse CI, linkinator, satori with @resvg/resvg-js and sharp, exifr, yaml, esbuild, Wrangler 4, Pages CMS.

**Spec:** `docs/superpowers/specs/2026-09-27-personal-website-design.md` (decisions D1 to D29, E1 to E23, G1 to G12). **Design system:** `DESIGN.md`. **Approved visuals:** `docs/superpowers/specs/assets/final-mockups.png` (current), `quality-mockups.png` (dark mode, 375px matrix), `photo-mark.svg` (ring).

## Global Constraints

- Node 22 LTS (`.nvmrc` = `22`), pnpm pinned in `packageManager`; every dependency pinned to an exact version in `package.json`.
- Astro static output, no adapter; `build.format: 'file'`, `trailingSlash: 'never'`, `build.inlineStylesheets: 'never'`, `vite.build.assetsInlineLimit: 0`.
- No `style` attributes, no `<style>` elements and no inline scripts in built HTML, except `<script type="application/ld+json">`. CSP: `default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`.
- First-party client JavaScript under 5 KB brotli; it only reads `/quality.json` on `/` and `/quality`. Both pages are fully usable without it.
- Client rendering uses DOM APIs and `textContent` only: never `innerHTML`, never `setAttribute('style', ...)`.
- `quality.json` limits: 200 requirements, 50 history points, 500 tests per requirement, 200 characters per string.
- Every Vitest and Playwright test (except `@smoke`) carries at least one `@REQ-XXX-NN` tag that exists in `tests/requirements.ts`.
- Dates render as "Month Year" in English ("March 2024"), computed in UTC. A certification is expired only when its expiry date is strictly before today (UTC date).
- Copy terms, exactly: "test", "test run", "3 browser engines and 5 device profiles", "automated accessibility violations (axe)", "in CI". Sentence case; no all-caps labels.
- Links open in the same tab. Link targets at least 44px tall; CV button at least 48px.
- Worker name `ceylan-akyol`; site URL `https://ceylan-akyol.<account-subdomain>.workers.dev` supplied through `SITE_URL`.
- Written text in docs, comments, commit messages and UI copy never uses a dash as sentence punctuation (no em dash, en dash or spaced hyphen joining clauses).
- Commits: small, one per task step marked "Commit"; author email is the repo-local personal address (already configured).

## Review Focus

1. **Two certifications issued in the same month** must render in a stable order (then by name, A to Z), not in filesystem order. Owner: Task 2.
2. **A visitor with JavaScript disabled** must see the fallback sentences on `/` and `/quality`, with working CV and home links and no empty holes. Owner: Task 20.
3. **A long unbroken string in real content** (a long URL in About, a long credential ID) must not cause horizontal scrolling at 375px. Owner: Task 20.
4. **A `quality.json` written by a newer schema version** (for example after a later phase ships but a visitor has an old cached script) must settle as `unavailable`, never throw. Owner: Task 3.
5. **Expiry near midnight in a non-UTC timezone** (build machine or test machine at UTC minus 5 at 23:30) must still compare UTC calendar dates. Owner: Task 2.

---

## File Structure

```
.
├── .github/
│   ├── dependabot.yml                  Task 24
│   └── workflows/
│       ├── ci.yml                      Task 23  logic, fixture, real, report, deploy, daily schedule
│       ├── smoke.yml                   Task 24  post-deploy (workflow_call) and daily
│       ├── links-weekly.yml            Task 24
│       ├── visual-baselines.yml        Task 24
│       └── keepalive.yml               Task 24
├── .githooks/pre-commit                Task 9   EXIF check for IDE commits
├── .nvmrc, package.json, tsconfig.json, .gitignore          Task 1
├── astro.config.mjs, wrangler.jsonc                          Task 1
├── vitest.config.ts                                          Task 1
├── playwright.config.ts                                      Task 20
├── stryker.config.mjs                                        Task 11
├── lighthouserc.cjs                                          Task 21
├── .pages.yml                                                Task 13
├── DESIGN.md                                                 exists
├── README.md, docs/runbook.md, docs/decisions/0001..0008     Task 25
├── public/
│   ├── _headers, robots.txt, favicon.svg                     Task 18
│   └── cv.pdf                          Task 13  placeholder until real content
├── scripts/
│   ├── make-placeholder-assets.ts      Task 13  placeholder photo and CV, fixture photo
│   ├── extract-brush-paths.ts          Task 14  reads docs/.../photo-mark.svg
│   ├── node-fs.ts                      Task 22  file walking and hashing (node only)
│   ├── scan-dist.ts                    Task 22  CLI around src/lib/dist-scan
│   ├── write-manifest.ts               Task 22
│   ├── check-content.ts                Task 9   EXIF and About rules CLI
│   ├── stand-in-quality.ts             Task 22
│   ├── build-report.ts                 Task 22  traceability gate and quality.json
│   ├── gate-cli.ts                     Task 22  bundled for deploy
│   ├── live-check.ts                   Task 24
│   └── issue-sync.ts                   Task 24
├── src/
│   ├── content.config.ts               Task 13
│   ├── content/                        Task 13  real content (placeholders at first)
│   ├── assets/uploads/                 Task 13  CMS media
│   ├── lib/                            Lane A, all pure, unit and mutation tested
│   │   ├── dates.ts, certifications.ts                       Task 2
│   │   ├── quality-schema.ts                                 Task 3
│   │   ├── history.ts                                        Task 4
│   │   ├── traceability.ts, evidence.ts, mutation.ts         Task 5
│   │   ├── dist-scan.ts                                      Task 6
│   │   ├── manifest.ts, placeholders.ts, stale-sha.ts        Task 7
│   │   ├── issue-state.ts                                    Task 8
│   │   ├── exif.ts, content-rules.ts, jsonld.ts              Task 9
│   │   ├── quality-client.ts, render-home.ts, render-quality.ts   Task 10
│   │   └── brush.ts                                          Task 14 (generated path data)
│   ├── styles/tokens.css, base.css                           Task 12
│   ├── layouts/Base.astro                                    Task 12
│   ├── components/                                           Tasks 12 to 17
│   ├── og/card.ts, og/profile-photo.ts, og/fonts/*.ttf       Task 18
│   └── pages/
│       ├── index.astro                 Task 16
│       ├── quality.astro               Task 17
│       ├── 404.astro, og.png.ts, apple-touch-icon.png.ts     Task 18
│       └── [states].astro              Task 19  fixture build only
└── tests/
    ├── requirements.ts                 Task 11
    ├── tag.ts                          Task 11  req() helper
    ├── unit/                           Lane A tests
    ├── components/                     Task 19
    ├── build/                          Task 21
    ├── e2e/                            Task 20 (and @smoke in Task 24)
    └── fixtures/
        ├── content/                    Task 13
        └── quality/                    Task 10  valid, malformed, hostile, oversized, future
```

Lanes (from the engineering review): **Lane A** (Tasks 2 to 11, `src/lib`) and **Lane D** (Task 25, docs) can run in parallel after Task 1. **Lane B** (Tasks 12 to 21, site) and **Lane C** (Tasks 22 to 24, pipeline) run after Lane A. Task 26 (launch) runs last. In a single session, execute in task order.

---

## Task 1: Project foundation

**Files:**
- Create: `package.json`, `.nvmrc`, `tsconfig.json`, `astro.config.mjs`, `wrangler.jsonc`, `vitest.config.ts`, `src/pages/index.astro` (temporary), `tests/unit/foundation.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `pnpm test:unit` (Vitest, JSON report at `reports/vitest.json`), `pnpm build` (Astro), env vars `CONTENT_DIR` (default `src/content`), `SITE_URL` (default `https://ceylan-akyol.example.workers.dev`), `BUILD_KIND` (`fixture` or `real`, default `real`).

- [ ] **Step 1: Create `.nvmrc` and `package.json`**

`.nvmrc`:
```
22
```

`package.json` (versions: run `pnpm view <pkg> version` for each and pin the exact current version; the numbers below are the minimum majors this plan was written against):
```json
{
  "name": "ceylan-akyol-site",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.18.0",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "build:fixture": "CONTENT_DIR=tests/fixtures/content BUILD_KIND=fixture astro build --outDir dist-fixture",
    "build:real": "BUILD_KIND=real astro build --outDir dist",
    "check": "astro check",
    "test:unit": "vitest run --reporter=default --reporter=json --outputFile.json=reports/vitest.json",
    "test:mutation": "stryker run",
    "test:e2e": "playwright test",
    "test:visual:update": "playwright test --grep @visual --update-snapshots",
    "serve:fixture": "wrangler dev --assets ./dist-fixture --port 8787 --local",
    "serve:real": "wrangler dev --assets ./dist-served --port 8788 --local",
    "lhci": "lhci autorun",
    "assets:placeholders": "tsx scripts/make-placeholder-assets.ts",
    "brush:extract": "tsx scripts/extract-brush-paths.ts"
  },
  "dependencies": {
    "astro": "6.3.1",
    "@fontsource/schibsted-grotesk": "5.2.0",
    "zod": "4.1.0"
  },
  "devDependencies": {
    "@astrojs/check": "0.9.4",
    "typescript": "5.9.2",
    "vitest": "3.2.4",
    "happy-dom": "18.0.1",
    "@playwright/test": "1.55.0",
    "@axe-core/playwright": "4.10.2",
    "@stryker-mutator/core": "9.1.1",
    "@stryker-mutator/vitest-runner": "9.1.1",
    "@lhci/cli": "0.15.1",
    "linkinator": "6.1.4",
    "satori": "0.18.2",
    "@resvg/resvg-js": "2.6.2",
    "sharp": "0.34.3",
    "exifr": "7.1.3",
    "yaml": "2.8.1",
    "esbuild": "0.25.9",
    "tsx": "4.20.5",
    "wrangler": "4.35.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `corepack enable && pnpm install`
Expected: lockfile `pnpm-lock.yaml` created, no errors. Then replace every version in `package.json` with the exact installed version (`pnpm list --depth 0`), so the Playwright version in `package.json` equals the lockfile (Task 23 reads it).

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "dist-fixture", "dist-served", "reports", ".lighthouseci"],
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 4: Create `astro.config.mjs`**

```js
// @ts-check
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL ?? 'https://ceylan-akyol.example.workers.dev';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    // CSP forbids inline styles (style-src 'self'); always emit CSS files.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // CSP has no 'unsafe-inline' for scripts. Astro inlines small scripts
      // below this limit, so 0 forces every script into /_astro/*.js (E3).
      assetsInlineLimit: 0,
    },
  },
});
```

- [ ] **Step 5: Create `wrangler.jsonc`**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "ceylan-akyol",
  "compatibility_date": "2026-09-01",
  "workers_dev": true,
  "preview_urls": false,
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
    "html_handling": "drop-trailing-slash"
  }
}
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.ts', 'tests/build/**/*.test.ts'],
    includeTaskLocation: true,
    globals: true,
  },
});
```

- [ ] **Step 7: Temporary page and a failing foundation test**

`src/pages/index.astro`:
```astro
---
---
<html lang="en"><head><meta charset="utf-8"><title>Ceylan Akyol</title></head><body><h1>Ceylan Akyol</h1></body></html>
```

`tests/unit/foundation.test.ts`:
```ts
import { readFileSync } from 'node:fs';

test('@REQ-PERF-02 astro config never inlines scripts or styles', () => {
  const config = readFileSync('astro.config.mjs', 'utf8');
  expect(config).toContain('assetsInlineLimit: 0');
  expect(config).toContain("inlineStylesheets: 'never'");
});
```

- [ ] **Step 8: Run the test and the build**

Run: `pnpm test:unit && pnpm build`
Expected: 1 test passes; `dist/index.html` exists.

- [ ] **Step 9: Update `.gitignore`**

Append:
```
dist-fixture/
dist-served/
reports/
.lighthouseci/
.astro/
.stryker-tmp/
test-results/
playwright-report/
.wrangler/
```

- [ ] **Step 10: Commit**

```bash
git add .nvmrc package.json pnpm-lock.yaml tsconfig.json astro.config.mjs wrangler.jsonc vitest.config.ts src/pages/index.astro tests/unit/foundation.test.ts .gitignore
git commit -m "Scaffold Astro 6 project with Vitest and Workers config"
```

---

## Task 2: Dates and certification rules

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/certifications.ts`
- Test: `tests/unit/certifications.test.ts`

**Interfaces:**
- Produces:
  - `formatMonthYear(d: Date): string` ("March 2024", UTC)
  - `utcDay(d: Date): number` (milliseconds at 00:00 UTC of that calendar day)
  - `interface Certification { id: string; name: string; issuer: string; issueDate: Date; expiryDate?: Date; credentialId?: string; verifyUrl?: string; hidden?: boolean }`
  - `type Validity = { kind: 'none' } | { kind: 'valid'; until: Date } | { kind: 'expired'; on: Date }`
  - `isExpired(c: Certification, today: Date): boolean`
  - `validity(c: Certification, today: Date): Validity`
  - `validityLabel(v: Validity): string | null`
  - `visibleCertifications(list: Certification[]): Certification[]`
  - `hasVerification(c: Certification): boolean`
  - `showTickNote(list: Certification[]): boolean`

- [ ] **Step 1: Write the failing tests**

`tests/unit/certifications.test.ts`:
```ts
import { formatMonthYear, utcDay } from '../../src/lib/dates';
import {
  type Certification, isExpired, validity, validityLabel,
  visibleCertifications, hasVerification, showTickNote,
} from '../../src/lib/certifications';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const cert = (over: Partial<Certification>): Certification => ({
  id: 'x', name: 'Cert', issuer: 'ISTQB', issueDate: d('2024-03-01'), ...over,
});

describe('dates', () => {
  test('@REQ-CERT-05 formats month and year in English, UTC', () => {
    expect(formatMonthYear(d('2024-03-01'))).toBe('March 2024');
    expect(formatMonthYear(new Date('2024-12-31T23:30:00-05:00'))).toBe('January 2025');
  });
  test('@REQ-CERT-03 utcDay drops the time of day', () => {
    expect(utcDay(new Date('2024-03-05T23:59:59Z'))).toBe(utcDay(d('2024-03-05')));
  });
});

describe('expiry', () => {
  const today = d('2026-09-27');
  test('@REQ-CERT-03 expiring today is still valid', () => {
    expect(isExpired(cert({ expiryDate: d('2026-09-27') }), today)).toBe(false);
  });
  test('@REQ-CERT-03 expired the day before is expired', () => {
    expect(isExpired(cert({ expiryDate: d('2026-09-26') }), today)).toBe(true);
  });
  test('@REQ-CERT-03 no expiry date never expires', () => {
    expect(isExpired(cert({}), today)).toBe(false);
  });
  test('@REQ-CERT-03 compares UTC calendar days even late in a negative offset evening', () => {
    const lateEvening = new Date('2026-09-27T23:30:00-05:00'); // 04:30 UTC on the 28th
    expect(isExpired(cert({ expiryDate: d('2026-09-27') }), lateEvening)).toBe(true);
    expect(isExpired(cert({ expiryDate: d('2026-09-28') }), lateEvening)).toBe(false);
  });
});

describe('validity labels', () => {
  const today = d('2026-09-27');
  test('@REQ-CERT-05 valid until', () => {
    const v = validity(cert({ expiryDate: d('2027-03-01') }), today);
    expect(v).toEqual({ kind: 'valid', until: d('2027-03-01') });
    expect(validityLabel(v)).toBe('Valid until March 2027');
  });
  test('@REQ-CERT-05 expired', () => {
    const v = validity(cert({ expiryDate: d('2024-01-15') }), today);
    expect(validityLabel(v)).toBe('Expired January 2024');
  });
  test('@REQ-CERT-05 no label without an expiry date', () => {
    expect(validityLabel(validity(cert({}), today))).toBeNull();
  });
});

describe('visible certifications', () => {
  test('@REQ-CERT-02 hidden entries are removed', () => {
    const list = [cert({ id: 'a' }), cert({ id: 'b', hidden: true })];
    expect(visibleCertifications(list).map((c) => c.id)).toEqual(['a']);
  });
  test('@REQ-CERT-01 newest first', () => {
    const list = [
      cert({ id: 'old', issueDate: d('2021-01-01') }),
      cert({ id: 'new', issueDate: d('2024-11-01') }),
      cert({ id: 'mid', issueDate: d('2024-03-01') }),
    ];
    expect(visibleCertifications(list).map((c) => c.id)).toEqual(['new', 'mid', 'old']);
  });
  test('@REQ-CERT-01 same issue date sorts by name A to Z, independent of input order', () => {
    const a = cert({ id: 'b', name: 'Beta' });
    const b = cert({ id: 'a', name: 'Alpha' });
    expect(visibleCertifications([a, b]).map((c) => c.id)).toEqual(['a', 'b']);
    expect(visibleCertifications([b, a]).map((c) => c.id)).toEqual(['a', 'b']);
  });
  test('@REQ-CERT-01 does not mutate the input', () => {
    const list = [cert({ id: 'x', issueDate: d('2020-01-01') }), cert({ id: 'y' })];
    visibleCertifications(list);
    expect(list.map((c) => c.id)).toEqual(['x', 'y']);
  });
});

describe('ticks', () => {
  test('@REQ-CERT-04 verification only with a verify URL', () => {
    expect(hasVerification(cert({ verifyUrl: 'https://verify.example/1' }))).toBe(true);
    expect(hasVerification(cert({}))).toBe(false);
    expect(hasVerification(cert({ verifyUrl: '' }))).toBe(false);
  });
  test('@REQ-CERT-06 tick note only when at least one visible entry is verifiable', () => {
    expect(showTickNote([cert({}), cert({ verifyUrl: 'https://v.example' })])).toBe(true);
    expect(showTickNote([cert({})])).toBe(false);
    expect(showTickNote([cert({ verifyUrl: 'https://v.example', hidden: true })])).toBe(false);
    expect(showTickNote([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/certifications.test.ts`
Expected: FAIL, cannot resolve `../../src/lib/dates`.

- [ ] **Step 3: Implement**

`src/lib/dates.ts`:
```ts
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** "March 2024". Always UTC so builds on any machine agree. */
export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Milliseconds at 00:00 UTC of the UTC calendar day containing `d`. */
export function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
```

`src/lib/certifications.ts`:
```ts
import { formatMonthYear, utcDay } from './dates';

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
  verifyUrl?: string;
  hidden?: boolean;
}

export type Validity =
  | { kind: 'none' }
  | { kind: 'valid'; until: Date }
  | { kind: 'expired'; on: Date };

/** Expired only when the expiry day is strictly before today's UTC day. */
export function isExpired(c: Certification, today: Date): boolean {
  if (!c.expiryDate) return false;
  return utcDay(c.expiryDate) < utcDay(today);
}

export function validity(c: Certification, today: Date): Validity {
  if (!c.expiryDate) return { kind: 'none' };
  return isExpired(c, today)
    ? { kind: 'expired', on: c.expiryDate }
    : { kind: 'valid', until: c.expiryDate };
}

export function validityLabel(v: Validity): string | null {
  if (v.kind === 'valid') return `Valid until ${formatMonthYear(v.until)}`;
  if (v.kind === 'expired') return `Expired ${formatMonthYear(v.on)}`;
  return null;
}

/** Hidden removed; newest issue date first; ties by name A to Z. */
export function visibleCertifications(list: Certification[]): Certification[] {
  return list
    .filter((c) => !c.hidden)
    .sort((a, b) => {
      const byDate = utcDay(b.issueDate) - utcDay(a.issueDate);
      return byDate !== 0 ? byDate : a.name.localeCompare(b.name, 'en');
    });
}

export function hasVerification(c: Certification): boolean {
  return typeof c.verifyUrl === 'string' && c.verifyUrl.length > 0;
}

export function showTickNote(list: Certification[]): boolean {
  return visibleCertifications(list).some(hasVerification);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/certifications.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/certifications.ts tests/unit/certifications.test.ts
git commit -m "Add certification ordering, expiry and validity rules"
```

---

## Task 3: The shared `quality.json` schema and fixtures

**Files:**
- Create: `src/lib/quality-schema.ts`
- Create: `tests/fixtures/quality/valid.json`, `tests/fixtures/quality/hostile.json`, `tests/fixtures/quality/malformed.json`, `tests/fixtures/quality/future.json`
- Test: `tests/unit/quality-schema.test.ts`

**Interfaces:**
- Produces:
  - `SCHEMA_VERSION = 1`, `LIMITS = { requirements: 200, history: 50, testsPerRequirement: 500, string: 200 }`
  - `SUITES`, `CHECKS` (readonly string tuples), types `Suite`, `CheckName`
  - `qualityReportSchema`, `historyPointSchema`, `matrixRowSchema`, `coveringTestSchema`, `liveCheckSchema` (zod/mini)
  - types `QualityReport`, `HistoryPoint`, `MatrixRow`, `CoveringTest`, `LiveCheck`
  - `parseQualityReport(input: unknown): { ok: true; data: QualityReport } | { ok: false; reason: string }`

- [ ] **Step 1: Create the fixtures**

`tests/fixtures/quality/valid.json` (used by unit tests, component tests, the fixture build and E2E):
```json
{
  "schemaVersion": 1,
  "commit": "e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901",
  "builtAt": "2026-09-27T09:14:00Z",
  "repoUrl": "https://github.com/example/ceylan-akyol-site",
  "ciRunUrl": "https://github.com/example/ceylan-akyol-site/actions/runs/1",
  "pipelineSeconds": 512,
  "counts": { "requirements": 4, "tests": 148, "testRuns": 312, "axeViolations": 0 },
  "lighthouse": { "performance": 100, "accessibility": 100, "bestPractices": 100, "seo": 100 },
  "mutation": { "score": 100, "killed": 86, "total": 86, "reportUrl": "https://dashboard.stryker-mutator.io/reports/github.com/example/ceylan-akyol-site/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901" },
  "liveCheck": { "commit": "0c1d2e3", "checkedAt": "2026-09-26T09:20:00Z", "files": 64, "ok": true },
  "matrix": [
    { "id": "REQ-CV-01", "text": "CV downloads in one click from the hero", "phase": "pre-deploy", "checks": [],
      "tests": [{ "title": "hero CV link returns a PDF", "file": "tests/e2e/home.spec.ts", "line": 12, "suite": "e2e", "projects": ["chromium", "firefox", "webkit", "iphone", "pixel"] }] },
    { "id": "REQ-CERT-03", "text": "Expired only when expiry is strictly before today", "phase": "pre-deploy", "checks": [],
      "tests": [{ "title": "expiring today is still valid", "file": "tests/unit/certifications.test.ts", "line": 27, "suite": "unit", "projects": [] }] },
    { "id": "REQ-PERF-01", "text": "Mobile Lighthouse in CI: performance at least 95", "phase": "pre-deploy", "checks": ["lighthouse"], "tests": [] },
    { "id": "REQ-DEPLOY-01", "text": "Every file served live matches the tested build", "phase": "post-deploy", "checks": [], "tests": [] }
  ],
  "history": [
    { "commit": "1111111", "date": "2026-09-16T09:00:00Z", "testRuns": 248, "mutationScore": 96, "lighthousePerformance": 97 },
    { "commit": "2222222", "date": "2026-09-17T09:00:00Z", "testRuns": 248, "mutationScore": 97, "lighthousePerformance": 98 },
    { "commit": "3333333", "date": "2026-09-18T09:00:00Z", "testRuns": 256, "mutationScore": 97, "lighthousePerformance": 98 },
    { "commit": "4444444", "date": "2026-09-19T09:00:00Z", "testRuns": 262, "mutationScore": 98, "lighthousePerformance": 99 },
    { "commit": "5555555", "date": "2026-09-20T09:00:00Z", "testRuns": 262, "mutationScore": 100, "lighthousePerformance": 98 },
    { "commit": "6666666", "date": "2026-09-21T09:00:00Z", "testRuns": 270, "mutationScore": 100, "lighthousePerformance": 99 },
    { "commit": "7777777", "date": "2026-09-22T09:00:00Z", "testRuns": 276, "mutationScore": 100, "lighthousePerformance": 100 },
    { "commit": "8888888", "date": "2026-09-23T09:00:00Z", "testRuns": 284, "mutationScore": 99, "lighthousePerformance": 99 },
    { "commit": "9999999", "date": "2026-09-24T09:00:00Z", "testRuns": 284, "mutationScore": 100, "lighthousePerformance": 100 },
    { "commit": "aaaaaaa", "date": "2026-09-25T09:00:00Z", "testRuns": 296, "mutationScore": 100, "lighthousePerformance": 100 },
    { "commit": "bbbbbbb", "date": "2026-09-26T09:00:00Z", "testRuns": 304, "mutationScore": 100, "lighthousePerformance": 99 },
    { "commit": "e5cdb92", "date": "2026-09-27T09:14:00Z", "testRuns": 312, "mutationScore": 100, "lighthousePerformance": 100 }
  ]
}
```

`tests/fixtures/quality/hostile.json`: a copy of `valid.json` with these changes (schema-valid, so it reaches the renderers):
- `matrix[0].text`: `"<img src=x onerror=\"document.body.dataset.pwned='1'\">"`
- `matrix[0].tests[0].title`: `"</script><script>document.body.dataset.pwned='1'</script>"`
- `matrix[1].tests[0].file`: `"javascript:document.body.dataset.pwned='1'"`
- `counts.testRuns`: `999999`

`tests/fixtures/quality/malformed.json` (deliberately invalid JSON):
```
{"schemaVersion": 1, "commit": "e5cdb92", "counts": {
```

`tests/fixtures/quality/future.json`: a copy of `valid.json` with `"schemaVersion": 2`.

- [ ] **Step 2: Write the failing tests**

`tests/unit/quality-schema.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { parseQualityReport, LIMITS, SCHEMA_VERSION } from '../../src/lib/quality-schema';

const load = (name: string) => JSON.parse(readFileSync(`tests/fixtures/quality/${name}.json`, 'utf8'));
const valid = () => load('valid');

test('@REQ-QUAL-02 the valid fixture parses', () => {
  const r = parseQualityReport(valid());
  expect(r.ok).toBe(true);
  expect(SCHEMA_VERSION).toBe(1);
});

test('@REQ-QUAL-02 a future schema version is rejected, not thrown', () => {
  expect(parseQualityReport(load('future')).ok).toBe(false);
});

test('@REQ-QUAL-02 wrong types are rejected', () => {
  const doc = valid();
  doc.counts.testRuns = '312';
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 negative and fractional counts are rejected', () => {
  const a = valid(); a.counts.tests = -1;
  const b = valid(); b.counts.tests = 1.5;
  expect(parseQualityReport(a).ok).toBe(false);
  expect(parseQualityReport(b).ok).toBe(false);
});

test('@REQ-QUAL-02 scores above 100 are rejected', () => {
  const doc = valid(); doc.lighthouse.performance = 101;
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 too many requirements are rejected', () => {
  const doc = valid();
  doc.matrix = Array.from({ length: LIMITS.requirements + 1 }, (_, i) => ({
    ...doc.matrix[0], id: `REQ-X-${String(i % 100).padStart(2, '0')}`,
  }));
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 too many history points are rejected', () => {
  const doc = valid();
  doc.history = Array.from({ length: LIMITS.history + 1 }, () => doc.history[0]);
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 overlong strings are rejected', () => {
  const doc = valid(); doc.matrix[0].text = 'x'.repeat(LIMITS.string + 1);
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 non-https links are rejected', () => {
  const doc = valid(); doc.ciRunUrl = 'javascript:alert(1)';
  expect(parseQualityReport(doc).ok).toBe(false);
});

test('@REQ-QUAL-02 the report URL is optional', () => {
  const doc = valid(); delete doc.mutation.reportUrl; delete doc.liveCheck;
  expect(parseQualityReport(doc).ok).toBe(true);
});

test('@REQ-QUAL-02 non-objects are rejected', () => {
  for (const x of [null, 42, 'x', [], undefined]) expect(parseQualityReport(x).ok).toBe(false);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run tests/unit/quality-schema.test.ts`
Expected: FAIL, cannot resolve `quality-schema`.

- [ ] **Step 4: Implement `src/lib/quality-schema.ts`**

```ts
// Shared by the CI writer (scripts/build-report.ts), the tests and the browser
// loader. zod/mini keeps the browser bundle inside the 5 KB budget (E6).
import * as z from 'zod/mini';

export const SCHEMA_VERSION = 1 as const;
export const LIMITS = { requirements: 200, history: 50, testsPerRequirement: 500, string: 200 } as const;

export const SUITES = ['unit', 'component', 'build', 'e2e', 'real', 'axe', 'visual'] as const;
export const CHECKS = ['lighthouse', 'links', 'dist-scan'] as const;
export type Suite = (typeof SUITES)[number];
export type CheckName = (typeof CHECKS)[number];

const text = z.string().check(z.maxLength(LIMITS.string));
const sha = z.string().check(z.regex(/^[0-9a-f]{7,40}$/));
const https = z.string().check(z.maxLength(LIMITS.string), z.startsWith('https://'));
const isoDate = z.string().check(z.maxLength(40), z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/));
const count = z.int().check(z.minimum(0), z.maximum(1_000_000));
const score = z.number().check(z.minimum(0), z.maximum(100));

export const coveringTestSchema = z.object({
  title: text,
  file: text,
  line: count,
  suite: z.enum(SUITES),
  projects: z.array(text).check(z.maxLength(10)),
});

export const matrixRowSchema = z.object({
  id: z.string().check(z.regex(/^REQ-[A-Z0-9]+-\d{2}$/)),
  text,
  phase: z.enum(['pre-deploy', 'post-deploy']),
  tests: z.array(coveringTestSchema).check(z.maxLength(LIMITS.testsPerRequirement)),
  checks: z.array(z.enum(CHECKS)).check(z.maxLength(CHECKS.length)),
});

export const historyPointSchema = z.object({
  commit: sha,
  date: isoDate,
  testRuns: count,
  mutationScore: score,
  lighthousePerformance: score,
});

export const liveCheckSchema = z.object({
  commit: sha,
  checkedAt: isoDate,
  files: count,
  ok: z.boolean(),
});

export const qualityReportSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  commit: sha,
  builtAt: isoDate,
  repoUrl: https,
  ciRunUrl: https,
  pipelineSeconds: count,
  counts: z.object({ requirements: count, tests: count, testRuns: count, axeViolations: count }),
  lighthouse: z.object({ performance: score, accessibility: score, bestPractices: score, seo: score }),
  mutation: z.object({ score, killed: count, total: count, reportUrl: z.optional(https) }),
  liveCheck: z.optional(liveCheckSchema),
  matrix: z.array(matrixRowSchema).check(z.maxLength(LIMITS.requirements)),
  history: z.array(historyPointSchema).check(z.maxLength(LIMITS.history)),
});

export type QualityReport = z.infer<typeof qualityReportSchema>;
export type HistoryPoint = z.infer<typeof historyPointSchema>;
export type MatrixRow = z.infer<typeof matrixRowSchema>;
export type CoveringTest = z.infer<typeof coveringTestSchema>;
export type LiveCheck = z.infer<typeof liveCheckSchema>;

export type ParseResult = { ok: true; data: QualityReport } | { ok: false; reason: string };

export function parseQualityReport(input: unknown): ParseResult {
  const r = qualityReportSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  return { ok: false, reason: first ? first.path.join('.') || 'root' : 'invalid' };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/unit/quality-schema.test.ts`
Expected: PASS (11 tests). If `z.int` or `z.startsWith` is reported missing, check the installed Zod 4 mini exports (`node -e "import('zod/mini').then(m=>console.log(Object.keys(m).join(' ')))"`) and use the equivalent check name; do not switch to full `zod`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quality-schema.ts tests/fixtures/quality tests/unit/quality-schema.test.ts
git commit -m "Add shared quality.json schema with size limits"
```

---

## Task 4: History merge, fallback and upgrades

**Files:**
- Create: `src/lib/history.ts`
- Test: `tests/unit/history.test.ts`

**Interfaces:**
- Consumes: `parseQualityReport`, `SCHEMA_VERSION`, `LIMITS`, `QualityReport`, `HistoryPoint` from Task 3.
- Produces:
  - `type FetchOutcome = { kind: 'ok'; body: unknown } | { kind: 'not-found' } | { kind: 'error'; reason: string }`
  - `UPGRADERS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>>` (empty at v1)
  - `upgradeToCurrent(raw: unknown): QualityReport | null`
  - `type HistorySource = { kind: 'live' | 'artifact'; history: HistoryPoint[] } | { kind: 'fresh'; warning: string | null }`
  - `resolveHistory(live: FetchOutcome, artifact: unknown): HistorySource`
  - `appendHistory(history: HistoryPoint[], point: HistoryPoint, limit?: number): HistoryPoint[]`
  - `interface FetchDeps { fetch(url: string, init: { signal: AbortSignal }): Promise<{ status: number; json(): Promise<unknown> }>; sleep(ms: number): Promise<void>; timeoutMs?: number; attempts?: number }`
  - `fetchLiveQuality(url: string, deps: FetchDeps): Promise<FetchOutcome>`

- [ ] **Step 1: Write the failing tests**

`tests/unit/history.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import {
  appendHistory, fetchLiveQuality, resolveHistory, upgradeToCurrent, UPGRADERS, type FetchDeps,
} from '../../src/lib/history';
import type { HistoryPoint } from '../../src/lib/quality-schema';

const valid = () => JSON.parse(readFileSync('tests/fixtures/quality/valid.json', 'utf8'));
const point = (commit: string): HistoryPoint => ({
  commit, date: '2026-09-28T09:00:00Z', testRuns: 320, mutationScore: 100, lighthousePerformance: 100,
});

describe('resolveHistory', () => {
  test('@REQ-QUAL-03 a 404 starts fresh without a warning', () => {
    expect(resolveHistory({ kind: 'not-found' }, valid())).toEqual({ kind: 'fresh', warning: null });
  });
  test('@REQ-QUAL-03 a valid live file is used', () => {
    const r = resolveHistory({ kind: 'ok', body: valid() }, undefined);
    expect(r.kind).toBe('live');
    if (r.kind === 'live') expect(r.history).toHaveLength(12);
  });
  test('@REQ-QUAL-03 an invalid live file falls back to the last main artifact', () => {
    const r = resolveHistory({ kind: 'ok', body: { nope: true } }, valid());
    expect(r.kind).toBe('artifact');
  });
  test('@REQ-QUAL-03 a network error falls back to the artifact', () => {
    expect(resolveHistory({ kind: 'error', reason: 'timeout' }, valid()).kind).toBe('artifact');
  });
  test('@REQ-QUAL-03 no live file and no artifact restarts with a warning naming the reason', () => {
    const r = resolveHistory({ kind: 'error', reason: 'HTTP 503' }, undefined);
    expect(r.kind).toBe('fresh');
    if (r.kind === 'fresh') expect(r.warning).toContain('HTTP 503');
  });
  test('@REQ-QUAL-03 an invalid artifact also restarts with a warning', () => {
    const r = resolveHistory({ kind: 'ok', body: null }, { broken: 1 });
    expect(r).toEqual({ kind: 'fresh', warning: expect.stringContaining('invalid') });
  });
});

describe('upgrades', () => {
  test('@REQ-QUAL-02 the current version passes through', () => {
    expect(upgradeToCurrent(valid())?.schemaVersion).toBe(1);
  });
  test('@REQ-QUAL-02 an unknown older version without an upgrader is rejected', () => {
    const doc = valid(); doc.schemaVersion = 0;
    expect(upgradeToCurrent(doc)).toBeNull();
  });
  test('@REQ-QUAL-02 a registered upgrader is applied', () => {
    const doc = valid(); doc.schemaVersion = 0; delete doc.pipelineSeconds;
    UPGRADERS[0] = (d) => ({ ...d, schemaVersion: 1, pipelineSeconds: 0 });
    try {
      expect(upgradeToCurrent(doc)?.pipelineSeconds).toBe(0);
    } finally {
      delete UPGRADERS[0];
    }
  });
  test('@REQ-QUAL-02 non-objects are rejected', () => {
    expect(upgradeToCurrent('x')).toBeNull();
    expect(upgradeToCurrent(null)).toBeNull();
  });
});

describe('appendHistory', () => {
  test('@REQ-QUAL-03 appends a new commit', () => {
    expect(appendHistory([point('aaaaaaa')], point('bbbbbbb')).map((p) => p.commit)).toEqual(['aaaaaaa', 'bbbbbbb']);
  });
  test('@REQ-QUAL-03 a scheduled rebuild of a recorded commit changes nothing', () => {
    const h = [point('aaaaaaa')];
    expect(appendHistory(h, point('aaaaaaa'))).toEqual(h);
  });
  test('@REQ-QUAL-03 keeps only the last 50', () => {
    const h = Array.from({ length: 50 }, (_, i) => point(i.toString(16).padStart(7, '0')));
    const out = appendHistory(h, point('fffffff'));
    expect(out).toHaveLength(50);
    expect(out[0]!.commit).toBe('0000001');
    expect(out[49]!.commit).toBe('fffffff');
  });
});

describe('fetchLiveQuality', () => {
  const noSleep = async () => {};
  const deps = (responses: Array<number | 'hang' | 'throw'>, extra: Partial<FetchDeps> = {}): FetchDeps & { calls: number } => {
    const d = {
      calls: 0,
      sleep: noSleep,
      timeoutMs: 20,
      fetch: (_url: string, init: { signal: AbortSignal }) => {
        const r = responses[d.calls++] ?? 500;
        if (r === 'throw') return Promise.reject(new Error('ECONNRESET'));
        if (r === 'hang') {
          return new Promise<never>((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
        }
        return Promise.resolve({ status: r, json: async () => ({ ok: r }) });
      },
      ...extra,
    };
    return d;
  };

  test('@REQ-QUAL-03 200 returns the body', async () => {
    expect(await fetchLiveQuality('u', deps([200]))).toEqual({ kind: 'ok', body: { ok: 200 } });
  });
  test('@REQ-QUAL-03 404 returns not-found without retrying', async () => {
    const d = deps([404, 200]);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'not-found' });
    expect(d.calls).toBe(1);
  });
  test('@REQ-QUAL-03 retries a 5xx and succeeds', async () => {
    const d = deps([503, 200]);
    expect((await fetchLiveQuality('u', d)).kind).toBe('ok');
    expect(d.calls).toBe(2);
  });
  test('@REQ-QUAL-03 a hanging request times out and is reported as timeout after 3 attempts', async () => {
    const d = deps(['hang', 'hang', 'hang']);
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'error', reason: 'timeout' });
    expect(d.calls).toBe(3);
  });
  test('@REQ-QUAL-03 backs off 1 s then 2 s between attempts', async () => {
    const waits: number[] = [];
    const d = deps(['throw', 'throw', 'throw'], { sleep: async (ms) => { waits.push(ms); } });
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'error', reason: 'ECONNRESET' });
    expect(waits).toEqual([1000, 2000]);
  });
  test('@REQ-QUAL-03 unparseable JSON is returned as an invalid body', async () => {
    const d = deps([200], {
      fetch: async () => ({ status: 200, json: async () => { throw new SyntaxError('bad'); } }),
    });
    expect(await fetchLiveQuality('u', d)).toEqual({ kind: 'ok', body: null });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/history.test.ts`
Expected: FAIL, cannot resolve `history`.

- [ ] **Step 3: Implement `src/lib/history.ts`**

```ts
import {
  LIMITS, SCHEMA_VERSION, parseQualityReport, type HistoryPoint, type QualityReport,
} from './quality-schema';

export type FetchOutcome =
  | { kind: 'ok'; body: unknown }
  | { kind: 'not-found' }
  | { kind: 'error'; reason: string };

type Doc = Record<string, unknown>;

/** Upgrader for version n produces version n + 1. Empty while the schema is at v1 (D28). */
export const UPGRADERS: Record<number, (doc: Doc) => Doc> = {};

const isRecord = (x: unknown): x is Doc => typeof x === 'object' && x !== null && !Array.isArray(x);

export function upgradeToCurrent(raw: unknown): QualityReport | null {
  if (!isRecord(raw)) return null;
  let doc = raw;
  while (typeof doc.schemaVersion === 'number' && doc.schemaVersion < SCHEMA_VERSION) {
    const upgrade = UPGRADERS[doc.schemaVersion];
    if (!upgrade) return null;
    doc = upgrade(doc);
  }
  const parsed = parseQualityReport(doc);
  return parsed.ok ? parsed.data : null;
}

export type HistorySource =
  | { kind: 'live' | 'artifact'; history: HistoryPoint[] }
  | { kind: 'fresh'; warning: string | null };

/**
 * E19: a 404 means no history yet. Any other failure falls back to the last
 * successful main run's artifact, and only then restarts with a warning.
 */
export function resolveHistory(live: FetchOutcome, artifact: unknown): HistorySource {
  if (live.kind === 'not-found') return { kind: 'fresh', warning: null };
  if (live.kind === 'ok') {
    const current = upgradeToCurrent(live.body);
    if (current) return { kind: 'live', history: current.history };
  }
  const fallback = artifact === undefined ? null : upgradeToCurrent(artifact);
  if (fallback) return { kind: 'artifact', history: fallback.history };
  const why = live.kind === 'error' ? live.reason : 'live quality.json invalid';
  return { kind: 'fresh', warning: `History restarted: ${why}; no valid previous artifact.` };
}

/** One point per commit (G4); keeps the newest `limit`. */
export function appendHistory(history: HistoryPoint[], point: HistoryPoint, limit: number = LIMITS.history): HistoryPoint[] {
  if (history.some((h) => h.commit === point.commit)) return history.slice(-limit);
  return [...history, point].slice(-limit);
}

export interface FetchDeps {
  fetch(url: string, init: { signal: AbortSignal }): Promise<{ status: number; json(): Promise<unknown> }>;
  sleep(ms: number): Promise<void>;
  timeoutMs?: number;
  attempts?: number;
}

export async function fetchLiveQuality(url: string, deps: FetchDeps): Promise<FetchOutcome> {
  const attempts = deps.attempts ?? 3;
  const timeoutMs = deps.timeoutMs ?? 10_000;
  let reason = 'unknown';
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await deps.sleep(1000 * 2 ** (i - 1));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await deps.fetch(url, { signal: controller.signal });
      if (res.status === 404) return { kind: 'not-found' };
      if (res.status >= 200 && res.status < 300) {
        try {
          return { kind: 'ok', body: await res.json() };
        } catch {
          return { kind: 'ok', body: null };
        }
      }
      reason = `HTTP ${res.status}`;
    } catch (error) {
      reason = controller.signal.aborted ? 'timeout' : error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
  }
  return { kind: 'error', reason };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/history.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/history.ts tests/unit/history.test.ts
git commit -m "Add quality history fetch, fallback and one-point-per-commit merge"
```

---

## Task 5: Traceability builder, evidence rules and mutation summary

**Files:**
- Create: `src/lib/traceability.ts`, `src/lib/evidence.ts`, `src/lib/mutation.ts`
- Test: `tests/unit/traceability.test.ts`, `tests/unit/evidence.test.ts`, `tests/unit/mutation.test.ts`

**Interfaces:**
- Consumes: `MatrixRow`, `CoveringTest`, `CheckName`, `Suite` from Task 3.
- Produces (`traceability.ts`):
  - `interface Requirement { id: string; text: string; source: string; phase?: 'pre-deploy' | 'post-deploy'; checks?: CheckName[] }`
  - `type ResultSuite = Suite | 'smoke'`
  - `interface TestResult { title: string; file: string; line: number; suite: ResultSuite; project: string | null; status: 'passed' | 'failed' | 'skipped'; tags: string[]; annotations: { type: string; description?: string }[] }`
  - `interface CheckEvidence { name: CheckName; passed: boolean; examined: number; detail: string }`
  - `type GateProblem = { kind: 'uncovered'; id: string } | { kind: 'unknown-tag'; tag: string; test: string } | { kind: 'untagged'; test: string } | { kind: 'missing-projects'; missing: string[] }`
  - `FIXTURE_PROJECTS = ['chromium', 'firefox', 'webkit', 'iphone', 'pixel']`, `REAL_PROJECT = 'real-chromium'`
  - `tagsIn(text: string): string[]` (ids without the leading `@`)
  - `normalizeVitest(report: unknown, rootDir: string): TestResult[]`
  - `normalizePlaywright(report: unknown, rootDir: string): TestResult[]`
  - `buildMatrix(reqs: Requirement[], results: TestResult[], evidence: CheckEvidence[]): { rows: MatrixRow[]; problems: GateProblem[]; counts: { tests: number; testRuns: number; axeViolations: number } }`
  - `describeProblem(p: GateProblem): string`
- Produces (`evidence.ts`):
  - `lighthouseEvidence(input: { lhrs: { requestedUrl: string }[]; assertions: { level: string; passed: boolean }[]; expectedUrls: string[]; runsPerUrl: number }): CheckEvidence`
  - `linksEvidence(report: unknown): CheckEvidence`
  - `distScanEvidence(report: { scanned: string[]; findings: unknown[] }): CheckEvidence`
  - `combineEvidence(items: CheckEvidence[]): CheckEvidence` (all must pass; examined summed)
  - `medianScores(lhrs: { requestedUrl: string; categories: Record<string, { score: number | null }> }[], url: string): { performance: number; accessibility: number; bestPractices: number; seo: number }`
- Produces (`mutation.ts`):
  - `mutationSummary(report: unknown): { score: number; killed: number; total: number }`

- [ ] **Step 1: Write the failing tests for tags and normalizers**

`tests/unit/traceability.test.ts`:
```ts
import {
  buildMatrix, describeProblem, normalizePlaywright, normalizeVitest, tagsIn,
  FIXTURE_PROJECTS, type Requirement, type TestResult, type CheckEvidence,
} from '../../src/lib/traceability';

const r = (over: Partial<TestResult>): TestResult => ({
  title: 't', file: 'tests/e2e/a.spec.ts', line: 1, suite: 'e2e', project: 'chromium',
  status: 'passed', tags: [], annotations: [], ...over,
});
const req = (id: string, over: Partial<Requirement> = {}): Requirement => ({ id, text: id, source: '§1', ...over });
const allProjects = (over: Partial<TestResult>) => FIXTURE_PROJECTS.map((p) => r({ ...over, project: p }));

describe('tagsIn', () => {
  test('@REQ-TRACE-01 finds requirement tags and strips the @', () => {
    expect(tagsIn('@REQ-CV-01 @REQ-A11Y-02 hero works')).toEqual(['REQ-CV-01', 'REQ-A11Y-02']);
  });
  test('@REQ-TRACE-01 ignores near misses and duplicates', () => {
    expect(tagsIn('REQ-CV-01 @REQ-cv-01 @REQ-CV-1 @REQ-CV-01 @REQ-CV-01')).toEqual(['REQ-CV-01']);
  });
});

describe('normalizeVitest', () => {
  test('@REQ-TRACE-01 maps assertion results with location and suite from the path', () => {
    const report = { testResults: [{
      name: '/repo/tests/unit/x.test.ts',
      assertionResults: [
        { fullName: 'group @REQ-CERT-01 sorts', title: '@REQ-CERT-01 sorts', status: 'passed', location: { line: 7, column: 3 } },
        { fullName: 'group skipped', title: 'skipped', status: 'pending' },
      ],
    }, { name: '/repo/tests/components/y.test.ts', assertionResults: [{ fullName: '@REQ-STATE-01 empty', title: 'e', status: 'failed' }] }] };
    const out = normalizeVitest(report, '/repo');
    expect(out).toEqual([
      { title: 'group @REQ-CERT-01 sorts', file: 'tests/unit/x.test.ts', line: 7, suite: 'unit', project: null, status: 'passed', tags: ['REQ-CERT-01'], annotations: [] },
      { title: 'group skipped', file: 'tests/unit/x.test.ts', line: 0, suite: 'unit', project: null, status: 'skipped', tags: [], annotations: [] },
      { title: '@REQ-STATE-01 empty', file: 'tests/components/y.test.ts', line: 0, suite: 'component', project: null, status: 'failed', tags: ['REQ-STATE-01'], annotations: [] },
    ]);
  });
  test('@REQ-TRACE-01 a malformed report yields no results', () => {
    expect(normalizeVitest({ nope: 1 }, '/repo')).toEqual([]);
    expect(normalizeVitest(null, '/repo')).toEqual([]);
  });
});

describe('normalizePlaywright', () => {
  const report = { suites: [{
    title: 'home.spec.ts', file: 'e2e/home.spec.ts',
    specs: [{ title: 'hero', file: 'e2e/home.spec.ts', line: 12, tags: ['@REQ-HERO-01'], tests: [
      { projectName: 'chromium', status: 'expected', annotations: [] },
      { projectName: 'webkit', status: 'skipped', annotations: [] },
    ] }],
    suites: [{ title: 'nested', specs: [{ title: 'axe @axe', file: 'e2e/a11y.spec.ts', line: 3, tags: ['@REQ-A11Y-01', '@axe'], tests: [
      { projectName: 'real-chromium', status: 'unexpected', annotations: [{ type: 'axe-violations', description: '2' }] },
    ] }] }],
  }], config: { rootDir: '/repo/tests' } };

  test('@REQ-TRACE-01 flattens nested suites into one result per project', () => {
    const out = normalizePlaywright(report, '/repo');
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ file: 'tests/e2e/home.spec.ts', line: 12, project: 'chromium', status: 'passed', suite: 'e2e', tags: ['REQ-HERO-01'] });
    expect(out[1]).toMatchObject({ project: 'webkit', status: 'skipped' });
    expect(out[2]).toMatchObject({ project: 'real-chromium', status: 'failed', suite: 'axe', annotations: [{ type: 'axe-violations', description: '2' }] });
  });
  test('@REQ-TRACE-01 suites come from tags and projects', () => {
    const tagged = (tags: string[], projectName: string) => normalizePlaywright({ suites: [{ specs: [{ title: 'x', file: 'e2e/x.spec.ts', line: 1, tags, tests: [{ projectName, status: 'expected', annotations: [] }] }] }], config: { rootDir: '/repo/tests' } }, '/repo')[0]!.suite;
    expect(tagged(['@smoke', '@REQ-CV-01'], 'smoke')).toBe('smoke');
    expect(tagged(['@visual', '@REQ-CV-01'], 'chromium')).toBe('visual');
    expect(tagged(['@REQ-CV-01'], 'real-chromium')).toBe('real');
    expect(tagged(['@REQ-CV-01'], 'chromium')).toBe('e2e');
  });
});

describe('buildMatrix', () => {
  const passLh: CheckEvidence = { name: 'lighthouse', passed: true, examined: 12, detail: '' };

  test('@REQ-TRACE-01 covers a requirement with a passing tagged test, counting projects once', () => {
    const { rows, problems } = buildMatrix([req('REQ-CV-01')], allProjects({ title: 'cv', tags: ['REQ-CV-01'] }), []);
    expect(problems).toEqual([]);
    expect(rows[0]!.tests).toEqual([{ title: 'cv', file: 'tests/e2e/a.spec.ts', line: 1, suite: 'e2e', projects: [...FIXTURE_PROJECTS] }]);
  });

  test('@REQ-TRACE-01 skipped and failed tests do not cover', () => {
    const results = [...allProjects({ title: 'other', tags: ['REQ-X-01'] }), r({ tags: ['REQ-CV-01'], status: 'skipped' }), r({ title: 'f', tags: ['REQ-CV-01'], status: 'failed' })];
    const { problems } = buildMatrix([req('REQ-CV-01'), req('REQ-X-01')], results, []);
    expect(problems).toContainEqual({ kind: 'uncovered', id: 'REQ-CV-01' });
  });

  test('@REQ-TRACE-01 a declared check covers only when it passed and examined something', () => {
    const base = allProjects({ tags: ['REQ-X-01'] });
    const reqs = [req('REQ-PERF-01', { checks: ['lighthouse'] }), req('REQ-X-01')];
    expect(buildMatrix(reqs, base, [passLh]).problems).toEqual([]);
    expect(buildMatrix(reqs, base, [{ ...passLh, examined: 0 }]).problems).toContainEqual({ kind: 'uncovered', id: 'REQ-PERF-01' });
    expect(buildMatrix(reqs, base, [{ ...passLh, passed: false }]).problems).toContainEqual({ kind: 'uncovered', id: 'REQ-PERF-01' });
    expect(buildMatrix(reqs, base, []).problems).toContainEqual({ kind: 'uncovered', id: 'REQ-PERF-01' });
  });

  test('@REQ-TRACE-01 unknown and missing tags are problems', () => {
    const results = [...allProjects({ title: 'ok', tags: ['REQ-X-01'] }), r({ title: 'typo', tags: ['REQ-XX-99'] }), r({ title: 'bare', tags: [] })];
    const { problems } = buildMatrix([req('REQ-X-01')], results, []);
    expect(problems).toContainEqual({ kind: 'unknown-tag', tag: 'REQ-XX-99', test: 'tests/e2e/a.spec.ts > typo' });
    expect(problems).toContainEqual({ kind: 'untagged', test: 'tests/e2e/a.spec.ts > bare' });
  });

  test('@REQ-TRACE-01 smoke tests are ignored by the gate', () => {
    const results = [...allProjects({ tags: ['REQ-X-01'] }), r({ suite: 'smoke', project: 'smoke', tags: [] })];
    expect(buildMatrix([req('REQ-X-01')], results, []).problems).toEqual([]);
  });

  test('@REQ-TRACE-01 a missing fixture project fails the gate (E15)', () => {
    const results = FIXTURE_PROJECTS.filter((p) => p !== 'iphone').map((p) => r({ project: p, tags: ['REQ-X-01'] }));
    expect(buildMatrix([req('REQ-X-01')], results, []).problems).toContainEqual({ kind: 'missing-projects', missing: ['iphone'] });
  });

  test('@REQ-TRACE-01 post-deploy requirements are listed but never block', () => {
    const { rows, problems } = buildMatrix([req('REQ-X-01'), req('REQ-DEPLOY-01', { phase: 'post-deploy' })], allProjects({ tags: ['REQ-X-01'] }), []);
    expect(problems).toEqual([]);
    expect(rows.find((x) => x.id === 'REQ-DEPLOY-01')!.phase).toBe('post-deploy');
  });

  test('@REQ-TRACE-01 counts unique tests, fixture test runs and axe violations', () => {
    const results = [
      ...allProjects({ title: 'a', tags: ['REQ-X-01'] }),
      r({ title: 'unit', suite: 'unit', project: null, file: 'tests/unit/u.test.ts', tags: ['REQ-X-01'] }),
      r({ title: 'real', suite: 'axe', project: 'real-chromium', tags: ['REQ-X-01'], annotations: [{ type: 'axe-violations', description: '0' }] }),
      r({ title: 'skip', tags: ['REQ-X-01'], status: 'skipped' }),
    ];
    const { counts } = buildMatrix([req('REQ-X-01')], results, []);
    expect(counts).toEqual({ tests: 3, testRuns: 5, axeViolations: 0 });
  });

  test('@REQ-TRACE-01 problems read as plain sentences', () => {
    expect(describeProblem({ kind: 'uncovered', id: 'REQ-CV-01' })).toBe('REQ-CV-01 has no passing test or check.');
    expect(describeProblem({ kind: 'missing-projects', missing: ['webkit'] })).toBe('No results from project(s): webkit.');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/traceability.test.ts`
Expected: FAIL, cannot resolve `traceability`.

- [ ] **Step 3: Implement `src/lib/traceability.ts`**

```ts
/*
 * Requirement -> test -> result (D6, E15).
 *
 *   vitest.json ─┐                 ┌─ rows (one per requirement, tests deduped, projects listed)
 *   playwright  ─┼─ TestResult[] ──┤
 *   evidence    ─┘                 └─ problems (uncovered, unknown tag, untagged, missing project)
 */
import type { CheckName, MatrixRow, CoveringTest, Suite } from './quality-schema';

export interface Requirement {
  id: string;
  text: string;
  source: string;
  phase?: 'pre-deploy' | 'post-deploy';
  checks?: CheckName[];
}
export type ResultSuite = Suite | 'smoke';
export interface TestResult {
  title: string;
  file: string;
  line: number;
  suite: ResultSuite;
  project: string | null;
  status: 'passed' | 'failed' | 'skipped';
  tags: string[];
  annotations: { type: string; description?: string }[];
}
export interface CheckEvidence { name: CheckName; passed: boolean; examined: number; detail: string }
export type GateProblem =
  | { kind: 'uncovered'; id: string }
  | { kind: 'unknown-tag'; tag: string; test: string }
  | { kind: 'untagged'; test: string }
  | { kind: 'missing-projects'; missing: string[] };

export const FIXTURE_PROJECTS = ['chromium', 'firefox', 'webkit', 'iphone', 'pixel'] as const;
export const REAL_PROJECT = 'real-chromium';

const TAG = /@(REQ-[A-Z0-9]+-\d{2})(?![\w-])/g;

export function tagsIn(text: string): string[] {
  return [...new Set([...text.matchAll(TAG)].map((m) => m[1]!))];
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const str = (x: unknown): string => (typeof x === 'string' ? x : '');
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const relative = (file: string, rootDir: string) =>
  file.startsWith(rootDir) ? file.slice(rootDir.length).replace(/^\/+/, '') : file;

function vitestSuite(file: string): Suite {
  if (file.startsWith('tests/components/')) return 'component';
  if (file.startsWith('tests/build/')) return 'build';
  return 'unit';
}

export function normalizeVitest(report: unknown, rootDir: string): TestResult[] {
  if (!isObj(report)) return [];
  return arr(report.testResults).flatMap((fileResult) => {
    if (!isObj(fileResult)) return [];
    const file = relative(str(fileResult.name), rootDir);
    return arr(fileResult.assertionResults).filter(isObj).map((a): TestResult => {
      const title = str(a.fullName) || str(a.title);
      const status = a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped';
      return {
        title, file, line: isObj(a.location) ? num(a.location.line) : 0,
        suite: vitestSuite(file), project: null, status, tags: tagsIn(title), annotations: [],
      };
    });
  });
}

function playwrightSuite(tags: string[], project: string): ResultSuite {
  if (tags.includes('@smoke') || project === 'smoke') return 'smoke';
  if (tags.includes('@visual')) return 'visual';
  if (tags.includes('@axe')) return 'axe';
  if (project === REAL_PROJECT) return 'real';
  return 'e2e';
}

export function normalizePlaywright(report: unknown, rootDir: string): TestResult[] {
  if (!isObj(report)) return [];
  const testDir = isObj(report.config) ? str(report.config.rootDir) : '';
  const out: TestResult[] = [];
  const walk = (suite: unknown) => {
    if (!isObj(suite)) return;
    for (const spec of arr(suite.specs)) {
      if (!isObj(spec)) continue;
      const rawTags = arr(spec.tags).map(str);
      const title = str(spec.title);
      const file = relative(testDir ? `${testDir}/${str(spec.file)}` : str(spec.file), rootDir);
      const tags = tagsIn(`${rawTags.join(' ')} ${title}`);
      for (const t of arr(spec.tests)) {
        if (!isObj(t)) continue;
        const project = str(t.projectName);
        const status = t.status === 'expected' ? 'passed' : t.status === 'skipped' ? 'skipped' : 'failed';
        const annotations = arr(t.annotations).filter(isObj).map((a) => ({
          type: str(a.type), ...(typeof a.description === 'string' ? { description: a.description } : {}),
        }));
        out.push({ title, file, line: num(spec.line), suite: playwrightSuite(rawTags, project), project, status, tags, annotations });
      }
    }
    for (const child of arr(suite.suites)) walk(child);
  };
  for (const s of arr(report.suites)) walk(s);
  return out;
}

const testName = (t: TestResult) => `${t.file} > ${t.title}`;

export function buildMatrix(reqs: Requirement[], results: TestResult[], evidence: CheckEvidence[]) {
  const known = new Set(reqs.map((r) => r.id));
  const gated = results.filter((t) => t.suite !== 'smoke');
  const problems: GateProblem[] = [];

  for (const t of gated) {
    if (t.tags.length === 0) problems.push({ kind: 'untagged', test: testName(t) });
    for (const tag of t.tags) if (!known.has(tag)) problems.push({ kind: 'unknown-tag', tag, test: testName(t) });
  }

  const seenProjects = new Set(gated.map((t) => t.project).filter((p): p is string => p !== null));
  const missing = FIXTURE_PROJECTS.filter((p) => !seenProjects.has(p));
  if (missing.length > 0) problems.push({ kind: 'missing-projects', missing });

  const passed = gated.filter((t) => t.status === 'passed');
  const rows: MatrixRow[] = reqs.map((req) => {
    const byTest = new Map<string, CoveringTest>();
    for (const t of passed.filter((p) => p.tags.includes(req.id))) {
      const key = testName(t);
      const existing = byTest.get(key);
      if (existing) {
        if (t.project && !existing.projects.includes(t.project)) existing.projects.push(t.project);
      } else {
        byTest.set(key, { title: t.title, file: t.file, line: t.line, suite: t.suite as Suite, projects: t.project ? [t.project] : [] });
      }
    }
    const checks = (req.checks ?? []).filter((name) =>
      evidence.some((e) => e.name === name && e.passed && e.examined > 0));
    const phase = req.phase ?? 'pre-deploy';
    if (phase === 'pre-deploy' && byTest.size === 0 && checks.length === 0) problems.push({ kind: 'uncovered', id: req.id });
    return { id: req.id, text: req.text, phase, tests: [...byTest.values()], checks };
  });

  const uniqueTests = new Set(passed.map(testName));
  const fixtureProjects: readonly string[] = FIXTURE_PROJECTS;
  const testRuns = passed.filter((t) => t.project !== null && fixtureProjects.includes(t.project)).length;
  const axeViolations = gated
    .flatMap((t) => t.annotations)
    .filter((a) => a.type === 'axe-violations')
    .reduce((sum, a) => sum + (Number.parseInt(a.description ?? '0', 10) || 0), 0);

  return { rows, problems, counts: { tests: uniqueTests.size, testRuns, axeViolations } };
}

export function describeProblem(p: GateProblem): string {
  switch (p.kind) {
    case 'uncovered': return `${p.id} has no passing test or check.`;
    case 'unknown-tag': return `${p.test} uses unknown tag ${p.tag}.`;
    case 'untagged': return `${p.test} has no requirement tag.`;
    case 'missing-projects': return `No results from project(s): ${p.missing.join(', ')}.`;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/traceability.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Write the failing evidence and mutation tests**

`tests/unit/evidence.test.ts`:
```ts
import { combineEvidence, distScanEvidence, lighthouseEvidence, linksEvidence, medianScores } from '../../src/lib/evidence';

const urls = ['http://localhost:8788/', 'http://localhost:8788/quality'];
const lhrs = (n: number) => urls.flatMap((u) => Array.from({ length: n }, () => ({ requestedUrl: u })));

test('@REQ-TRACE-01 lighthouse passes with every URL run 3 times and no error assertions', () => {
  expect(lighthouseEvidence({ lhrs: lhrs(3), assertions: [], expectedUrls: urls, runsPerUrl: 3 }))
    .toMatchObject({ name: 'lighthouse', passed: true, examined: 6 });
});
test('@REQ-TRACE-01 lighthouse fails when a URL has fewer runs', () => {
  const e = lighthouseEvidence({ lhrs: lhrs(3).slice(1), assertions: [], expectedUrls: urls, runsPerUrl: 3 });
  expect(e.passed).toBe(false);
  expect(e.detail).toContain('http://localhost:8788/');
});
test('@REQ-TRACE-01 lighthouse fails on a failed error-level assertion, not on warnings', () => {
  const base = { lhrs: lhrs(3), expectedUrls: urls, runsPerUrl: 3 };
  expect(lighthouseEvidence({ ...base, assertions: [{ level: 'warn', passed: false }] }).passed).toBe(true);
  expect(lighthouseEvidence({ ...base, assertions: [{ level: 'error', passed: false }] }).passed).toBe(false);
});
test('@REQ-TRACE-01 lighthouse with no reports examined nothing', () => {
  expect(lighthouseEvidence({ lhrs: [], assertions: [], expectedUrls: urls, runsPerUrl: 3 })).toMatchObject({ passed: false, examined: 0 });
});

test('@REQ-TRACE-01 links need a passing report with at least one checked link', () => {
  expect(linksEvidence({ passed: true, links: [{ state: 'OK' }, { state: 'SKIPPED' }] })).toMatchObject({ passed: true, examined: 1 });
  expect(linksEvidence({ passed: true, links: [{ state: 'SKIPPED' }] })).toMatchObject({ passed: false, examined: 0 });
  expect(linksEvidence({ passed: false, links: [{ state: 'BROKEN' }] }).passed).toBe(false);
  expect(linksEvidence('garbage')).toMatchObject({ passed: false, examined: 0 });
});

test('@REQ-TRACE-01 dist scan must include index.html and have no findings', () => {
  expect(distScanEvidence({ scanned: ['index.html', 'quality.html'], findings: [] })).toMatchObject({ passed: true, examined: 2 });
  expect(distScanEvidence({ scanned: ['quality.html'], findings: [] }).passed).toBe(false);
  expect(distScanEvidence({ scanned: ['index.html'], findings: [{}] }).passed).toBe(false);
});

test('@REQ-TRACE-01 combined evidence needs every part to pass', () => {
  const ok = { name: 'dist-scan' as const, passed: true, examined: 2, detail: 'a' };
  expect(combineEvidence([ok, ok])).toMatchObject({ passed: true, examined: 4 });
  expect(combineEvidence([ok, { ...ok, passed: false }]).passed).toBe(false);
  expect(combineEvidence([]).passed).toBe(false);
});

test('@REQ-PERF-01 median scores per category, scaled to 0 to 100', () => {
  const lhr = (p: number) => ({ requestedUrl: urls[0]!, categories: {
    performance: { score: p }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: null },
  } });
  expect(medianScores([lhr(0.91), lhr(0.99), lhr(0.95)], urls[0]!)).toEqual({ performance: 95, accessibility: 100, bestPractices: 100, seo: 0 });
});
```

`tests/unit/mutation.test.ts`:
```ts
import { mutationSummary } from '../../src/lib/mutation';

test('@REQ-TRACE-01 killed and timeout count as detected; no coverage counts against', () => {
  const report = { files: {
    'a.ts': { mutants: [{ status: 'Killed' }, { status: 'Timeout' }, { status: 'Survived' }] },
    'b.ts': { mutants: [{ status: 'NoCoverage' }, { status: 'CompileError' }, { status: 'Ignored' }] },
  } };
  expect(mutationSummary(report)).toEqual({ killed: 2, total: 4, score: 50 });
});
test('@REQ-TRACE-01 an empty or malformed report scores 0', () => {
  expect(mutationSummary({ files: {} })).toEqual({ killed: 0, total: 0, score: 0 });
  expect(mutationSummary(null)).toEqual({ killed: 0, total: 0, score: 0 });
});
test('@REQ-TRACE-01 score is rounded to one decimal', () => {
  const report = { files: { 'a.ts': { mutants: [{ status: 'Killed' }, { status: 'Killed' }, { status: 'Survived' }] } } };
  expect(mutationSummary(report).score).toBe(66.7);
});
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm vitest run tests/unit/evidence.test.ts tests/unit/mutation.test.ts`
Expected: FAIL, cannot resolve `evidence` and `mutation`.

- [ ] **Step 7: Implement `src/lib/evidence.ts` and `src/lib/mutation.ts`**

`src/lib/evidence.ts`:
```ts
import type { CheckEvidence } from './traceability';

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null;

export function lighthouseEvidence(input: {
  lhrs: { requestedUrl: string }[];
  assertions: { level: string; passed: boolean }[];
  expectedUrls: string[];
  runsPerUrl: number;
}): CheckEvidence {
  const short = input.expectedUrls.filter(
    (u) => input.lhrs.filter((l) => l.requestedUrl === u).length < input.runsPerUrl,
  );
  const failedErrors = input.assertions.filter((a) => a.level === 'error' && !a.passed).length;
  const passed = input.lhrs.length > 0 && short.length === 0 && failedErrors === 0;
  const detail = short.length > 0
    ? `Too few Lighthouse runs for: ${short.join(', ')}`
    : failedErrors > 0 ? `${failedErrors} Lighthouse assertion(s) failed` : `${input.lhrs.length} runs`;
  return { name: 'lighthouse', passed, examined: input.lhrs.length, detail };
}

export function linksEvidence(report: unknown): CheckEvidence {
  const links = isObj(report) && Array.isArray(report.links) ? report.links.filter(isObj) : [];
  const checked = links.filter((l) => l.state !== 'SKIPPED').length;
  const passed = isObj(report) && report.passed === true && checked > 0;
  return { name: 'links', passed, examined: checked, detail: `${checked} links checked` };
}

export function distScanEvidence(report: { scanned: string[]; findings: unknown[] }): CheckEvidence {
  const hasIndex = report.scanned.some((f) => f === 'index.html' || f.endsWith('/index.html'));
  const passed = hasIndex && report.findings.length === 0;
  return { name: 'dist-scan', passed, examined: report.scanned.length, detail: `${report.scanned.length} HTML files, ${report.findings.length} findings` };
}

export function combineEvidence(items: CheckEvidence[]): CheckEvidence {
  const [first] = items;
  if (!first) return { name: 'dist-scan', passed: false, examined: 0, detail: 'no evidence' };
  return {
    name: first.name,
    passed: items.every((i) => i.passed),
    examined: items.reduce((s, i) => s + i.examined, 0),
    detail: items.map((i) => i.detail).join('; '),
  };
}

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

export function medianScores(
  lhrs: { requestedUrl: string; categories: Record<string, { score: number | null }> }[],
  url: string,
) {
  const runs = lhrs.filter((l) => l.requestedUrl === url);
  const cat = (key: string) => Math.round(median(runs.map((r) => (r.categories[key]?.score ?? 0) * 100)));
  return { performance: cat('performance'), accessibility: cat('accessibility'), bestPractices: cat('best-practices'), seo: cat('seo') };
}
```

`src/lib/mutation.ts`:
```ts
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null;

const DETECTED = new Set(['Killed', 'Timeout']);
const UNDETECTED = new Set(['Survived', 'NoCoverage']);

/** Summarizes a mutation-testing-report-schema JSON (Stryker's json reporter). */
export function mutationSummary(report: unknown): { score: number; killed: number; total: number } {
  const files = isObj(report) && isObj(report.files) ? Object.values(report.files) : [];
  let killed = 0;
  let total = 0;
  for (const f of files) {
    const mutants = isObj(f) && Array.isArray(f.mutants) ? f.mutants : [];
    for (const m of mutants) {
      const status = isObj(m) ? m.status : undefined;
      if (typeof status !== 'string') continue;
      if (DETECTED.has(status)) { killed++; total++; } else if (UNDETECTED.has(status)) total++;
    }
  }
  const score = total === 0 ? 0 : Math.round((killed / total) * 1000) / 10;
  return { score, killed, total };
}
```

- [ ] **Step 8: Run to verify pass**

Run: `pnpm vitest run tests/unit/evidence.test.ts tests/unit/mutation.test.ts tests/unit/traceability.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/traceability.ts src/lib/evidence.ts src/lib/mutation.ts tests/unit/traceability.test.ts tests/unit/evidence.test.ts tests/unit/mutation.test.ts
git commit -m "Add traceability builder, evidence rules and mutation summary"
```

---

## Task 6: Built HTML scanner

**Files:**
- Create: `src/lib/dist-scan.ts`
- Test: `tests/unit/dist-scan.test.ts`

**Interfaces:**
- Produces:
  - `type FindingRule = 'style-attr' | 'style-element' | 'inline-script' | 'states-page'`
  - `interface Finding { file: string; rule: FindingRule; excerpt: string }`
  - `scanHtml(file: string, html: string): Finding[]`
  - `scanFiles(files: { path: string; html: string }[], opts: { forbidStatesPage: boolean }): { scanned: string[]; findings: Finding[] }`
  - `STATES_PAGE = '__states.html'`

- [ ] **Step 1: Write the failing tests**

`tests/unit/dist-scan.test.ts`:
```ts
import { scanFiles, scanHtml, STATES_PAGE } from '../../src/lib/dist-scan';

const rules = (html: string) => scanHtml('index.html', html).map((f) => f.rule);

test('@REQ-GATE-01 clean HTML has no findings', () => {
  expect(rules('<html><head><link rel="stylesheet" href="/_astro/a.css"><script type="module" src="/_astro/b.js"></script></head><body data-style="x"><p>style=plain text</p><noscript>hi</noscript></body></html>')).toEqual([]);
});
test('@REQ-GATE-01 style attributes in any case are found', () => {
  expect(rules('<div style="color:red">')).toEqual(['style-attr']);
  expect(rules('<DIV STYLE = "x">')).toEqual(['style-attr']);
  expect(rules('<svg><path d="M0" style="fill:red"/></svg>')).toEqual(['style-attr']);
});
test('@REQ-GATE-01 style elements, including inside inline SVG, are found', () => {
  expect(rules('<style>p{}</style>')).toEqual(['style-element']);
  expect(rules('<svg><style>.a{}</style></svg>')).toEqual(['style-element']);
  expect(rules('<STYLE media="x">')).toEqual(['style-element']);
});
test('@REQ-GATE-01 inline scripts are found; external and JSON-LD scripts are allowed', () => {
  expect(rules('<script>alert(1)</script>')).toEqual(['inline-script']);
  expect(rules('<script type="module">x()</script>')).toEqual(['inline-script']);
  expect(rules('<script type="application/ld+json">{}</script>')).toEqual([]);
  expect(rules("<script type='application/ld+json'>{}</script>")).toEqual([]);
  expect(rules('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{}"></script>')).toEqual([]);
});
test('@REQ-GATE-01 every occurrence is reported with an excerpt', () => {
  const f = scanHtml('a.html', '<p style="a"></p><p style="b"></p>');
  expect(f).toHaveLength(2);
  expect(f[0]!.excerpt).toContain('style="a"');
});
test('@REQ-GATE-01 scanFiles scans only HTML and lists what it scanned', () => {
  const out = scanFiles([
    { path: 'index.html', html: '<p>ok</p>' },
    { path: 'favicon.svg', html: '<svg><style>@media(prefers-color-scheme:dark){}</style></svg>' },
    { path: 'quality.html', html: '<p style="x">' },
  ], { forbidStatesPage: false });
  expect(out.scanned).toEqual(['index.html', 'quality.html']);
  expect(out.findings.map((f) => f.file)).toEqual(['quality.html']);
});
test('@REQ-GATE-01 the states page is forbidden in the real build only', () => {
  const files = [{ path: 'index.html', html: '' }, { path: STATES_PAGE, html: '' }];
  expect(scanFiles(files, { forbidStatesPage: true }).findings.map((f) => f.rule)).toEqual(['states-page']);
  expect(scanFiles(files, { forbidStatesPage: false }).findings).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/dist-scan.test.ts`
Expected: FAIL, cannot resolve `dist-scan`.

- [ ] **Step 3: Implement `src/lib/dist-scan.ts`**

```ts
export type FindingRule = 'style-attr' | 'style-element' | 'inline-script' | 'states-page';
export interface Finding { file: string; rule: FindingRule; excerpt: string }

export const STATES_PAGE = '__states.html';

const STYLE_ATTR = /<[a-z][^>]*?\sstyle\s*=/gi;
const STYLE_ELEMENT = /<style[\s>]/gi;
const SCRIPT_OPEN = /<script\b([^>]*)>/gi;
const HAS_SRC = /\ssrc\s*=/i;
const IS_JSON_LD = /\stype\s*=\s*["']?application\/ld\+json["']?/i;

const excerpt = (html: string, index: number | undefined) => html.slice(index ?? 0, (index ?? 0) + 80);

export function scanHtml(file: string, html: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of html.matchAll(STYLE_ATTR)) findings.push({ file, rule: 'style-attr', excerpt: excerpt(html, m.index) });
  for (const m of html.matchAll(STYLE_ELEMENT)) findings.push({ file, rule: 'style-element', excerpt: excerpt(html, m.index) });
  for (const m of html.matchAll(SCRIPT_OPEN)) {
    const attrs = m[1] ?? '';
    if (!HAS_SRC.test(attrs) && !IS_JSON_LD.test(attrs)) {
      findings.push({ file, rule: 'inline-script', excerpt: excerpt(html, m.index) });
    }
  }
  return findings;
}

export function scanFiles(
  files: { path: string; html: string }[],
  opts: { forbidStatesPage: boolean },
): { scanned: string[]; findings: Finding[] } {
  const html = files.filter((f) => f.path.endsWith('.html'));
  const findings = html.flatMap((f) => scanHtml(f.path, f.html));
  if (opts.forbidStatesPage) {
    for (const f of html) {
      if (f.path === STATES_PAGE || f.path.endsWith(`/${STATES_PAGE}`)) {
        findings.push({ file: f.path, rule: 'states-page', excerpt: '' });
      }
    }
  }
  return { scanned: html.map((f) => f.path), findings };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/dist-scan.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dist-scan.ts tests/unit/dist-scan.test.ts
git commit -m "Add built HTML scanner for CSP rules and the states page"
```

---

## Task 7: Deploy gates: manifest, placeholders, stale commit

**Files:**
- Create: `src/lib/manifest.ts`, `src/lib/placeholders.ts`, `src/lib/stale-sha.ts`
- Test: `tests/unit/gates.test.ts`

**Interfaces:**
- Produces:
  - `type Manifest = Record<string, string>` (relative path to lowercase SHA-256 hex)
  - `interface ManifestDiff { changed: string[]; missing: string[]; extra: string[] }`
  - `diffManifest(expected: Manifest, actual: Manifest, ignore?: string[]): ManifestDiff` (default ignore `['quality.json']`)
  - `manifestMatches(d: ManifestDiff): boolean`
  - `parseManifest(text: string): Manifest | null`
  - `findPlaceholders(files: { path: string; text: string }[]): string[]`
  - `parseLsRemote(output: string, ref?: string): string | null`
  - `isStale(runSha: string, headSha: string | null): boolean`

- [ ] **Step 1: Write the failing tests**

`tests/unit/gates.test.ts`:
```ts
import { diffManifest, manifestMatches, parseManifest } from '../../src/lib/manifest';
import { findPlaceholders } from '../../src/lib/placeholders';
import { isStale, parseLsRemote } from '../../src/lib/stale-sha';

const h = (c: string) => c.repeat(64);

describe('manifest', () => {
  const expected = { 'index.html': h('a'), 'quality.html': h('b') };
  test('@REQ-GATE-02 identical trees match', () => {
    const d = diffManifest(expected, { ...expected });
    expect(d).toEqual({ changed: [], missing: [], extra: [] });
    expect(manifestMatches(d)).toBe(true);
  });
  test('@REQ-GATE-02 a changed file is rejected', () => {
    const d = diffManifest(expected, { ...expected, 'index.html': h('c') });
    expect(d.changed).toEqual(['index.html']);
    expect(manifestMatches(d)).toBe(false);
  });
  test('@REQ-GATE-02 missing and extra files are rejected', () => {
    const d = diffManifest(expected, { 'index.html': h('a'), 'evil.js': h('d') });
    expect(d).toEqual({ changed: [], missing: ['quality.html'], extra: ['evil.js'] });
    expect(manifestMatches(d)).toBe(false);
  });
  test('@REQ-GATE-02 quality.json is the only ignored difference', () => {
    expect(manifestMatches(diffManifest(expected, { ...expected, 'quality.json': h('e') }))).toBe(true);
    expect(manifestMatches(diffManifest(expected, { ...expected, 'nested/quality.json': h('e') }))).toBe(false);
  });
  test('@REQ-GATE-02 parseManifest accepts only path to 64-hex maps', () => {
    expect(parseManifest(JSON.stringify(expected))).toEqual(expected);
    expect(parseManifest('{"a": "short"}')).toBeNull();
    expect(parseManifest('[]')).toBeNull();
    expect(parseManifest('not json')).toBeNull();
    expect(parseManifest('{}')).toBeNull();
  });
});

describe('placeholders', () => {
  test('@REQ-GATE-03 finds placeholder frontmatter in Markdown and YAML', () => {
    const files = [
      { path: 'src/content/profile/profile.md', text: '---\nname: X\nplaceholder: true\n---\nBody' },
      { path: 'src/content/certifications/a.yaml', text: 'name: A\nplaceholder: true\n' },
      { path: 'src/content/certifications/b.yaml', text: 'name: B\nplaceholder: false\n' },
      { path: 'src/content/certifications/c.yaml', text: 'name: C\n' },
    ];
    expect(findPlaceholders(files)).toEqual(['src/content/profile/profile.md', 'src/content/certifications/a.yaml']);
  });
  test('@REQ-GATE-03 ignores the phrase in Markdown body text', () => {
    expect(findPlaceholders([{ path: 'p.md', text: '---\nname: X\n---\nplaceholder: true' }])).toEqual([]);
  });
  test('@REQ-GATE-03 tolerates quoting and spacing', () => {
    expect(findPlaceholders([{ path: 'a.yaml', text: 'placeholder:   true   \n' }])).toEqual(['a.yaml']);
    expect(findPlaceholders([{ path: 'b.yaml', text: "placeholder: 'true'\n" }])).toEqual(['b.yaml']);
  });
});

describe('stale commit guard', () => {
  test('@REQ-GATE-04 reads the head of main from ls-remote output', () => {
    const out = 'abc123\tHEAD\n' + 'def456def456def456def456def456def456def4\trefs/heads/main\n';
    expect(parseLsRemote(out)).toBe('def456def456def456def456def456def456def4');
    expect(parseLsRemote('')).toBeNull();
  });
  test('@REQ-GATE-04 a run is stale only when main has moved on', () => {
    expect(isStale('aaa', 'aaa')).toBe(false);
    expect(isStale('aaa', 'bbb')).toBe(true);
    expect(isStale('aaa', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/gates.test.ts`
Expected: FAIL, cannot resolve the modules.

- [ ] **Step 3: Implement**

`src/lib/manifest.ts`:
```ts
export type Manifest = Record<string, string>;
export interface ManifestDiff { changed: string[]; missing: string[]; extra: string[] }

const HEX64 = /^[0-9a-f]{64}$/;

export function diffManifest(expected: Manifest, actual: Manifest, ignore: string[] = ['quality.json']): ManifestDiff {
  const skip = new Set(ignore);
  const changed: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [path, hash] of Object.entries(expected)) {
    if (skip.has(path)) continue;
    if (!(path in actual)) missing.push(path);
    else if (actual[path] !== hash) changed.push(path);
  }
  for (const path of Object.keys(actual)) {
    if (!skip.has(path) && !(path in expected)) extra.push(path);
  }
  return { changed: changed.sort(), missing: missing.sort(), extra: extra.sort() };
}

export function manifestMatches(d: ManifestDiff): boolean {
  return d.changed.length === 0 && d.missing.length === 0 && d.extra.length === 0;
}

export function parseManifest(text: string): Manifest | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  for (const [, v] of entries) if (typeof v !== 'string' || !HEX64.test(v)) return null;
  return data as Manifest;
}
```

`src/lib/placeholders.ts`:
```ts
const FLAG = /^placeholder:\s*['"]?true['"]?\s*$/m;
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

/** Content files still marked `placeholder: true` (the launch gate). */
export function findPlaceholders(files: { path: string; text: string }[]): string[] {
  return files
    .filter((f) => {
      if (f.path.endsWith('.md')) {
        const fm = FRONTMATTER.exec(f.text);
        return fm ? FLAG.test(fm[1]!) : false;
      }
      return FLAG.test(f.text);
    })
    .map((f) => f.path);
}
```

`src/lib/stale-sha.ts`:
```ts
export function parseLsRemote(output: string, ref = 'refs/heads/main'): string | null {
  for (const line of output.split('\n')) {
    const [sha, name] = line.trim().split(/\s+/);
    if (name === ref && sha) return sha;
  }
  return null;
}

/** A newer commit reached main while this run was in flight (E17 deploy guard). */
export function isStale(runSha: string, headSha: string | null): boolean {
  return headSha !== null && headSha !== runSha;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/gates.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/manifest.ts src/lib/placeholders.ts src/lib/stale-sha.ts tests/unit/gates.test.ts
git commit -m "Add manifest, placeholder and stale-commit deploy gates"
```

---

## Task 8: Monitoring issue logic

**Files:**
- Create: `src/lib/issue-state.ts`
- Test: `tests/unit/issue-state.test.ts`

The spec says the link-check issue body holds the state between runs. An issue only exists after a link fails twice, so a first failure has nowhere to live. This task keeps the per-link failure counts in a small state object that the workflow stores in the Actions cache (Task 24) and mirrors into the issue body once the issue exists.

**Interfaces:**
- Produces:
  - `interface OpenIssue { number: number; body: string }`
  - `type IssueAction = { kind: 'none' } | { kind: 'open'; title: string; body: string } | { kind: 'update'; number: number; body: string } | { kind: 'close'; number: number; comment: string }`
  - `SMOKE_TITLE = 'Live site is failing'`, `LINKS_TITLE = 'Broken external links'`
  - `smokeAction(failed: boolean, open: OpenIssue | null, details: string, when: string): IssueAction`
  - `interface LinkState { failures: Record<string, number> }`
  - `nextLinkState(prev: LinkState, results: { url: string; ok: boolean }[]): LinkState`
  - `reportableLinks(state: LinkState): string[]`
  - `renderLinksBody(state: LinkState): string`
  - `linksAction(state: LinkState, open: OpenIssue | null, when: string): IssueAction`

- [ ] **Step 1: Write the failing tests**

`tests/unit/issue-state.test.ts`:
```ts
import {
  linksAction, nextLinkState, renderLinksBody, reportableLinks, smokeAction, LINKS_TITLE, SMOKE_TITLE,
} from '../../src/lib/issue-state';

const when = '2026-09-28 06:17 UTC';

describe('smoke issue', () => {
  test('@REQ-OPS-01 opens on the first failure', () => {
    expect(smokeAction(true, null, 'CV returned 404', when)).toEqual({ kind: 'open', title: SMOKE_TITLE, body: expect.stringContaining('CV returned 404') });
  });
  test('@REQ-OPS-01 updates an open issue while failing', () => {
    expect(smokeAction(true, { number: 7, body: 'old' }, 'still 404', when)).toEqual({ kind: 'update', number: 7, body: expect.stringContaining('still 404') });
  });
  test('@REQ-OPS-01 closes the issue once passing', () => {
    expect(smokeAction(false, { number: 7, body: 'x' }, '', when)).toEqual({ kind: 'close', number: 7, comment: `Passing again at ${when}.` });
  });
  test('@REQ-OPS-01 does nothing when passing with no issue', () => {
    expect(smokeAction(false, null, '', when)).toEqual({ kind: 'none' });
  });
});

describe('link state', () => {
  const a = 'https://issuer.example/a';
  const b = 'https://issuer.example/b';
  test('@REQ-OPS-01 counts consecutive failures and resets on success', () => {
    let s = nextLinkState({ failures: {} }, [{ url: a, ok: false }, { url: b, ok: true }]);
    expect(s.failures).toEqual({ [a]: 1 });
    s = nextLinkState(s, [{ url: a, ok: false }, { url: b, ok: false }]);
    expect(s.failures).toEqual({ [a]: 2, [b]: 1 });
    s = nextLinkState(s, [{ url: a, ok: true }, { url: b, ok: false }]);
    expect(s.failures).toEqual({ [b]: 2 });
  });
  test('@REQ-OPS-01 drops links that are no longer checked', () => {
    expect(nextLinkState({ failures: { [a]: 3 } }, [{ url: b, ok: true }]).failures).toEqual({});
  });
  test('@REQ-OPS-01 only links failing twice in a row are reported, sorted', () => {
    expect(reportableLinks({ failures: { [b]: 2, [a]: 3, 'https://c.example': 1 } })).toEqual([a, b]);
  });
  test('@REQ-OPS-01 opens, updates and closes one issue', () => {
    const failing = { failures: { [a]: 2 } };
    expect(linksAction(failing, null, when)).toEqual({ kind: 'open', title: LINKS_TITLE, body: renderLinksBody(failing) });
    expect(linksAction(failing, { number: 3, body: '' }, when)).toEqual({ kind: 'update', number: 3, body: renderLinksBody(failing) });
    expect(linksAction({ failures: { [a]: 1 } }, { number: 3, body: '' }, when)).toEqual({ kind: 'close', number: 3, comment: `All external links passed or recovered at ${when}.` });
    expect(linksAction({ failures: { [a]: 1 } }, null, when)).toEqual({ kind: 'none' });
  });
  test('@REQ-OPS-01 the body lists each reportable link with its failure count', () => {
    expect(renderLinksBody({ failures: { [a]: 2, [b]: 1 } })).toContain(`- ${a} (failed 2 weekly checks in a row)`);
    expect(renderLinksBody({ failures: { [a]: 2, [b]: 1 } })).not.toContain(b);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/issue-state.test.ts`
Expected: FAIL, cannot resolve `issue-state`.

- [ ] **Step 3: Implement `src/lib/issue-state.ts`**

```ts
export interface OpenIssue { number: number; body: string }
export type IssueAction =
  | { kind: 'none' }
  | { kind: 'open'; title: string; body: string }
  | { kind: 'update'; number: number; body: string }
  | { kind: 'close'; number: number; comment: string };

export const SMOKE_TITLE = 'Live site is failing';
export const LINKS_TITLE = 'Broken external links';

export function smokeAction(failed: boolean, open: OpenIssue | null, details: string, when: string): IssueAction {
  const body = `The daily live check failed at ${when}.\n\n${details}\n\nRecovery steps: docs/runbook.md`;
  if (failed) return open ? { kind: 'update', number: open.number, body } : { kind: 'open', title: SMOKE_TITLE, body };
  return open ? { kind: 'close', number: open.number, comment: `Passing again at ${when}.` } : { kind: 'none' };
}

export interface LinkState { failures: Record<string, number> }

export function nextLinkState(prev: LinkState, results: { url: string; ok: boolean }[]): LinkState {
  const failures: Record<string, number> = {};
  for (const r of results) if (!r.ok) failures[r.url] = (prev.failures[r.url] ?? 0) + 1;
  return { failures };
}

export function reportableLinks(state: LinkState): string[] {
  return Object.entries(state.failures).filter(([, n]) => n >= 2).map(([url]) => url).sort();
}

export function renderLinksBody(state: LinkState): string {
  const lines = reportableLinks(state).map((url) => `- ${url} (failed ${state.failures[url]} weekly checks in a row)`);
  return `These external links failed on at least two weekly checks in a row:\n\n${lines.join('\n')}\n\nFix the link in the content file, or remove it if the issuer retired it.`;
}

export function linksAction(state: LinkState, open: OpenIssue | null, when: string): IssueAction {
  if (reportableLinks(state).length > 0) {
    const body = renderLinksBody(state);
    return open ? { kind: 'update', number: open.number, body } : { kind: 'open', title: LINKS_TITLE, body };
  }
  return open ? { kind: 'close', number: open.number, comment: `All external links passed or recovered at ${when}.` } : { kind: 'none' };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/issue-state.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/issue-state.ts tests/unit/issue-state.test.ts
git commit -m "Add self-closing monitoring issue logic"
```

---

## Task 9: Privacy, content rules and JSON-LD

**Files:**
- Create: `src/lib/exif.ts`, `src/lib/content-rules.ts`, `src/lib/jsonld.ts`, `scripts/check-content.ts`, `.githooks/pre-commit`
- Test: `tests/unit/content-rules.test.ts`

**Interfaces:**
- Produces:
  - `IDENTIFYING_EXIF_KEYS: readonly string[]`; `identifyingExifKeys(tags: Record<string, unknown> | null | undefined): string[]`
  - `MAX_ABOUT_WORDS = 90`; `wordCount(text: string): number`; `sentences(text: string): string[]`; `aboutProblems(about: string, tagline: string): string[]`
  - `interface PersonInput { name: string; jobTitle: string; url: string; image: string; sameAs: string[] }`; `personJsonLd(p: PersonInput): Record<string, unknown>`; `serializeJsonLd(data: unknown): string`
  - CLI `pnpm tsx scripts/check-content.ts [files...]`: exits 1 with a plain message when an image has identifying EXIF or the About rules fail.

- [ ] **Step 1: Write the failing tests**

`tests/unit/content-rules.test.ts`:
```ts
import { identifyingExifKeys } from '../../src/lib/exif';
import { aboutProblems, sentences, wordCount, MAX_ABOUT_WORDS } from '../../src/lib/content-rules';
import { personJsonLd, serializeJsonLd } from '../../src/lib/jsonld';

describe('EXIF', () => {
  test('@REQ-PRIV-01 GPS and owner fields are identifying', () => {
    expect(identifyingExifKeys({ latitude: 43.6, longitude: -79.4, Make: 'Apple' })).toEqual(['latitude', 'longitude']);
    expect(identifyingExifKeys({ GPSLatitude: [43, 39, 1], SerialNumber: 'X1', OwnerName: 'C' })).toEqual(['GPSLatitude', 'OwnerName', 'SerialNumber']);
  });
  test('@REQ-PRIV-01 empty values and missing tags are fine', () => {
    expect(identifyingExifKeys({ Artist: '', GPSLatitude: null })).toEqual([]);
    expect(identifyingExifKeys(undefined)).toEqual([]);
    expect(identifyingExifKeys({ Make: 'Apple', Orientation: 1 })).toEqual([]);
  });
});

describe('About rules', () => {
  const tagline = 'I build test automation that teams can read, trust and keep running.';
  test('@REQ-CONTENT-03 counts words ignoring Markdown punctuation', () => {
    expect(wordCount('**Hello** there, [world](https://x.example).')).toBe(3);
    expect(wordCount('   ')).toBe(0);
  });
  test('@REQ-CONTENT-03 normalizes sentences for comparison', () => {
    expect(sentences('I BUILD test automation.  Next one here! Short.')).toEqual(['i build test automation', 'next one here']);
  });
  test('@REQ-CONTENT-03 flags About text that repeats the tagline', () => {
    const about = 'I build test automation that teams can read, trust and keep running. For five years I tested products.';
    expect(aboutProblems(about, tagline)).toEqual(['About repeats the tagline: "i build test automation that teams can read trust and keep running"']);
  });
  test('@REQ-CONTENT-03 flags About text over the word limit', () => {
    const long = Array.from({ length: MAX_ABOUT_WORDS + 1 }, () => 'word').join(' ');
    expect(aboutProblems(long, tagline)).toEqual([`About has ${MAX_ABOUT_WORDS + 1} words; the limit is ${MAX_ABOUT_WORDS}.`]);
  });
  test('@REQ-CONTENT-03 a distinct, short About passes', () => {
    expect(aboutProblems('For five years I tested web and API products in small teams.', tagline)).toEqual([]);
  });
});

describe('JSON-LD', () => {
  test('@REQ-PREV-01 builds a schema.org Person', () => {
    expect(personJsonLd({ name: 'Ceylan Akyol', jobTitle: 'QA Automation Engineer', url: 'https://s.example', image: 'https://s.example/og.png', sameAs: ['https://linkedin.example/c'] }))
      .toEqual({ '@context': 'https://schema.org', '@type': 'Person', name: 'Ceylan Akyol', jobTitle: 'QA Automation Engineer', url: 'https://s.example', image: 'https://s.example/og.png', sameAs: ['https://linkedin.example/c'] });
  });
  test('@REQ-CSP-01 serialized JSON-LD can never close its script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/content-rules.test.ts`
Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement**

`src/lib/exif.ts`:
```ts
// Keys produced by exifr.parse(file, { gps: true, tiff: true, exif: true }) that can identify a person or place (E18).
export const IDENTIFYING_EXIF_KEYS = [
  'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSPosition',
  'OwnerName', 'CameraOwnerName', 'Artist', 'SerialNumber', 'BodySerialNumber', 'LensSerialNumber',
] as const;

export function identifyingExifKeys(tags: Record<string, unknown> | null | undefined): string[] {
  if (!tags) return [];
  return IDENTIFYING_EXIF_KEYS
    .filter((k) => {
      const v = tags[k];
      return v !== undefined && v !== null && v !== '';
    })
    .sort();
}
```

`src/lib/content-rules.ts`:
```ts
export const MAX_ABOUT_WORDS = 90;

const stripMarkdown = (text: string) =>
  text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>]/g, ' ');

export function wordCount(text: string): number {
  return stripMarkdown(text).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** Lowercased sentences of 3 or more words, punctuation removed, for overlap checks. */
export function sentences(text: string): string[] {
  return stripMarkdown(text)
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.split(' ').length >= 3);
}

export function aboutProblems(about: string, tagline: string): string[] {
  const problems: string[] = [];
  const taglineSentences = new Set(sentences(tagline));
  for (const s of sentences(about)) {
    if (taglineSentences.has(s)) problems.push(`About repeats the tagline: "${s}"`);
  }
  const words = wordCount(about);
  if (words > MAX_ABOUT_WORDS) problems.push(`About has ${words} words; the limit is ${MAX_ABOUT_WORDS}.`);
  return problems;
}
```

`src/lib/jsonld.ts`:
```ts
export interface PersonInput { name: string; jobTitle: string; url: string; image: string; sameAs: string[] }

export function personJsonLd(p: PersonInput): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.jobTitle, url: p.url, image: p.image, sameAs: p.sameAs };
}

/** Escapes "<" so content can never end the surrounding script element (D21). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/content-rules.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Add the CLI and the pre-commit hook**

`scripts/check-content.ts`:
```ts
// Usage: tsx scripts/check-content.ts [content dir, default src/content] [--images-only file ...]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import exifr from 'exifr';
import { parse as parseYaml } from 'yaml';
import { identifyingExifKeys } from '../src/lib/exif';
import { aboutProblems } from '../src/lib/content-rules';

const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic']);
const args = process.argv.slice(2);
const imagesOnly = args[0] === '--images-only';
const walk = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; }) : [];

const problems: string[] = [];
const images = imagesOnly ? args.slice(1) : [...walk('src/assets'), ...walk(args[0] ?? 'src/content')];
for (const file of images.filter((f) => IMAGE.has(extname(f).toLowerCase()))) {
  const tags = await exifr.parse(file, { gps: true, tiff: true, exif: true }).catch(() => null);
  const keys = identifyingExifKeys(tags);
  if (keys.length > 0) problems.push(`${file} contains identifying metadata (${keys.join(', ')}). Strip it first: see docs/runbook.md.`);
}

if (!imagesOnly) {
  const dir = args[0] ?? 'src/content';
  const raw = readFileSync(join(dir, 'profile/profile.md'), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (match) {
    const fm = parseYaml(match[1]!) as { tagline?: string };
    problems.push(...aboutProblems(match[2]!, fm.tagline ?? ''));
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log('Content checks passed.');
```

`.githooks/pre-commit`:
```sh
#!/bin/sh
# Blocks commits of images with GPS or owner metadata (E18). Enable once with:
#   git config core.hooksPath .githooks
files=$(git diff --cached --name-only --diff-filter=ACM | grep -Ei '\.(jpe?g|png|webp|avif|heic)$')
[ -z "$files" ] && exit 0
exec pnpm -s tsx scripts/check-content.ts --images-only $files
```

Run: `chmod +x .githooks/pre-commit && git config core.hooksPath .githooks`

- [ ] **Step 6: Commit**

```bash
git add src/lib/exif.ts src/lib/content-rules.ts src/lib/jsonld.ts scripts/check-content.ts .githooks/pre-commit tests/unit/content-rules.test.ts
git commit -m "Add EXIF privacy check, About rules and escaped JSON-LD"
```

---

## Task 10: Browser loader and renderers

**Files:**
- Create: `src/lib/quality-client.ts`, `src/lib/dom.ts`, `src/lib/render-home.ts`, `src/lib/render-quality.ts`, `src/lib/brush-tick.ts`
- Test: `tests/unit/quality-client.test.ts`, `tests/unit/renderers.test.ts`

**Interfaces:**
- Consumes: `parseQualityReport`, `QualityReport` (Task 3).
- Produces:
  - `TICK_PATH: string` (the approved brush tick, viewBox `0 0 36 30`)
  - `type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>`
  - `type Renderer = (live: HTMLElement, data: QualityReport) => void`
  - `loadQuality(fetchFn: FetchLike, url?: string): Promise<QualityReport | null>`
  - `hydrate(root: ParentNode, renderers: Record<string, Renderer>, fetchFn: FetchLike, url?: string): Promise<void>`
  - Markup contract for every data block: `<div data-block="NAME" data-state="unavailable"> <div data-slot="fallback">...</div> <div data-slot="live"></div> </div>`; `hydrate` sets `data-state="ready"` on success and always sets `data-settled="true"`.
  - `el(tag, text?, attrs?)`, `svgEl(tag, attrs)`, `tick(size)` in `dom.ts`
  - `renderProofStrip: Renderer` (`render-home.ts`)
  - `renderVerdict`, `renderIntegrity`, `renderMatrix`, `renderTrends`, `renderMutation`, `renderDuration`: `Renderer` (`render-quality.ts`)
  - `plural(n: number, one: string, many: string): string`, `formatDeployTime(iso: string): string`

- [ ] **Step 1: Write the failing loader tests**

`tests/unit/quality-client.test.ts`:
```ts
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { hydrate, loadQuality, type FetchLike } from '../../src/lib/quality-client';

const text = (name: string) => readFileSync(`tests/fixtures/quality/${name}.json`, 'utf8');
const fetchJson = (body: string, ok = true): FetchLike => async () => ({ ok, json: async () => JSON.parse(body) });
const block = (name: string) => {
  const div = document.createElement('div');
  div.dataset.block = name; div.dataset.state = 'unavailable';
  const fallback = document.createElement('div'); fallback.dataset.slot = 'fallback'; fallback.textContent = 'fallback';
  const live = document.createElement('div'); live.dataset.slot = 'live';
  div.append(fallback, live); document.body.append(div); return div;
};
beforeEach(() => { document.body.replaceChildren(); });

test('@REQ-QUAL-01 loads and validates the valid fixture', async () => {
  expect((await loadQuality(fetchJson(text('valid'))))?.counts.testRuns).toBe(312);
});
test('@REQ-QUAL-01 returns null on HTTP errors, bad JSON, invalid and future data, and thrown fetches', async () => {
  expect(await loadQuality(fetchJson(text('valid'), false))).toBeNull();
  expect(await loadQuality(fetchJson(text('malformed')))).toBeNull();
  expect(await loadQuality(fetchJson(text('future')))).toBeNull();
  expect(await loadQuality(async () => { throw new TypeError('offline'); })).toBeNull();
});
test('@REQ-QUAL-01 hydrate marks blocks ready and settled on success', async () => {
  const a = block('a');
  await hydrate(document, { a: (live, d) => { live.textContent = String(d.counts.testRuns); } }, fetchJson(text('valid')));
  expect(a.dataset.state).toBe('ready');
  expect(a.dataset.settled).toBe('true');
  expect(a.querySelector('[data-slot="live"]')!.textContent).toBe('312');
});
test('@REQ-QUAL-01 hydrate leaves blocks unavailable but settled when data fails', async () => {
  const a = block('a');
  await hydrate(document, { a: () => {} }, fetchJson(text('malformed')));
  expect(a.dataset.state).toBe('unavailable');
  expect(a.dataset.settled).toBe('true');
});
test('@REQ-QUAL-01 one failing renderer does not affect other blocks', async () => {
  const bad = block('bad'); const good = block('good');
  await hydrate(document, { bad: () => { throw new Error('boom'); }, good: (l) => { l.textContent = 'ok'; } }, fetchJson(text('valid')));
  expect(bad.dataset.state).toBe('unavailable');
  expect(bad.dataset.settled).toBe('true');
  expect(good.dataset.state).toBe('ready');
});
test('@REQ-QUAL-01 blocks without a renderer settle as unavailable', async () => {
  const x = block('unknown');
  await hydrate(document, {}, fetchJson(text('valid')));
  expect(x.dataset.state).toBe('unavailable');
  expect(x.dataset.settled).toBe('true');
});
test('@REQ-QUAL-01 no blocks means no request', async () => {
  let calls = 0;
  await hydrate(document, {}, async () => { calls++; return { ok: true, json: async () => ({}) }; });
  expect(calls).toBe(0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/quality-client.test.ts`
Expected: FAIL, cannot resolve `quality-client`.

- [ ] **Step 3: Implement the loader, DOM helpers and tick**

`src/lib/brush-tick.ts`:
```ts
// The approved tapered brush tick (viewBox 0 0 36 30), generated from the design review geometry.
export const TICK_PATH =
  'M2.8 15.2 L3.2 16.8 L3.7 18.0 L4.3 19.3 L5.1 20.2 L6.0 21.2 L6.8 22.3 L7.6 23.4 L8.4 24.6 L9.2 25.8 L13.3 27.9 L15.3 24.3 L16.7 21.8 L18.1 19.2 L19.7 16.8 L21.5 14.4 L23.4 12.0 L25.6 9.8 L27.9 7.6 L30.5 5.4 L33.2 3.3 L32.8 2.7 L29.7 4.3 L26.8 6.0 L24.0 7.9 L21.4 10.0 L19.0 12.1 L16.8 14.4 L14.7 16.9 L12.8 19.4 L11.2 22.2 L10.7 24.1 L13.2 23.4 L12.3 22.1 L11.4 20.7 L10.5 19.5 L9.5 18.3 L8.6 17.2 L7.6 16.1 L6.2 15.4 L4.8 14.9 L3.2 14.8 Z';
```

`src/lib/dom.ts`:
```ts
// DOM builders for client renderers. Text always goes through textContent;
// attributes are limited to a fixed allowlist, and hrefs must be https or root-relative.
import { TICK_PATH } from './brush-tick';

const ATTRS = new Set(['class', 'href', 'aria-label', 'datetime', 'aria-hidden', 'hidden']);
const SVG_NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, text?: string, attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) {
    if (!ATTRS.has(k)) continue;
    if (k === 'href' && !(v.startsWith('https://') || v.startsWith('/'))) continue;
    node.setAttribute(k, v);
  }
  return node;
}

export function svgEl(tag: 'svg' | 'path' | 'polyline' | 'circle' | 'line', attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (k !== 'style') node.setAttribute(k, v);
  return node;
}

export function tick(size = 30): SVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 36 30', width: String(size), height: String(Math.round(size * 30 / 36)), class: 'tick', 'aria-hidden': 'true' });
  svg.append(svgEl('path', { d: TICK_PATH, class: 'tick-ink' }));
  return svg;
}
```

`src/lib/quality-client.ts`:
```ts
import { parseQualityReport, type QualityReport } from './quality-schema';

export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
export type Renderer = (live: HTMLElement, data: QualityReport) => void;

export async function loadQuality(fetchFn: FetchLike, url = '/quality.json'): Promise<QualityReport | null> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const parsed = parseQualityReport(await res.json());
    return parsed.ok ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Upgrades server-rendered fallbacks to live numbers (E7, E14, G3):
 *   unavailable (SSR) ──valid data + renderer ok──▶ ready
 *   every path          ─────────────────────────▶ data-settled="true"
 */
export async function hydrate(root: ParentNode, renderers: Record<string, Renderer>, fetchFn: FetchLike, url?: string): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('[data-block]')];
  if (blocks.length === 0) return;
  const data = await loadQuality(fetchFn, url);
  for (const block of blocks) {
    try {
      const render = renderers[block.dataset.block ?? ''];
      const live = block.querySelector<HTMLElement>('[data-slot="live"]');
      if (data && render && live) {
        live.replaceChildren();
        render(live, data);
        block.dataset.state = 'ready';
      }
    } catch {
      block.dataset.state = 'unavailable';
    } finally {
      block.dataset.settled = 'true';
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/quality-client.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing renderer tests**

`tests/unit/renderers.test.ts`:
```ts
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { parseQualityReport, type QualityReport } from '../../src/lib/quality-schema';
import { renderProofStrip } from '../../src/lib/render-home';
import {
  formatDeployTime, plural, renderDuration, renderIntegrity, renderMatrix, renderMutation, renderTrends, renderVerdict,
} from '../../src/lib/render-quality';

const fixture = (name: string): QualityReport => {
  const r = parseQualityReport(JSON.parse(readFileSync(`tests/fixtures/quality/${name}.json`, 'utf8')));
  if (!r.ok) throw new Error(r.reason);
  return r.data;
};
const live = () => document.createElement('div');
const squash = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

test('@REQ-QUAL-01 proof strip sentence uses the exact approved wording', () => {
  const l = live(); renderProofStrip(l, fixture('valid'));
  expect(squash(l.textContent)).toBe("This site's code passed 312 test runs across 3 browser engines and 5 device profiles, with 0 automated accessibility violations (axe) and a Lighthouse mobile score of 100 in CI.");
  expect(l.querySelectorAll('b')).toHaveLength(3);
});
test('@REQ-QUAL-01 plurals and thousands separators', () => {
  expect(plural(1, 'test run', 'test runs')).toBe('1 test run');
  expect(plural(1234, 'test run', 'test runs')).toBe('1,234 test runs');
});
test('@REQ-QUAL-01 verdict states requirements, tests and test runs', () => {
  const l = live(); renderVerdict(l, fixture('valid'));
  expect(squash(l.textContent)).toContain('This build covered all 4 requirements with 148 tests (312 test runs), and nothing ships unless every one passes.');
  const commit = l.querySelector('a[href*="/commit/"]')!;
  expect(commit.getAttribute('href')).toBe('https://github.com/example/ceylan-akyol-site/commit/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901');
  expect(commit.textContent).toBe('e5cdb92');
});
test('@REQ-QUAL-01 deploy time reads as day month year, UTC', () => {
  expect(formatDeployTime('2026-09-27T09:14:00Z')).toBe('27 September 2026, 09:14 UTC');
});
test('@REQ-QUAL-01 matrix rows link covering tests to permalinks at the deployed commit', () => {
  const l = live(); renderMatrix(l, fixture('valid'));
  expect(l.querySelectorAll('li.req')).toHaveLength(4);
  const link = l.querySelector('a[href*="/blob/"]')!;
  expect(link.getAttribute('href')).toBe('https://github.com/example/ceylan-akyol-site/blob/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901/tests/e2e/home.spec.ts#L12');
  expect(squash(l.textContent)).toContain('Lighthouse CI');
  expect(squash(l.textContent)).toContain('Checked after each deploy');
});
test('@REQ-SEC-02 hostile strings render as text and create no elements', () => {
  const l = live(); document.body.append(l);
  renderMatrix(l, fixture('hostile'));
  expect(l.querySelector('img, script')).toBeNull();
  expect(l.textContent).toContain('<img src=x');
  expect(document.body.dataset.pwned).toBeUndefined();
  for (const a of l.querySelectorAll('a')) expect(a.getAttribute('href')!.startsWith('https://')).toBe(true);
});
test('@REQ-QUAL-01 integrity line covers ok, failed and first-deploy cases', () => {
  const d = fixture('valid');
  const ok = live(); renderIntegrity(ok, d);
  expect(squash(ok.textContent)).toBe('The previous deploy was verified live: all 64 files served matched the tested build (checked 26 September 2026, 09:20 UTC).');
  const bad = live(); renderIntegrity(bad, { ...d, liveCheck: { ...d.liveCheck!, ok: false } });
  expect(squash(bad.textContent)).toContain('found files that did not match');
  const first = live(); const { liveCheck: _omit, ...rest } = d; renderIntegrity(first, rest as QualityReport);
  expect(squash(first.textContent)).toBe('The live file check runs after this deploy.');
});
test('@REQ-STATE-01 trends show lines with 3 or more points and a message below that', () => {
  const d = fixture('valid');
  const full = live(); renderTrends(full, d);
  expect(full.querySelectorAll('polyline')).toHaveLength(3);
  const sparse = live(); renderTrends(sparse, { ...d, history: d.history.slice(0, 2) });
  expect(squash(sparse.textContent)).toBe('Trends appear after 3 deploys. This is deploy 2.');
  expect(sparse.querySelector('polyline')).toBeNull();
});
test('@REQ-QUAL-01 mutation sentence, with the dashboard link only when uploaded', () => {
  const d = fixture('valid');
  const withLink = live(); renderMutation(withLink, d);
  expect(squash(withLink.textContent)).toContain('Stryker changed the business logic 86 times to plant deliberate bugs. The tests caught 86.');
  expect(withLink.querySelector('a')).not.toBeNull();
  const { reportUrl: _drop, ...m } = d.mutation;
  const noLink = live(); renderMutation(noLink, { ...d, mutation: m });
  expect(noLink.querySelector('a')).toBeNull();
});
test('@REQ-QUAL-01 pipeline duration in minutes and seconds', () => {
  const l = live(); renderDuration(l, fixture('valid'));
  expect(squash(l.textContent)).toBe('This build went through the pipeline in 8 min 32 s.');
});
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm vitest run tests/unit/renderers.test.ts`
Expected: FAIL, cannot resolve renderers.

- [ ] **Step 7: Implement the renderers**

`src/lib/render-home.ts`:
```ts
import type { Renderer } from './quality-client';
import { el } from './dom';
import { plural } from './render-quality';

export const renderProofStrip: Renderer = (live, d) => {
  const p = el('p', undefined, { class: 'big' });
  p.append(
    "This site's code passed ",
    el('b', plural(d.counts.testRuns, 'test run', 'test runs')),
    ' across 3 browser engines and 5 device profiles, with ',
    el('b', plural(d.counts.axeViolations, 'automated accessibility violation', 'automated accessibility violations')),
    ' (axe) and a Lighthouse mobile score of ',
    el('b', String(d.lighthouse.performance)),
    ' in CI.',
  );
  live.append(p);
};
```

`src/lib/render-quality.ts`:
```ts
import type { Renderer } from './quality-client';
import type { MatrixRow, QualityReport } from './quality-schema';
import { el, svgEl, tick } from './dom';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nf = new Intl.NumberFormat('en-US');
const pad = (n: number) => String(n).padStart(2, '0');

export function plural(n: number, one: string, many: string): string {
  return `${nf.format(n)} ${n === 1 ? one : many}`;
}

export function formatDeployTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

const permalink = (d: QualityReport, file: string, line: number) =>
  `${d.repoUrl}/blob/${d.commit}/${file.split('/').map(encodeURIComponent).join('/')}#L${line}`;

export const renderVerdict: Renderer = (live, d) => {
  const p = el('p', undefined, { class: 'lede' });
  p.append(
    'Every promise this site makes is tied to the checks that prove it. This build covered ',
    el('b', `all ${plural(d.counts.requirements, 'requirement', 'requirements')}`),
    ' with ',
    el('b', plural(d.counts.tests, 'test', 'tests')),
    ' (', el('b', plural(d.counts.testRuns, 'test run', 'test runs')), '), and nothing ships unless every one passes.',
  );
  const meta = el('p', undefined, { class: 'meta2' });
  meta.append(
    `Deployed ${formatDeployTime(d.builtAt)}`, el('br'),
    'Commit ', el('a', d.commit.slice(0, 7), { href: `${d.repoUrl}/commit/${d.commit}` }), el('br'),
    el('a', 'View this CI run', { href: d.ciRunUrl }), el('br'),
    el('a', 'Browse the source', { href: d.repoUrl }),
  );
  live.append(p, meta);
};

export const renderIntegrity: Renderer = (live, d) => {
  const p = el('p', undefined, { class: 'integrity' });
  if (!d.liveCheck) {
    p.append('The live file check runs after this deploy.');
  } else if (d.liveCheck.ok) {
    p.append(tick(22), `The previous deploy was verified live: all ${plural(d.liveCheck.files, 'file', 'files')} served matched the tested build (checked ${formatDeployTime(d.liveCheck.checkedAt)}).`);
  } else {
    p.append('The previous deploy\'s live check found files that did not match the tested build. ', el('a', 'See the CI history', { href: `${d.repoUrl}/actions` }));
  }
  live.append(p);
};

const CHECK_LABELS = { lighthouse: 'Lighthouse CI', links: 'link check', 'dist-scan': 'built HTML scan' } as const;

function coverage(row: MatrixRow, d: QualityReport): HTMLElement {
  const box = el('div', undefined, { class: 'rq-cov' });
  if (row.phase === 'post-deploy') {
    box.append(el('strong', 'Checked after each deploy'), el('span', 'live smoke test'));
    return box;
  }
  const suites = [...new Set(row.tests.map((t) => t.suite))];
  const projects = [...new Set(row.tests.flatMap((t) => t.projects))];
  const parts = [...(row.tests.length > 0 ? [plural(row.tests.length, 'test', 'tests')] : []), ...row.checks.map((c) => CHECK_LABELS[c])];
  box.append(el('strong', parts.join(', ')));
  if (suites.length > 0) box.append(el('span', suites.join(', ')));
  if (projects.length > 0) box.append(el('span', `${projects.length} device ${projects.length === 1 ? 'profile' : 'profiles'}`, { class: 'dim' }));
  if (row.tests.length > 0) {
    const details = el('details');
    details.append(el('summary', `Show ${row.tests.length === 1 ? 'the test' : `the ${row.tests.length} tests`}`));
    const list = el('ul');
    for (const t of row.tests) {
      const li = el('li');
      li.append(el('a', t.title, { href: permalink(d, t.file, t.line) }));
      list.append(li);
    }
    details.append(list);
    box.append(details);
  }
  return box;
}

export const renderMatrix: Renderer = (live, d) => {
  const list = el('ul', undefined, { class: 'reqs' });
  for (const row of d.matrix) {
    const li = el('li', undefined, { class: 'req' });
    const main = el('div');
    main.append(el('span', row.id, { class: 'rq-id' }), el('p', row.text, { class: 'rq-text' }));
    li.append(tick(30), main, coverage(row, d));
    list.append(li);
  }
  live.append(list);
};

const SERIES = [
  { key: 'testRuns', label: 'Test runs passed', caption: 'Across 5 device profiles', max: null },
  { key: 'mutationScore', label: 'Mutation score', caption: 'Share of planted bugs the tests caught', max: 100 },
  { key: 'lighthousePerformance', label: 'Lighthouse mobile', caption: 'Median of 3 runs in CI', max: 100 },
] as const;

export const renderTrends: Renderer = (live, d) => {
  const h = d.history;
  if (h.length < 3) {
    live.append(el('p', `Trends appear after 3 deploys. This is deploy ${h.length}.`, { class: 'sparse' }));
    return;
  }
  const grid = el('div', undefined, { class: 'trends' });
  for (const s of SERIES) {
    const values = h.map((p) => p[s.key]);
    const lo = Math.min(...values);
    const hi = Math.max(...values, s.max ?? 0, lo + 1);
    const points = values.map((v, i) => `${(8 + (i * 204) / (values.length - 1)).toFixed(1)},${(48 - ((v - lo) / (hi - lo)) * 40).toFixed(1)}`).join(' ');
    const item = el('div', undefined, { class: 'trend' });
    const svg = svgEl('svg', { viewBox: '0 0 220 56', class: 'spark', 'aria-hidden': 'true' });
    svg.append(svgEl('polyline', { points, class: 'spark-line', fill: 'none' }));
    const current = values[values.length - 1]!;
    item.append(el('h3', s.label), el('p', s.max === 100 ? `${current}${s.key === 'mutationScore' ? '%' : ''}` : new Intl.NumberFormat('en-US').format(current), { class: 'now' }), svg, el('p', s.caption, { class: 'cap' }));
    grid.append(item);
  }
  live.append(grid);
};

export const renderMutation: Renderer = (live, d) => {
  const p = el('p');
  p.append(`Stryker changed the business logic ${plural(d.mutation.total, 'time', 'times')} to plant deliberate bugs. The tests caught ${nf.format(d.mutation.killed)}.`);
  live.append(p);
  if (d.mutation.reportUrl) {
    const link = el('p');
    link.append(el('a', 'Open the full report on Stryker Dashboard', { href: d.mutation.reportUrl }));
    live.append(link);
  }
};

export const renderDuration: Renderer = (live, d) => {
  const m = Math.floor(d.pipelineSeconds / 60);
  const s = d.pipelineSeconds % 60;
  live.append(el('p', `This build went through the pipeline in ${m} min ${s} s.`));
};
```

- [ ] **Step 8: Run to verify pass**

Run: `pnpm vitest run tests/unit/renderers.test.ts tests/unit/quality-client.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/quality-client.ts src/lib/dom.ts src/lib/render-home.ts src/lib/render-quality.ts src/lib/brush-tick.ts tests/unit/quality-client.test.ts tests/unit/renderers.test.ts
git commit -m "Add quality loader with settled states and safe DOM renderers"
```

---

## Task 11: Requirements registry, test tag helper and mutation testing

**Files:**
- Create: `tests/requirements.ts`, `tests/tag.ts`, `stryker.config.mjs`, `vitest.unit.config.ts`
- Test: `tests/unit/requirements.test.ts`

**Interfaces:**
- Consumes: `Requirement` type (Task 5).
- Produces: `REQUIREMENTS: Requirement[]`; `req(...ids: string[]): { tag: string[] }` for Playwright; `pnpm test:mutation` writing `reports/mutation/mutation.json`.

- [ ] **Step 1: Write the failing registry test**

`tests/unit/requirements.test.ts`:
```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REQUIREMENTS } from '../requirements';
import { tagsIn } from '../../src/lib/traceability';

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('@REQ-TRACE-01 requirement IDs are unique and well formed', () => {
  const ids = REQUIREMENTS.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^REQ-[A-Z0-9]+-\d{2}$/);
});

test('@REQ-TRACE-01 every tag used in a test file exists in the registry', () => {
  const known = new Set(REQUIREMENTS.map((r) => r.id));
  const files = walk('tests').filter((f) => /\.(test|spec)\.ts$/.test(f));
  const unknown = files.flatMap((f) => tagsIn(readFileSync(f, 'utf8')).filter((t) => !known.has(t)).map((t) => `${f}: ${t}`));
  expect(unknown).toEqual([]);
});

test('@REQ-TRACE-01 every requirement in the spec table is registered', () => {
  const spec = readFileSync('docs/superpowers/specs/2026-09-27-personal-website-design.md', 'utf8');
  const inSpec = [...spec.matchAll(/^\| (REQ-[A-Z0-9]+-\d{2}) \|/gm)].map((m) => m[1]);
  const registered = new Set(REQUIREMENTS.map((r) => r.id));
  expect(inSpec.filter((id) => !registered.has(id!))).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/requirements.test.ts`
Expected: FAIL, cannot resolve `../requirements`.

- [ ] **Step 3: Create the registry and the tag helper**

`tests/requirements.ts`:
```ts
import type { Requirement } from '../src/lib/traceability';

export const REQUIREMENTS: Requirement[] = [
  { id: 'REQ-HERO-01', text: 'Hero shows name, title, tagline and photo with alt text', source: '§4' },
  { id: 'REQ-CV-01', text: 'CV downloads in one click from the hero and is served as a PDF', source: '§4' },
  { id: 'REQ-CV-02', text: 'Both CV links download as Ceylan-Akyol-CV.pdf; Contact includes the CV link', source: 'G8' },
  { id: 'REQ-CONTACT-01', text: 'Email, LinkedIn and GitHub links are present in the hero and in Contact', source: '§4' },
  { id: 'REQ-CERT-01', text: 'Visible certifications are sorted newest first', source: '§5' },
  { id: 'REQ-CERT-02', text: 'Hidden certifications are not rendered', source: '§5' },
  { id: 'REQ-CERT-03', text: 'A certification is expired only when its expiry date is before today', source: '§5' },
  { id: 'REQ-CERT-04', text: 'Tick and Verify link appear only when a verify URL is present', source: '§5' },
  { id: 'REQ-CERT-05', text: 'Entries with an expiry date show Valid until or Expired with month and year', source: 'G4' },
  { id: 'REQ-CERT-06', text: 'The tick note appears only when a visible entry has a tick', source: 'G5' },
  { id: 'REQ-NAV-01', text: '/quality has a top line linking home and to the CV', source: 'G7' },
  { id: 'REQ-AVAIL-01', text: 'The availability line renders only when switched on', source: 'G6' },
  { id: 'REQ-STATE-01', text: 'Empty, sparse and overflow states render as specified', source: 'D19' },
  { id: 'REQ-CONTENT-01', text: 'Invalid content, disallowed file types and small photos fail the build', source: 'D14' },
  { id: 'REQ-CONTENT-02', text: 'CMS config and content schemas define the same fields', source: '§5' },
  { id: 'REQ-CONTENT-03', text: 'About is at most about 90 words and never repeats the tagline', source: 'G1' },
  { id: 'REQ-PRIV-01', text: 'Images with GPS or identifying metadata fail the build', source: 'E18' },
  { id: 'REQ-A11Y-01', text: 'No automated WCAG 2.2 AA violations in light or dark mode', source: '§1' },
  { id: 'REQ-A11Y-02', text: 'Skip link, logical tab order and visible focus', source: '§6' },
  { id: 'REQ-A11Y-03', text: 'Reduced motion shows the brush mark without animation', source: '§6' },
  { id: 'REQ-A11Y-04', text: 'Landmarks are present and repeated links have unique names', source: 'G11' },
  { id: 'REQ-PERF-01', text: 'Mobile Lighthouse in CI: performance at least 95, other categories 100', source: '§1', checks: ['lighthouse'] },
  { id: 'REQ-PERF-02', text: 'First-party JavaScript under 5 KB brotli and never inlined', source: 'E22' },
  { id: 'REQ-LINK-01', text: 'No broken internal links', source: '§8', checks: ['links'] },
  { id: 'REQ-NF-01', text: 'Unknown paths return the custom 404 page with status 404', source: '§4' },
  { id: 'REQ-URL-01', text: '/quality and /quality/ resolve to one canonical URL', source: 'E22' },
  { id: 'REQ-SEC-01', text: 'Security headers are present on every page', source: '§9' },
  { id: 'REQ-SEC-02', text: 'Data from quality.json cannot inject markup', source: 'D24' },
  { id: 'REQ-CSP-01', text: 'Built HTML has no inline styles or scripts, and no states page in the real build', source: 'D21', checks: ['dist-scan'] },
  { id: 'REQ-CACHE-01', text: 'Mutable files revalidate; fingerprinted assets are cached immutably', source: 'D18' },
  { id: 'REQ-QUAL-01', text: '/quality and the proof strip render data and fall back to true sentences', source: 'G3' },
  { id: 'REQ-QUAL-02', text: 'quality.json conforms to its schema and limits; old versions upgrade', source: 'E10' },
  { id: 'REQ-QUAL-03', text: 'History survives transient failures and resets only when none exists', source: 'E19' },
  { id: 'REQ-PREV-01', text: 'Pages have Open Graph and JSON-LD metadata, and the preview image is served', source: 'D7' },
  { id: 'REQ-HEALTH-01', text: 'No console errors on any page and data state', source: '§8' },
  { id: 'REQ-VIS-01', text: 'Pages match approved visual baselines', source: '§8' },
  { id: 'REQ-TRACE-01', text: 'The traceability builder, evidence checks and gate compute coverage correctly', source: 'D6' },
  { id: 'REQ-GATE-01', text: 'The built HTML scanner detects every forbidden pattern', source: 'E8' },
  { id: 'REQ-GATE-02', text: 'Manifest verification rejects any changed, missing or extra file', source: 'E8' },
  { id: 'REQ-GATE-03', text: 'The placeholder check finds content still marked as placeholder', source: 'E8' },
  { id: 'REQ-GATE-04', text: 'The stale commit check skips deploys of superseded commits', source: 'E8' },
  { id: 'REQ-OPS-01', text: 'Monitoring issues open, update and close correctly', source: 'E8' },
  { id: 'REQ-DEPLOY-01', text: 'Every file served live matches the tested build', source: 'E15', phase: 'post-deploy' },
];
```

`tests/tag.ts`:
```ts
/** Playwright details object carrying requirement tags: test('x', req('REQ-CV-01'), async ...). */
export function req(...ids: string[]): { tag: string[] } {
  return { tag: ids.map((id) => `@${id}`) };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/unit/requirements.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Configure Stryker**

`vitest.unit.config.ts` (Stryker runs only the fast unit tests; component and build tests need Astro rendering or a built site):
```ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'], exclude: ['tests/unit/og-card.test.ts'], globals: true },
});
```

`stryker.config.mjs`:
```js
// Mutation testing covers business logic in src/lib only (decision 0003).
const dashboard = process.env.STRYKER_DASHBOARD_API_KEY && process.env.GITHUB_SHA;

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.unit.config.ts', related: false },
  mutate: ['src/lib/**/*.ts', '!src/lib/brush-*.ts'],
  ignoreStatic: true,
  reporters: ['clear-text', 'progress', 'json', 'html', ...(dashboard ? ['dashboard'] : [])],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  dashboard: {
    project: process.env.STRYKER_PROJECT,
    version: process.env.GITHUB_SHA,
    reportType: 'full',
  },
  thresholds: { high: 95, low: 90, break: 90 },
};
```

- [ ] **Step 6: Run the whole unit suite and mutation testing**

Run: `pnpm test:unit && pnpm test:mutation`
Expected: all unit tests pass; Stryker reports a score of at least 90 and writes `reports/mutation/mutation.json`. For every surviving mutant, add a unit test to the owning module's test file that kills it (the target is at or near 100), then rerun.

- [ ] **Step 7: Commit**

```bash
git add tests/requirements.ts tests/tag.ts tests/unit/requirements.test.ts stryker.config.mjs vitest.unit.config.ts
git commit -m "Add requirements registry and mutation testing for src/lib"
```

---

## Task 12: Tokens, base styles and the page layout

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/layouts/Base.astro`
- Test: `tests/components/base-layout.test.ts`

**Interfaces:**
- Consumes: `personJsonLd`, `serializeJsonLd` (Task 9).
- Produces: `Base.astro` props `{ title: string; description: string; path: string; noindex?: boolean; jsonLd?: Record<string, unknown> }`. It renders `<head>` (meta, canonical, Open Graph, Twitter card, favicon links, 800-weight font preload, optional analytics), a skip link to `#main`, and a default slot. CSS class vocabulary used by every later task: `.page`, `.sec`, `.side`, `.note`, `.list`, `.row`, `.btn`, `.lnk`, `.muted`, `.big`, `[data-block]`, `[data-slot]`.

- [ ] **Step 1: Write the failing layout test**

`tests/components/base-layout.test.ts`:
```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Base from '../../src/layouts/Base.astro';

const render = async (props: Record<string, unknown>) => {
  const c = await AstroContainer.create();
  return c.renderToString(Base, { props: { title: 'T', description: 'D', path: '/quality', ...props }, slots: { default: '<main id="main">x</main>' } });
};

test('@REQ-PREV-01 canonical and Open Graph URLs are absolute and have no trailing slash', async () => {
  const html = await render({});
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/quality">/);
  expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+\/og\.png">/);
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
});
test('@REQ-PREV-01 JSON-LD is escaped and not executable', async () => {
  const html = await render({ jsonLd: { name: '</script><b>x' } });
  expect(html).toContain('<script type="application/ld+json">');
  expect(html).not.toContain('</script><b>');
});
test('@REQ-NF-01 noindex pages get a robots tag and no preview metadata', async () => {
  const html = await render({ noindex: true });
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).not.toContain('og:image');
});
test('@REQ-A11Y-02 every page starts with a skip link to main', async () => {
  expect(await render({})).toMatch(/<body[^>]*>\s*<a class="skip" href="#main">Skip to content<\/a>/);
});
test('@REQ-CSP-01 no analytics beacon unless the real build has a token', async () => {
  expect(await render({})).not.toContain('cloudflareinsights');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/components/base-layout.test.ts`
Expected: FAIL, cannot resolve `Base.astro`.

- [ ] **Step 3: Create `src/styles/tokens.css`** (values from `DESIGN.md`)

```css
:root {
  color-scheme: light dark;
  --bg: #FFF6F5; --ink: #2C1822; --muted: #7D5F69;
  --rose-mark: #CF3F68; --rose-mark-hover: #B8325A; --rose-mark-active: #9E2A4E; --on-rose: #FFFFFF;
  --rose-text: #B8325A; --visited: #8A2447;
  --coral: #F08A5D; --peach: #F7B596; --peach-end: #F3A07E; --blush: #FBE1E3; --line: #F1D9DC;
  --face: #F2B9C4; --rose-start: #E2557A;
  --gutter: 64px; --section-gap: 96px; --label-col: 220px; --col-gap: 48px; --max: 1120px;
  --font: "Schibsted Grotesk", ui-sans-serif, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1E1117; --ink: #F8E8EB; --muted: #B8949F;
    --rose-mark: #F0729A; --rose-mark-hover: #F48FB0; --rose-mark-active: #E0678E; --on-rose: #1E1117;
    --rose-text: #F0729A; --visited: #E8B89A;
    --coral: #F4A07C; --peach: #C9785C; --peach-end: #B8694F; --blush: #2E1A23; --line: #3A2530;
    --face: #4A2C39; --rose-start: #F0729A;
  }
}
@media (max-width: 899px) {
  :root { --gutter: 16px; --section-gap: 64px; }
}
```

- [ ] **Step 4: Create `src/styles/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: 100%; }
body { background: var(--bg); color: var(--ink); font: 400 18px/1.6 var(--font); font-variant-numeric: tabular-nums; }
@media (max-width: 899px) { body { font-size: 17px; } }
img, svg { display: block; max-width: 100%; }

.skip { position: absolute; left: 16px; top: -64px; background: var(--ink); color: var(--bg); padding: 12px 16px; border-radius: 8px; z-index: 10; }
.skip:focus { top: 16px; }
:focus-visible { outline: 2px solid var(--rose-text); outline-offset: 3px; border-radius: 4px; }

.page { max-width: calc(var(--max) + 2 * var(--gutter)); margin: 0 auto; padding: 64px var(--gutter) 32px; }
@media (max-width: 899px) { .page { padding-top: 32px; } }

.lnk, .prose a, .list a, .reqs a { color: var(--rose-text); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; text-decoration-color: color-mix(in srgb, var(--rose-text) 40%, transparent); font-weight: 500; }
.lnk:visited, .prose a:visited, .list a:visited, .reqs a:visited { color: var(--visited); text-decoration-color: var(--muted); }
.lnk { display: inline-flex; align-items: center; min-height: 44px; }

.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; border-radius: 10px; background: var(--rose-mark); color: var(--on-rose); font-weight: 700; text-decoration: none; }
.btn:hover { background: var(--rose-mark-hover); }
.btn:active { background: var(--rose-mark-active); }

.muted { color: var(--muted); }
h2 { font-size: 24px; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; }

.sec { display: grid; grid-template-columns: var(--label-col) 1fr; gap: var(--col-gap); margin-top: var(--section-gap); }
.sec > .side .note { font-size: 14px; color: var(--muted); margin-top: 8px; max-width: 26ch; line-height: 1.5; }
@media (max-width: 899px) { .sec { grid-template-columns: 1fr; gap: 12px; } }
.prose p { max-width: 62ch; }
.prose p + p { margin-top: 16px; }

.list { list-style: none; padding: 0; }
.row { display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; padding: 16px 0; border-top: 1px solid var(--line); align-items: start; }
.row:last-child { border-bottom: 1px solid var(--line); }
.row .meta { display: block; color: var(--muted); font-size: 16px; }
.row .cid { display: block; color: var(--muted); font-size: 14px; white-space: nowrap; }
.row .title { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.35; overflow-wrap: anywhere; }
.row.expired .title { color: var(--muted); }
.expired-label { display: inline-block; font-size: 13px; font-weight: 700; color: var(--muted); border: 1.5px solid var(--line); border-radius: 6px; padding: 0 8px; margin-left: 6px; vertical-align: 3px; }
@media (max-width: 899px) { .row { grid-template-columns: 32px 1fr; } .row > :last-child { grid-column: 2; } }

.tick-ink { fill: url(#tick-gradient); }
.tick-stop-a { stop-color: var(--rose-mark); }
.tick-stop-b { stop-color: var(--coral); }

.big { font-size: 24px; line-height: 1.45; font-weight: 500; letter-spacing: -0.01em; max-width: 40ch; }
.big b { font-weight: 800; }
@media (max-width: 899px) { .big { font-size: 20px; } }

/* Data blocks (E7, E14, G3): fallback until the loader marks the block ready. */
[data-block][data-state="unavailable"] > [data-slot="live"] { display: none; }
[data-block][data-state="ready"] > [data-slot="fallback"] { display: none; }
[data-block="proof-strip"] { min-height: 7.5em; }

.foot { margin-top: var(--section-gap); padding-top: 24px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); }
```

- [ ] **Step 5: Create `src/layouts/Base.astro`**

```astro
---
import '@fontsource/schibsted-grotesk/latin-400.css';
import '@fontsource/schibsted-grotesk/latin-500.css';
import '@fontsource/schibsted-grotesk/latin-800.css';
import '../styles/tokens.css';
import '../styles/base.css';
import font800 from '@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-800-normal.woff2?url';
import { serializeJsonLd } from '../lib/jsonld';

interface Props {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}
const { title, description, path, noindex = false, jsonLd } = Astro.props;
const site = (Astro.site?.href ?? 'https://ceylan-akyol.example.workers.dev/').replace(/\/$/, '');
const canonical = `${site}${path === '/' ? '' : path}`;
const beaconToken = process.env.BUILD_KIND === 'real' ? process.env.CF_BEACON_TOKEN : undefined;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href={font800} as="font" type="font/woff2" crossorigin />
    {noindex ? (
      <meta name="robots" content="noindex" />
    ) : (
      <>
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={`${site}/og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
      </>
    )}
    {jsonLd && <script type="application/ld+json" set:html={serializeJsonLd(jsonLd)} />}
    {beaconToken && (
      // Cloudflare updates beacon.min.js in place, so Subresource Integrity cannot be used here.
      <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: beaconToken })}></script>
    )}
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <svg width="0" height="0" aria-hidden="true" class="defs">
      <defs>
        <linearGradient id="tick-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" class="tick-stop-a" />
          <stop offset="1" class="tick-stop-b" />
        </linearGradient>
      </defs>
    </svg>
    <slot />
  </body>
</html>
```

Append to `src/styles/base.css`:
```css
.defs { position: absolute; }
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm vitest run tests/components/base-layout.test.ts`
Expected: PASS (5 tests). If the Container API cannot resolve the `?url` font import in Vitest, add `test: { server: { deps: { inline: ['@fontsource/schibsted-grotesk'] } } }` to `vitest.config.ts` and rerun.

- [ ] **Step 7: Commit**

```bash
git add src/styles src/layouts/Base.astro tests/components/base-layout.test.ts
git commit -m "Add design tokens, base styles and the page layout"
```

---

## Task 13: Content collections, CMS config and placeholder content

**Files:**
- Create: `src/content-schemas.ts`, `src/content.config.ts`, `scripts/make-placeholder-assets.ts`
- Create: `src/content/profile/profile.md`, `src/content/certifications/istqb-ctfl.yaml`
- Create: `tests/fixtures/content/profile/profile.md`, `tests/fixtures/content/certifications/*.yaml` (6 files)
- Create: `src/pages/cv.pdf.ts`, `.pages.yml`
- Test: `tests/unit/content-schemas.test.ts`

The spec lists a fixture certification "expiring today". Fixture files are static while "today" is the build date, so that boundary is covered by the unit tests in Task 2; the fixtures cover past and future expiry instead.

**Interfaces:**
- Produces:
  - `photoProblem(meta: { width: number; height: number; format: string }): string | null`
  - `certificationObject` (Zod object, `astro/zod`), `certificationRules` (with the expiry refinement)
  - `profileObject(image: () => ZodTypeAny)` (Zod object factory)
  - `PROFILE_FIELDS`, `CERTIFICATION_FIELDS`: `{ name: string; required: boolean }[]` derived from the schemas
  - Collections `profile` (single entry id `profile`) and `certifications`
  - `/cv.pdf` endpoint serving the file named by the profile's `cv` field

- [ ] **Step 1: Write the failing schema tests**

`tests/unit/content-schemas.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import {
  certificationRules, photoProblem, profileObject, PROFILE_FIELDS, CERTIFICATION_FIELDS,
} from '../../src/content-schemas';

const cert = (over: Record<string, unknown>) => ({ name: 'A', issuer: 'ISTQB', issueDate: '2024-03-01', ...over });

test('@REQ-CONTENT-01 a minimal certification is valid and defaults are applied', () => {
  const r = certificationRules.safeParse(cert({}));
  expect(r.success).toBe(true);
  if (r.success) expect(r.data).toMatchObject({ hidden: false, placeholder: false });
});
test('@REQ-CONTENT-01 an expiry before the issue date is rejected with a plain message', () => {
  const r = certificationRules.safeParse(cert({ expiryDate: '2023-01-01' }));
  expect(r.success).toBe(false);
  if (!r.success) expect(r.error.issues[0]!.message).toBe('The expiry date cannot be before the issue date.');
});
test('@REQ-CONTENT-01 a malformed verify URL is rejected', () => {
  expect(certificationRules.safeParse(cert({ verifyUrl: 'not a url' })).success).toBe(false);
});
test('@REQ-CONTENT-01 badge images are no longer accepted (G1)', () => {
  expect(CERTIFICATION_FIELDS.map((f) => f.name)).not.toContain('badge');
});
test('@REQ-CONTENT-01 photos must be JPG, PNG, WebP or AVIF and at least 800px on the short side', () => {
  expect(photoProblem({ width: 900, height: 1200, format: 'jpg' })).toBeNull();
  expect(photoProblem({ width: 799, height: 1200, format: 'webp' })).toBe('The photo must be at least 800px on its shorter side (it is 799px).');
  expect(photoProblem({ width: 900, height: 900, format: 'heic' })).toBe('The photo must be JPG, PNG, WebP or AVIF.');
});
test('@REQ-AVAIL-01 availability is optional, switched off by default, and short', () => {
  const schema = profileObject(() => z.any());
  const base = { name: 'N', title: 'T', tagline: 'Tag', photo: 'x', photoAlt: 'Alt', email: 'a@b.co', linkedinUrl: 'https://l.example', githubUrl: 'https://g.example', cv: 'src/assets/uploads/cv.pdf' };
  const ok = schema.safeParse(base);
  expect(ok.success && ok.data.showAvailability).toBe(false);
  expect(schema.safeParse({ ...base, availability: 'x'.repeat(101) }).success).toBe(false);
  expect(schema.safeParse({ ...base, cv: 'cv.docx' }).success).toBe(false);
});
test('@REQ-CONTENT-02 .pages.yml defines exactly the schema fields with the same required flags', () => {
  const cms = parse(readFileSync('.pages.yml', 'utf8')) as { content: { name: string; fields: { name: string; required?: boolean }[] }[] };
  const fields = (name: string) => cms.content.find((c) => c.name === name)!.fields
    .filter((f) => f.name !== 'body')
    .map((f) => ({ name: f.name, required: f.required === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sorted = (xs: { name: string; required: boolean }[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name));
  expect(fields('profile')).toEqual(sorted(PROFILE_FIELDS));
  expect(fields('certifications')).toEqual(sorted(CERTIFICATION_FIELDS));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/content-schemas.test.ts`
Expected: FAIL, cannot resolve `content-schemas`.

- [ ] **Step 3: Implement `src/content-schemas.ts`**

```ts
import { z } from 'astro/zod';

const PHOTO_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);

export function photoProblem(meta: { width: number; height: number; format: string }): string | null {
  if (!PHOTO_FORMATS.has(meta.format.toLowerCase())) return 'The photo must be JPG, PNG, WebP or AVIF.';
  const short = Math.min(meta.width, meta.height);
  if (short < 800) return `The photo must be at least 800px on its shorter side (it is ${short}px).`;
  return null;
}

export const certificationObject = z.object({
  name: z.string().min(1).max(120),
  issuer: z.string().min(1).max(80),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  credentialId: z.string().max(60).optional(),
  verifyUrl: z.string().url().optional(),
  hidden: z.boolean().default(false),
  placeholder: z.boolean().default(false),
});

export const certificationRules = certificationObject.refine(
  (c) => !c.expiryDate || c.expiryDate >= c.issueDate,
  { message: 'The expiry date cannot be before the issue date.', path: ['expiryDate'] },
);

export const profileObject = (image: () => z.ZodTypeAny) => z.object({
  name: z.string().min(1).max(60),
  title: z.string().min(1).max(60),
  tagline: z.string().min(1).max(160),
  photo: image(),
  photoAlt: z.string().min(1).max(200),
  email: z.string().email(),
  linkedinUrl: z.string().url(),
  githubUrl: z.string().url(),
  cv: z.string().regex(/\.pdf$/i, 'The CV must be a PDF.'),
  availability: z.string().max(100).optional(),
  showAvailability: z.boolean().default(false),
  placeholder: z.boolean().default(false),
});

const fieldsOf = (shape: Record<string, z.ZodTypeAny>) =>
  Object.entries(shape).map(([name, s]) => ({ name, required: !s.isOptional() }));

// z.string() stands in for image(): both are required, which is what the drift test compares.
export const PROFILE_FIELDS = fieldsOf(profileObject(() => z.string()).shape);
export const CERTIFICATION_FIELDS = fieldsOf(certificationObject.shape);
```

Note: fields with `.default(...)` count as optional (`isOptional()` is true), which matches `.pages.yml` where they are not required.

- [ ] **Step 4: Create `src/content.config.ts`**

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { certificationRules, photoProblem, profileObject } from './content-schemas';

// CONTENT_DIR switches between real content and fixtures (spec section 8).
// The glob loader resolves `base` from the working directory; a wrong value
// yields an empty collection, which the @real count check catches.
const base = process.env.CONTENT_DIR ?? 'src/content';

const profile = defineCollection({
  loader: glob({ pattern: 'profile.md', base: `${base}/profile` }),
  schema: ({ image }) => profileObject(() =>
    image().superRefine((meta, ctx) => {
      const problem = photoProblem(meta);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),
  ),
});

const certifications = defineCollection({
  loader: glob({ pattern: '*.yaml', base: `${base}/certifications` }),
  schema: certificationRules,
});

export const collections = { profile, certifications };
```

- [ ] **Step 5: Create the placeholder asset script and run it**

`scripts/make-placeholder-assets.ts`:
```ts
// Creates clearly fake assets so the site builds before real content arrives.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;
const square = (hex: string) => sharp({ create: { width: 900, height: 900, channels: 3, background: hex } });

mkdirSync('src/assets/uploads', { recursive: true });
mkdirSync('tests/fixtures/content/assets', { recursive: true });
await square('#FBE1E3').jpeg({ quality: 80 }).toFile('src/assets/uploads/photo.jpg');
await square('#F2B9C4').webp({ quality: 80 }).toFile('tests/fixtures/content/assets/photo.webp');
writeFileSync('src/assets/uploads/cv.pdf', PDF);
writeFileSync('tests/fixtures/content/assets/cv.pdf', PDF);
console.log('Placeholder assets written.');
```

Run: `pnpm assets:placeholders`
Expected: the four files exist.

- [ ] **Step 6: Create the real placeholder content**

`src/content/profile/profile.md`:
```md
---
name: Ceylan Akyol
title: QA Automation Engineer
tagline: I build test automation that teams can read, trust and keep running.
photo: ../../assets/uploads/photo.jpg
photoAlt: Placeholder square, to be replaced by Ceylan's photo
email: hello@example.com
linkedinUrl: https://www.linkedin.com/in/example
githubUrl: https://github.com/example
cv: src/assets/uploads/cv.pdf
showAvailability: false
placeholder: true
---
Placeholder About text. Replace with at most about 90 words that do not repeat the tagline.
```

`src/content/certifications/istqb-ctfl.yaml`:
```yaml
name: ISTQB Certified Tester, Foundation Level
issuer: ISTQB
issueDate: 2024-03-01
credentialId: PLACEHOLDER-0001
verifyUrl: https://www.istqb.org/
placeholder: true
```

- [ ] **Step 7: Create the fixture content**

`tests/fixtures/content/profile/profile.md`:
```md
---
name: Ceylan Akyol Testname Longerthanusual Xy
title: QA Automation Engineer
tagline: I build test automation that teams can read, trust and keep running.
photo: ../assets/photo.webp
photoAlt: Fixture portrait
email: fixture@example.com
linkedinUrl: https://www.linkedin.com/in/fixture
githubUrl: https://github.com/fixture
cv: tests/fixtures/content/assets/cv.pdf
availability: Based in Fixture City, open to remote. Available from November.
showAvailability: true
---
For five years I have tested web and API products in small teams. Long link for wrapping checks: https://example.com/a/really/long/path/that/should/wrap/instead/of/scrolling/sideways/on/small/phones.
```

(The name is exactly 40 characters: `Ceylan Akyol Testname Longerthanusual Xy`.)

`tests/fixtures/content/certifications/a-valid-future.yaml`:
```yaml
name: ISTQB Test Automation Engineering
issuer: ISTQB
issueDate: 2024-11-01
expiryDate: 2099-03-01
credentialId: TAE-2024-18842
verifyUrl: https://verify.example/tae
```
`tests/fixtures/content/certifications/b-foundation.yaml`:
```yaml
name: ISTQB Certified Tester, Foundation Level
issuer: ISTQB
issueDate: 2024-03-01
credentialId: CTFL-2024-09311
verifyUrl: https://verify.example/ctfl
```
`tests/fixtures/content/certifications/c-no-verify.yaml`:
```yaml
name: Postman API Fundamentals Student Expert
issuer: Postman
issueDate: 2023-06-01
```
`tests/fixtures/content/certifications/d-expired.yaml`:
```yaml
name: Scrum Fundamentals Certified
issuer: SCRUMstudy
issueDate: 2021-01-01
expiryDate: 2024-01-15
credentialId: SFC-771203
verifyUrl: https://verify.example/sfc
```
`tests/fixtures/content/certifications/e-hidden.yaml`:
```yaml
name: Hidden Certification Must Not Render
issuer: Nobody
issueDate: 2025-01-01
hidden: true
```
`tests/fixtures/content/certifications/f-long-name.yaml`:
```yaml
name: International Software Testing Qualifications Board Certified Tester Advanced Level Test Analyst
issuer: ISTQB
issueDate: 2022-05-01
credentialId: CTAL-TA-2022-000000000001
verifyUrl: https://verify.example/ctal
```

- [ ] **Step 8: Create the CV endpoint**

`src/pages/cv.pdf.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { getEntry } from 'astro:content';

// Stable URL /cv.pdf whatever the uploaded file is called (spec section 4).
export async function GET() {
  const profile = await getEntry('profile', 'profile');
  if (!profile) throw new Error('Missing profile content.');
  const bytes = await readFile(profile.data.cv);
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
}
```

- [ ] **Step 9: Create `.pages.yml`**

Check the current Pages CMS configuration reference (https://pagescms.org/docs/configuration/) for the exact media and field option keys before saving; the structure below uses its documented `media`, `content`, `type: file`, `type: collection` and field `options`.

```yaml
media:
  - name: uploads
    label: Photos and CV
    input: src/assets/uploads
    output: ../../assets/uploads
    extensions: [jpg, jpeg, png, webp, avif, pdf]

content:
  - name: profile
    label: Profile
    type: file
    path: src/content/profile/profile.md
    format: yaml-frontmatter
    fields:
      - { name: name, label: Name, type: string, required: true }
      - { name: title, label: Job title, type: string, required: true }
      - { name: tagline, label: Tagline (one sentence), type: string, required: true }
      - { name: photo, label: Photo (JPG, PNG, WebP or AVIF, at least 800px), type: image, required: true, options: { media: uploads, extensions: [jpg, jpeg, png, webp, avif] } }
      - { name: photoAlt, label: Photo description, type: string, required: true }
      - { name: email, label: Email, type: string, required: true }
      - { name: linkedinUrl, label: LinkedIn URL, type: string, required: true }
      - { name: githubUrl, label: GitHub URL, type: string, required: true }
      - { name: cv, label: CV (PDF, public version without phone or address), type: file, required: true, options: { media: uploads, extensions: [pdf], path: src/assets/uploads } }
      - { name: availability, label: Availability line, type: string }
      - { name: showAvailability, label: Show availability on the site, type: boolean }
      - { name: placeholder, label: Placeholder (blocks deploy), type: boolean }
      - { name: body, label: About (at most about 90 words), type: rich-text }

  - name: certifications
    label: Certifications
    type: collection
    path: src/content/certifications
    format: yaml
    fields:
      - { name: name, label: Name, type: string, required: true }
      - { name: issuer, label: Issuer, type: string, required: true }
      - { name: issueDate, label: Issue date, type: date, required: true }
      - { name: expiryDate, label: Expiry date, type: date }
      - { name: credentialId, label: Credential ID, type: string }
      - { name: verifyUrl, label: Verification URL, type: string }
      - { name: hidden, label: Hide from the site, type: boolean }
      - { name: placeholder, label: Placeholder (blocks deploy), type: boolean }
```

The CV field stores the repo-relative path (`src/assets/uploads/...pdf`), which the `/cv.pdf` endpoint reads. If Pages CMS writes a different path shape for file fields, adjust `cv.pdf.ts` to resolve it and keep the drift test green.

- [ ] **Step 10: Run the tests and both builds**

Run: `pnpm vitest run tests/unit/content-schemas.test.ts && pnpm build:real && pnpm build:fixture`
Expected: 7 tests pass; both builds succeed; `dist/cv.pdf` and `dist-fixture/cv.pdf` exist.

- [ ] **Step 11: Commit**

```bash
git add src/content-schemas.ts src/content.config.ts src/content src/assets/uploads src/pages/cv.pdf.ts scripts/make-placeholder-assets.ts tests/fixtures/content .pages.yml tests/unit/content-schemas.test.ts
git commit -m "Add content collections, CMS config, fixtures and placeholder content"
```

---

## Task 14: Brush ring, photo frame and tick components

**Files:**
- Create: `scripts/extract-brush-paths.ts`, `src/lib/brush-ring.ts` (generated), `src/components/PhotoFrame.astro`, `src/components/Tick.astro`
- Modify: `src/styles/base.css` (append ring styles)
- Test: `tests/components/photo-frame.test.ts`

**Interfaces:**
- Consumes: `TICK_PATH` (Task 10); `docs/superpowers/specs/assets/photo-mark.svg`.
- Produces: `RING_MAIN`, `RING_SECOND` path strings; `<PhotoFrame photo={ImageMetadata} alt={string} size="hero" />`; `<Tick size={number} />`.

- [ ] **Step 1: Write the extraction script and run it**

`scripts/extract-brush-paths.ts`:
```ts
// Copies the approved ring geometry out of the design asset into a TS module.
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('docs/superpowers/specs/assets/photo-mark.svg', 'utf8');
const find = (id: string) => {
  const m = new RegExp(`<path d="(M[^"]+)" fill="url\\(#${id}\\)"`).exec(svg);
  if (!m) throw new Error(`Path for #${id} not found`);
  return m[1];
};
const out = `// Generated by scripts/extract-brush-paths.ts from docs/superpowers/specs/assets/photo-mark.svg. Do not edit.
export const RING_MAIN = ${JSON.stringify(find('ink2'))};
export const RING_SECOND = ${JSON.stringify(find('ink22'))};
`;
writeFileSync('src/lib/brush-ring.ts', out);
console.log('src/lib/brush-ring.ts written.');
```

Run: `pnpm brush:extract`
Expected: `src/lib/brush-ring.ts` exists and both constants start with `M`.

- [ ] **Step 2: Write the failing component test**

`tests/components/photo-frame.test.ts`:
```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import PhotoFrame from '../../src/components/PhotoFrame.astro';
import Tick from '../../src/components/Tick.astro';
// A real image module, so <Picture> can process it (generated in Task 13).
import photo from '../fixtures/content/assets/photo.webp';

test('@REQ-HERO-01 the frame reserves the square and renders the photo with alt text', async () => {
  const c = await AstroContainer.create();
  const html = await c.renderToString(PhotoFrame, { props: { photo, alt: 'Portrait of Ceylan' } });
  expect(html).toContain('class="photo-frame"');
  expect(html).toContain('alt="Portrait of Ceylan"');
  expect(html).toContain('fetchpriority="high"');
  expect(html).not.toMatch(/\sstyle=/);
});
test('@REQ-A11Y-03 the ring is decorative and its draw-in uses masks, not inline styles', async () => {
  const c = await AstroContainer.create();
  const html = await c.renderToString(PhotoFrame, { props: { photo, alt: 'x' } });
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('<mask id="ring-mask-main"');
  expect(html).not.toContain('<style');
});
test('@REQ-CERT-04 the tick is decorative', async () => {
  const c = await AstroContainer.create();
  const html = await c.renderToString(Tick, { props: { size: 30 } });
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('class="tick-ink"');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run tests/components/photo-frame.test.ts`
Expected: FAIL, components missing.

- [ ] **Step 4: Implement the components**

`src/components/Tick.astro`:
```astro
---
import { TICK_PATH } from '../lib/brush-tick';
interface Props { size?: number }
const { size = 30 } = Astro.props;
---
<svg class="tick" viewBox="0 0 36 30" width={size} height={Math.round((size * 30) / 36)} aria-hidden="true">
  <path d={TICK_PATH} class="tick-ink" />
</svg>
```

`src/components/PhotoFrame.astro`:
```astro
---
import { Picture } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { RING_MAIN, RING_SECOND } from '../lib/brush-ring';
interface Props { photo: ImageMetadata; alt: string }
const { photo, alt } = Astro.props;
---
<div class="photo-frame">
  <Picture
    class="photo"
    src={photo}
    alt={alt}
    formats={['avif', 'webp']}
    widths={[160, 320, 480, 640]}
    sizes="(max-width: 899px) 104px, 173px"
    loading="eager"
    fetchpriority="high"
  />
  <svg class="ring" viewBox="0 0 300 300" aria-hidden="true">
    <defs>
      <linearGradient id="ring-main-gradient" gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="270" y2="270">
        <stop offset="0" class="ring-stop-start" />
        <stop offset=".55" class="ring-stop-mid" />
        <stop offset="1" class="ring-stop-end" />
      </linearGradient>
      <linearGradient id="ring-second-gradient" gradientUnits="userSpaceOnUse" x1="270" y1="30" x2="30" y2="270">
        <stop offset="0" class="ring-stop-peach" />
        <stop offset="1" class="ring-stop-peach-end" />
      </linearGradient>
      <!-- Draw-in (spec section 6): a thick circular stroke inside each mask sweeps from the stroke start, revealing the filled brush. -->
      <mask id="ring-mask-main" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
        <circle class="ring-sweep ring-sweep-main" cx="150" cy="150" r="128" />
      </mask>
      <mask id="ring-mask-second" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
        <circle class="ring-sweep ring-sweep-second" cx="150" cy="150" r="128" />
      </mask>
    </defs>
    <path d={RING_SECOND} class="ring-second" mask="url(#ring-mask-second)" />
    <path d={RING_MAIN} class="ring-main" mask="url(#ring-mask-main)" />
  </svg>
</div>
```

Append to `src/styles/base.css`:
```css
/* Photo frame: the blush square is reserved before the image loads (G5). */
.photo-frame { position: relative; width: 250px; aspect-ratio: 1; }
.photo-frame::before { content: ""; position: absolute; inset: 15.3%; border-radius: 50%; background: var(--blush); }
.photo-frame .photo, .photo-frame .photo img { position: absolute; inset: 15.3%; width: 69.4%; height: 69.4%; border-radius: 50%; object-fit: cover; }
.photo-frame .ring { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
@media (max-width: 899px) { .photo-frame { width: 150px; } }

.ring-stop-start { stop-color: var(--rose-start); }
.ring-stop-mid { stop-color: var(--rose-mark); }
.ring-stop-end { stop-color: var(--coral); }
.ring-stop-peach { stop-color: var(--peach); }
.ring-stop-peach-end { stop-color: var(--peach-end); }
.ring-main { fill: url(#ring-main-gradient); }
.ring-second { fill: url(#ring-second-gradient); }

/* One motion per page load: the ring draws itself, main stroke then second pass (about 900ms). */
.ring-sweep { fill: none; stroke: #fff; stroke-width: 44; stroke-dasharray: 805; stroke-dashoffset: 0; transform-origin: 150px 150px; }
.ring-sweep-main { transform: rotate(-50deg) scaleY(-1); animation: ring-draw 600ms cubic-bezier(.6, 0, .3, 1) both; }
.ring-sweep-second { transform: rotate(-20deg) scaleY(-1); animation: ring-draw 400ms cubic-bezier(.6, 0, .3, 1) 500ms both; }
@keyframes ring-draw { from { stroke-dashoffset: 805; } to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .ring-sweep-main, .ring-sweep-second { animation: none; } }
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/components/photo-frame.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Visual check of the draw-in**

Run: `pnpm build:real && pnpm exec wrangler dev --assets ./dist --port 8788 --local` after Task 16 adds the hero. Open `http://localhost:8788/` and confirm the ring draws counterclockwise from about 1 o'clock (matching the approved stroke start); if it draws the wrong way, flip `scaleY(-1)` off. Record the result in the commit message.

- [ ] **Step 7: Commit**

```bash
git add scripts/extract-brush-paths.ts src/lib/brush-ring.ts src/components/PhotoFrame.astro src/components/Tick.astro src/styles/base.css tests/components/photo-frame.test.ts
git commit -m "Add brush ring photo frame with masked draw-in and tick component"
```

---

## Task 15: Certifications section

**Files:**
- Create: `src/components/Certifications.astro`, `src/components/CertEntry.astro`
- Test: `tests/components/certifications.test.ts`

**Interfaces:**
- Consumes: `Certification`, `visibleCertifications`, `validity`, `validityLabel`, `hasVerification`, `showTickNote`, `formatMonthYear` (Task 2); `Tick` (Task 14).
- Produces: `<Certifications entries={Certification[]} today={Date} />` rendering nothing when no entry is visible.

- [ ] **Step 1: Write the failing tests**

`tests/components/certifications.test.ts`:
```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Certifications from '../../src/components/Certifications.astro';
import type { Certification } from '../../src/lib/certifications';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d('2026-09-27');
const render = async (entries: Certification[]) => (await AstroContainer.create()).renderToString(Certifications, { props: { entries, today } });
const c = (over: Partial<Certification>): Certification => ({ id: 'x', name: 'Cert', issuer: 'ISTQB', issueDate: d('2024-03-01'), ...over });

test('@REQ-STATE-01 zero visible certifications render nothing', async () => {
  expect((await render([c({ hidden: true })])).trim()).toBe('');
  expect((await render([])).trim()).toBe('');
});
test('@REQ-CERT-04 verifiable entries get a tick and a uniquely named verify link', async () => {
  const html = await render([c({ name: 'ISTQB Foundation', verifyUrl: 'https://v.example/1' })]);
  expect(html).toContain('class="tick"');
  expect(html).toContain('aria-label="Verify credential: ISTQB Foundation"');
  expect(html).toContain('>Verify credential</a>');
  expect(html).not.toContain('target=');
});
test('@REQ-CERT-06 the tick note appears only when a tick is shown', async () => {
  expect(await render([c({ verifyUrl: 'https://v.example' })])).toContain('A tick means you can verify it with the issuer.');
  expect(await render([c({})])).not.toContain('A tick means');
});
test('@REQ-CERT-05 validity dates and the expired label', async () => {
  const html = await render([
    c({ id: 'a', name: 'Future', expiryDate: d('2027-03-01') }),
    c({ id: 'b', name: 'Past', expiryDate: d('2024-01-15'), issueDate: d('2021-01-01') }),
  ]);
  expect(html).toContain('Issued by ISTQB, March 2024. Valid until March 2027');
  expect(html).toContain('Issued by ISTQB, January 2021. Expired January 2024');
  expect(html).toMatch(/class="row expired"/);
  expect(html).toContain('<span class="expired-label">Expired</span>');
});
test('@REQ-CERT-01 renders in newest-first order with the credential ID', async () => {
  const html = await render([c({ id: 'o', name: 'Older', issueDate: d('2020-01-01') }), c({ id: 'n', name: 'Newer', credentialId: 'ID-1' })]);
  expect(html.indexOf('Newer')).toBeLessThan(html.indexOf('Older'));
  expect(html).toContain('Credential ID ID-1');
});
test('@REQ-A11Y-04 the section is labelled by its heading', async () => {
  const html = await render([c({})]);
  expect(html).toMatch(/<section[^>]*aria-labelledby="certifications-heading"/);
  expect(html).toContain('id="certifications-heading"');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/components/certifications.test.ts`
Expected: FAIL, components missing.

- [ ] **Step 3: Implement**

`src/components/CertEntry.astro`:
```astro
---
import Tick from './Tick.astro';
import { formatMonthYear } from '../lib/dates';
import { hasVerification, validity, validityLabel, type Certification } from '../lib/certifications';
interface Props { entry: Certification; today: Date }
const { entry, today } = Astro.props;
const v = validity(entry, today);
const label = validityLabel(v);
const verifiable = hasVerification(entry);
const meta = `Issued by ${entry.issuer}, ${formatMonthYear(entry.issueDate)}${label ? `. ${label}` : ''}`;
---
<li class:list={['row', { expired: v.kind === 'expired' }]}>
  {verifiable ? <Tick size={30} /> : <span />}
  <div>
    <span class="title">{entry.name}</span>{v.kind === 'expired' && <> <span class="expired-label">Expired</span></>}
    <span class="meta">{meta}</span>
    {entry.credentialId && <span class="cid">Credential ID {entry.credentialId}</span>}
  </div>
  {verifiable ? (
    <a class="lnk" href={entry.verifyUrl} aria-label={`Verify credential: ${entry.name}`}>Verify credential</a>
  ) : <span />}
</li>
```

`src/components/Certifications.astro`:
```astro
---
import CertEntry from './CertEntry.astro';
import { showTickNote, visibleCertifications, type Certification } from '../lib/certifications';
interface Props { entries: Certification[]; today: Date }
const { entries, today } = Astro.props;
const visible = visibleCertifications(entries);
---
{visible.length > 0 && (
  <section class="sec" aria-labelledby="certifications-heading">
    <div class="side">
      <h2 id="certifications-heading">Certifications</h2>
      {showTickNote(visible) && <p class="note">A tick means you can verify it with the issuer.</p>}
    </div>
    <ul class="list">
      {visible.map((entry) => <CertEntry entry={entry} today={today} />)}
    </ul>
  </section>
)}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/components/certifications.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Certifications.astro src/components/CertEntry.astro tests/components/certifications.test.ts
git commit -m "Add certifications section with validity dates and verify links"
```

---

## Task 16: Hero, proof strip, About, Contact, footer and the home page

**Files:**
- Create: `src/components/Hero.astro`, `src/components/ProofStrip.astro`, `src/components/About.astro`, `src/components/Contact.astro`, `src/components/Footer.astro`, `src/lib/content.ts`, `src/lib/site.ts`
- Modify: `src/pages/index.astro` (replace the Task 1 placeholder)
- Test: `tests/components/home-sections.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 9, 10, 12 to 15.
- Produces:
  - `loadProfile(): Promise<{ data: ProfileData; About: AstroComponentFactory; aboutText: string }>` and `loadCertifications(): Promise<Certification[]>` in `src/lib/content.ts` (thin wrappers over `getEntry` and `getCollection`; excluded from Stryker because Astro virtual modules are unavailable to its runner).
  - `CV_FILENAME = 'Ceylan-Akyol-CV.pdf'` in `src/lib/site.ts` (a plain module, so components importing it stay renderable in Container API tests)
  - Home page section order (G2): Hero, Certifications, ProofStrip, About, Contact, Footer.

- [ ] **Step 1: Write the failing component tests**

`tests/components/home-sections.test.ts`:
```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Hero from '../../src/components/Hero.astro';
import ProofStrip from '../../src/components/ProofStrip.astro';
import Contact from '../../src/components/Contact.astro';
import Footer from '../../src/components/Footer.astro';
import photo from '../fixtures/content/assets/photo.webp';
const profile = {
  name: 'Ceylan Akyol', title: 'QA Automation Engineer', tagline: 'I build test automation that teams can read, trust and keep running.',
  photo, photoAlt: 'Portrait', email: 'hi@example.com', linkedinUrl: 'https://linkedin.example/c', githubUrl: 'https://github.example/c',
  cv: 'x.pdf', showAvailability: false, placeholder: false,
};
const render = async (C: any, props: Record<string, unknown>) => (await AstroContainer.create()).renderToString(C, { props });

test('@REQ-HERO-01 hero shows name as h1, title and tagline', async () => {
  const html = await render(Hero, { profile });
  expect(html).toMatch(/<h1 class="name">Ceylan Akyol<\/h1>/);
  expect(html).toContain('QA Automation Engineer');
  expect(html).toContain('I build test automation');
});
test('@REQ-CV-02 the hero CV button downloads with the owner name', async () => {
  expect(await render(Hero, { profile })).toContain('<a class="btn" href="/cv.pdf" download="Ceylan-Akyol-CV.pdf">Download CV (PDF)</a>');
});
test('@REQ-CONTACT-01 hero links are Email, LinkedIn, GitHub in that order', async () => {
  const html = await render(Hero, { profile });
  const order = ['mailto:hi@example.com', 'https://linkedin.example/c', 'https://github.example/c'].map((h) => html.indexOf(h));
  expect(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1]!))).toBe(true);
});
test('@REQ-AVAIL-01 the availability line shows only when switched on', async () => {
  expect(await render(Hero, { profile: { ...profile, availability: 'Open to remote.' } })).not.toContain('Open to remote.');
  expect(await render(Hero, { profile: { ...profile, availability: 'Open to remote.', showAvailability: true } })).toContain('<p class="avail">Open to remote.</p>');
});
test('@REQ-QUAL-01 the proof strip ships a true fallback sentence and an empty live slot', async () => {
  const html = await render(ProofStrip, {});
  expect(html).toContain('data-block="proof-strip" data-state="unavailable"');
  expect(html).toContain('Every change runs through automated tests in 3 browser engines and 5 device profiles before it deploys.');
  expect(html).toContain('<div data-slot="live"></div>');
  expect(html).toContain('href="/quality"');
});
test('@REQ-CV-02 contact starts with the CV link', async () => {
  const html = await render(Contact, { profile });
  expect(html.indexOf('download="Ceylan-Akyol-CV.pdf"')).toBeLessThan(html.indexOf('mailto:'));
});
test('@REQ-A11Y-04 the footer is a landmark with only name and year', async () => {
  const html = await render(Footer, { name: 'Ceylan Akyol', year: 2026 });
  expect(html).toMatch(/<footer class="foot">\s*Ceylan Akyol, 2026\s*<\/footer>/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/components/home-sections.test.ts`
Expected: FAIL, components missing.

- [ ] **Step 3: Implement the content loaders**

`src/lib/site.ts`:
```ts
export const CV_FILENAME = 'Ceylan-Akyol-CV.pdf';
```

`src/lib/content.ts`:
```ts
import { getCollection, getEntry, render } from 'astro:content';
import type { Certification } from './certifications';

export async function loadProfile() {
  const entry = await getEntry('profile', 'profile');
  if (!entry) throw new Error('src/content/profile/profile.md is missing.');
  const { Content } = await render(entry);
  return { data: entry.data, About: Content, aboutText: entry.body ?? '' };
}

export async function loadCertifications(): Promise<Certification[]> {
  const entries = await getCollection('certifications');
  return entries.map((e) => ({ id: e.id, ...e.data }));
}
```

In `stryker.config.mjs`, change `mutate` to `['src/lib/**/*.ts', '!src/lib/brush-*.ts', '!src/lib/content.ts']` (Astro virtual modules are not available to Stryker's runner).

- [ ] **Step 4: Implement the components**

`src/components/Hero.astro`:
```astro
---
import PhotoFrame from './PhotoFrame.astro';
import { CV_FILENAME } from '../lib/site';
interface Props { profile: { name: string; title: string; tagline: string; photo: any; photoAlt: string; email: string; linkedinUrl: string; githubUrl: string; availability?: string; showAvailability: boolean } }
const { profile: p } = Astro.props;
---
<header class="hero">
  <div class="h-text">
    <h1 class="name">{p.name}</h1>
    <p class="role">{p.title}</p>
    {p.showAvailability && p.availability && <p class="avail">{p.availability}</p>}
    <p class="tag">{p.tagline}</p>
    <div class="acts">
      <a class="btn" href="/cv.pdf" download={CV_FILENAME}>Download CV (PDF)</a>
      <div class="links">
        <a class="lnk" href={`mailto:${p.email}`}>Email</a>
        <a class="lnk" href={p.linkedinUrl}>LinkedIn</a>
        <a class="lnk" href={p.githubUrl}>GitHub</a>
      </div>
    </div>
  </div>
  <PhotoFrame photo={p.photo} alt={p.photoAlt} />
</header>
```

`src/components/ProofStrip.astro`:
```astro
---
---
<section class="sec proof" aria-labelledby="proof-heading">
  <h2 id="proof-heading">How this site is tested</h2>
  <div>
    <div data-block="proof-strip" data-state="unavailable">
      <div data-slot="fallback"><p class="big">Every change runs through automated tests in 3 browser engines and 5 device profiles before it deploys.</p></div>
      <div data-slot="live"></div>
    </div>
    <p class="sub"><a class="lnk" href="/quality">See every requirement and the tests behind it</a></p>
  </div>
</section>
<script>
  import { hydrate } from '../lib/quality-client';
  import { renderProofStrip } from '../lib/render-home';
  hydrate(document, { 'proof-strip': renderProofStrip }, (url) => fetch(url, { cache: 'no-cache' }));
</script>
```

`src/components/About.astro`:
```astro
---
interface Props { About: any }
const { About } = Astro.props;
---
<section class="sec" aria-labelledby="about-heading">
  <h2 id="about-heading">About</h2>
  <div class="prose"><About /></div>
</section>
```

`src/components/Contact.astro`:
```astro
---
import { CV_FILENAME } from '../lib/site';
interface Props { profile: { email: string; linkedinUrl: string; githubUrl: string } }
const { profile: p } = Astro.props;
---
<section class="sec" aria-labelledby="contact-heading">
  <h2 id="contact-heading">Contact</h2>
  <div class="cl">
    <a class="lnk" href="/cv.pdf" download={CV_FILENAME}>Download CV (PDF)</a>
    <a class="lnk" href={`mailto:${p.email}`}>Email</a>
    <a class="lnk" href={p.linkedinUrl}>LinkedIn</a>
    <a class="lnk" href={p.githubUrl}>GitHub</a>
  </div>
</section>
```

`src/components/Footer.astro`:
```astro
---
interface Props { name: string; year: number }
const { name, year } = Astro.props;
---
<footer class="foot">{name}, {year}</footer>
```

Append to `src/styles/base.css`:
```css
.hero { display: grid; grid-template-columns: 1fr 280px; gap: 48px; align-items: center; }
.name { font-size: 96px; font-weight: 800; line-height: .92; letter-spacing: -0.035em; overflow-wrap: anywhere; }
.role { font-size: 20px; font-weight: 500; margin-top: 24px; }
.avail { font-size: 16px; margin-top: 4px; }
.tag { font-size: 20px; color: var(--muted); margin-top: 8px; max-width: 38ch; line-height: 1.5; }
.acts { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; margin-top: 32px; font-size: 17px; }
.links, .cl { display: flex; flex-wrap: wrap; gap: 0 24px; }
.proof { padding: 32px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.sub { margin-top: 12px; font-size: 16px; }
@media (max-width: 899px) {
  .hero { grid-template-columns: 1fr; gap: 16px; }
  .hero .photo-frame { order: -1; }
  .name { font-size: 60px; }
  .role, .tag { font-size: 18px; }
  .acts { flex-direction: column; align-items: stretch; gap: 8px; margin-top: 24px; }
}
```

- [ ] **Step 5: Replace `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import Certifications from '../components/Certifications.astro';
import ProofStrip from '../components/ProofStrip.astro';
import About from '../components/About.astro';
import Contact from '../components/Contact.astro';
import Footer from '../components/Footer.astro';
import { loadCertifications, loadProfile } from '../lib/content';
import { personJsonLd } from '../lib/jsonld';

const { data: profile, About: AboutContent } = await loadProfile();
const certifications = await loadCertifications();
const today = new Date();
const site = (Astro.site?.href ?? '').replace(/\/$/, '');
const jsonLd = personJsonLd({
  name: profile.name, jobTitle: profile.title, url: site, image: `${site}/og.png`,
  sameAs: [profile.linkedinUrl, profile.githubUrl],
});
---
<Base title={`${profile.name}, ${profile.title}`} description={profile.tagline} path="/" jsonLd={jsonLd}>
  <div class="page">
    <Hero profile={profile} />
    <main id="main">
      <Certifications entries={certifications} today={today} />
      <ProofStrip />
      <About About={AboutContent} />
      <Contact profile={profile} />
    </main>
    <Footer name={profile.name} year={today.getUTCFullYear()} />
  </div>
</Base>
```

- [ ] **Step 6: Run the tests and build**

Run: `pnpm vitest run tests/components && pnpm build:fixture`
Expected: all component tests pass; `dist-fixture/index.html` contains `data-block="proof-strip"` and no `style=`.

- [ ] **Step 7: Commit**

```bash
git add src/components src/lib/content.ts src/pages/index.astro src/styles/base.css stryker.config.mjs tests/components/home-sections.test.ts
git commit -m "Build the home page in the approved order with proof strip fallback"
```

---

## Task 17: The `/quality` page

**Files:**
- Create: `src/components/TopLine.astro`, `src/components/DataBlock.astro`, `src/pages/quality.astro`
- Modify: `src/styles/base.css` (append `/quality` styles)
- Test: `tests/components/quality-page.test.ts`

**Interfaces:**
- Consumes: renderers (Task 10), `hydrate` (Task 10), `Base` (Task 12), `CV_FILENAME` (Task 16).
- Produces: `<DataBlock name="verdict" fallback="...">` markup contract; `/quality` with blocks `verdict`, `integrity`, `matrix`, `trends`, `mutation`, `duration`.

- [ ] **Step 1: Write the failing tests**

`tests/components/quality-page.test.ts`:
```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TopLine from '../../src/components/TopLine.astro';
import DataBlock from '../../src/components/DataBlock.astro';

test('@REQ-NAV-01 the top line links home and to the CV', async () => {
  const html = await (await AstroContainer.create()).renderToString(TopLine, { props: { name: 'Ceylan Akyol' } });
  expect(html).toMatch(/<a class="homelink" href="\/">Ceylan Akyol<\/a>/);
  expect(html).toContain('download="Ceylan-Akyol-CV.pdf"');
  expect(html).toMatch(/<nav[^>]*aria-label="Site"/);
});
test('@REQ-QUAL-01 a data block renders its fallback, an empty live slot and the unavailable state', async () => {
  const html = await (await AstroContainer.create()).renderToString(DataBlock, { props: { name: 'matrix', fallback: 'Requirement coverage is unavailable right now.' } });
  expect(html).toContain('data-block="matrix" data-state="unavailable"');
  expect(html).toContain('Requirement coverage is unavailable right now.');
  expect(html).toContain('<div data-slot="live"></div>');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/components/quality-page.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/TopLine.astro`:
```astro
---
import { CV_FILENAME } from '../lib/site';
interface Props { name: string }
const { name } = Astro.props;
---
<nav class="topline" aria-label="Site">
  <a class="homelink" href="/">{name}</a>
  <a class="lnk" href="/cv.pdf" download={CV_FILENAME}>Download CV (PDF)</a>
</nav>
```

`src/components/DataBlock.astro`:
```astro
---
interface Props { name: string; fallback: string; ciUrl?: string }
const { name, fallback, ciUrl } = Astro.props;
---
<div data-block={name} data-state="unavailable">
  <div data-slot="fallback"><p class="unav">{fallback}{ciUrl && <> <a class="lnk" href={ciUrl}>See the latest CI run</a></>}</p></div>
  <div data-slot="live"></div>
</div>
```

`src/pages/quality.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import TopLine from '../components/TopLine.astro';
import DataBlock from '../components/DataBlock.astro';
import Footer from '../components/Footer.astro';
import { loadProfile } from '../lib/content';

const { data: profile } = await loadProfile();
const repo = process.env.REPO_URL ?? 'https://github.com/example/ceylan-akyol-site';
const actions = `${repo}/actions/workflows/ci.yml`;
---
<Base title={`How ${profile.name}'s site is tested`} description="Every promise this site makes, tied to the tests and checks that prove it." path="/quality">
  <div class="page q">
    <TopLine name={profile.name} />
    <main id="main">
      <header class="qhead">
        <h1 class="qh1">How this site is tested</h1>
        <DataBlock name="verdict" fallback="Every promise this site makes is tied to the checks that prove it. Live results could not be loaded; the source and CI history are linked here." ciUrl={actions} />
        <p class="gloss">A <b>test</b> is one test case. A <b>test run</b> is one test in one device profile: desktop Chromium, Firefox and WebKit, plus emulated iPhone and Pixel. Behavior is tested on fixed test content; the real content is checked for accessibility, performance, links and key behavior before every deploy.</p>
      </header>
      <DataBlock name="integrity" fallback="The live file check result is unavailable right now." ciUrl={actions} />
      <section class="sec" aria-labelledby="req-heading">
        <div class="side">
          <h2 id="req-heading">Requirements</h2>
          <p class="note">Every row links to the exact tests, pinned to the deployed commit. There is no pass or fail column: only fully passing builds deploy.</p>
        </div>
        <DataBlock name="matrix" fallback="Requirement coverage is unavailable right now." ciUrl={actions} />
      </section>
      <section class="sec" aria-labelledby="trend-heading">
        <div class="side"><h2 id="trend-heading">Over time</h2><p class="note">The last 50 deploys.</p></div>
        <DataBlock name="trends" fallback="Trend data is unavailable right now." ciUrl={actions} />
      </section>
      <section class="sec" aria-labelledby="mut-heading">
        <div class="side"><h2 id="mut-heading">Mutation testing</h2><p class="note">Covers the business logic in src/lib only.</p></div>
        <DataBlock name="mutation" fallback="Mutation results are unavailable right now." ciUrl={actions} />
      </section>
      <section class="sec" aria-labelledby="suites-heading">
        <h2 id="suites-heading">The suites</h2>
        <dl class="suites">
          <div><dt>End to end</dt><dd>Playwright in desktop Chromium, Firefox and WebKit, plus emulated iPhone and Pixel.</dd></div>
          <div><dt>Accessibility</dt><dd>axe on every page in light and dark mode.</dd></div>
          <div><dt>Visual regression</dt><dd>Screenshots per page, viewport and theme on fixed test content.</dd></div>
          <div><dt>Deploy integrity</dt><dd>File hashes checked before every deploy and again on the live site after it.</dd></div>
        </dl>
        <DataBlock name="duration" fallback="" />
      </section>
    </main>
    <Footer name={profile.name} year={new Date().getUTCFullYear()} />
  </div>
</Base>
<script>
  import { hydrate } from '../lib/quality-client';
  import { renderDuration, renderIntegrity, renderMatrix, renderMutation, renderTrends, renderVerdict } from '../lib/render-quality';
  hydrate(document, {
    verdict: renderVerdict, integrity: renderIntegrity, matrix: renderMatrix,
    trends: renderTrends, mutation: renderMutation, duration: renderDuration,
  }, (url) => fetch(url, { cache: 'no-cache' }));
</script>
```

Append to `src/styles/base.css`:
```css
.topline { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line); margin-bottom: 48px; font-size: 16px; }
.homelink { font-weight: 800; letter-spacing: -0.02em; font-size: 18px; color: var(--ink); text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
.qhead .qh1 { font-size: 64px; font-weight: 800; line-height: .95; letter-spacing: -0.035em; }
.lede { font-size: 21px; line-height: 1.5; margin-top: 22px; max-width: 46ch; }
.lede b { font-weight: 800; }
.meta2 { font-size: 15px; color: var(--muted); line-height: 1.8; margin-top: 16px; }
.gloss { font-size: 15px; color: var(--muted); margin-top: 16px; max-width: 66ch; }
.gloss b { color: var(--ink); }
.integrity { display: flex; gap: 10px; align-items: center; margin-top: 32px; font-size: 16px; }
.reqs { list-style: none; padding: 0; border-top: 1px solid var(--line); }
.req { display: grid; grid-template-columns: 40px 1fr 240px; gap: 14px; padding: 16px 0; border-bottom: 1px solid var(--line); align-items: start; }
.rq-id { font-size: 13px; font-weight: 700; color: var(--muted); }
.rq-text { font-size: 17px; font-weight: 500; margin-top: 2px; overflow-wrap: anywhere; }
.rq-cov { display: flex; flex-direction: column; font-size: 14px; overflow-wrap: anywhere; }
.rq-cov .dim { color: var(--muted); }
.rq-cov details summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--rose-text); }
.trends { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.trend h3 { font-size: 15px; font-weight: 700; }
.trend .now { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
.trend .cap, .unav { font-size: 14px; color: var(--muted); }
.spark { width: 100%; height: 56px; margin-top: 6px; }
.spark-line { stroke: var(--rose-mark); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.sparse { border: 1.5px dashed var(--line); border-radius: 12px; padding: 18px 20px; color: var(--muted); max-width: 52ch; }
.suites { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 40px; }
.suites dt { font-weight: 700; }
.suites dd { color: var(--muted); margin: 0; }
@media (max-width: 899px) {
  .qhead .qh1 { font-size: 40px; }
  .trends, .suites { grid-template-columns: 1fr; }
}
@media (max-width: 639px) {
  .req { grid-template-columns: 30px 1fr; }
  .req > .rq-cov { grid-column: 2; }
}
```

- [ ] **Step 4: Run tests and build**

Run: `pnpm vitest run tests/components/quality-page.test.ts && pnpm build:fixture`
Expected: PASS; `dist-fixture/quality.html` exists.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopLine.astro src/components/DataBlock.astro src/pages/quality.astro src/styles/base.css tests/components/quality-page.test.ts
git commit -m "Add /quality with top line, fallback blocks and live renderers"
```

---

## Task 18: 404, link preview image, favicons, headers and robots

**Files:**
- Create: `src/pages/404.astro`, `src/og/card.ts`, `src/og/profile-photo.ts`, `src/og/fonts/SchibstedGrotesk-Medium.ttf`, `src/og/fonts/SchibstedGrotesk-ExtraBold.ttf`, `src/pages/og.png.ts`, `src/pages/apple-touch-icon.png.ts`, `src/pages/favicon-32.png.ts`, `public/favicon.svg`, `public/_headers`, `public/robots.txt`
- Test: `tests/unit/og-card.test.ts`

**Interfaces:**
- Consumes: `RING_MAIN`, `RING_SECOND` (Task 14); profile content (Task 13).
- Produces: `ringSvg(opts: { size: number }): string` and `renderOgCard(input: { name: string; title: string; site: string; photoPng: Buffer; fonts: { medium: Buffer; bold: Buffer } }): Promise<Buffer>` in `src/og/card.ts`; `/og.png` (1200x630 PNG), `/apple-touch-icon.png` (180x180), `/favicon-32.png` (32x32).

- [ ] **Step 1: Add the fonts**

Satori needs static TTF files (it cannot read WOFF2 or variable fonts). Download the Medium (500) and ExtraBold (800) static TTFs from the Schibsted Grotesk release (https://github.com/schibsted/schibsted-grotesk, `fonts/ttf/`), save them as `src/og/fonts/SchibstedGrotesk-Medium.ttf` and `src/og/fonts/SchibstedGrotesk-ExtraBold.ttf`, and copy the repository's `OFL.txt` to `src/og/fonts/OFL.txt`.

Run: `file src/og/fonts/*.ttf`
Expected: both report "TrueType Font data".

- [ ] **Step 2: Write the failing OG test**

`tests/unit/og-card.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { renderOgCard, ringSvg } from '../../src/og/card';

test('@REQ-PREV-01 the preview card is a 1200x630 PNG', async () => {
  const photoPng = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#F2B9C4' } }).png().toBuffer();
  const png = await renderOgCard({
    name: 'Ceylan Akyol', title: 'QA Automation Engineer', site: 'ceylan-akyol.example.workers.dev', photoPng,
    fonts: { medium: readFileSync('src/og/fonts/SchibstedGrotesk-Medium.ttf'), bold: readFileSync('src/og/fonts/SchibstedGrotesk-ExtraBold.ttf') },
  });
  const meta = await sharp(png).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 630]);
});
test('@REQ-PREV-01 the ring SVG embeds both brush strokes with literal colors', () => {
  const svg = ringSvg({ size: 400 });
  expect(svg.match(/<path /g)).toHaveLength(2);
  expect(svg).toContain('#CF3F68');
  expect(svg).not.toContain('var(');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run tests/unit/og-card.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the card**

`src/og/card.ts`:
```ts
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { RING_MAIN, RING_SECOND } from '../lib/brush-ring';

/** Light-theme ring with literal colors (satori and resvg do not resolve CSS variables). */
export function ringSvg({ size }: { size: number }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="${size}" height="${size}"><defs>`
    + '<linearGradient id="m" gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="270" y2="270"><stop offset="0" stop-color="#E2557A"/><stop offset=".55" stop-color="#CF3F68"/><stop offset="1" stop-color="#F08A5D"/></linearGradient>'
    + '<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="270" y1="30" x2="30" y2="270"><stop offset="0" stop-color="#F7B596"/><stop offset="1" stop-color="#F3A07E"/></linearGradient>'
    + `</defs><path d="${RING_SECOND}" fill="url(#s)"/><path d="${RING_MAIN}" fill="url(#m)"/></svg>`;
}

const dataUri = (mime: string, buf: Buffer | string) => `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node =>
  ({ type, props: { style, children, ...extra } });

export async function renderOgCard(input: { name: string; title: string; site: string; photoPng: Buffer; fonts: { medium: Buffer; bold: Buffer } }): Promise<Buffer> {
  const [first, ...rest] = input.name.split(' ');
  const tree = h('div', { width: 1200, height: 630, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 96px', background: '#FFF6F5', color: '#2C1822', fontFamily: 'Schibsted Grotesk' }, [
    h('div', { display: 'flex', flexDirection: 'column' }, [
      h('div', { fontSize: 112, fontWeight: 800, lineHeight: 0.92, letterSpacing: -4 }, first),
      h('div', { fontSize: 112, fontWeight: 800, lineHeight: 0.92, letterSpacing: -4 }, rest.join(' ')),
      h('div', { fontSize: 36, fontWeight: 500, marginTop: 32 }, input.title),
      h('div', { fontSize: 24, fontWeight: 500, marginTop: 28, color: '#7D5F69' }, input.site),
    ]),
    h('div', { position: 'relative', width: 400, height: 400, display: 'flex' }, [
      h('div', { position: 'absolute', left: 61, top: 61, width: 278, height: 278, borderRadius: 139, background: '#FBE1E3' }),
      h('img', { position: 'absolute', left: 61, top: 61, width: 278, height: 278, borderRadius: 139, objectFit: 'cover' }, undefined, { src: dataUri('image/png', input.photoPng), width: 278, height: 278 }),
      h('img', { position: 'absolute', left: 0, top: 0, width: 400, height: 400 }, undefined, { src: dataUri('image/svg+xml', ringSvg({ size: 400 })), width: 400, height: 400 }),
    ]),
  ]);
  const svg = await satori(tree as never, {
    width: 1200, height: 630,
    fonts: [
      { name: 'Schibsted Grotesk', data: input.fonts.medium, weight: 500, style: 'normal' },
      { name: 'Schibsted Grotesk', data: input.fonts.bold, weight: 800, style: 'normal' },
    ],
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
```

`src/og/profile-photo.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';

/** Reads the profile photo path from frontmatter and returns a square PNG (satori reads only PNG and JPEG). */
export async function profilePhotoPng(contentDir: string, size: number): Promise<Buffer> {
  const file = resolve(contentDir, 'profile/profile.md');
  const fm = /^---\n([\s\S]*?)\n---/.exec(await readFile(file, 'utf8'));
  const photo = (fm ? parse(fm[1]!) : {}) as { photo?: string };
  if (!photo.photo) throw new Error('profile.md has no photo.');
  return sharp(resolve(dirname(file), photo.photo)).rotate().resize(size, size, { fit: 'cover' }).png().toBuffer();
}
```

- [ ] **Step 5: Implement the endpoints and static files**

`src/pages/og.png.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { getEntry } from 'astro:content';
import { renderOgCard } from '../og/card';
import { profilePhotoPng } from '../og/profile-photo';

export async function GET({ site }: { site?: URL }) {
  const profile = await getEntry('profile', 'profile');
  if (!profile) throw new Error('Missing profile.');
  const png = await renderOgCard({
    name: profile.data.name, title: profile.data.title, site: site?.host ?? '',
    photoPng: await profilePhotoPng(process.env.CONTENT_DIR ?? 'src/content', 556),
    fonts: { medium: await readFile('src/og/fonts/SchibstedGrotesk-Medium.ttf'), bold: await readFile('src/og/fonts/SchibstedGrotesk-ExtraBold.ttf') },
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
```

`src/pages/apple-touch-icon.png.ts`:
```ts
import sharp from 'sharp';
import { ringSvg } from '../og/card';

export async function GET() {
  const png = await sharp(Buffer.from(ringSvg({ size: 180 }))).flatten({ background: '#FFF6F5' }).png().toBuffer();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
```

`src/pages/favicon-32.png.ts`:
```ts
import sharp from 'sharp';
import { ringSvg } from '../og/card';

export async function GET() {
  const png = await sharp(Buffer.from(ringSvg({ size: 32 }))).png().toBuffer();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
```

`public/favicon.svg` (a simplified two-stroke ring; the internal `<style>` is allowed because the dist scan covers HTML only, E22):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .m { stroke: #CF3F68; } .s { stroke: #F7B596; }
    @media (prefers-color-scheme: dark) { .m { stroke: #F0729A; } .s { stroke: #C9785C; } }
  </style>
  <path class="s" d="M26 9 A12 12 0 1 1 9 5.5" fill="none" stroke-width="2" stroke-linecap="round"/>
  <path class="m" d="M22 5 A12.5 11.5 -8 1 1 6.5 9 L8.5 6" fill="none" stroke-width="3.2" stroke-linecap="round"/>
</svg>
```

`public/robots.txt`:
```
User-agent: *
Allow: /
```

`public/_headers`:
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  X-Frame-Options: DENY

/cv.pdf
  Cache-Control: no-cache

/quality.json
  Cache-Control: no-cache

/og.png
  Cache-Control: no-cache

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

`src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Page not found" description="This page doesn't exist." path="/404" noindex>
  <div class="page">
    <main id="main" class="nf">
      <h1 class="nf-code">404</h1>
      <p class="nf-text">This page doesn't exist. It may have moved, or the link has a typo.</p>
      <a class="lnk" href="/">Go to the home page</a>
    </main>
  </div>
</Base>
```

Append to `src/styles/base.css`:
```css
.nf { padding: 64px 0; }
.nf-code { font-size: 120px; font-weight: 800; letter-spacing: -0.04em; line-height: .9; }
.nf-text { font-size: 20px; margin-top: 20px; max-width: 30ch; }
```

- [ ] **Step 6: Run the tests and build**

Run: `pnpm vitest run tests/unit/og-card.test.ts && pnpm build:fixture && file dist-fixture/og.png dist-fixture/apple-touch-icon.png`
Expected: tests pass; both files are PNG images; `dist-fixture/404.html`, `dist-fixture/_headers`, `dist-fixture/favicon.svg` exist.

- [ ] **Step 7: Commit**

```bash
git add src/pages/404.astro src/og src/pages/og.png.ts src/pages/apple-touch-icon.png.ts src/pages/favicon-32.png.ts public tests/unit/og-card.test.ts src/styles/base.css
git commit -m "Add 404 page, link preview card, favicons, security and cache headers"
```

---

## Task 19: Test-only states page

**Files:**
- Create: `src/pages/[states].astro`
- Test: `tests/components/states-page.test.ts`

**Interfaces:**
- Consumes: `Hero`, `Certifications`, `ProofStrip` components.
- Produces: `/__states` in the fixture build only (`BUILD_KIND=fixture`), with anchored sections `#certs-one`, `#certs-many`, `#certs-long`, `#hero-long-name`, `#proof-fallback`.

- [ ] **Step 1: Write the failing test**

`tests/components/states-page.test.ts`:
```ts
test('@REQ-CSP-01 the states page is generated only in the fixture build', async () => {
  const mod = await import('../../src/pages/[states].astro');
  process.env.BUILD_KIND = 'real';
  expect(await mod.getStaticPaths()).toEqual([]);
  process.env.BUILD_KIND = 'fixture';
  expect(await mod.getStaticPaths()).toEqual([{ params: { states: '__states' } }]);
  delete process.env.BUILD_KIND;
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/components/states-page.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pages/[states].astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import Certifications from '../components/Certifications.astro';
import ProofStrip from '../components/ProofStrip.astro';
import { loadProfile } from '../lib/content';
import type { Certification } from '../lib/certifications';

// Exists only in the fixture build (D20); the real build's dist scan fails if it appears (D21).
export async function getStaticPaths() {
  return process.env.BUILD_KIND === 'fixture' ? [{ params: { states: '__states' } }] : [];
}

const { data: profile } = await loadProfile();
const today = new Date('2026-09-27T00:00:00Z');
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const one: Certification[] = [{ id: '1', name: 'ISTQB Certified Tester, Foundation Level', issuer: 'ISTQB', issueDate: d('2024-03-01'), verifyUrl: 'https://verify.example/1' }];
const many: Certification[] = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Certification number ${i + 1}`, issuer: 'Issuer', issueDate: d(`202${i % 6}-0${(i % 9) + 1}-01`), ...(i % 2 ? { verifyUrl: 'https://verify.example/x' } : {}), ...(i === 3 ? { expiryDate: d('2024-01-01') } : {}) }));
const long: Certification[] = [{ id: 'l', name: 'International Software Testing Qualifications Board Certified Tester Advanced Level Technical Test Analyst Extended', issuer: 'ISTQB', issueDate: d('2022-05-01'), credentialId: 'CTAL-TTA-2022-000000000000001', verifyUrl: 'https://verify.example/l' }];
---
<Base title="States" description="Visual states for tests" path="/__states" noindex>
  <div class="page">
    <main id="main">
      <div id="hero-long-name"><Hero profile={{ ...profile, name: 'Ceylan Akyol Testname Longerthanusual Xy', showAvailability: true, availability: 'Based in Fixture City, open to remote. Available from November.' }} /></div>
      <div id="certs-one"><Certifications entries={one} today={today} /></div>
      <div id="certs-many"><Certifications entries={many} today={today} /></div>
      <div id="certs-long"><Certifications entries={long} today={today} /></div>
      <div id="proof-fallback"><ProofStrip /></div>
    </main>
  </div>
</Base>
```

- [ ] **Step 4: Run tests and both builds**

Run: `pnpm vitest run tests/components/states-page.test.ts && pnpm build:fixture && pnpm build:real && ls dist-fixture/__states.html && test ! -e dist/__states.html && echo ok`
Expected: PASS; the states page exists only in `dist-fixture`.

- [ ] **Step 5: Commit**

```bash
git add "src/pages/[states].astro" tests/components/states-page.test.ts
git commit -m "Add fixture-only states page for visual tests"
```

---

## Task 20: Playwright configuration and browser test suites

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/home.spec.ts`, `tests/e2e/quality.spec.ts`, `tests/e2e/quality-data.spec.ts`, `tests/e2e/nojs.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/headers.spec.ts`, `tests/e2e/previews.spec.ts`, `tests/e2e/health.spec.ts`, `tests/e2e/visual.spec.ts`, `tests/e2e/real.spec.ts`
- Modify: `package.json` (`build:fixture` copies the valid fixture `quality.json`)

**Interfaces:**
- Consumes: `req()` (Task 11); fixture content (Task 13); fixture quality files (Task 3); `parseQualityReport` (Task 3).
- Produces: projects `chromium`, `firefox`, `webkit`, `iphone`, `pixel` (fixture, `FIXTURE_URL`, default `http://localhost:8787`), `real-chromium` (`REAL_URL`, default `http://localhost:8788`), `smoke` (`SMOKE_URL`); JSON report at `$PW_JSON` (default `reports/playwright.json`). Test helpers `test`, `expect`, `settled(page)`, `serveQuality(page, body, status?)`.

- [ ] **Step 1: Copy the fixture quality file into the fixture build**

In `package.json`, change `build:fixture` to:
```json
"build:fixture": "CONTENT_DIR=tests/fixtures/content BUILD_KIND=fixture astro build --outDir dist-fixture && cp tests/fixtures/quality/valid.json dist-fixture/quality.json"
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const FIXTURE_URL = process.env.FIXTURE_URL ?? 'http://localhost:8787';
const REAL_URL = process.env.REAL_URL ?? 'http://localhost:8788';
const fixtureOnly = { testIgnore: [/real\.spec\.ts/, /smoke\.spec\.ts/] };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.PW_JSON ?? 'reports/playwright.json' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' } },
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', ...fixtureOnly, use: { ...devices['Desktop Chrome'], baseURL: FIXTURE_URL } },
    { name: 'firefox', ...fixtureOnly, use: { ...devices['Desktop Firefox'], baseURL: FIXTURE_URL } },
    { name: 'webkit', ...fixtureOnly, use: { ...devices['Desktop Safari'], baseURL: FIXTURE_URL } },
    { name: 'iphone', ...fixtureOnly, use: { ...devices['iPhone 15'], baseURL: FIXTURE_URL } },
    { name: 'pixel', ...fixtureOnly, use: { ...devices['Pixel 7'], baseURL: FIXTURE_URL } },
    { name: 'real-chromium', testMatch: [/real\.spec\.ts/, /a11y\.spec\.ts/], use: { ...devices['Desktop Chrome'], baseURL: REAL_URL } },
    { name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: process.env.SMOKE_URL } },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'pnpm build:fixture && pnpm serve:fixture',
    url: FIXTURE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
```

- [ ] **Step 3: Create the shared fixtures**

`tests/e2e/fixtures.ts`:
```ts
import { test as base, expect, type Page } from '@playwright/test';

/** Every test blocks analytics and records console errors (REQ-HEALTH-01). */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/cloudflareinsights\.com/, (route) => route.abort());
    await use(errors);
  }, { auto: true }],
});
export { expect };

/** Waits until every data block has settled (E14), whatever its final state. */
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('[data-block]')].every((b) => b.dataset.settled === 'true'));
}

/** Serves a quality.json variant; null means 404. */
export async function serveQuality(page: Page, body: string | null, status = 200): Promise<void> {
  await page.route('**/quality.json', (route) => body === null
    ? route.fulfill({ status: 404, body: 'Not found' })
    : route.fulfill({ status, contentType: 'application/json', body }));
}
```

- [ ] **Step 4: Write the home page suite**

`tests/e2e/home.spec.ts`:
```ts
import { test, expect, settled } from './fixtures';
import { req } from '../tag';

test.beforeEach(async ({ page }) => { await page.goto('/'); await settled(page); });

test('hero shows name, title, tagline and photo', req('REQ-HERO-01'), async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ceylan Akyol Testname Longerthanusual Xy');
  await expect(page.locator('.hero .role')).toHaveText('QA Automation Engineer');
  await expect(page.locator('.hero .tag')).toContainText('I build test automation');
  const img = page.locator('.photo-frame img');
  await expect(img).toHaveAttribute('alt', 'Fixture portrait');
  expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('CV button returns a PDF and downloads with the owner name', req('REQ-CV-01', 'REQ-CV-02'), async ({ page, request }) => {
  const btn = page.locator('.hero a.btn');
  await expect(btn).toHaveText('Download CV (PDF)');
  await expect(btn).toHaveAttribute('href', '/cv.pdf');
  await expect(btn).toHaveAttribute('download', 'Ceylan-Akyol-CV.pdf');
  const res = await request.get('/cv.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.locator('[aria-labelledby="contact-heading"] a').first()).toHaveAttribute('download', 'Ceylan-Akyol-CV.pdf');
});

test('email, LinkedIn and GitHub appear in that order in the hero and in Contact', req('REQ-CONTACT-01'), async ({ page }) => {
  const expected = ['mailto:fixture@example.com', 'https://www.linkedin.com/in/fixture', 'https://github.com/fixture'];
  expect(await page.locator('.hero .links a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(expected);
  expect(await page.locator('[aria-labelledby="contact-heading"] a').evaluateAll((as) => as.slice(1).map((a) => a.getAttribute('href')))).toEqual(expected);
});

test('certifications are ordered, filtered and labelled', req('REQ-CERT-01', 'REQ-CERT-02', 'REQ-CERT-04', 'REQ-CERT-05', 'REQ-CERT-06'), async ({ page }) => {
  await expect(page.locator('.list .row .title')).toHaveText([
    'ISTQB Test Automation Engineering',
    'ISTQB Certified Tester, Foundation Level',
    'Postman API Fundamentals Student Expert',
    'International Software Testing Qualifications Board Certified Tester Advanced Level Test Analyst',
    'Scrum Fundamentals Certified',
  ]);
  await expect(page.getByText('Hidden Certification Must Not Render')).toHaveCount(0);
  await expect(page.locator('.row').nth(0).locator('.meta')).toHaveText('Issued by ISTQB, November 2024. Valid until March 2099');
  const expired = page.locator('.row.expired');
  await expect(expired).toHaveCount(1);
  await expect(expired.locator('.meta')).toHaveText('Issued by SCRUMstudy, January 2021. Expired January 2024');
  await expect(expired.locator('.expired-label')).toHaveText('Expired');
  await expect(page.locator('.row .tick')).toHaveCount(4);
  await expect(page.locator('.row').nth(2).locator('a')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Verify credential: ISTQB Certified Tester, Foundation Level' })).toHaveAttribute('href', 'https://verify.example/ctfl');
  await expect(page.getByText('A tick means you can verify it with the issuer.')).toBeVisible();
});

test('availability line shows when switched on', req('REQ-AVAIL-01'), async ({ page }) => {
  await expect(page.locator('.hero .avail')).toHaveText('Based in Fixture City, open to remote. Available from November.');
});

test('sections follow the approved order', req('REQ-STATE-01'), async ({ page }) => {
  expect(await page.locator('main h2').allTextContents()).toEqual(['Certifications', 'How this site is tested', 'About', 'Contact']);
  await expect(page.locator('footer.foot')).toHaveText(/^Ceylan Akyol Testname Longerthanusual Xy, \d{4}$/);
});

test('nothing scrolls sideways, including long names, IDs and URLs', req('REQ-STATE-01'), async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('proof strip upgrades to the numbered sentence', req('REQ-QUAL-01'), async ({ page }) => {
  const strip = page.locator('[data-block="proof-strip"]');
  await expect(strip).toHaveAttribute('data-state', 'ready');
  await expect(strip.locator('[data-slot="live"]')).toHaveText("This site's code passed 312 test runs across 3 browser engines and 5 device profiles, with 0 automated accessibility violations (axe) and a Lighthouse mobile score of 100 in CI.");
});
```

- [ ] **Step 5: Write the `/quality` suites**

`tests/e2e/quality.spec.ts`:
```ts
import { test, expect, settled } from './fixtures';
import { req } from '../tag';

test.beforeEach(async ({ page }) => { await page.goto('/quality'); await settled(page); });

test('top line links home and to the CV', req('REQ-NAV-01'), async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Site' });
  await expect(nav.getByRole('link', { name: 'Ceylan Akyol Testname Longerthanusual Xy' })).toHaveAttribute('href', '/');
  await expect(nav.getByRole('link', { name: 'Download CV (PDF)' })).toHaveAttribute('download', 'Ceylan-Akyol-CV.pdf');
});

test('every block renders from the fixture data', req('REQ-QUAL-01'), async ({ page }) => {
  for (const name of ['verdict', 'integrity', 'matrix', 'trends', 'mutation', 'duration']) {
    await expect(page.locator(`[data-block="${name}"]`)).toHaveAttribute('data-state', 'ready');
  }
  await expect(page.locator('[data-block="verdict"]')).toContainText('This build covered all 4 requirements with 148 tests (312 test runs)');
  await expect(page.locator('li.req')).toHaveCount(4);
  await expect(page.locator('.spark-line')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Open the full report on Stryker Dashboard' })).toBeVisible();
});

test('covering tests link to permalinks at the deployed commit', req('REQ-QUAL-01'), async ({ page }) => {
  await page.locator('li.req details summary').first().click();
  await expect(page.locator('li.req details a').first()).toHaveAttribute('href', /\/blob\/e5cdb92a1b2c3d4e5f60718293a4b5c6d7e8f901\/tests\/e2e\/home\.spec\.ts#L12$/);
});

test('the matrix fits small screens without sideways scrolling', req('REQ-STATE-01'), async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
```

`tests/e2e/quality-data.spec.ts`:
```ts
import { readFileSync } from 'node:fs';
import { test, expect, settled, serveQuality } from './fixtures';
import { req } from '../tag';

const fixture = (n: string) => readFileSync(`tests/fixtures/quality/${n}.json`, 'utf8');
const valid = () => JSON.parse(fixture('valid'));
const FALLBACK = 'Every change runs through automated tests in 3 browser engines and 5 device profiles before it deploys.';

for (const [label, body] of [
  ['missing', null],
  ['malformed', fixture('malformed')],
  ['future version', fixture('future')],
  ['oversized', JSON.stringify({ ...valid(), matrix: Array.from({ length: 201 }, (_, i) => ({ ...valid().matrix[0], id: `REQ-X-${String(i % 100).padStart(2, '0')}` })) })],
] as const) {
  test(`${label} data leaves true fallback sentences in place`, req('REQ-QUAL-01'), async ({ page }) => {
    await serveQuality(page, body);
    await page.goto('/');
    await settled(page);
    const strip = page.locator('[data-block="proof-strip"]');
    await expect(strip).toHaveAttribute('data-state', 'unavailable');
    await expect(strip.getByText(FALLBACK)).toBeVisible();
    await page.goto('/quality');
    await settled(page);
    await expect(page.locator('[data-block="verdict"]')).toHaveAttribute('data-state', 'unavailable');
    await expect(page.getByText('Live results could not be loaded; the source and CI history are linked here.')).toBeVisible();
    await expect(page.getByText('Requirement coverage is unavailable right now.')).toBeVisible();
  });
}

test('hostile strings render as text and never execute', req('REQ-SEC-02'), async ({ page }) => {
  await serveQuality(page, fixture('hostile'));
  await page.goto('/quality');
  await settled(page);
  await expect(page.locator('[data-block="matrix"]')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-block="matrix"] img, [data-block="matrix"] script')).toHaveCount(0);
  await expect(page.getByText('<img src=x onerror=', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.body.dataset.pwned)).toBeUndefined();
  await expect(page.locator('[data-block="verdict"]')).toContainText('999,999 test runs');
});

test('fewer than 3 history points show the sparse message', req('REQ-STATE-01'), async ({ page }) => {
  await serveQuality(page, JSON.stringify({ ...valid(), history: valid().history.slice(0, 1) }));
  await page.goto('/quality');
  await settled(page);
  await expect(page.getByText('Trends appear after 3 deploys. This is deploy 1.')).toBeVisible();
});
```

`tests/e2e/nojs.spec.ts`:
```ts
import { test, expect } from './fixtures';
import { req } from '../tag';

test.use({ javaScriptEnabled: false });

test('without JavaScript the pages stay complete and usable', req('REQ-QUAL-01', 'REQ-CV-01', 'REQ-NAV-01'), async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Every change runs through automated tests in 3 browser engines and 5 device profiles before it deploys.')).toBeVisible();
  await expect(page.locator('.hero a.btn')).toHaveAttribute('href', '/cv.pdf');
  await page.goto('/quality');
  await expect(page.getByText('Live results could not be loaded; the source and CI history are linked here.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link').first()).toHaveAttribute('href', '/');
});
```

- [ ] **Step 6: Write the accessibility, header, preview and health suites**

`tests/e2e/a11y.spec.ts`:
```ts
import AxeBuilder from '@axe-core/playwright';
import { test, expect, settled } from './fixtures';
import { req } from '../tag';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const path of ['/', '/quality', '/404']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`@axe ${path} has no automated violations in ${colorScheme} mode`, req('REQ-A11Y-01'), async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(path);
      await settled(page);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      testInfo.annotations.push({ type: 'axe-violations', description: String(violations.length) });
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}

test('skip link, tab order and visible focus', req('REQ-A11Y-02'), async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not move Tab focus to links by default');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('a.skip')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const cv = page.locator('.hero a.btn');
  await expect(cv).toBeFocused();
  expect(await cv.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
});

test('reduced motion shows the ring without animation', req('REQ-A11Y-03'), async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.locator('.ring-sweep-main').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('landmarks and unique link names', req('REQ-A11Y-04'), async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header.hero')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('footer')).toHaveCount(1);
  const names = await page.locator('a[aria-label^="Verify credential:"]').evaluateAll((as) => as.map((a) => a.getAttribute('aria-label')));
  expect(new Set(names).size).toBe(names.length);
});
```

`tests/e2e/headers.spec.ts`:
```ts
import { test, expect } from './fixtures';
import { req } from '../tag';

test('security headers on every page', req('REQ-SEC-01'), async ({ request }) => {
  for (const path of ['/', '/quality', '/cv.pdf']) {
    const h = (await request.get(path)).headers();
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['strict-transport-security']).toContain('max-age=31536000');
  }
});

test('mutable files revalidate, fingerprinted assets are immutable', req('REQ-CACHE-01'), async ({ request, page }) => {
  for (const path of ['/cv.pdf', '/quality.json', '/og.png']) {
    expect((await request.get(path)).headers()['cache-control']).toBe('no-cache');
  }
  await page.goto('/');
  const asset = await page.locator('script[src^="/_astro/"], link[rel="stylesheet"][href^="/_astro/"]').first().evaluate((el) => el.getAttribute('src') ?? el.getAttribute('href'));
  expect((await request.get(asset!)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

test('unknown paths return the custom 404 page with status 404', req('REQ-NF-01'), async ({ page }) => {
  const res = await page.goto('/this/does/not/exist');
  expect(res!.status()).toBe(404);
  await expect(page.getByText("This page doesn't exist. It may have moved, or the link has a typo.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
});

test('/quality/ resolves to the canonical URL without a trailing slash', req('REQ-URL-01'), async ({ page }) => {
  await page.goto('/quality/');
  await expect(page).toHaveURL(/\/quality$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/quality$/);
});
```

`tests/e2e/previews.spec.ts`:
```ts
import { test, expect } from './fixtures';
import { req } from '../tag';

const SITE = (process.env.SITE_URL ?? 'https://ceylan-akyol.example.workers.dev').replace(/\/$/, '');

test('Open Graph and JSON-LD metadata, and a served preview image', req('REQ-PREV-01'), async ({ page, request }) => {
  await page.goto('/');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBe(`${SITE}/og.png`);
  const res = await request.get(new URL(og!).pathname);
  expect(res.headers()['content-type']).toContain('image/png');
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ '@type': 'Person', name: 'Ceylan Akyol Testname Longerthanusual Xy' });
  await page.goto('/404');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});
```

`tests/e2e/health.spec.ts`:
```ts
import { test, expect, settled } from './fixtures';
import { req } from '../tag';

for (const path of ['/', '/quality', '/404', '/__states']) {
  test(`${path} logs no console errors, including CSP violations`, req('REQ-HEALTH-01'), async ({ page, consoleErrors }) => {
    await page.goto(path);
    await settled(page);
    expect(consoleErrors).toEqual([]);
  });
}
```

- [ ] **Step 7: Write the visual and `@real` suites**

`tests/e2e/visual.spec.ts`:
```ts
import { test, expect, settled } from './fixtures';
import { req } from '../tag';

const PAGES = { home: '/', quality: '/quality', states: '/__states', notfound: '/404' } as const;

for (const [name, path] of Object.entries(PAGES)) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`@visual ${name} ${colorScheme}`, req('REQ-VIS-01'), async ({ page }, testInfo) => {
      test.skip(!['chromium', 'pixel'].includes(testInfo.project.name), 'Visual baselines: desktop Chromium and emulated Pixel only');
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(path);
      await settled(page);
      await expect(page).toHaveScreenshot(`${name}-${colorScheme}.png`, { fullPage: true, mask: [page.locator('footer.foot')] });
    });
  }
}
```

`tests/e2e/real.spec.ts`:
```ts
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { test, expect, settled } from './fixtures';
import { req } from '../tag';

test('@real hero renders from real content', req('REQ-HERO-01'), async ({ page }) => {
  await page.goto('/');
  await settled(page);
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  expect(await page.locator('.photo-frame img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('@real the CV is a PDF', req('REQ-CV-01'), async ({ request }) => {
  const res = await request.get('/cv.pdf');
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('@real every non-hidden certification file is rendered', req('REQ-CERT-02'), async ({ page }) => {
  const dir = 'src/content/certifications';
  const visible = readdirSync(dir).filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(`${dir}/${f}`, 'utf8')) as { hidden?: boolean })
    .filter((c) => c.hidden !== true).length;
  await page.goto('/');
  await expect(page.locator('.list .row')).toHaveCount(visible);
});

test('@real unknown paths return 404', req('REQ-NF-01'), async ({ page }) => {
  expect((await page.goto('/definitely-missing'))!.status()).toBe(404);
});

test('@real security headers are served', req('REQ-SEC-01'), async ({ request }) => {
  expect((await request.get('/')).headers()['content-security-policy']).toContain("default-src 'self'");
});
```

- [ ] **Step 8: Run the fixture suites locally and create visual baselines**

Run: `pnpm build:fixture && (pnpm serve:fixture &) && sleep 5 && pnpm exec playwright test --project=chromium --project=firefox --project=webkit --project=iphone --project=pixel --grep-invert @visual`
Expected: all pass.

Visual baselines must be generated inside the Playwright container so they match CI (E23). Run:
```bash
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v$(node -p "require('./package.json').devDependencies['@playwright/test']")-noble \
  bash -c "corepack enable && pnpm install --frozen-lockfile && pnpm build:fixture && (pnpm serve:fixture &) && sleep 8 && pnpm exec playwright test --grep @visual --project=chromium --project=pixel --update-snapshots"
```
Expected: `tests/e2e/__screenshots__/visual.spec.ts/*.png` created (16 files). Open a few and compare them with `docs/superpowers/specs/assets/final-mockups.png`; if the layout differs from the approved mockup, fix the CSS before committing baselines. Without Docker, run `visual-baselines.yml` from Task 24 once it exists and commit its artifact instead.

- [ ] **Step 9: Run the `@real` project**

Run: `pnpm build:real && rm -rf dist-served && cp -r dist dist-served && cp tests/fixtures/quality/valid.json dist-served/quality.json && (pnpm serve:real &) && sleep 5 && pnpm exec playwright test --project=real-chromium`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add playwright.config.ts tests/e2e package.json
git commit -m "Add Playwright suites across 5 device profiles, a11y, headers, visual and @real"
```

---

## Task 21: Lighthouse budgets and the JavaScript budget test

**Files:**
- Create: `lighthouserc.cjs`, `tests/build/bundle.test.ts`

**Interfaces:**
- Consumes: built `dist/` (or `BUNDLE_DIST`).
- Produces: `.lighthouseci/assertion-results.json` and `.lighthouseci/<build>/manifest.json` per run (`LHCI_BUILD=fixture|real`).

- [ ] **Step 1: Write the failing budget test**

`tests/build/bundle.test.ts`:
```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { scanFiles } from '../../src/lib/dist-scan';

const DIST = process.env.BUNDLE_DIST ?? 'dist';

test('@REQ-PERF-02 first-party JavaScript is under 5 KB brotli', () => {
  expect(existsSync(`${DIST}/_astro`), `Build first: pnpm build:real (looked in ${DIST})`).toBe(true);
  const js = readdirSync(`${DIST}/_astro`).filter((f) => f.endsWith('.js'));
  expect(js.length).toBeGreaterThan(0);
  const bytes = js.reduce((sum, f) => sum + brotliCompressSync(readFileSync(`${DIST}/_astro/${f}`)).length, 0);
  expect(bytes).toBeLessThan(5 * 1024);
});

test('@REQ-PERF-02 no script is inlined into HTML', () => {
  const pages = readdirSync(DIST).filter((f) => f.endsWith('.html')).map((f) => ({ path: f, html: readFileSync(`${DIST}/${f}`, 'utf8') }));
  expect(scanFiles(pages, { forbidStatesPage: false }).findings.filter((f) => f.rule === 'inline-script')).toEqual([]);
});
```

- [ ] **Step 2: Run it**

Run: `pnpm build:real && pnpm vitest run tests/build/bundle.test.ts`
Expected: PASS. If the JavaScript budget fails, check which chunk is large (`ls -la dist/_astro/*.js`); `zod/mini` plus the renderers should fit. Do not raise the budget; trim the renderers or the schema instead.

- [ ] **Step 3: Create `lighthouserc.cjs`**

```js
// LHCI_BUILD selects which local server to audit. Results land in .lighthouseci/
// (assertion-results.json) and .lighthouseci/<build>/ (manifest.json plus reports).
const build = process.env.LHCI_BUILD === 'fixture' ? 'fixture' : 'real';
const base = build === 'fixture' ? 'http://localhost:8787' : 'http://localhost:8788';

module.exports = {
  ci: {
    collect: {
      url: [`${base}/`, `${base}/quality`],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
        blockedUrlPatterns: ['*cloudflareinsights.com*'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'resource-summary:font:size': ['error', { maxNumericValue: 120000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 256000 }],
        'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],
      },
    },
    upload: { target: 'filesystem', outputDir: `.lighthouseci/${build}` },
  },
};
```

- [ ] **Step 4: Run Lighthouse against the real build locally**

Run: `(pnpm serve:real &) && sleep 5 && CHROME_PATH=$(node -e "import('@playwright/test').then(m=>console.log(m.chromium.executablePath()))") LHCI_BUILD=real pnpm lhci`
Expected: all assertions pass; `.lighthouseci/real/manifest.json` lists 6 runs (2 URLs times 3).

- [ ] **Step 5: Commit**

```bash
git add lighthouserc.cjs tests/build/bundle.test.ts
git commit -m "Add Lighthouse score and byte budgets and the brotli JS budget test"
```

---

## Task 22: Pipeline scripts

**Files:**
- Create: `scripts/node-fs.ts`, `scripts/scan-dist.ts`, `scripts/write-manifest.ts`, `scripts/stand-in-quality.ts`, `scripts/build-report.ts`, `scripts/gate-cli.ts`
- Test: `tests/unit/node-fs.test.ts`

**Interfaces:**
- Consumes: every `src/lib` module from Lane A; `REQUIREMENTS` (Task 11).
- Produces (CLIs, all run with `pnpm tsx` except the bundled gate):
  - `scan-dist.ts <dir> <out.json> [--forbid-states]`: writes `{ scanned, findings }`, exits 1 on findings or a missing `index.html`.
  - `write-manifest.ts <dir> <out.json>`: SHA-256 of every file except `quality.json`.
  - `stand-in-quality.ts <srcDir> <outDir> <siteUrl>`: copies the build and adds the live `quality.json` if valid, else the valid fixture (E12).
  - `build-report.ts`: reads `REPORTS_DIR` (default `reports-in`), writes `out/quality.json` and the job summary, exits 1 on gate problems.
  - `gate-cli.ts verify-manifest <site> <manifest.json> | placeholders <contentDir> | stale <sha> <remoteUrl>`, bundled to `dist-gate/gate-cli.mjs` (Node built-ins only).
  - `node-fs.ts`: `walkFiles(root): string[]`, `sha256(buf): string`, `hashTree(root, ignore?): Manifest`, `NOT_SERVED`.

- [ ] **Step 1: Write the failing file-tree test**

`tests/unit/node-fs.test.ts`:
```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashTree, sha256, walkFiles } from '../../scripts/node-fs';

test('@REQ-GATE-02 walks nested files with forward slashes and hashes each one', () => {
  const root = mkdtempSync(join(tmpdir(), 'tree-'));
  mkdirSync(join(root, '_astro'));
  writeFileSync(join(root, 'index.html'), 'a');
  writeFileSync(join(root, '_astro', 'x.js'), 'b');
  writeFileSync(join(root, 'quality.json'), '{}');
  expect(walkFiles(root)).toEqual(['_astro/x.js', 'index.html', 'quality.json']);
  expect(hashTree(root)).toEqual({ '_astro/x.js': sha256(Buffer.from('b')), 'index.html': sha256(Buffer.from('a')) });
});
```

- [ ] **Step 2: Run to verify failure, then implement `scripts/node-fs.ts`**

Run: `pnpm vitest run tests/unit/node-fs.test.ts` (FAIL), then create:

```ts
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Manifest } from '../src/lib/manifest';

/** Files Workers static assets reads as configuration and never serves. */
export const NOT_SERVED = new Set(['_headers', '_redirects', '.assetsignore']);

export function walkFiles(root: string): string[] {
  const out: string[] = [];
  const go = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) go(p);
      else out.push(relative(root, p).split(sep).join('/'));
    }
  };
  go(root);
  return out.sort();
}

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function hashTree(root: string, ignore: ReadonlySet<string> = new Set(['quality.json'])): Manifest {
  const manifest: Manifest = {};
  for (const f of walkFiles(root)) if (!ignore.has(f)) manifest[f] = sha256(readFileSync(join(root, f)));
  return manifest;
}
```

Run: `pnpm vitest run tests/unit/node-fs.test.ts`
Expected: PASS.

- [ ] **Step 3: Create the small CLIs**

`scripts/scan-dist.ts`:
```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { scanFiles } from '../src/lib/dist-scan';
import { distScanEvidence } from '../src/lib/evidence';
import { walkFiles } from './node-fs';

const [dir, out, flag] = process.argv.slice(2);
if (!dir || !out) { console.error('Usage: scan-dist <dir> <out.json> [--forbid-states]'); process.exit(2); }
const files = walkFiles(dir).filter((f) => f.endsWith('.html')).map((path) => ({ path, html: readFileSync(join(dir, path), 'utf8') }));
const result = scanFiles(files, { forbidStatesPage: flag === '--forbid-states' });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2));
for (const f of result.findings) console.error(`${f.file}: ${f.rule}: ${f.excerpt}`);
const evidence = distScanEvidence(result);
if (!evidence.passed) { console.error(`Built HTML scan failed: ${evidence.detail}`); process.exit(1); }
console.log(`Built HTML scan passed: ${evidence.detail}`);
```

`scripts/write-manifest.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashTree } from './node-fs';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) { console.error('Usage: write-manifest <dir> <out.json>'); process.exit(2); }
const manifest = hashTree(dir);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`Manifest: ${Object.keys(manifest).length} files.`);
```

`scripts/stand-in-quality.ts`:
```ts
// E12: the real build is tested with a stand-in quality.json that never enters site-real.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchLiveQuality } from '../src/lib/history';
import { parseQualityReport } from '../src/lib/quality-schema';

const [src, out, siteUrl] = process.argv.slice(2);
if (!src || !out || !siteUrl) { console.error('Usage: stand-in-quality <srcDir> <outDir> <siteUrl>'); process.exit(2); }
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
const live = await fetchLiveQuality(`${siteUrl.replace(/\/$/, '')}/quality.json`, {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  attempts: 1,
});
const useLive = live.kind === 'ok' && parseQualityReport(live.body).ok;
writeFileSync(join(out, 'quality.json'), useLive ? JSON.stringify(live.body) : readFileSync('tests/fixtures/quality/valid.json', 'utf8'));
console.log(`Stand-in quality.json: ${useLive ? 'live' : 'fixture'}.`);
```

- [ ] **Step 4: Create `scripts/build-report.ts`**

```ts
/*
 * Report job (E4, E5, E15, E19):
 *   reports-in/ ──normalize──▶ TestResult[] ─┐
 *   lhci, links, dist scans ──evidence──────┼─▶ buildMatrix ─▶ gate (exit 1 on problems)
 *   mutation.json, live history ────────────┘                └▶ out/quality.json + job summary
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REQUIREMENTS } from '../tests/requirements';
import { buildMatrix, describeProblem, normalizePlaywright, normalizeVitest, type TestResult } from '../src/lib/traceability';
import { combineEvidence, distScanEvidence, lighthouseEvidence, linksEvidence, medianScores } from '../src/lib/evidence';
import { mutationSummary } from '../src/lib/mutation';
import { appendHistory, fetchLiveQuality, resolveHistory } from '../src/lib/history';
import { SCHEMA_VERSION, liveCheckSchema, parseQualityReport } from '../src/lib/quality-schema';
import { walkFiles } from './node-fs';

const R = process.env.REPORTS_DIR ?? 'reports-in';
const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing env ${k}`); return v; };
const files = existsSync(R) ? walkFiles(R).map((f) => join(R, f)) : [];
const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const first = (pred: (p: string) => boolean) => files.find(pred);
const summary: string[] = [];
const say = (line: string) => { summary.push(line); console.log(line); };
const flush = () => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`); };

// Runner paths differ between jobs (container vs host); keep the repo-relative tail.
const fixPath = (t: TestResult): TestResult => { const i = t.file.indexOf('tests/'); return i > 0 ? { ...t, file: t.file.slice(i) } : t; };
const root = process.cwd();
const results = [
  ...files.filter((p) => p.endsWith('vitest.json')).flatMap((p) => normalizeVitest(readJson(p), root)),
  ...files.filter((p) => /playwright-[\w-]+\.json$/.test(p)).flatMap((p) => normalizePlaywright(readJson(p), root)),
].map(fixPath);

function lhci(build: 'fixture' | 'real') {
  const manifestPath = first((p) => p.includes(`lhci-${build}`) && p.endsWith(`${build}/manifest.json`));
  const assertionsPath = first((p) => p.includes(`lhci-${build}`) && p.endsWith('assertion-results.json'));
  const manifest = (manifestPath ? readJson(manifestPath) : []) as { url: string; summary: Record<string, number> }[];
  const assertions = (assertionsPath ? readJson(assertionsPath) : []) as { level: string; passed: boolean }[];
  const base = build === 'fixture' ? 'http://localhost:8787' : 'http://localhost:8788';
  const lhrs = manifest.map((m) => ({ requestedUrl: m.url, categories: {
    performance: { score: m.summary.performance ?? null }, accessibility: { score: m.summary.accessibility ?? null },
    'best-practices': { score: m.summary['best-practices'] ?? null }, seo: { score: m.summary.seo ?? null },
  } }));
  return { lhrs, evidence: lighthouseEvidence({ lhrs, assertions, expectedUrls: [`${base}/`, `${base}/quality`], runsPerUrl: 3 }) };
}

const fixtureLh = lhci('fixture');
const realLh = lhci('real');
const linksPath = first((p) => p.endsWith('links.json'));
const scans = files.filter((p) => /dist-scan-(fixture|real)\.json$/.test(p)).map((p) => distScanEvidence(readJson(p) as { scanned: string[]; findings: unknown[] }));
const evidence = [
  combineEvidence([fixtureLh.evidence, realLh.evidence]),
  linksEvidence(linksPath ? readJson(linksPath) : null),
  combineEvidence(scans.length === 2 ? scans : []),
];

const { rows, problems, counts } = buildMatrix(REQUIREMENTS, results, evidence);
say(`## Traceability\n\n${rows.length} requirements, ${counts.tests} tests, ${counts.testRuns} test runs.`);
for (const e of evidence) say(`- ${e.name}: ${e.passed ? 'passed' : 'FAILED'} (${e.detail})`);
if (problems.length > 0) {
  say('\n### Gate failed\n');
  for (const p of problems) say(`- ${describeProblem(p)}`);
  flush();
  process.exit(1);
}

const sha = env('GITHUB_SHA');
const repoUrl = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env('GITHUB_REPOSITORY')}`;
const scores = medianScores(realLh.lhrs, 'http://localhost:8788/');
const mutationPath = first((p) => p.endsWith('mutation.json'));
const mutation = mutationSummary(mutationPath ? readJson(mutationPath) : null);
const liveCheckPath = first((p) => p.endsWith('live-check.json'));
const liveCheckParsed = liveCheckPath ? liveCheckSchema.safeParse(readJson(liveCheckPath)) : null;
const prevPath = first((p) => p.includes('prev-quality') && p.endsWith('quality.json'));
const now = new Date();
const started = Date.parse(process.env.RUN_STARTED_AT ?? '');

const siteUrl = env('SITE_URL').replace(/\/$/, '');
const live = await fetchLiveQuality(`${siteUrl}/quality.json`, {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
});
const source = resolveHistory(live, prevPath ? readJson(prevPath) : undefined);
if (source.kind === 'fresh' && source.warning) say(`\n> Warning: ${source.warning}`);
const history = appendHistory(source.kind === 'fresh' ? [] : source.history, {
  commit: sha, date: now.toISOString(), testRuns: counts.testRuns,
  mutationScore: mutation.score, lighthousePerformance: scores.performance,
});

const report = {
  schemaVersion: SCHEMA_VERSION,
  commit: sha,
  builtAt: now.toISOString(),
  repoUrl,
  ciRunUrl: `${repoUrl}/actions/runs/${env('GITHUB_RUN_ID')}`,
  pipelineSeconds: Number.isFinite(started) ? Math.max(0, Math.round((now.getTime() - started) / 1000)) : 0,
  counts: { requirements: rows.length, tests: counts.tests, testRuns: counts.testRuns, axeViolations: counts.axeViolations },
  lighthouse: scores,
  mutation: { ...mutation, ...(process.env.STRYKER_URL ? { reportUrl: process.env.STRYKER_URL } : {}) },
  ...(liveCheckParsed?.success ? { liveCheck: liveCheckParsed.data } : {}),
  matrix: rows,
  history,
};
const parsed = parseQualityReport(report);
if (!parsed.ok) { say(`quality.json failed its own schema at ${parsed.reason}`); flush(); process.exit(1); }
mkdirSync('out', { recursive: true });
writeFileSync('out/quality.json', JSON.stringify(parsed.data));
say(`\nquality.json written: history ${source.kind}, ${history.length} points; mutation ${mutation.score}%; Lighthouse performance ${scores.performance}.`);
flush();
```

- [ ] **Step 5: Create `scripts/gate-cli.ts` and bundle it**

```ts
// Runs in the deploy job, which installs no npm packages (E17). Bundled with esbuild; Node built-ins only.
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { diffManifest, manifestMatches, parseManifest } from '../src/lib/manifest';
import { findPlaceholders } from '../src/lib/placeholders';
import { isStale, parseLsRemote } from '../src/lib/stale-sha';
import { hashTree, walkFiles } from './node-fs';

const fail = (msg: string): never => { console.error(msg); process.exit(1); };
const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'verify-manifest') {
  const [site, manifestFile] = args;
  if (!site || !manifestFile) fail('Usage: gate-cli verify-manifest <site> <manifest.json>');
  const expected = parseManifest(readFileSync(manifestFile!, 'utf8')) ?? fail('The manifest is missing or invalid.');
  const diff = diffManifest(expected, hashTree(site!));
  if (!manifestMatches(diff)) fail(`The build differs from the tested manifest: ${JSON.stringify(diff)}`);
  console.log(`Manifest verified: ${Object.keys(expected).length} files.`);
} else if (cmd === 'placeholders') {
  const [dir] = args;
  if (!dir) fail('Usage: gate-cli placeholders <contentDir>');
  const found = findPlaceholders(walkFiles(dir!).filter((f) => /\.(md|ya?ml)$/.test(f)).map((f) => ({ path: `${dir}/${f}`, text: readFileSync(`${dir}/${f}`, 'utf8') })));
  if (found.length > 0) fail(`Placeholder content remains; replace it before launch:\n${found.join('\n')}`);
  console.log('No placeholder content.');
} else if (cmd === 'stale') {
  const [runSha, remote] = args;
  if (!runSha || !remote) fail('Usage: gate-cli stale <sha> <remoteUrl>');
  let head: string | null = null;
  try {
    head = parseLsRemote(execFileSync('git', ['ls-remote', remote!, 'refs/heads/main'], { encoding: 'utf8' }));
  } catch {
    console.log('::warning::Could not read the head of main; continuing with this deploy.');
  }
  const stale = isStale(runSha!, head);
  if (stale) console.log(`::notice::Skipping deploy: main has moved on to ${head}.`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `stale=${stale}\n`);
} else {
  fail('Usage: gate-cli verify-manifest|placeholders|stale ...');
}
```

Run: `pnpm exec esbuild scripts/gate-cli.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist-gate/gate-cli.mjs && node dist-gate/gate-cli.mjs placeholders src/content; echo "exit $?"`
Expected: bundle builds; the command lists the two placeholder files and prints `exit 1` (the launch gate works). Add `dist-gate/` to `.gitignore`.

- [ ] **Step 6: Run the pipeline locally end to end**

Run:
```bash
pnpm build:real && pnpm tsx scripts/scan-dist.ts dist reports/dist-scan-real.json --forbid-states \
  && pnpm tsx scripts/write-manifest.ts dist reports/manifest.json \
  && node dist-gate/gate-cli.mjs verify-manifest dist reports/manifest.json
```
Expected: scan passes; manifest verified.

- [ ] **Step 7: Commit**

```bash
git add scripts tests/unit/node-fs.test.ts .gitignore
git commit -m "Add pipeline CLIs: dist scan, manifest, stand-in data, report builder and deploy gate"
```

---

## Task 23: The `ci.yml` pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: package scripts (Tasks 1, 20, 21), CLIs (Task 22), `smoke.yml` as a reusable workflow (Task 24).
- Produces: artifacts `logic-reports`, `fixture-<project>`, `lhci-fixture`, `real-reports`, `lhci-real`, `site-real`, `manifest-real`, `quality-json`, `gate-cli`; repository variables `SITE_URL`, `CF_BEACON_TOKEN`; secrets `STRYKER_DASHBOARD_API_KEY` (repository), `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (environment `production`).

- [ ] **Step 1: Write the workflow with version tags**

`.github/workflows/ci.yml`:
```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    # G4: daily rebuild so certification expiry is never more than a day old.
    - cron: '17 6 * * *'
  workflow_dispatch:

permissions:
  contents: read

env:
  SITE_URL: ${{ vars.SITE_URL }}
  REPO_URL: https://github.com/${{ github.repository }}

jobs:
  versions:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    outputs:
      playwright: ${{ steps.v.outputs.playwright }}
    steps:
      - uses: actions/checkout@v5
      - id: v
        run: echo "playwright=$(node -p "require('./package.json').devDependencies['@playwright/test']")" >> "$GITHUB_OUTPUT"

  logic:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    outputs:
      stryker_url: ${{ steps.dashboard.outputs.url }}
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm build:real
      - run: pnpm test:unit
      - name: Mutation testing
        run: pnpm test:mutation
        env:
          STRYKER_DASHBOARD_API_KEY: ${{ github.ref == 'refs/heads/main' && secrets.STRYKER_DASHBOARD_API_KEY || '' }}
          STRYKER_PROJECT: github.com/${{ github.repository }}
      - name: Confirm the dashboard report exists (D13, E16)
        id: dashboard
        if: github.ref == 'refs/heads/main'
        run: |
          api="https://dashboard.stryker-mutator.io/api/reports/github.com/${{ github.repository }}/${{ github.sha }}"
          if curl -fsS -o /dev/null "$api"; then
            echo "url=https://dashboard.stryker-mutator.io/reports/github.com/${{ github.repository }}/${{ github.sha }}" >> "$GITHUB_OUTPUT"
          else
            echo "::warning::Stryker Dashboard report not found; /quality will omit the report link."
          fi
      - uses: actions/upload-artifact@v4
        with:
          name: logic-reports
          path: |
            reports/vitest.json
            reports/mutation/mutation.json

  fixture:
    needs: versions
    runs-on: ubuntu-latest
    timeout-minutes: 20
    container:
      image: mcr.microsoft.com/playwright:v${{ needs.versions.outputs.playwright }}-noble
    strategy:
      fail-fast: false
      matrix:
        project: [chromium, firefox, webkit, iphone, pixel]
    steps:
      - uses: actions/checkout@v5
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm build:fixture
      - run: pnpm tsx scripts/scan-dist.ts dist-fixture reports/dist-scan-fixture.json
      - name: Serve the fixture build
        run: |
          pnpm serve:fixture > wrangler.log 2>&1 &
          for i in $(seq 60); do curl -fsS http://localhost:8787/ > /dev/null && exit 0; sleep 1; done
          cat wrangler.log; exit 1
      - run: pnpm exec playwright test --project=${{ matrix.project }}
        env:
          CI: 'true'
          PW_JSON: reports/playwright-fixture-${{ matrix.project }}.json
      - name: Lighthouse on the fixture build (once)
        if: matrix.project == 'chromium'
        run: |
          export CHROME_PATH=$(node -e "import('@playwright/test').then(m=>console.log(m.chromium.executablePath()))")
          LHCI_BUILD=fixture pnpm lhci
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: fixture-${{ matrix.project }}
          path: |
            reports/playwright-fixture-${{ matrix.project }}.json
            reports/dist-scan-fixture.json
            test-results/
      - uses: actions/upload-artifact@v4
        if: matrix.project == 'chromium'
        with:
          name: lhci-fixture
          path: .lighthouseci
          include-hidden-files: true

  real:
    needs: versions
    runs-on: ubuntu-latest
    timeout-minutes: 20
    container:
      image: mcr.microsoft.com/playwright:v${{ needs.versions.outputs.playwright }}-noble
    steps:
      - uses: actions/checkout@v5
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm tsx scripts/check-content.ts
      - run: pnpm build:real
        env:
          CF_BEACON_TOKEN: ${{ vars.CF_BEACON_TOKEN }}
      - run: pnpm tsx scripts/scan-dist.ts dist reports/dist-scan-real.json --forbid-states
      - run: pnpm tsx scripts/write-manifest.ts dist manifest/manifest.json
      - uses: actions/upload-artifact@v4
        with: { name: site-real, path: dist, include-hidden-files: true }
      - uses: actions/upload-artifact@v4
        with: { name: manifest-real, path: manifest/manifest.json }
      - name: Serve the real build with a stand-in quality.json (E12)
        run: |
          pnpm tsx scripts/stand-in-quality.ts dist dist-served "$SITE_URL"
          test ! -e dist/quality.json
          pnpm serve:real > wrangler.log 2>&1 &
          for i in $(seq 60); do curl -fsS http://localhost:8788/ > /dev/null && exit 0; sleep 1; done
          cat wrangler.log; exit 1
      - run: pnpm exec playwright test --project=real-chromium
        env:
          CI: 'true'
          PW_JSON: reports/playwright-real.json
      - name: Lighthouse on the real build
        run: |
          export CHROME_PATH=$(node -e "import('@playwright/test').then(m=>console.log(m.chromium.executablePath()))")
          LHCI_BUILD=real pnpm lhci
      - name: Internal link check
        run: pnpm exec linkinator http://localhost:8788 --recurse --format json --skip "^(?!http://localhost:8788)" > reports/links.json
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: real-reports
          path: |
            reports/playwright-real.json
            reports/dist-scan-real.json
            reports/links.json
      - uses: actions/upload-artifact@v4
        with: { name: lhci-real, path: .lighthouseci, include-hidden-files: true }

  report:
    needs: [logic, fixture, real]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - uses: actions/download-artifact@v5
        with: { path: reports-in }
      - name: Previous quality.json and live check from the last successful main run (E19)
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          id=$(gh run list --workflow ci.yml --branch main --status success --limit 1 --json databaseId -q '.[0].databaseId')
          if [ -n "$id" ]; then
            gh run download "$id" -n quality-json -D reports-in/prev-quality || true
            gh run download "$id" -n live-check -D reports-in/prev-live-check || true
          fi
          echo "RUN_STARTED_AT=$(gh api repos/${{ github.repository }}/actions/runs/${{ github.run_id }} --jq .run_started_at)" >> "$GITHUB_ENV"
      - run: pnpm tsx scripts/build-report.ts
        env:
          STRYKER_URL: ${{ needs.logic.outputs.stryker_url }}
      - run: pnpm exec esbuild scripts/gate-cli.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist-gate/gate-cli.mjs
      - uses: actions/upload-artifact@v4
        with: { name: quality-json, path: out/quality.json }
      - uses: actions/upload-artifact@v4
        with: { name: gate-cli, path: dist-gate/gate-cli.mjs }

  deploy:
    needs: report
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment: production
    concurrency:
      group: deploy-main
      cancel-in-progress: false
    outputs:
      deployed: ${{ steps.stale.outputs.stale == 'false' }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc }
      - uses: actions/download-artifact@v5
        with: { name: site-real, path: dist }
      - uses: actions/download-artifact@v5
        with: { name: manifest-real, path: manifest }
      - uses: actions/download-artifact@v5
        with: { name: quality-json, path: quality }
      - uses: actions/download-artifact@v5
        with: { name: gate-cli, path: gate }
      - run: node gate/gate-cli.mjs verify-manifest dist manifest/manifest.json
      - run: node gate/gate-cli.mjs placeholders src/content
      - id: stale
        run: node gate/gate-cli.mjs stale ${{ github.sha }} https://github.com/${{ github.repository }}.git
      - name: Install a pinned wrangler without install scripts (E17)
        if: steps.stale.outputs.stale == 'false'
        run: |
          v=$(node -p "require('./package.json').devDependencies.wrangler")
          npm install --prefix /tmp/wrangler --no-save --ignore-scripts --no-audit --no-fund "wrangler@$v"
      - name: Deploy
        if: steps.stale.outputs.stale == 'false'
        run: |
          cp quality/quality.json dist/quality.json
          /tmp/wrangler/node_modules/.bin/wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  smoke:
    needs: deploy
    if: needs.deploy.outputs.deployed == 'true'
    permissions:
      contents: read
      issues: write
    uses: ./.github/workflows/smoke.yml
    with:
      mode: post-deploy
```

- [ ] **Step 2: Pin every third-party action to a commit SHA (D17)**

Run: `pnpm dlx pin-github-action .github/workflows/ci.yml`
Expected: each `uses: owner/action@vN` becomes `uses: owner/action@<40-hex-sha> # vN`. Confirm with `grep -n "uses:" .github/workflows/ci.yml` that every non-local `uses:` has a 40-character SHA.

- [ ] **Step 3: Lint the workflow**

Run: `pnpm dlx @action-validator/cli .github/workflows/ci.yml` (or `actionlint` if installed)
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI with parallel test jobs, traceability report and protected deploy"
```

---

## Task 24: Smoke, link check, baselines, keepalive and Dependabot

**Files:**
- Create: `.github/workflows/smoke.yml`, `.github/workflows/links-weekly.yml`, `.github/workflows/visual-baselines.yml`, `.github/workflows/keepalive.yml`, `.github/dependabot.yml`, `scripts/live-check.ts`, `scripts/issue-sync.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `smokeAction`, `linksAction`, `nextLinkState` (Task 8); `hashTree`, `sha256`, `NOT_SERVED` (Task 22); `parseManifest` (Task 7); `parseQualityReport` (Task 3).
- Produces: artifact `live-check` (`{ commit, checkedAt, files, ok }`); labels `smoke-alert`, `link-alert`.

- [ ] **Step 1: Write the smoke suite**

`tests/e2e/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { parseQualityReport } from '../../src/lib/quality-schema';

test('@smoke home page loads with the photo', async ({ page }) => {
  const res = await page.goto('/');
  expect(res!.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  expect(await page.locator('.photo-frame img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('@smoke the CV is a PDF and revalidates', async ({ request }) => {
  const res = await request.get('/cv.pdf');
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect(res.headers()['cache-control']).toBe('no-cache');
});

test('@smoke unknown paths return 404', async ({ page }) => {
  expect((await page.goto('/smoke-missing-page'))!.status()).toBe(404);
});

test('@smoke security headers are served', async ({ request }) => {
  const h = (await request.get('/')).headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['strict-transport-security']).toContain('max-age=31536000');
});

test('@smoke quality.json parses against the schema', async ({ request }) => {
  const res = await request.get('/quality.json');
  expect(res.headers()['cache-control']).toBe('no-cache');
  expect(parseQualityReport(await res.json()).ok).toBe(true);
});

test('@smoke the preview image is served as PNG', async ({ request }) => {
  expect((await request.get('/og.png')).headers()['content-type']).toContain('image/png');
});
```

- [ ] **Step 2: Create `scripts/live-check.ts` (REQ-DEPLOY-01)**

```ts
// Fetches every deployed file listed in the manifest and compares SHA-256 hashes (E15).
import { readFileSync, writeFileSync } from 'node:fs';
import { parseManifest } from '../src/lib/manifest';
import { NOT_SERVED, sha256 } from './node-fs';

const [manifestFile, siteUrl, out, commit] = process.argv.slice(2);
if (!manifestFile || !siteUrl || !out || !commit) { console.error('Usage: live-check <manifest.json> <siteUrl> <out.json> <sha>'); process.exit(2); }
const manifest = parseManifest(readFileSync(manifestFile, 'utf8'));
if (!manifest) { console.error('Invalid manifest.'); process.exit(1); }
const base = siteUrl.replace(/\/$/, '');
const mismatches: string[] = [];
const paths = Object.keys(manifest).filter((p) => !NOT_SERVED.has(p));
for (const path of paths) {
  const res = await fetch(`${base}/${path}`, { redirect: 'follow', cache: 'no-store' });
  const hash = sha256(new Uint8Array(await res.arrayBuffer()));
  if (!res.ok || hash !== manifest[path]) mismatches.push(`${path} (${res.status})`);
}
const result = { commit, checkedAt: new Date().toISOString(), files: paths.length, ok: mismatches.length === 0 };
writeFileSync(out, JSON.stringify(result));
if (!result.ok) { console.error(`Live files differ from the tested build:\n${mismatches.join('\n')}`); process.exit(1); }
console.log(`All ${paths.length} live files match the tested build.`);
```

- [ ] **Step 3: Create `scripts/issue-sync.ts`**

```ts
// Usage: issue-sync smoke <failed:true|false> <detailsFile>
//        issue-sync links <linkinator.json> <stateIn.json> <stateOut.json>
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { linksAction, nextLinkState, smokeAction, type IssueAction, type LinkState, type OpenIssue } from '../src/lib/issue-state';

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8' });
const openIssue = (label: string): OpenIssue | null => {
  const list = JSON.parse(gh(['issue', 'list', '--label', label, '--state', 'open', '--json', 'number,body', '--limit', '1'])) as OpenIssue[];
  return list[0] ?? null;
};
const apply = (action: IssueAction, label: string) => {
  if (action.kind === 'open') gh(['issue', 'create', '--title', action.title, '--body', action.body, '--label', label]);
  if (action.kind === 'update') gh(['issue', 'edit', String(action.number), '--body', action.body]);
  if (action.kind === 'close') gh(['issue', 'close', String(action.number), '--comment', action.comment]);
  console.log(`Issue action: ${action.kind}`);
};
const when = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const [mode, ...args] = process.argv.slice(2);

if (mode === 'smoke') {
  const [failed, detailsFile] = args;
  const details = detailsFile && existsSync(detailsFile) ? readFileSync(detailsFile, 'utf8').slice(0, 5000) : '';
  apply(smokeAction(failed === 'true', openIssue('smoke-alert'), details, when), 'smoke-alert');
} else if (mode === 'links') {
  const [reportFile, stateIn, stateOut] = args;
  const report = JSON.parse(readFileSync(reportFile!, 'utf8')) as { links: { url: string; state: string }[] };
  const prev: LinkState = stateIn && existsSync(stateIn) ? JSON.parse(readFileSync(stateIn, 'utf8')) : { failures: {} };
  const results = report.links.filter((l) => l.state !== 'SKIPPED').map((l) => ({ url: l.url, ok: l.state === 'OK' }));
  const next = nextLinkState(prev, results);
  writeFileSync(stateOut!, JSON.stringify(next));
  apply(linksAction(next, openIssue('link-alert'), when), 'link-alert');
} else {
  console.error('Usage: issue-sync smoke|links ...');
  process.exit(2);
}
```

- [ ] **Step 4: Create the workflows**

`.github/workflows/smoke.yml`:
```yaml
name: smoke

on:
  workflow_call:
    inputs:
      mode: { type: string, default: post-deploy }
  schedule:
    - cron: '41 7 * * *'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      issues: write
    env:
      SMOKE_URL: ${{ vars.SITE_URL }}
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - id: tests
        run: pnpm exec playwright test --project=smoke 2>&1 | tee smoke.log
      - name: Live file hashes (REQ-DEPLOY-01)
        if: inputs.mode == 'post-deploy'
        uses: actions/download-artifact@v5
        with: { name: manifest-real, path: manifest }
      - if: inputs.mode == 'post-deploy'
        run: pnpm tsx scripts/live-check.ts manifest/manifest.json "$SMOKE_URL" live-check.json ${{ github.sha }}
      - if: inputs.mode == 'post-deploy' && always()
        uses: actions/upload-artifact@v4
        with: { name: live-check, path: live-check.json }
      - name: Daily issue (D27)
        if: always() && github.event_name == 'schedule'
        env:
          GH_TOKEN: ${{ github.token }}
        run: pnpm tsx scripts/issue-sync.ts smoke ${{ steps.tests.outcome == 'failure' }} smoke.log
```

`.github/workflows/links-weekly.yml`:
```yaml
name: links-weekly

on:
  schedule:
    - cron: '23 8 * * 1'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  links:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Restore link failure counts
        uses: actions/cache/restore@v4
        with:
          path: link-state.json
          key: link-state-${{ github.run_id }}
          restore-keys: link-state-
      - name: Check every external link, 3 retries with backoff (D15)
        run: |
          pnpm exec linkinator "${{ vars.SITE_URL }}" --recurse --format json \
            --skip "linkedin\.com|cloudflareinsights\.com" \
            --retry-errors --retry-errors-count 3 --retry-errors-jitter 3000 > links.json || true
      - run: pnpm tsx scripts/issue-sync.ts links links.json link-state.json link-state.json
        env:
          GH_TOKEN: ${{ github.token }}
      - uses: actions/cache/save@v4
        with:
          path: link-state.json
          key: link-state-${{ github.run_id }}
```

`.github/workflows/visual-baselines.yml`:
```yaml
name: visual-baselines

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  versions:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    outputs:
      playwright: ${{ steps.v.outputs.playwright }}
    steps:
      - uses: actions/checkout@v5
      - id: v
        run: echo "playwright=$(node -p "require('./package.json').devDependencies['@playwright/test']")" >> "$GITHUB_OUTPUT"
  baselines:
    needs: versions
    runs-on: ubuntu-latest
    timeout-minutes: 20
    container:
      image: mcr.microsoft.com/playwright:v${{ needs.versions.outputs.playwright }}-noble
    steps:
      - uses: actions/checkout@v5
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm build:fixture
      - run: |
          pnpm serve:fixture > wrangler.log 2>&1 &
          for i in $(seq 60); do curl -fsS http://localhost:8787/ > /dev/null && break; sleep 1; done
          pnpm exec playwright test --grep @visual --project=chromium --project=pixel --update-snapshots
      - uses: actions/upload-artifact@v4
        with: { name: visual-baselines, path: tests/e2e/__screenshots__ }
```

`.github/workflows/keepalive.yml`:
```yaml
name: keepalive

# GitHub disables scheduled workflows in public repos after 60 days without activity (E23).
on:
  schedule:
    - cron: '5 9 1 * *'
  workflow_dispatch:

permissions:
  actions: write

jobs:
  enable:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    steps:
      - env:
          GH_TOKEN: ${{ github.token }}
          GH_REPO: ${{ github.repository }}
        run: |
          for wf in ci.yml smoke.yml links-weekly.yml keepalive.yml; do gh workflow enable "$wf"; done
```

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    groups:
      playwright:
        patterns: ['@playwright/*', 'playwright', 'playwright-core']
      astro:
        patterns: ['astro', '@astrojs/*']
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

- [ ] **Step 5: Pin actions and validate**

Run: `pnpm dlx pin-github-action .github/workflows/*.yml && pnpm dlx @action-validator/cli .github/workflows/smoke.yml .github/workflows/links-weekly.yml .github/workflows/visual-baselines.yml .github/workflows/keepalive.yml`
Expected: SHAs pinned, no validation errors.

- [ ] **Step 6: Commit**

```bash
git add .github scripts/live-check.ts scripts/issue-sync.ts tests/e2e/smoke.spec.ts
git commit -m "Add post-deploy and daily smoke, live hash check, weekly links, baselines and keepalive"
```

---

## Task 25: README, decision log and runbook

**Files:**
- Create: `README.md`, `docs/runbook.md`, `docs/decisions/0001-two-builds.md` to `docs/decisions/0008-quality-history.md`

**Interfaces:**
- Consumes: the spec and this plan. No code.

- [ ] **Step 1: Write `README.md`**

````md
# Ceylan Akyol

A personal portfolio that is also a QA project: every promise the site makes is tied to the tests and checks that prove it.

**Live site:** see the About section of this repository. **How it's tested:** `/quality` on the live site.

## What this repository shows

- A requirements registry (`tests/requirements.ts`). Every test carries a requirement tag, and CI refuses to deploy if any requirement has no passing test or check, or if any test has no tag.
- Two builds on every change: a fixture build with fixed test content (behavior, accessibility, visual regression in 3 browser engines and 5 device profiles) and the real build (accessibility, performance, links and key behavior).
- Mutation testing of the business logic in `src/lib` (Stryker, threshold 90).
- A deploy job that installs nothing, verifies the build against the hashes of what was tested, and a post-deploy check that every live file matches.

## Run it

```bash
corepack enable && pnpm install
pnpm assets:placeholders          # first run only
pnpm test:unit                    # unit, component and build tests (run pnpm build:real first)
pnpm test:mutation                # Stryker on src/lib
pnpm build:fixture && pnpm serve:fixture   # then: pnpm exec playwright test --project=chromium
```

## Where things live

| What | Where |
|---|---|
| Business logic | `src/lib` |
| Pages and components | `src/pages`, `src/components` |
| Requirements | `tests/requirements.ts` |
| Unit, component, build tests | `tests/unit`, `tests/components`, `tests/build` |
| Browser tests | `tests/e2e` |
| Pipeline | `.github/workflows`, `scripts` |
| Design system | `DESIGN.md` |
| Decisions | `docs/decisions` |
| Recovery | `docs/runbook.md` |

## Content

Edit content in Pages CMS or directly in `src/content`. The CV must be a public version without a phone number or home address. Strip photo metadata before uploading (see the runbook).

## Moving to a custom domain

Change `SITE_URL` in the repository variables and in Cloudflare, then follow `docs/runbook.md`.
````

- [ ] **Step 2: Write `docs/runbook.md`**

```md
# Runbook

## The live site is broken after a deploy

1. Roll back: `pnpm exec wrangler rollback` (choose the previous version).
2. Revert the bad commit on `main` (`git revert <sha>` and push). Without this, the next CMS save redeploys the broken code on top of the rollback.
3. Watch the next `ci` run go green and the `smoke` job pass.

## A CI run failed

- Open the run's summary. The report job lists any requirement without coverage, unknown or missing tags, and which checks failed.
- Lighthouse performance below 95 on a single job only: rerun that job once. Record both scores in the pull request or commit. A second miss is a real regression.
- Visual regression failed after an intended design change: run the `visual-baselines` workflow, download its artifact, review the images, and commit them to `tests/e2e/__screenshots__`.

## Where warnings appear

| Warning | Where |
|---|---|
| History restarted | report job summary |
| Stryker report missing | logic job annotations; `/quality` omits the link |
| Deploy skipped because main moved on | deploy job notice |
| Live site failing (daily) | GitHub issue labelled `smoke-alert` |
| Broken external links | GitHub issue labelled `link-alert` |

## Scheduled workflows stopped

GitHub disables scheduled workflows in public repositories after 60 days without activity. The `keepalive` workflow re-enables them monthly. To check: Actions tab, each workflow shows "This scheduled workflow is disabled" if it was disabled. Re-enable with `gh workflow enable <file>`.

## Photos and personal data

- Committed files stay in public git history forever. Removing a file later requires rewriting history, and forks may keep copies.
- Strip metadata before uploading a photo: `exiftool -all= photo.jpg` (or `sips` on macOS: export as a new JPEG).
- The build fails if an image has location or owner metadata, but a CMS upload is already committed by then: remove it from history before the repository is pushed anywhere else.
- The CV is a public version: no phone number, no home address.

## Swapping in the custom domain

1. Buy the domain (Cloudflare Registrar) and add it as a custom domain on the `ceylan-akyol` Worker.
2. Set the repository variable `SITE_URL` to the new URL and push any commit.
3. Add a 301 redirect from the `workers.dev` host to the new domain (a small Worker script in front of the assets), then share the new link so previews refresh.
```

- [ ] **Step 3: Write the decision notes**

Each file follows this shape: title, date, decision, why, consequences. Write them exactly:

`docs/decisions/0001-two-builds.md`:
```md
# 0001 Two builds: fixture and real

Date: 2026-09-27

**Decision:** Every change builds the site twice. The fixture build uses fixed test content and runs behavior, accessibility and visual tests in 3 browser engines and 5 device profiles. The real build uses the real content and runs accessibility, Lighthouse, links and a short `@real` behavior pass before deploy.

**Why:** Real content changes with every CMS edit. Visual and behavior tests on real content would fail on every legitimate edit and get ignored. Fixed content makes those tests deterministic and lets edge cases (expired, hidden, long names) always be tested.

**Consequences:** The proof strip says "This site's code passed N test runs", not "this page". The `@real` pass catches problems that only real content shows.
```

`docs/decisions/0002-visual-regression-on-fixtures.md`:
```md
# 0002 Visual regression only on fixtures

Date: 2026-09-27

**Decision:** Screenshots are compared only on the fixture build, in desktop Chromium and emulated Pixel, light and dark, inside the official Playwright container.

**Why:** Screenshots of real content change whenever content changes. Rendering differs across machines unless fonts and browsers are identical.

**Consequences:** Baselines are regenerated by the `visual-baselines` workflow, never on a laptop.
```

`docs/decisions/0003-mutation-testing-scope.md`:
```md
# 0003 Mutation testing covers src/lib only

Date: 2026-09-27

**Decision:** Stryker mutates the pure modules in `src/lib`, with a break threshold of 90.

**Why:** That is where the rules live: certification expiry, traceability, the deploy gates. Templates and browser tests are too slow to rerun per mutant and would say little.

**Consequences:** `/quality` says "mutation-tested business logic", never "mutation-tested site".
```

`docs/decisions/0004-deploy-the-tested-artifact.md`:
```md
# 0004 Deploy exactly what was tested, and verify it live

Date: 2026-09-27

**Decision:** The real job hashes every built file. The deploy job refuses if any file differs other than `quality.json`, installs no npm packages, and runs a pinned wrangler. After deploy, a smoke job fetches every file from the live site and compares hashes.

**Why:** "We deploy what we tested" should be a checked fact, and the job holding the Cloudflare token should run as little third-party code as possible.

**Consequences:** `/quality` shows the previous deploy's live check.
```

`docs/decisions/0005-pages-cms.md`:
```md
# 0005 Pages CMS over a headless CMS

Date: 2026-09-27

**Decision:** Content is files in the repository, edited in the IDE or through Pages CMS, which commits to `main`.

**Why:** One editor who already works in git needs no database, no server and nothing to patch.

**Consequences:** A test keeps `.pages.yml` and the content schemas in sync.
```

`docs/decisions/0006-workers-hosting.md`:
```md
# 0006 Cloudflare Workers static assets over Railway and Vercel

Date: 2026-09-27

**Decision:** The site is static and deploys to Workers static assets.

**Why:** Railway has no meaningful free tier and would run a server for pages that never change. Vercel's free plan does not allow commercial use, which matters if tools are sold later.

**Consequences:** Hosting is free; headers come from `public/_headers`.
```

`docs/decisions/0007-traceability.md`:
```md
# 0007 Traceability tags and evidence rules

Date: 2026-09-27

**Decision:** Every test carries `@REQ-XXX-NN` tags from `tests/requirements.ts`. CI fails if a requirement has no passing test or check, a tag is unknown, or a test has no tag. A check only counts if it examined a non-empty, expected set (all 5 device profiles present, Lighthouse runs for both pages, links checked, HTML scanned).

**Why:** A matrix is only evidence if it cannot be satisfied by tests that ran nothing.

**Consequences:** The builder is itself unit and mutation tested.
```

`docs/decisions/0008-quality-history.md`:
```md
# 0008 Quality history lives in quality.json

Date: 2026-09-27

**Decision:** Before each deploy, CI reads the live `quality.json` (10 second timeout, 3 attempts), falls back to the last successful main run's artifact, and restarts history only if neither is valid. One point per commit; the last 50 are kept.

**Why:** No git writes from CI, and a transient error must not erase weeks of trends.

**Consequences:** Two runs deploying close together can drop one point. This is accepted.
```

- [ ] **Step 4: Check the docs for dashes used as punctuation**

Run: `grep -nE ' - |—|–' README.md docs/runbook.md docs/decisions/*.md | grep -vE '^\S+:[0-9]+:\s*- ' || echo clean`
Expected: `clean` (list bullets are fine).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/runbook.md docs/decisions
git commit -m "Add reviewer README, decision log and runbook"
```

---

## Task 26: Launch

**Files:**
- Modify: `src/content/**` (real content), `src/assets/uploads/*`, `tests/e2e/__screenshots__/**`

This task is mostly account setup and content that only Ceylan can provide. Each step says who does it.

- [ ] **Step 1 (Ceylan): Remove the old-email backup refs before the first push**

Run: `git update-ref -d refs/original/refs/heads/main && git branch -D backup/pre-email-rewrite && git log --all --format='%ae' | sort -u`
Expected: only the personal address.

- [ ] **Step 2 (Ceylan): Create accounts and the repository**

1. GitHub: turn on 2FA; create the public repository; push `main`.
2. Cloudflare: create an API token with only "Workers Scripts: Edit" on the one account; note the account ID; create a Web Analytics site and copy its token.
3. GitHub settings: environment `production` restricted to `main`, holding secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; repository secret `STRYKER_DASHBOARD_API_KEY` (from dashboard.stryker-mutator.io, signed in with GitHub, project enabled); repository variables `SITE_URL` (`https://ceylan-akyol.<account-subdomain>.workers.dev`) and `CF_BEACON_TOKEN`.
4. Pages CMS: sign in with GitHub and open the repository.

- [ ] **Step 3 (engineer): Generate and commit visual baselines**

Run the `visual-baselines` workflow (Actions tab, Run workflow). Download the `visual-baselines` artifact, compare the images with `docs/superpowers/specs/assets/final-mockups.png`, copy them into `tests/e2e/__screenshots__`, and commit.

- [ ] **Step 4 (Ceylan): Replace the placeholder content**

1. Photo: head and shoulders, at least 800px on the short side, metadata stripped (`exiftool -all= photo.jpg`); upload through Pages CMS and set the description.
2. CV: a public PDF without phone number or home address.
3. Certifications: one file per certification with name, issuer, dates, credential ID and verify URL where available.
4. Tagline and About (Claude drafts from Ceylan's notes; Ceylan approves). About stays under about 90 words and does not repeat the tagline.
5. Remove `placeholder: true` from every content file.

- [ ] **Step 5 (engineer): Watch the first deploy**

Push, then confirm in the `ci` run: all five jobs green, deploy not skipped, `smoke` green, `live-check` artifact shows `"ok": true`. Open `SITE_URL` and `SITE_URL/quality` on a phone and a laptop, in light and dark mode.

- [ ] **Step 6 (engineer): Post-launch checks**

Run `/design-review` on the live site for visual QA, and check securityheaders.com for an A. Record both results in the first `/quality` history note in the commit message of any follow-up fix.

---

## Self-review notes

- **Spec coverage:** sections 1 to 14 of the spec map to Tasks 1 to 26; every requirement ID in spec section 8 is registered in Task 11 and has an owning test (the registry test fails if one is missing).
- **Deviations recorded in the tasks:** the link-check state lives in the Actions cache until an issue exists (Task 8); fixtures cover past and future expiry, while the "expiring today" boundary is covered by unit tests (Task 13); the pipeline duration is measured to the report job, so the copy says "went through the pipeline" rather than "push to live" (Task 10).
- **Verify during implementation:** exact Pages CMS keys (Task 13, Step 9); Zod mini check names if the installed version differs (Task 3, Step 5); the ring draw-in direction (Task 14, Step 6); wrangler deploying with `--ignore-scripts` (Task 23; if it fails, install without that flag in the deploy job only after pinning the exact version and reviewing its install scripts).

