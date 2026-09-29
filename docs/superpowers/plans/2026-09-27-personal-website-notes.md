# Phase 1 implementation notes

Running notes for executing `docs/superpowers/plans/2026-09-27-personal-website.md` on branch `feat/phase-1-site`. The controller session writes this file; implementer and reviewer subagents report into it.

## Summary for Ceylan

Work in progress. This section is updated after every task.

### Spec deviations

- REQ-PERF-02 JavaScript budget raised from 5 KB to 10 KB brotli by your decision on 2026-09-28 (Task 21). Please update spec section 6 and the REQ-PERF-02 row; then remove the parity-test override.
- Otherwise none. Where the plan and the spec disagreed, the spec was followed; the pre-flight table and each task section list those plan changes (P11 hostile fixture, P22 retries, Task 5 malformed tags, Task 6 JSON-LD type, Task 7 fail-open gates).

### Open questions

- Brush ring colours: DESIGN.md tokens are used; photo-mark.svg's own gradient stops differ slightly. Add tokens to DESIGN.md if you want the SVG's exact shades (Task 12).
- Credential IDs longer than about 35 characters cannot both stay unbroken and avoid sideways scrolling at 375px (spec section 6). Check your real IDs at launch (Task 20).

### Things you must do

- Task 26 (launch) is yours. Its steps are listed under "Needs me" at the end of this file.
- Enable the local EXIF pre-commit hook: `git config core.hooksPath .githooks` (Task 9).
- Update the spec for the 10 KB JavaScript budget (Task 21).
- Delete the untracked `.probe/` scratch folder (Task 21).

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

## Task 14: Brush ring, photo frame and tick components

Commit `2a219eb`. New files: `scripts/extract-brush-paths.ts` (reads `photo-mark.svg`), the generated `src/lib/brush-ring.ts`, `PhotoFrame.astro`, `Tick.astro`, ring CSS and 3 component tests. The suite passes 289 of 289.

**Changes from the plan:**
- Ruling T12-B: the plan's CSS used `--rose-start` and `--peach-end`, which are not DESIGN.md tokens. The main stroke runs from `--rose-mark` to `--coral`, and the second pass is a flat `--peach`.
- Ruling P23: the ring markup test is tagged `@REQ-HERO-01` instead of `@REQ-A11Y-03`. It checks the decorative, mask-based ring, not reduced motion. Reduced motion is covered by the E2E test in Task 20.

**Verified against real tools:**
- Draw-in direction (the plan asked for this check): the animations were paused at 0, 100, 300, 600 and 1000ms in `/browse`, and the frames compared with `photo-mark.svg`. The main stroke draws first, counterclockwise from about 1 o'clock, then the second pass, as in the approved asset. No flip was needed. The reviewer and I both compared the end frame with the reference: the geometry, colour order and overshoot match.
- Reduced motion could not be emulated in `/browse`, because its browser bridge refuses the media emulation command. The fallback was checked by cancelling the animations, and by reading the CSS: both strokes rest at `stroke-dashoffset: 0`, meaning complete. The Playwright E2E test in Task 20 emulates reduced motion for real.

**Reviewer findings:** none blocking. Minor: the plan's interface line mentions a `size` prop on `PhotoFrame`, which no caller uses.

## Task 15: Certifications section

Commit `3c134b2`. `Certifications.astro` and `CertEntry.astro` were implemented as planned, with 6 component tests. The suite passes 295 of 295.

**Reviewer findings:**
- No critical or important findings.
- Minor, deferred: each Verify link's accessible name is built from the certification name only. Two visible certifications with the same name (for example, a renewal recorded as a second entry) would produce duplicate link names.
- Minor, deferred: no committed test locks in that an entry without a verify URL shows no tick and no link. The code does this correctly.

## Task 16: Hero, proof strip, About, Contact, footer and the home page

Commit `4595748`. The home page is built from content in the approved order: hero, certifications, proof strip, About, Contact, footer. The suite passes 302 of 302, and both builds succeed.

**Changes from the plan:**
- Ruling P10: `src/lib/site.ts` is included in the commit. The plan's `git add` list left it out.
- Ruling T13-A: the page takes "today" from `buildToday`. The fixture build therefore shows the 27 September 2026 state: the certification expiring that day reads "Valid until September 2026", and the footer year is 2026. `BUILD_KIND` is available through both `import.meta.env` and `process.env` during `astro build`, and this was checked.

**Verified against real tools:**
- Built HTML: `dist/index.html` and `dist-fixture/index.html` contain no `style=` and no `<style`. Each has exactly two script tags: the JSON-LD block and one external `/_astro/*.js` module. There is no analytics beacon without a token.

**Reviewer findings:**
- No critical or important findings.
- Minor, deferred: an Astro markdown deprecation warning prints during every component test that uses the Container API. It dates from an earlier task, and the final review will trace it. `About.astro` has no render test of its own. Some component props are typed `any`.

## Task 17: The /quality page

Commits `afb3ef7` and `93d76f6`. New files: `TopLine.astro`, `DataBlock.astro`, `src/pages/quality.astro`, the page styles and 11 component tests. The suite passes 313 of 313. Both builds succeed, and `quality.html` has no inline styles and one external script.

**Changes from the plan:**
- Ruling P12, with spec section 4 winning over the plan and the mockup:
  - The page runs in the spec's order: top line, verdict, requirements, deploy integrity, trends, mutation testing, the suites, pipeline duration. The plan and the approved mockup put deploy integrity before the requirements, but the spec says its text wins over any mockup.
  - The verdict fallback uses the spec sentence and links to both the repository and its Actions page. `DataBlock` now accepts a list of links.
  - Every other block's fallback says its numbers are unavailable and links to the latest CI run.
  - Pipeline duration now has a real fallback sentence instead of an empty one.
  - "The suites" describes all 11 suites from spec section 8, not the plan's four. The wording matches what the pipeline does: "mutation-tested business logic", visual regression on desktop Chromium and emulated Pixel only, axe in both themes, Lighthouse mobile with 3 runs.
  - The page says there is no pass or fail column because only fully green builds deploy.
- The glossary line uses the spec's terms: test, test run, browser engines and the five device profiles. It is set at 14px with a 62-character cap (DESIGN.md), where the plan had 15px and 66 characters.
- The footer year comes from `buildToday`.

**Reviewer findings:**
- Important, fixed: two new tests had no requirement tag, which the CI gate would reject. They are now tagged `@REQ-QUAL-01`, the closest registered requirement. A scoped re-review confirmed the fix.
- Minor, deferred: some small layout values differ from the plan (for example, a 22px margin that aligns the verdict columns). They are documented in the implementer's report.

## Task 18: 404, link preview image, favicons, headers and robots

Commits `1abfe0e`, `152f1c6` and `bf33b8e`. New files:
- the 404 page
- the link preview card (`src/og/card.ts` and `src/og/profile-photo.ts`) and three image endpoints (`/og.png`, `/apple-touch-icon.png`, `/favicon-32.png`)
- `public/favicon.svg`, `public/_headers` and `public/robots.txt`
- the Schibsted Grotesk TTFs with `OFL.txt`
- the shared `src/lib/content-paths.ts`

The suite passes 318 of 318, and both builds succeed.

**Changes from the plan:**
- Ruling P26: the 404 numeral uses the DESIGN.md display size (96px desktop, 60px mobile) instead of 120px.
- Ruling P19: TypeScript 6 rejects a Node `Buffer` as a `Response` body, so the three image endpoints wrap it in `Uint8Array`.
- The plan's preview card had no handling for long names. With the fixture's 40-character name, the photo and ring were pushed almost entirely off the 1200x630 canvas (I checked the image). The card now has a fixed photo column and a text column with a maximum width, and the name's font size scales down with its length. A pixel-level test decodes the PNG and checks the ring is present for both a 40-character name and "Ceylan Akyol". The short-name card still matches `final-mockups.png`.
- Ruling P27: one shared path resolver (`src/lib/content-paths.ts`) now serves the content check, the preview card and `/cv.pdf`.

**Verified against real tools:**
- satori 0.33.5 needed no API changes from the plan's code, which was written for 0.18.
- `wrangler dev` (the reviewer repeated this independently):
  - `/cv.pdf` and `/og.png` return `Cache-Control: no-cache`, and `/_astro/*` returns `public, max-age=31536000, immutable`. Other paths get wrangler's default, `public, max-age=0, must-revalidate`.
  - The CSP and HSTS headers are on every path, and no path gets a duplicate `Cache-Control`.
  - `/does-not-exist` returns a real 404 with the custom page and a noindex tag.
  - Production Workers behaviour is confirmed only by the smoke run at launch.
- The favicon's literal colours equal the `--rose-mark` and `--peach` token values in both themes.
- The fonts are genuine TrueType files carrying the Schibsted Grotesk OFL copyright. The implementer's report records their download URLs and hashes.

**Reviewer findings:**
- Important, fixed: the preview card read the photo path only relative to `profile.md`. The leading-slash path Pages CMS writes would have broken `/og.png` on the first real upload. A scoped re-review confirmed the fix, and a scoped Stryker run on the new resolver killed 5 of 5 mutants.

## Task 19: Test-only states page

Commits `758db92` and `09466f4`. `src/pages/[states].astro` renders the long-name hero and the one, many and long certification lists, plus the proof strip fallback, for visual tests. It exists only in the fixture build. The unit suite passes 319 of 319.

**Changes from the plan:**
- Ruling P3: the test is tagged `@REQ-STATE-01` instead of `@REQ-CSP-01`. The requirement that the real build contains no states page stays with the real dist-scan check.
- The page's "today" is the shared `FIXTURE_TODAY`.
- The plan's test changed `BUILD_KIND` and did not restore it when an assertion failed, so it could leak into other tests. It now restores the previous value in a `finally` block.

**Decisions not in the plan:**
- Spec section 8 also lists sparse and full history and a matrix with many rows. Those are drawn in the browser from `quality.json`, so they are covered in Task 20's `/quality` tests with routed data variants, not on this page.

**Verified:** `dist-fixture/__states.html` has no inline style, and `dist/__states.html` does not exist.

## Task 20: Playwright configuration and browser test suites

Commits `69242fd`, `6a0a23b` and `995a721`. New files: `playwright.config.ts`, shared fixtures, and 12 spec files. `overflow.spec.ts` and `scripts/serve-and-wait.sh` were added beyond the brief.

Suites: home, quality, quality-data, nojs, overflow, a11y, headers, previews, health, visual and real.

**Local results (macOS host, not the Linux container):**
- Fixture build, visual excluded: 51 tests passed, 0 failed and 0 skipped in each of chromium, firefox, webkit, iphone and pixel. That is 255 test runs.
- Real build (`real-chromium`, served with a stand-in `quality.json` that is not in `dist`): 14 passed.
- Visual suite: all 24 tests (chromium and pixel) ran and failed only because no baseline exists yet. No screenshot files were written or committed.
- The traceability builder reports no problems for the 283 Playwright results.

**Changes from the plan:**
- The plan's two "no sideways scroll" checks ran at the desktop viewport (1280px), where they could never fail. `overflow.spec.ts` forces a 375px viewport on `/`, `/quality`, `/__states` and a many-rows `/quality` in all five profiles (Review Focus 3). It found a real bug: `/__states` scrolled 18px sideways because the whole "Credential ID" line refused to wrap. Now the label can wrap, and the ID stays unbroken (commit `69242fd`).
- Ruling P11: the invalid `hostile.json` must settle as `unavailable`. The valid `hostile-valid.json` must settle as `ready` with nothing injected: only expected element types, every link `https`, and no marker attribute set on the page.
- `/quality` gets routed variants for sparse history (2 points) and a many-row matrix, tagged `@REQ-STATE-01` and included in the visual suite. They cover spec section 8's states that are drawn in the browser.
- Ruling P23: the section-order test is tagged `@REQ-A11Y-04`, and it also checks that each section is labelled by its heading.
- Header tests assert exact values. Task 18 recorded what `wrangler dev` really serves.
- WebKit does not move focus to links with plain Tab (Safari's default), so the keyboard test uses Alt+Tab there. It asserts the same focus order and the site's own 2px solid focus ring on the skip link, the CV button and Email.
- The plan's list of certifications grew from 5 to 6 rows, because the fixture now includes the certification expiring today.
- One serve-and-wait helper (ruling P27): `scripts/serve-and-wait.sh`.

**Verified against real tools:**
- The Playwright 1.63 JSON reporter drops the `@` from tags. The traceability builder handles that.
- `--update-snapshots=none` fails on a missing baseline without writing an image.
- `playwright install` kept timing out when downloading from its CDN on this machine, although plain downloads of the same URLs worked. The implementer downloaded the exact browser archives Playwright names and placed them in its install folders. This only affects local runs, because CI uses the Playwright container.

**Reviewer findings:**
- Important, fixed: the "no console errors on any page and data state" test (REQ-HEALTH-01) skipped the "missing `quality.json`" state. It now covers it, ignoring only the one expected 404 message.
- Ruled in and fixed: five tightened assertions:
  - the focus ring is the site's own 2px solid outline
  - each credential ID renders on one line
  - all 5 Verify links appear
  - the real build has at least one visible certification
  - the oversized variant fails for the matrix limit
- Not yet verified: whether Alt+Tab behaves the same in WebKit inside the Linux container. It is confirmed on macOS only, and the first CI run will show it.

**Open question for you:** spec section 6 asks for both "credential IDs never break mid-token" and "no horizontal scroll at 375px". The schema allows credential IDs up to 60 characters, and an unbroken ID longer than about 35 characters cannot fit a 375px screen. The site keeps IDs unbroken, and every tested ID fits. If one of your real IDs is longer than about 35 characters, choose between capping the ID length in the schema and allowing a break only for IDs that cannot fit.

## Task 21: Lighthouse budgets and the JavaScript budget test

Commits `588e0f8` and `8e7fb5b`. New files: `lighthouserc.cjs`, `tests/build/bundle.test.ts` and `src/lib/format.ts`. The suite passes 321 of 321.

**Your decision (28 September 2026):** the first-party JavaScript budget goes up from 5 KB to 10 KB brotli, and zod/mini stays in the browser (E6).

The measurements behind it, taken with esbuild against the installed zod 4.6.5:
- zod/mini with a two-field schema: 4.2 KB brotli.
- The full `quality.json` schema alone: 6.6 KB.
- The schema with every limit check removed: 5.6 KB.
- The whole first-party bundle: 9.4 KB (9,423 bytes). It now passes the 10,240-byte limit.

**Needs me:** carry this decision into the spec. Section 6 says "under 5 KB brotli-compressed", and the REQ-PERF-02 row in section 8 says "under 5 KB brotli". The registry text already says 10 KB, so the public `/quality` page matches what is tested. The spec-parity unit test has one narrow override for REQ-PERF-02 text only, with a comment pointing here. Remove it once the spec is updated.

**Changes from the plan:**
- The beacon budget (ruling P16). With a dummy analytics token, Lighthouse still counts the blocked beacon request as one third-party resource. The plan's budget of 0 would have failed on the first CI run after you add `CF_BEACON_TOKEN`. The budget now allows 1 only for the real build with a token set. Both states were proven with real Lighthouse runs: [1,1,1] with the token, [0,0,0] without.
- `src/lib/format.ts` now holds the `plural` helper, so the home page renderer no longer imports the `/quality` renderer module. It did not shrink the bundle, but it removes the coupling. This goes slightly beyond the plan's file list.

**Verified against real tools (Lighthouse 12.6.1 through @lhci/cli 0.15.1, 3 runs per URL, mobile by default):**

| Build | Page | Performance | Accessibility | Best practices | SEO | Total | Fonts |
|---|---|---|---|---|---|---|---|
| real | / | 100 | 100 | 100 | 100 | 97.8 KB | 75.0 KB |
| real | /quality | 95 | 100 | 100 | 100 | 95.5 KB | 75.0 KB |
| fixture | / | 100 | 100 | 100 | 100 | 98.3 KB | 75.0 KB |
| fixture | /quality | 96 | 100 | 100 | 100 | 95.5 KB | 75.0 KB |

- The canonical audit passes on `localhost`, even though the canonical URL points at the `workers.dev` host (ruling P15). No audit is skipped.
- The blocked beacon causes no console errors, so best practices stays at 100.
- `/quality` on the real build sits exactly at the 95 performance threshold. The spec's one-rerun policy for runner noise may be needed in CI.

**Needs me:**
- Delete the untracked `.probe/` folder at the repo root. It holds esbuild size probes from this investigation, and deleting it was not permitted in this session.

**Reviewer findings:** none blocking. Carried to Task 23: `CF_BEACON_TOKEN` must reach both the real build step and the real Lighthouse step.

## Task 22: Pipeline scripts

Commits `f50c774`, `8c2a716` and `7150b5e`. New files in `scripts/`: `node-fs.ts`, `scan-dist.ts`, `write-manifest.ts`, `stand-in-quality.ts`, `build-report.ts` and `gate-cli.ts` (bundled to `dist-gate/gate-cli.mjs`). The unit suite passes 324 of 324, and Stryker scores 99.78.

**Changes from the plan:**
- Ruling T22-A: `build-report` fails closed on missing evidence. A missing or unreadable Lighthouse file for either build means "not covered". A missing Vitest, Playwright or mutation report is a named problem. The live check is optional by design: the first deploy has none, and /quality then says the check runs after this deploy.
- The traceability gate now also requires results from the real-build project (`real-chromium`). Before this fix, a missing real Playwright report passed the gate silently, dropping the real-content count check, the real-build axe run and the real 404 and header checks. This was shown end to end: without the file, `build-report` now exits 1 with "No results from project(s): real-chromium."
- The stale-commit check fails closed. If the head of `main` cannot be read (ls-remote error, or no `main`), `gate-cli` exits 1 and nothing is deployed. The plan deployed in that case, which could let an older run overwrite a newer deploy. A brief GitHub outage now fails the deploy job, and a rerun recovers. The skip note for a superseded commit also goes to the job summary, as spec section 7 says.
- `scan-dist` records whether it ran with `--forbid-states`, and the report requires that on the real scan, which carries REQ-CSP-01's states-page rule.
- `stand-in-quality` refuses to write into its own source directory, including edge cases like `dist/..served`.
- A traceability test title contained a bare `@REQ-`, which the gate correctly reported as the unknown tag `REQ-`. The title was renamed, and the assertion is unchanged.

**Verified against real tools (all local, no GitHub or Cloudflare):**
- Every CLI was run end to end with real inputs:
  - `scan-dist` passes both builds and fails a copy with an inline style.
  - The manifest check passes, then fails after one changed byte and after one extra file.
  - `placeholders` refuses the real content, which still has `placeholder: true`.
  - The stale check was run against local bare repositories.
  - `stand-in-quality` falls back to the fixture when the live host is unreachable.
  - `build-report` produced a `quality.json` that passes `parseQualityReport`.
- The gate bundle imports only `node:` modules and runs from a directory without `node_modules`.

**Things found for CI (handled in Task 23):**
- Playwright's default `updateSnapshots: 'missing'` silently wrote 24 baseline images during a local run, and the next visual run passed against them. Nothing was committed, and the run was repeated without them. CI must never write baselines (ruling T23-A).
- An honest local report fails only on REQ-VIS-01 until visual baselines are committed. It also fails while `SITE_URL` is unset.

**Reviewer findings:**
- Critical, fixed: the real Playwright report was not required.
- Important, fixed (my ruling): the stale check deployed when the head of `main` was unknown.
- Minor, deferred: a browser project counts as present even when all of its results are skipped. That was already true for every project.
- Minor, deferred: the evidence loaders in `build-report` live outside `src/lib`, so they are not mutation tested.

## Task 23: The ci.yml pipeline

Commits `318ca6c`, `100e905` and `093d589`. New files: `.github/workflows/ci.yml` and `scripts/lighthouse-summary.ts`. `playwright.config.ts` now sets `updateSnapshots: 'none'`, and the Lighthouse manifest reader moved into `src/lib/evidence.ts`. The unit suite passes 326 of 326, and the mutation score on `evidence.ts` is 100.

**What the workflow does:**
- A `versions` job reads the Playwright version from `package.json`.
- `logic` runs check, a real build, the unit, component and build tests, and Stryker, with the dashboard upload on main only.
- `fixture` runs as a 5-project matrix in the Playwright container. It builds the fixture site, scans it, serves it, runs Playwright, and runs Lighthouse on the chromium leg only.
- `real` runs the content check, then the real build and scan. It uploads `site-real` and `manifest-real`, then serves the build with the stand-in `quality.json` and runs the @real tests, axe, Lighthouse and the link check.
- `report` checks the evidence and runs the traceability gate, then writes `quality.json` and the gate bundle.
- `deploy` runs on `main` only, in the `production` environment, with no project install. It verifies the manifest, refuses placeholders and handles stale commits, then copies `quality.json` in and runs a pinned wrangler with install scripts disabled.
- `smoke` calls `smoke.yml` after a deploy.

The daily schedule runs the same gates.

**Changes from the plan:**
- Ruling T23-C: every action is pinned to a full commit SHA with a version comment, because spec section 7 requires SHA pinning and the plan used tags. The versions are newer than the plan's (checkout v7.0.1, pnpm/action-setup v6.1.0, setup-node v7.0.0, upload-artifact v7.0.1, download-artifact v8.0.1). The plan's versions run on node20, which GitHub is retiring. The reviewer re-resolved all five SHAs.
- Ruling T23-A: Playwright never writes a missing baseline during a normal run. Only the baselines workflow may do that.
- Ruling T23-B: jobs other than deploy fall back to the example `SITE_URL` when the repository variable is not visible, which may be the case for Dependabot. The deploy job refuses to run without a real `SITE_URL`.
- Ruling P2: the fixture dist scan uploads from the chromium leg only.
- Ruling P18: the container sets `HOME=/root` for Firefox.
- Task 21's warning: `CF_BEACON_TOKEN` reaches both the real build and the real Lighthouse run.
- The content check runs before the real build (REQ-CONTENT-01).
- The Playwright container jobs install Node 22 from `.nvmrc`, not the image's Node 24, because the real job builds the artifact that gets deployed.
- The spec says "History never blocks a deploy". A failing GitHub API lookup for history or the live check now logs a warning and continues, where it would have failed the report job.
- The spec's Lighthouse rerun rule says the rerun and both scores go in the job summary. The plan moved that elsewhere. A summary step after each Lighthouse run now writes the run attempt and the scores.
- The two build artifacts can be uploaded again on a rerun (`overwrite: true`). The check that the real site contains no `quality.json` runs before its upload.

**Verified locally (not on GitHub, not in the container):**
- Every job's commands were run in order, and every artifact path matched what `build-report` reads.
- The report gate failed only on REQ-VIS-01, because no visual baselines exist yet.
- wrangler 4.142.0 installs with `--ignore-scripts`, and `wrangler deploy --dry-run` exits 0. This was tested on macOS only.
- A structural check of `ci.yml` (46 checks, run from a throwaway script) passed:
  - permissions and the report job's `actions: read`
  - `timeout-minutes` on every job
  - SHA pins
  - no install in the deploy job
  - secrets only in the wrangler step
  - the main-only, production, concurrency and schedule settings
- `@action-validator/cli` 0.6.0 accepts the file. actionlint was not available.
- The history-lookup fallbacks were exercised with a stub `gh` in five failure modes, and the step exits 0 in each.

**Not verified until the first real run:**
- `HOME=/root` for Firefox, the background `wrangler dev` surviving between container steps, and setup-node and pnpm inside the container.
- wrangler `--ignore-scripts` on Linux.
- Whether a reran job can re-upload artifacts.
- The 15-minute timeout of the logic job with Stryker on a 2-core runner.

**Reviewer findings:**
- Important, fixed: the history lookups could block a deploy.
- Important, fixed: Lighthouse scores were missing from the job summary.
- Small items ruled in and fixed. A scoped re-review confirmed each fix and that no fallback can turn a failing suite green.
- Minor, deferred: wrangler's deeper dependencies are resolved when the deploy job runs, with install scripts off. A committed deploy lockfile would pin them fully.

## Task 24: Smoke, link check, baselines, keepalive and Dependabot

Commit `4f6a496`. New files: `.github/workflows/smoke.yml`, `links-weekly.yml`, `visual-baselines.yml`, `keepalive.yml`, `.github/dependabot.yml`, `scripts/live-check.ts`, `scripts/issue-sync.ts`, `tests/e2e/smoke.spec.ts` and `tests/unit/issue-sync.test.ts`. The unit suite passes 344 of 344.

**Changes from the plan:**
- The plan chose between the daily and post-deploy paths using `github.event_name`. Inside a called workflow, that is the caller's event, and `ci.yml` has its own daily schedule, so post-deploy runs would have touched the issue. `smoke.yml` now takes a `mode` input, and `ci.yml` passes `post-deploy`.
- The plan decided "failed" from the outcome of the test step. A failure before the tests, such as the install, would then have read as passing and closed the "Live site is failing" issue. The job status is used instead, so a failed run can only open or update the issue.
- Ruling P9: link-check state is read from the open issue body first. When no issue is open, it comes from the `link-state` artifact of the previous run, downloaded with `gh run download`, not from the Actions cache. A refused run carries the previous counts forward. `links-weekly` gets `actions: read` to download the previous artifact.
- `issue-sync links` also takes the site URL. It refuses to judge a crawl that never loaded the site or found no external links (evidence rule E15). linkinator gets a 20-second timeout, because its default has none.
- Rulings P7 and P8: steps piped into `tee` run with pipefail, and both monitoring workflows create their labels before syncing issues.
- A stub `gh` could not be made executable in this session. `issue-sync` therefore takes its `gh` function as a parameter, and a new unit test file (18 tests, tagged `@REQ-OPS-01`) covers opening, updating, closing and leaving both issues alone, plus every state-source path.
- Dependabot groups `@playwright/test` and `playwright` (which set the container tag). `@axe-core/playwright` is left out of the group. The spec says "all Playwright packages", so change this if you meant axe too.
- `keepalive` has `actions: write` on its job only.

**Verified locally:**
- `@action-validator/cli` passes all five workflows, and a broken control file fails. `dependabot.yml` passes the SchemaStore schema.
- The structural check passes: timeouts, permissions, SHA pins, and the `smoke` job-name prefix that `ci.yml` relies on.
- `live-check` against a real build served by `wrangler dev` matched 33 of 33 files. After one file was changed, it reported `robots.txt (content differs)` and exited 1. A removed file, a dead host and a missing manifest each recorded `ok: false`.
- The smoke spec passes 6 of 6 against the local server. A broken case fails the step under pipefail.

**Not verified until live runs:**
- Production Workers header values.
- The daily path when `inputs.mode` is empty.
- Whether `gh workflow enable` resets GitHub's 60-day timer.
- The `gh` label, issue and download calls with the job token.
- Whether linkinator reaches every certification verify URL.

Until real content and `SITE_URL` are in place, the weekly link check will report the placeholder links.

**Reviewer findings:** no critical or important findings. Minor, deferred:
- live-check has no per-request timeout.
- Cancelling a daily smoke run by hand opens the issue.
- live-check has no automated test.
- The live 404 check does not confirm the custom page.
- `/_astro/*` caching is not checked live.

## Task 25: README, decision log and runbook

Commits `c4e9ac2` and `c9d6bd0`. New files: `README.md`, `docs/runbook.md` and `docs/decisions/0001` to `0008`.

**Changes from the plan:**
- Ruling T25-A: the documents describe what was built, not the plan's draft. Visual regression runs on desktop Chromium and emulated Pixel only (the draft said all five profiles, ruling P25). The JavaScript budget is 10 KB. The runbook covers:
  - the Stryker runner patch and when to remove it
  - fail-closed stale commits
  - where the link-check state lives
  - the Lighthouse rerun and its job-summary record
  - enabling the pre-commit hook
  - SHA-pinned actions
- The README's "Run it" commands were run in order, which corrected one: `pnpm build:real` must run before `pnpm test:unit`, because the build test reads `dist/_astro`. Results: 344 of 344 unit tests passed, Stryker scored 99.78, and in chromium 51 E2E tests passed and 12 visual tests failed only for missing baselines. `pnpm install` was skipped because `node_modules` was already present, and the hook line was not run. The README says both of these.

**Reviewer findings:**
- Important, fixed: the README first claimed every command had been run.
- Important, fixed: the README, decision 0004 and a code comment said the deploy job "installs nothing". It installs no project dependencies and fetches only the pinned wrangler with install scripts disabled.
- A scoped re-review confirmed both fixes. The reviewer checked every other factual claim against the repository and found no mismatch.

## Needs me

### Before the first push

1. **Task 26 Step 1.** Remove the old-email backup refs: `git update-ref -d refs/original/refs/heads/main && git branch -D backup/pre-email-rewrite`, then check `git log --all --format='%ae' | sort -u` shows only your personal address. I did not touch these refs.
2. **Review and merge `feat/phase-1-site`.** Nothing was pushed, and there is no pull request.
3. **Update the spec for the JavaScript budget.** Change "under 5 KB brotli-compressed" in section 6 and the REQ-PERF-02 row in section 8 to 10 KB (your decision on 28 September 2026). Then delete the one override for REQ-PERF-02 in `tests/unit/requirements.test.ts`.
4. **Delete the untracked `.probe/` folder** at the repo root. It holds esbuild size probes from Task 21, and deleting it was not permitted in this session.
5. **Enable the local EXIF hook** once with `git config core.hooksPath .githooks`.

### Accounts, secrets and settings (Task 26 Step 2)

6. **GitHub:** turn on 2FA, create the public repository and push `main`.
7. **Cloudflare:**
   - Create an API token with only "Workers Scripts: Edit" on your one account, and note the account ID.
   - Create a Web Analytics site and copy its token.
8. **GitHub settings:**
   - An environment called `production`, restricted to `main`, with secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
   - A repository secret `STRYKER_DASHBOARD_API_KEY`, from dashboard.stryker-mutator.io after signing in with GitHub and enabling the project.
   - Repository variables `SITE_URL` (`https://ceylan-akyol.<your-account-subdomain>.workers.dev`) and `CF_BEACON_TOKEN`.
   - The deploy job refuses to run while `SITE_URL` is empty. The other jobs fall back to the example URL.
9. **Pages CMS:** sign in with GitHub and open the repository.

### Content and first deploy (Task 26 Steps 3 to 6)

10. **Visual baselines.** Run the `visual-baselines` workflow (Actions tab, Run workflow). Download the `visual-baselines` artifact, compare the images with `docs/superpowers/specs/assets/final-mockups.png`, copy them into `tests/e2e/__screenshots__`, and commit. Until then, every CI run fails on REQ-VIS-01 and nothing deploys, by design. The visual set holds 24 images: the pages and the states page in both themes on desktop Chromium and emulated Pixel, plus the sparse-history and many-rows `/quality` states.
11. **Replace the placeholder content:**
    - A photo at least 800px on the short side, with its metadata stripped (`exiftool -all= photo.jpg`), and its description.
    - A public CV PDF without your phone number or home address.
    - One file per certification.
    - The tagline and About text (under about 90 words, not repeating the tagline).
    - Remove `placeholder: true` from every content file. The deploy refuses while any remains.
12. **Check two things after your first CMS upload.** The build must still find the photo and the CV: the Pages CMS path format was taken from its docs, not from a live upload (Task 13). Also check your real credential IDs. An unbroken ID longer than about 35 characters would make the page scroll sideways at 375px (the open question in Task 20).
13. **Watch the first deploy.** In the `ci` run, all five test jobs should be green, deploy not skipped, `smoke` green, and the `live-check` artifact should show `"ok": true`. Then open `SITE_URL` and `SITE_URL/quality` on a phone and a laptop, in light and dark mode.
14. **Post-launch checks.** Run `/design-review` on the live site, check securityheaders.com for an A, and record both results.

### Only a real run can verify

15. **First CI run on GitHub:**
    - Firefox with `HOME=/root` in the Playwright container.
    - WebKit's Alt+Tab keyboard path on Linux (it was checked on macOS only).
    - The background `wrangler dev` surviving between container steps.
    - wrangler `--ignore-scripts` on Linux.
    - Whether the logic job's 15-minute limit is enough for Stryker on a 2-core runner.
    - Whether a reran job can re-upload its artifacts.
16. **First deploy:** production Workers headers match the exact values the smoke tests expect. `/quality` on the real build scored exactly 95 for performance locally, so the one-rerun policy may come into play.
17. **First daily and weekly runs:**
    - The daily smoke path (mode input empty).
    - The `gh` label, issue and artifact calls with the job token.
    - Whether `gh workflow enable` in keepalive resets GitHub's 60-day timer.
    - Whether linkinator reaches every certification verify URL.
18. **Dependabot:** whether repository variables reach its runs (the fallback `SITE_URL` covers the case where they don't). `@axe-core/playwright` is outside the Playwright group. Change that if "all Playwright packages" was meant to include it.

## Final local check suite

Run on 28 September 2026 against `a17256f`. The only commit after that, `c9d5f75`, changes this notes file. The suite ran on macOS with Node 22.23.3, and the full table is kept in the controller's workspace. Results, including the expected failures:

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile --offline` | Pass. The lockfile is consistent. |
| `pnpm check` (astro check) | Pass: 114 files, 0 errors, 0 warnings, 7 hints (zod 4 deprecation hints in `content-schemas.ts`). |
| `pnpm build:real` | Pass. `dist/quality.json` is absent, as spec E12 requires. |
| `pnpm test:unit` (unit, component, build) | Pass: 27 files, 344 of 344 tests. |
| `pnpm test:mutation` (Stryker on `src/lib`) | Pass: 99.78% (threshold 90). Of 1,382 mutants: 1,366 killed, 2 survived, 2 timed out, 1 had no coverage and 11 were ignored as equivalent. |
| Content check (real and fixture) | Pass on both. |
| Placeholder gate on `src/content` | **Refuses (exit 1), as it should.** `istqb-ctfl.yaml` and `profile.md` still carry `placeholder: true`. On the fixture content it passes. |
| Dist scans | Pass. Real (with `--forbid-states`): 3 HTML files, 0 findings. Fixture: 4 HTML files, 0 findings. |
| Manifest | 34 files written, and the verification against it passes. |
| Fixture E2E, 5 projects, visual excluded | Pass: 255 of 255 (51 per project), 0 failed, skipped or flaky. |
| Visual tests (chromium and pixel) | **Fail (24 of 24), as expected**, because no baselines exist yet. They only come from the container workflow. No screenshot files were written. |
| Real E2E (`real-chromium`, stand-in `quality.json`) | Pass: 14 of 14. |
| Lighthouse, real build | Pass, all assertions. `/`: 100/100/100/100. `/quality`: 95/100/100/100. |
| Lighthouse, fixture build | Pass, all assertions. `/`: 100 in every category. `/quality`: 96/100/100/100. |
| Internal link check (linkinator, real build) | Pass: 23 links, 0 broken. |

About the mutation results:
- The 2 survivors are the `Intl.NumberFormat` locale string in `format.ts` and `render-quality.ts`. The runner cannot record import-time errors (Task 11 explains why), and the tests do fail when the mutation is applied by hand.
- The mutant with no coverage is the `CV_FILENAME` constant in `site.ts`. Component tests use it, but Stryker runs only the unit tests.

Not run locally:
- Anything inside the Playwright Linux container or on GitHub Actions.
- The Stryker Dashboard upload, which needs your key.
- Lighthouse CI upload: results stayed on the local filesystem.
- A real deploy and the live smoke and hash check.

Leftover `wrangler dev` servers started by subagents during the session were stopped afterwards, and ports 8787 and 8788 are free.
