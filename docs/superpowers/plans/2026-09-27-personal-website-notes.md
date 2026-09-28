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

## Task 5: Traceability builder, evidence rules and mutation summary

Commits `b57427c` and `dead480`. New modules: `src/lib/traceability.ts`, `evidence.ts`, `mutation.ts` and a shared `guards.ts`. The unit suite passes 91 of 91, and `astro check` is clean.

**Changes from the plan:**
- Ruling P1: Playwright's JSON reporter writes tags without the leading `@`, so `normalizePlaywright` now adds the `@` before reading tags. Without this, the gate would have called every Playwright test untagged. The test fixtures now use the real reporter shape, and one case keeps the `@` form.
- Ruling P3: the Lighthouse summary unit test is retagged from `@REQ-PERF-01` to `@REQ-TRACE-01`. No unit test carries `REQ-PERF-01` or `REQ-CSP-01`, so those two are covered only by the real Lighthouse and dist-scan evidence, as spec section 8 requires.
- Ruling P27: one `isRecord` guard now lives in `src/lib/guards.ts`, and `src/lib/history.ts` imports it instead of keeping its own copy.
- A plan test fixture used Vitest's `pending` status. Vitest 5 reports a skipped test as `skipped`, so the fixture was updated. No code change was needed: every status other than `passed` and `failed` counts as skipped, so a skipped test can never count as coverage.
- A Task 5 ruling (the spec wins over the plan): the plan's `tagsIn` silently drops near-miss tags such as `REQ-HERO-1`. Spec section 8 says CI fails on a tag that is not in the registry. Both normalizers now pass such tags through, and the gate reports them as unknown tags. `tagsIn` itself and its plan test are unchanged.

**Verified against real tools:**
- Playwright 1.63.0's JSON reporter strips the `@` from `spec.tags`. This was confirmed with a throwaway spec run outside the repo's tests.
- Vitest 5.0.2's JSON report has the fields the normalizer reads. Its status values are `passed`, `failed`, `skipped`, `pending` and `todo`.
- The Stryker 10 report format (mutation-testing-report-schema 3.8.4) matches the field names `mutationSummary` reads.

**Reviewer findings:**
- Important, fixed: near-miss requirement tags passed the gate silently (see the ruling above).
- Important, fixed: the gate's malformed-input paths were untested. Focused tests now cover each guard, the evidence detail strings and the problem wording. A scoped re-review confirmed both fixes.
- Deferred to the final review (minor): the Playwright `flaky` status maps to "failed" implicitly. Tests marked as expected to fail (Playwright `test.fail()`, Vitest `test.fails`) would count as coverage. Problems repeat once per browser project. Two Playwright tests with the same title in one file merge. `relative()` matches a path prefix without a trailing slash.
- Carried forward to Tasks 20 and 22: a missing Lighthouse `assertion-results.json` must count as "not covered", a missing `vitest.json` must fail the report job, and failing tests must fail their CI job before the report job runs.

## Task 6: Built HTML scanner

Commits `7197ce4` and `1eaf09a`. `src/lib/dist-scan.ts` has 10 unit tests, and the unit suite passes 101 of 101. All scanner tests are tagged `@REQ-GATE-01`, not `@REQ-CSP-01` (ruling P3).

**Changes from the plan:**
- The plan's JSON-LD exception was a prefix match, so `<script type="application/ld+jsonp">alert(1)</script>` passed the CSP scan. Spec section 7 allows only `type="application/ld+json"`. The regex now needs the exact value, quoted with matching quotes or unquoted and followed by whitespace, `/` or `>`. Tests show that `ld+jsonp`, `ld+json-evil` and `ld+jsonx` are flagged, and that the three exact forms are allowed.

**Decisions not in the plan:**
- Added tests that pin case-insensitivity (`<SCRIPT>`, `SRC=`, `TYPE="APPLICATION/LD+JSON"`) and a `data-src` decoy.

**Reviewer findings:**
- Important, fixed: the JSON-LD prefix-match evasion above.
- Important, fixed: case-insensitivity of the script rules was not pinned.
- Fixed in a second round: the implementer's report used dashes as punctuation, and its first fix claim was inaccurate. Only the report changed, not the code.
- Minor, deferred: the nested-path branch of the states page check has no test.
- Carried to Task 22: the CLI around the scanner must assert that it scanned a non-zero number of files including `index.html` (spec section 7).

## Task 7: Deploy gates (manifest, placeholders, stale commit)

Commits `980dcf7` and `10f5e0b`. New modules: `src/lib/manifest.ts`, `placeholders.ts`, `stale-sha.ts`, and a shared `frontmatter.ts`. There are 22 gate tests, and the unit suite passes 123 of 123.

**Decisions not in the plan:**
- Ruling P27: frontmatter extraction lives once, in `src/lib/frontmatter.ts` (`frontmatterOf`). Tasks 9 and 22 must import it instead of copying the regex.

**Changes from the plan:**
- Two fail-open paths were copied from the plan's own code, and both are fixed because the spec says deploy must refuse:
  - `diffManifest` used `path in expected`, which also finds names inherited from every JavaScript object. An extra file named `toString` passed manifest verification. Both membership checks now use `Object.hasOwn`.
  - The placeholder regex missed `placeholder: True`, `placeholder: TRUE` and `placeholder: true  # remove before launch`, so placeholder content could have gone live. It now matches `true` in any letter case and allows a trailing comment. `false`, words that only start with "true", and mentions in the body still don't trigger it.
- `frontmatterOf` normalizes Windows (CRLF) line endings, because a CRLF file used to read as having no frontmatter.
- The stale-commit check deliberately fails open (as in the plan): if `git ls-remote` output can't be parsed, the deploy is not skipped. A transient network error should not block every deploy.

**Reviewer findings:**
- Critical, fixed: both fail-open paths above.
- Minor, fixed under a ruling: the CRLF case, which is the same fail-open class. A scoped re-review confirmed all three fixes.

## Task 8: Monitoring issue logic

Commit `1c1854a`. `src/lib/issue-state.ts` has 21 unit tests, and the unit suite passes 144 of 144.

**Changes from the plan:**
- Ruling P9. The plan kept the link-check failure counts in the GitHub Actions cache until an issue exists. GitHub evicts cache entries that go unused for 7 days, which is exactly the weekly interval, so a link might never reach the two-failure threshold. The spec (D15) says the issue body holds the state. `renderLinksBody` now embeds the full state as a hidden HTML comment, and a new `parseLinkState` reads it back. Before any issue exists, the workflow will keep the state in an artifact from the previous run (Task 24).
- As a result, one plan assertion changed. The test that a URL failing only once is not reported used to check that the URL appears nowhere in the body. The URL now legitimately sits in the hidden state comment, so the test checks that it is not in the visible list of broken links. The reviewer judged this still proves the original point, and a mutant that removes the threshold would still fail it.

**Reviewer findings:**
- No critical or important findings.
- Minor, deferred: the state-comment regex stops at the first `-->`, so a URL containing `-->` would be truncated. This is not realistic for this content.
