# Runbook

## The live site is broken after a deploy

1. Roll back: `pnpm exec wrangler rollback` (choose the previous version).
2. Revert the bad commit on `main` (`git revert <sha>` and push). Without this, the next CMS save redeploys the broken code on top of the rollback.
3. Watch the next `ci` run go green and the `smoke` job pass.

## A CI run failed

- Open the run's summary. The report job lists any requirement without coverage, unknown or missing tags, and which checks failed.
- Lighthouse performance below 95 on a single job (`fixture` or `real`) only: rerun that job once from the Actions tab. Each attempt writes its scores to that job's summary, so both are recorded. A second miss is a real regression, not noise.
- A transient GitHub error while reading the head of `main` fails the deploy job closed: it refuses to deploy rather than risk deploying a superseded commit. Rerunning the job recovers once GitHub answers again.
- Visual regression failed after an intended design change: run the `visual-baselines` workflow (Actions tab, "Run workflow"), download its `visual-baselines` artifact, review the images, copy them into `tests/e2e/__screenshots__`, and commit them. Baselines are never generated on a laptop: Playwright is configured with `updateSnapshots: 'none'` everywhere except that workflow, so a local run can fail against a missing baseline but can never quietly create one.

## Where warnings appear

| Warning | Where |
|---|---|
| History restarted | report job summary |
| Stryker report missing | logic job annotations; `/quality` omits the link |
| Deploy skipped because main moved on | deploy job notice |
| Live site failing (daily) | GitHub issue labelled `smoke-alert` |
| Broken external links | GitHub issue labelled `link-alert`, whose body holds the running state; when no such issue is open, the state carries over in the previous run's `link-state` artifact |

## Scheduled workflows stopped

GitHub disables scheduled workflows in public repositories after 60 days without activity. The `keepalive` workflow re-enables them monthly. To check: Actions tab, each workflow shows "This scheduled workflow is disabled" if it was disabled. Re-enable with `gh workflow enable <file>`.

## Mutation testing runner patch

`@stryker-mutator/vitest-runner` 10.0.0 is patched with `pnpm patch` (`patches/@stryker-mutator__vitest-runner@10.0.0.patch`) because it joins nested test names with a space while Vitest 5 matches them joined with " > ", which silently skipped every test inside a `describe` block. Remove the patch (and the `patchedDependencies` entry in `package.json`) once a released runner joins names with " > ", then run `pnpm test:mutation` again and confirm the score does not change.

## Photos and personal data

- Committed files stay in public git history forever. Removing a file later requires rewriting history, and forks may keep copies.
- Strip metadata before uploading a photo: `exiftool -all= photo.jpg` (or `sips` on macOS: export as a new JPEG).
- The build fails if an image has location or owner metadata, but a CMS upload is already committed by then: remove it from history before the repository is pushed anywhere else.
- The local pre-commit hook catches this earlier, before a commit is even made. Enable it once with `git config core.hooksPath .githooks`.
- The CV is a public version: no phone number, no home address.

## Swapping in the custom domain

1. Buy the domain (Cloudflare Registrar) and add it as a custom domain on the `ceylan-akyol` Worker.
2. Set the repository variable `SITE_URL` to the new URL and push any commit.
3. Add a 301 redirect from the `workers.dev` host to the new domain (a small Worker script in front of the assets), then share the new link so previews refresh.
