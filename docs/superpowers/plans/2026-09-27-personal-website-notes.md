# Phase 1 implementation notes

Running notes for executing `docs/superpowers/plans/2026-09-27-personal-website.md` on branch `feat/phase-1-site`. The controller session writes this file; implementer and reviewer subagents report into it.

## Summary for Ceylan

Work in progress. This section is updated after every task.

### Spec deviations

None so far. Where the plan and the spec disagreed, the spec was followed; the pre-flight table and each task section list those plan changes (P11 hostile fixture, P22 retries, Task 5 malformed tags, Task 6 JSON-LD type, Task 7 fail-open gates).

### Open questions

- Brush ring colours: DESIGN.md tokens are used; photo-mark.svg's own gradient stops differ slightly. Add tokens to DESIGN.md if you want the SVG's exact shades (Task 12).

### Things you must do

- Task 26 (launch) is yours. Its steps are listed under "Needs me" at the end of this file.
- Enable the local EXIF pre-commit hook: `git config core.hooksPath .githooks` (Task 9).

### Known gaps

- Package majors are newer than the plan text (Vitest 5, Stryker 10, TypeScript 6, Playwright 1.63); see Task 1.
- The Stryker Vitest runner 10.0.0 is patched locally (Task 11) because it silently skipped nested tests under Vitest 5. Remove the patch when a fixed runner is released.

## Environment

- Branch `feat/phase-1-site`, created from `main` at `c9bb45f`. Git identity checked: the repo-local personal identity "Ceylan Akyol" matches the required one and was not changed.
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

## Task 9: Privacy, content rules and JSON-LD

Commits `d70d157` and `d85635b`. New files: `src/lib/exif.ts`, `content-rules.ts`, `jsonld.ts`, `scripts/check-content.ts` and `.githooks/pre-commit`, plus `splitFrontmatter` in `src/lib/frontmatter.ts`. The unit suite passes 164 of 164, and `astro check` is clean.

**Changes from the plan:**
- Ruling P17. exifr 7 cannot read WebP, and the plan swallowed its error with `.catch(() => null)`, so a WebP photo with GPS data would have passed the privacy check. The fixture photo is WebP. `check-content` now reads each image's EXIF through sharp and parses that with exifr. It fails closed: an image whose metadata cannot be read is reported as a problem.
- The JSON-LD escaping test is tagged `@REQ-PREV-01` instead of `@REQ-CSP-01` (ruling P3). The spec has no separate requirement ID for JSON-LD escaping (D21), so PREV-01 is the closest fit.
- The body split lives in the shared `src/lib/frontmatter.ts` (ruling P27). A `profile.md` without frontmatter is now reported as a problem instead of silently skipping the About rules.

**Decisions not in the plan:**
- Added `tests/unit/check-content.test.ts`. It builds real JPEG, WebP and AVIF images with and without GPS data in a temporary folder, and runs the checker end to end. No mocking is involved.

**Verified against real tools:**
- sharp 0.35.5 returns the EXIF block of JPEG, WebP and AVIF files with a 6-byte `Exif\0\0` prefix, which exifr 7.1.3 rejects until it is stripped.
- exifr does not always throw on corrupt input. Sometimes it resolves with `{ errors: [...] }`, and that case now also fails closed.
- The JSON-LD serializer source holds a literal `\\u003c`. This was checked byte by byte, and a test proves the output never contains `<`.

**Needs me:**
- To turn on the local pre-commit EXIF hook, run `git config core.hooksPath .githooks` once. I did not change your repository configuration. The hook was tested by running it directly: it blocks a staged GPS image and passes a clean one. It needs `pnpm` on `PATH`. Without it, the hook exits with code 127 and blocks the commit.

**Reviewer findings:**
- Important, fixed: the checker's orchestration, including the new missing-frontmatter path, had no test.
- Important, fixed: there was no AVIF test, although the code claimed AVIF support. A scoped re-review confirmed both fixes.
- Minor, deferred: when `profile/profile.md` is missing, the checker crashes with ENOENT instead of printing a plain message. It still exits non-zero.
- Minor, deferred: `.heic` is accepted, although the spec lists only jpg, png, webp and avif.

## Task 10: Browser loader and renderers

Commits `988d18e` and `06fc90b`. New modules: `src/lib/quality-client.ts`, `dom.ts`, `render-home.ts`, `render-quality.ts` and `brush-tick.ts`. The unit suite passes 187 of 187, and `astro check` is clean.

**Changes from the plan:**
- Ruling P11. The renderer injection test uses the schema-valid `hostile-valid.json`. New loader tests show that the invalid `hostile.json`, and a document over the size limits, both leave every block `unavailable` with `data-settled="true"`.
- Ruling P12. The integrity sentence uses the spec's wording: "every file served matched the tested build (N files, checked ...)". The plan said "all N files served matched".
- Ruling P12. Every link a renderer creates carries the `lnk` class, which gives it the link colour and a 44px target. The plan left four renderer links unstyled and too small.
- Ruling P27. `MONTHS` is exported once, from `src/lib/dates.ts`.
- The trend label reads "Lighthouse mobile score" (the spec's wording). The plan said "Lighthouse mobile".
- When a renderer throws partway through, the loader now clears the partly built content. That keeps the fallback sentence on its own, as the spec says ("any failure keeps the fallback").
- The link guard in `el()` accepted `//evil.example` and `/\evil.example`, which browsers treat as links to another site. It now accepts only `https://` URLs or site-relative paths, with a test for each rejected form. No current data could reach this path, because the schema forces `https://`, so the fix is defence in depth.

**Verified against real tools:**
- happy-dom 20.14.5 needed no changes to the plan's tests.

**Reviewer findings:**
- Important, fixed: the link guard (above).
- Ruled in and fixed: the trend label wording and the partial-render cleanup. A scoped re-review confirmed all three fixes.
- Minor, deferred: several DOM and renderer branches are not asserted, so Stryker mutants may survive there. Task 11 runs Stryker for the first time.
- Minor, deferred: invalid ISO dates render "NaN" text. The home page renderer imports a helper from the `/quality` renderer module, which may cost JavaScript budget (checked in Task 21). Also, rounding of the mutation score and small duplications.
- Carried to Task 22: the history must include the current deploy, otherwise the page would say "This is deploy 0".

## Task 11: Requirements registry, test tag helper and mutation testing

Commits `d92d365`, `7d70c8d`, `f287a5d` and `128c512`. New files: `tests/requirements.ts` (all 43 spec requirements), `tests/tag.ts`, `stryker.config.mjs` and `vitest.unit.config.ts`. The unit suite passes 260 of 260. Stryker scores 99.93 on `src/lib`: 1,335 mutants killed, 2 timeouts, 1 survivor and 11 ignored. It runs in about 51 seconds.

**Changes from the plan:**
- Ruling P24. Each requirement's text is the spec section 8 table text word for word, with Markdown backticks removed. The plan's texts had drifted: for example, CERT-03 had lost "strictly" and PERF-01 had lost the byte budgets. A unit test now parses the table from the spec file, so any future drift fails CI.
- `ignoreStatic` is `false`. The plan had `true`, which left 123 mutants in module-level constants unmeasured, including the gate regexes themselves. Measuring them costs about 16 seconds per run.
- `stryker.config.mjs` needs `plugins: ['@stryker-mutator/vitest-runner']`, because pnpm's strict layout hides the runner from Stryker's default plugin lookup.
- About 70 unit tests were added across the `src/lib` modules to kill surviving mutants. Small refactors in 12 files removed redundant guards. A reviewer checked every one and found no behavior change. Three split regexes were rewritten into equivalent forms, so no disable comment is needed on them. That equivalence was checked against 200,000 random strings.
- `vitest.unit.config.ts` pins `TZ=America/New_York`, like the main config. Without that, the date tests would stop proving UTC behavior under Stryker.

**Verified against real tools:**
- `@stryker-mutator/vitest-runner` 10.0.0 has a bug with Vitest 5: it joins nested test names with a space, but Vitest 5 matches them joined with " > ". As a result, no test inside a `describe` block ever ran against a mutant, and the first run falsely scored 32.88. No newer runner exists, so the runner is patched with `pnpm patch` (`patches/@stryker-mutator__vitest-runner@10.0.0.patch`, recorded in `package.json` and the lockfile). The reviewer read the runner source and confirmed the patch can only lower a score, never raise it. **Remove the patch** once a released runner joins names with " > ", then check that the score does not change.
- Every Stryker option key in the plan still exists in Stryker 10.
- The 1 survivor is a real limitation of the runner, not a gap in the tests. The mutant `new Intl.NumberFormat("")` throws while the test file is being imported, and the tests do fail when it is applied by hand, but the runner records it as survived. It is left counted against the score instead of hidden.
- The 11 ignored mutants are each disabled with a one-line reason, and a reviewer checked each one as equivalent.

**Reviewer findings:**
- Important, fixed: three regex disable comments also hid mutants that are not equivalent (8 in total), which the tests do kill. The regexes were rewritten and the comments removed. A scoped re-review confirmed this from `mutation.json`.
- Minor, deferred: one disable comment's reason is worded inaccurately. Several renderer tests pin attribute order through `innerHTML`, which will cause churn on harmless refactors. The config comment does not state when to remove the patch.

## Task 12: Tokens, base styles and the page layout

Commit `b30ea49`. New files: `src/styles/tokens.css`, `src/styles/base.css`, `src/layouts/Base.astro` and 5 component tests. The whole suite passes 265 of 265, and `astro check` and `pnpm build` are clean.

**Changes from the plan:**
- Ruling P26: the tokens are exactly the DESIGN.md table in both themes. The plan's extra `--face` (unused), `--rose-start` and `--peach-end` tokens were dropped. The brush gradient runs from `--rose-mark` to `--coral`.
- Ruling P26: off-scale values were snapped to DESIGN.md. The certification title went from 19px to 20px, the "Expired" label from 13px to 14px, and the button padding from 22px to 24px.
- Ruling P4: `.prose` wraps long unbroken strings, so a long URL in About cannot scroll the page sideways at 375px.
- Ruling P3: the "no analytics beacon without a token" test is tagged `@REQ-HEALTH-01` instead of `@REQ-CSP-01`.

**Decisions not in the plan:**
- `vitest.config.ts` turns off Astro's dev toolbar for tests only. Astro 6.4.8 adds `data-astro-source-*` attributes to every element when the toolbar is on in dev mode, and Vitest runs Astro in that mode. A production build never adds them. The reviewer confirmed this in Astro's compiler source.

**Reviewer findings:**
- No critical or important findings.
- Minor, deferred: the "Expired" label keeps a 6px left margin, which is off the 4px spacing scale.

**Open question for you:** `photo-mark.svg` uses its own gradient stop colours, which differ slightly from the DESIGN.md tokens. DESIGN.md says colours come from tokens, so the ring uses `--rose-mark`, `--coral` and `--peach`. If you want the SVG's exact shades, add two tokens to DESIGN.md and the ring can use them.

## Task 13: Content collections, CMS config and placeholder content

Commits `469edd6`, `c734189` and `8097a2b`. New files: content schemas, `src/content.config.ts`, `src/pages/cv.pdf.ts`, `.pages.yml`, `src/lib/build-date.ts`, the placeholder real content, the fixture content and the placeholder asset script. The whole suite passes 286 of 286, and both `build:real` and `build:fixture` succeed.

**Changes from the plan:**
- New helper `src/lib/build-date.ts`. The fixture build pins "today" to 27 September 2026, and the real build uses the real date. This lets the fixture include the spec's certification "expiring today" (spec section 8), which the plan had dropped. It also defuses a time bomb: a fixed "Valid until 2027" fixture would otherwise have turned into an expired one in 2027, breaking the E2E tests and the daily scheduled deploy. Later page tasks call `buildToday` instead of `new Date()`.
- The fixture content now has seven certifications, and the list covers every item in spec section 8.
- Astro 6.4.8 does not resolve `image()` while it validates content-layer collections: it hands the schema a placeholder string. So the plan's photo rule inside the schema crashed every build. The schema now skips the rule when real image data isn't available (with a comment explaining why), and the rule is enforced in `scripts/check-content.ts`, which CI runs. That check reads the real format and size with sharp and fails closed. So a photo under 800px, a GIF or a missing file still fails the pipeline, as REQ-CONTENT-01 requires.
- sharp reports AVIF images as `heif` with `av1` compression, so the check maps that to AVIF. HEIC stays rejected.
- `.pages.yml` differs from the plan's draft after a check against the live Pages CMS docs:
  - `media.output` is the public path written into content.
  - Certifications use `filename: "{primary}.yaml"`, so CMS-created entries match the `*.yaml` glob.
  - `required` and `default` are top-level field keys.
  - `showAvailability`, `hidden` and `placeholder` default to false.
  - `cv.pdf.ts` strips the leading slash that Pages CMS writes.

**Verified against real tools:**
- Pages CMS docs, read live with `/browse`:
  - media `output`: https://pagescms.org/docs/configuration/media.md
  - collection `filename`: https://pagescms.org/docs/configuration/content/filename.md
  - `format: yaml`: https://pagescms.org/docs/configuration/content.md
  - top-level `required`: https://pagescms.org/docs/configuration/content/fields.md
  - `default`: https://pagescms.org/docs/configuration/fields/boolean.md
  - image and file options: the fields pages
- A reviewer confirmed through context7 that `{primary}` falls back to the `name` field and is slugified.
- Not verified: an upload through a live Pages CMS instance. The image path shape it writes is the remaining unknown until your first CMS upload (Task 26).
- The launch gate works: `findPlaceholders` flags both real content files.
- The placeholder images carry no identifying EXIF.

**Reviewer findings:**
- Spec gap, fixed: valid AVIF photos were rejected.
- Important, fixed: no test would catch removal of the call that enforces the photo rule. A scoped re-review confirmed both fixes.
- The reviewer also found your email address in this notes file (in the Environment section, from my own first draft). I removed it in `ede0f51`. It still appears as the commit author, as before.
- Minor, deferred: no test pins that a missing CV fails the build (the code does fail it). The `cv` path resolves from the repository root while `photo` resolves relative to `profile.md`. The drift test ignores the About body field.
- Carried to Task 23: `check-content.ts` must run in CI before deploy.

**Needs me:**
- After the first photo and CV upload through Pages CMS (Task 26), check that the build still finds both files. The CMS path format was taken from its docs, not from a live upload.
