# Ceylan Akyol

A personal portfolio that is also a QA project: every promise the site makes is tied to the tests and checks that prove it.

**Live site:** see the About section of this repository. **How it's tested:** `/quality` on the live site.

## What this repository shows

- A requirements registry (`tests/requirements.ts`). Every test carries a requirement tag, and CI refuses to deploy if any requirement has no passing test or check, or if any test has no tag.
- Two builds on every change: a fixture build with fixed test content, and the real build with the real content. The fixture build runs behavior and accessibility tests in 3 browser engines and 5 device profiles (desktop Chromium, desktop Firefox, desktop WebKit, emulated iPhone and emulated Pixel), plus visual regression on desktop Chromium and emulated Pixel only, both themes. The real build runs accessibility, performance, links and a short key behavior pass before deploy.
- Mutation testing of the business logic in `src/lib` (Stryker, threshold 90, every mutant measured including module level constants).
- A first-party JavaScript budget of 10 KB brotli-compressed, checked by a build test.
- A deploy job that installs nothing, verifies the build against the hashes of what was tested, and a post-deploy check that every live file matches.
- GitHub Actions pinned to commit SHAs, kept current by Dependabot.

## Run it

```bash
corepack enable && pnpm install
pnpm assets:placeholders                  # first run only, writes placeholder photo and CV
pnpm build:real && pnpm test:unit         # unit, component and build tests
pnpm test:mutation                        # Stryker on src/lib
pnpm build:fixture && pnpm serve:fixture  # then, in another terminal:
pnpm exec playwright test --project=chromium
```

Enable the local privacy check once, so a commit is blocked if a staged photo still carries GPS or owner metadata:

```bash
git config core.hooksPath .githooks
```

Every command above was run against this repository as part of writing this file. The visual regression tests in the last step fail until baselines exist (see the runbook); every other test passes.

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
