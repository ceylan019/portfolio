# Phase 1 implementation notes

Running notes for executing `docs/superpowers/plans/2026-09-27-personal-website.md` on branch `feat/phase-1-site`. The controller session writes this file; implementer and reviewer subagents report into it.

## Summary for Ceylan

Work in progress. This section is updated after every task.

### Spec deviations

None yet.

### Open questions

None yet.

### Things you must do

- Task 26 (launch) is yours. Its steps are listed under "Needs me" at the end of this file.

### Known gaps

None yet.

## Environment

- Branch `feat/phase-1-site`, created from `main` at `c9bb45f`. Git identity checked: "Ceylan Akyol" <akyl.cyln@gmail.com> (repo-local, unchanged).
- The machine's default Node is 23 (Homebrew) and nvm's default is 18. Node 22.23.3 was installed through nvm and is used by putting its `bin` directory first on `PATH`. The nvm default was not changed.
- pnpm 10.18.0 through corepack (the version in the plan's `packageManager`).
- Docker is installed but its daemon is not running, so container-based steps (Playwright container, visual baselines) cannot run locally.
- actionlint is not installed.

## Pre-flight plan scan

Before Task 1, a read-only scan compared every task pair that shares a file or interface, checked each task against itself, and checked the plan against the spec and DESIGN.md. Every requirement ID in spec section 8 is registered in Task 11 and has an owning test. The scan found the items below. None of them made me think the spec itself is wrong. Where the plan and the spec disagree, the spec wins. Each ruling is carried into the dispatch of the task it affects.

| # | Tasks | Finding | Ruling |
|---|---|---|---|
| P1 | 5, 20 | The Playwright 1.55 JSON reporter strips the leading `@` from tags. Without a fix, the gate would treat every E2E test as untagged, so seven requirements would count as uncovered. | Traceability accepts tags with or without `@`. The unit fixture uses the real reporter shape. |
| P2 | 22, 23 | All five fixture matrix legs upload the dist-scan output, so the report job would find six scan files where it expects two. | Only the Chromium leg uploads it. |
| P3 | 5, 9, 12, 19 | Unit tests tagged REQ-PERF-01 and REQ-CSP-01 would count as coverage by themselves, so missing Lighthouse or dist-scan evidence would never block the gate. | Retag those tests. PERF-01 and CSP-01 are then covered only by their declared checks, as spec section 8 says. |
| P4 | 12, 16, 20 | `.prose` has no `overflow-wrap`, so the long URL in the fixture About text would scroll sideways at 375px. | Add `overflow-wrap: anywhere`. |
| P5 | 1, 20, 22, 23 | An unset `vars.SITE_URL` arrives as an empty string, which `??` does not replace. | Use `\|\|`. |
| P6 | 23, 24 | The report job read `live-check` only from the last successful run. A failed live check fails its run, so `/quality` would keep showing an older passing result. | Read it from the latest completed run, whatever its outcome. |
| P7 | 24 | `playwright test \| tee` without pipefail, so smoke failures never fail the job. | Use bash with pipefail. |
| P8 | 24 | No task creates the `smoke-alert` and `link-alert` labels. | The workflows create them idempotently. |
| P9 | 8, 24 | The plan keeps link-check state in the Actions cache before an issue exists. GitHub evicts cache entries after 7 unused days, which matches the weekly interval. | State lives in the issue body once the issue exists (as the spec says). Before that, it lives in an artifact from the previous run. |
| P10 | 16 | `src/lib/site.ts` is missing from the commit. | Add it. |
| P11 | 3, 10, 20 | The plan's hostile `quality.json` is schema-valid and expected to render. The spec (section 8) says hostile data stays `unavailable`. | Follow the spec. Add a separate valid variant with HTML in test names, expected `ready`, which proves nothing is injected. |
| P12 | 10, 17 | `/quality` deviates from spec section 4 in several ways: the integrity block comes before the requirements, the integrity wording differs, the duration block has an empty fallback, the verdict fallback has no repo link, only four suites are described, and several links are under 44px. | Follow the spec on each point. |
| P13 | 13 | The schema drift test also passes when the base object fails to parse. | Assert success first. |
| P14 | 13 | CMS-created certifications may not be `.yaml`, and the CV media path semantics are unclear. | Set `filename` in `.pages.yml` and verify the media path against Pages CMS docs. |
| P15, P16 | 21 | Lighthouse's canonical audit on localhost, and blocking the beacon, may cost SEO or best-practices points. | Verify with a real run. Any skipped audit is recorded openly. |
| P17 | 9 | exifr cannot parse WebP, and the plan swallows the error, so a WebP with GPS data would pass. | Read metadata through sharp, and fail closed on parse errors. |
| P18 | 23 | Firefox may refuse to start as root in the Playwright container. | Set `HOME=/root`. This cannot be verified locally. |
| P19 | 18 | A sharp `Buffer` passed to `Response` may fail `astro check`. | Wrap it in `Uint8Array` if needed. |
| P20 | 18, 20, 24 | Exact `Cache-Control` equality may fail if Workers adds directives. | Check against `wrangler dev`. Relax the test only to "required directives present" if that proves necessary. |
| P21 | 5, 9 | The plan's expected test counts are off by one. | The counts are informational. Real counts are reported. |
| P22 | 4 | The plan makes 3 attempts in total, and an invalid 200 response is not retried. The spec says "retry 3 times". | One attempt plus three retries. An invalid body counts as a failure. |
| P23 | 14, 20 | Three tests carry the wrong requirement tag. | Retag them. |
| P24 | 11 | Registry texts drift from the spec (for example, CERT-03 drops "strictly"). | Copy the spec text verbatim. |
| P25 | 25 | The README and decision 0001 claim visual regression runs in all five profiles. | Correct the claim: desktop Chromium and emulated Pixel only. |
| P26 | 12, 17 | Some sizes and spacing are off the DESIGN.md scales, and an unused token is defined. | Snap to the DESIGN.md scales. |
| P27 | several | Verbatim duplication: the months array, `isObj`, frontmatter parsing, and the serve-and-wait loop. | Share each one. |

## Task 1: Project foundation

Commit `66308b4`. The scaffold, configs, temporary page and foundation test were implemented as planned. `pnpm test:unit` passed 1 of 1, and `pnpm build` produced `dist/index.html`.

**Decisions not in the plan:**
- pnpm 10 blocks dependency install scripts by default. `package.json` allows exactly three: `esbuild`, `sharp` and `workerd` (`pnpm.onlyBuiltDependencies`). Each one needs its native binary.

**Changes from the plan:**
- `astro.config.mjs` uses `process.env.SITE_URL || ...` instead of `??` (ruling P5), because an unset GitHub variable arrives as an empty string.
- The plan says to pin the current version of each package and treats its numbers as minimum majors. The result is several majors newer than the plan text: `vitest` 5.0.2 (plan 3), `@stryker-mutator/*` 10.0.0 (plan 9), `typescript` 6.0.3 (plan 5), `happy-dom` 20 (plan 18) and `linkinator` 8 (plan 6). Others: `@playwright/test` 1.63.0, `zod` 4.6.5, `wrangler` 4.142.0, `satori` 0.33.5, `sharp` 0.35.5, `esbuild` 0.28.2. Later tasks were written against the older majors, so any API drift they hit is fixed with the smallest change and recorded under that task.

**Tradeoffs:**
- `astro` is held at 6.4.8, the newest 6.x. Astro 7.3.5 exists, but the plan and spec are built on Astro 6.
- `typescript` is held at 6.0.3, not 7.0.2, because `@astrojs/check` 0.9.10 declares peer support for TypeScript 5 and 6 only.

**Verified against real tools:**
- `zod/mini` imports and works in zod 4.6.5. Its check names are verified in Task 3.
- `vitest` 5.0.2 runs through Astro 6's `getViteConfig` (Vite 7). This was confirmed by the passing test run, not only by the peer ranges.
- Stryker 10 with Vitest 5 is compatible by declared peer ranges only. The first real mutation run is in Task 11.

**Reviewer findings:**
- No critical or important findings.
- Minor: `@types/node` 26 is pulled in transitively while the runtime is Node 22. Left as is, and noted for the final review.
- Minor: the Stryker 10 compatibility is still unproven. It is checked in Task 11.
- The reviewer could not confirm the `@REQ-PERF-02` tag from this diff alone. Task 11 creates the registry entry.

## Task 2: Dates and certification rules

Commits `4c70b07` and `d908717`. `src/lib/dates.ts` and `src/lib/certifications.ts` were implemented as planned, with 15 unit tests. The unit suite passes 16 of 16.

**Decisions not in the plan:**
- `vitest.config.ts` pins `TZ=America/New_York` for every Vitest run (Stryker's Vitest runner included).

**Reviewer findings:**
- Important, fixed: on a UTC machine such as a GitHub runner, the tests could not tell `getUTCMonth` from `getMonth`. Review Focus 5 (expiry near midnight at UTC minus 5) was therefore not really proven, and the matching mutants would survive. With the timezone pinned, swapping one UTC accessor for its local version fails 2 tests ("February 2024" instead of "March 2024"). A scoped re-review confirmed the red and green evidence.
- Minor, deferred to the final review: the "expired" branch of `validity()` is asserted only through its label text.

## Task 3: The shared quality.json schema and fixtures

Commits `eb4e5c1` and `9f760a3`. `src/lib/quality-schema.ts` matches the plan line for line. The schema has 14 unit tests. The unit suite passes 30 of 30, and `astro check` reports no errors.

**Changes from the plan:**
- Ruling P11 (the spec wins over the plan). The plan made `tests/fixtures/quality/hostile.json` schema-valid, so it would have rendered as `ready`. Spec section 8 says the hostile variant holds HTML in names, huge and negative numbers and wrong types, and stays `unavailable`. `hostile.json` keeps the plan's HTML and `javascript:` strings and adds `counts.axeViolations: -1`, `counts.tests: 1e12` and `lighthouse.performance: "100"`, so it fails validation. A new `tests/fixtures/quality/hostile-valid.json` carries only the HTML and `javascript:` strings and stays valid. Later tasks use it to prove that rendered strings cannot inject markup. Two tests were added for the pair.

**Verified against real tools:**
- zod/mini check names were confirmed in the installed zod 4.6.5, and every name the plan uses exists: `z.int`, `z.minimum`, `z.maximum`, `z.maxLength`, `z.regex`, `z.startsWith`, `z.enum` and `.check(...)`. Schema instances also expose `.safeParse()`. No substitutions were needed.
- Review Focus 4: `future.json` (`schemaVersion: 2`) is rejected through `safeParse` and never throws.

**Reviewer findings:**
- Important, fixed: the 500-tests-per-requirement limit had no test. A new test was proven to fail when the limit check is removed. A scoped re-review confirmed the fix.
- Minor, deferred to the final review: no test shows that a value exactly at a limit (200 requirements, 50 history points, 200 characters) is still accepted. The existing tests only prove that one over the limit is rejected.
- Minor, deferred: the fixture JSON formatting is inconsistent (compact versus pretty-printed).

## Task 4: History merge, fallback and upgrades

Commit `4c22f7c`. `src/lib/history.ts` was implemented with 26 unit tests: the plan's 19, adjusted, plus 7 new ones. The unit suite passes 56 of 56.

**Changes from the plan:**
- Ruling P22 (the spec wins over the plan). Spec section 8 says: "Any other failure (timeout, 5xx, invalid): retry 3 times with backoff". The plan made 3 attempts in total and accepted a 200 response with an unparseable body as success. `fetchLiveQuality` now makes one attempt plus three retries, with 1, 2 and 4 second backoff. A 2xx response whose body is not JSON, or fails the schema, counts as a failed attempt and ends as an error naming the invalid data. A 404 still returns "not found" at once. The plan's tests were adjusted to match: 4 attempts, backoff `[1000, 2000, 4000]`, and the 200 test now uses the valid fixture. No test was removed.

**Decisions not in the plan:**
- Boundary tests were added for mutation testing: status codes 199, 299 and 300; a history exactly at the 50-point limit; and a duplicate commit arriving when the history is already full.

**Reviewer findings:**
- No critical or important findings.
- Minor, deferred: the 10-second default timeout and the initial "unknown" failure reason are never exercised by a test, so Stryker mutants on them will probably survive. Testing the real default would need a slow test.
