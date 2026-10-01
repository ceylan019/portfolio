# Ceylan Akyol

[![Mutation testing badge](https://img.shields.io/endpoint?style=flat&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fceylan019%2Fportfolio%2Fmain)](https://dashboard.stryker-mutator.io/reports/github.com/ceylan019/portfolio/main)

A personal portfolio that is also a QA project: every promise the site makes is tied to the tests and checks that prove it.

**Live site:** see the About section of this repository. **How it's tested:** `/quality` on the live site.

## What this repository shows

- A requirements registry (`tests/requirements.ts`). Every test carries a requirement tag, and CI refuses to deploy if any requirement has no passing test or check, or if any test has no tag.
- Two builds on every change: a fixture build with fixed test content, and the real build with the real content. The fixture build runs behavior and accessibility tests in 3 browser engines and 5 device profiles (desktop Chromium, desktop Firefox, desktop WebKit, emulated iPhone and emulated Pixel), plus visual regression on desktop Chromium and emulated Pixel only, both themes. The real build runs accessibility, performance, links and a short key behavior pass before deploy.
- Mutation testing of the business logic in `src/lib` (Stryker, threshold 90, every mutant measured including module level constants).
- A first-party JavaScript budget of 10 KB brotli-compressed, checked by a build test.
- A deploy job that installs no project dependencies (only wrangler, from its own committed lockfile in `deploy/`, with install scripts disabled), verifies the build against the hashes of what was tested, and a post-deploy check that every live file matches.
- GitHub Actions pinned to commit SHAs, kept current by Dependabot.

## Run it

Node 22 and pnpm (through corepack). Every suite CI runs can be run locally; the commands below are grouped the way the pipeline groups them.

```bash
corepack enable && pnpm install
pnpm assets:placeholders                  # first run only, writes placeholder photo and CV
```

**Logic: types, content, unit, component and build tests, mutation testing**

```bash
pnpm check                                # Astro and TypeScript diagnostics
pnpm tsx scripts/check-content.ts         # content rules, photo size and type, EXIF, XMP and IPTC privacy
pnpm build:real && pnpm test:unit         # unit, component and build tests (the build test reads dist/)
pnpm test:mutation                        # Stryker on src/lib; the HTML report lands in reports/mutation/
```

**Fixture build: E2E and axe in the 5 device profiles, then Lighthouse**

```bash
pnpm build:fixture
bash scripts/serve-and-wait.sh serve:fixture http://localhost:8787/
pnpm exec playwright test --project=chromium --project=firefox --project=webkit --project=iphone --project=pixel --grep-invert @visual
export CHROME_PATH=$(node -e "import('@playwright/test').then(m=>console.log(m.chromium.executablePath()))")
LHCI_BUILD=fixture pnpm lhci              # mobile, 3 runs each of / and /quality
```

The `@visual` tests compare against baselines made in the Playwright container, so they are left out locally. `visual-baselines.yml` makes the baselines (see the runbook); after that, `pnpm exec playwright test --grep @visual` runs them.

**Real build: `@real` and axe with the stand-in `quality.json`, Lighthouse, links**

```bash
pnpm build:real
pnpm tsx scripts/stand-in-quality.ts dist dist-served   # dist stays free of quality.json (E12)
bash scripts/serve-and-wait.sh serve:real http://localhost:8788/
pnpm exec playwright test --project=real-chromium
LHCI_BUILD=real pnpm lhci                 # needs CHROME_PATH from above
pnpm exec linkinator http://localhost:8788 --recurse --format json --skip "^(?!http://localhost:8788)" > reports/links.json
```

**Smoke: the live site**

```bash
SMOKE_URL=https://your-site.example pnpm exec playwright test --project=smoke
```

Stop the local servers when done: `pkill -f "wrangler.* dev --assets"`.

Enable the local privacy check once, so a commit is blocked if a staged photo still carries GPS or owner metadata:

```bash
git config core.hooksPath .githooks
```

Every command above was run against this repository while writing this section, except three. `corepack enable && pnpm install` was skipped because pnpm and `node_modules` were already present. (`pnpm assets:placeholders` was run from a scratch directory so it could not touch committed files; its output is byte for byte the committed placeholders.) The smoke command needs a live site, so it is documented from `smoke.yml` rather than run. `git config core.hooksPath .githooks` changes this repository's own git configuration, so its effect was confirmed by reading `.githooks/pre-commit` instead. Nothing here deploys: the deploy job in `ci.yml` is the only path to production.

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

1. Point the Worker at the domain. Add the domain to the Worker in `wrangler.jsonc` as a Cloudflare Custom Domain, `"routes": [{ "pattern": "example.com", "custom_domain": true }]`, so the next deploy creates the DNS record and certificate. Keep `"workers_dev": true` until the redirect in step 3 exists, so shared `workers.dev` links keep working.
2. Set the repository variable `SITE_URL` (Settings, Secrets and variables, Actions, Variables) to `https://example.com`. `astro.config.mjs` builds the canonical, Open Graph and JSON-LD URLs from it, and the report, smoke and weekly links jobs read the live site through it. Push any commit so ci rebuilds and deploys.
3. Add the 301 redirect from the `workers.dev` host and finish the remaining steps in `TODOS.md` ("Custom domain migration") and `docs/runbook.md` ("Swapping in the custom domain").
