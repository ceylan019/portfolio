# TODOS

## Infrastructure

### Custom domain migration

**What:** Buy a personal domain and move the site from `workers.dev` to it, with a permanent redirect from the old address.

**Why:** A CV needs a stable personal URL, and links already shared on the `workers.dev` address must keep working.

**Context:** Phase 1 launches on the free `workers.dev` subdomain (spec section 3). Cloudflare Registrar sells at cost (about $10 a year). Steps: register the domain; add it as a custom domain on the Worker; change Astro `site` so canonical and Open Graph URLs use it (the E2E preview test reads `site`, so it follows automatically); add a small Worker script in front of the static assets that returns a 301 from the `workers.dev` host to the custom domain; update `docs/runbook.md` and the README. Do this **before the URL is put on a CV that gets sent out**.

**Effort:** S
**Priority:** P1
**Depends on:** Phase 1 live

## Site polish

### Post-launch polish extras

**What:** Four small additions: a print stylesheet, `/.well-known/security.txt`, an HTML version of the CV, and an accessibility statement page.

**Why:** Each is a detail careful reviewers notice, and each fits the "site as QA evidence" story.

**Context:** Surfaced in the CEO review expansion scan on 2026-09-27 and deliberately kept out of launch scope. Each needs a requirement ID in `tests/requirements.ts` and covering tests, per the traceability gate. The HTML CV should come from structured content so it and the PDF cannot drift.

**Effort:** S (each)
**Priority:** P3
**Depends on:** Phase 1 live

## Completed
