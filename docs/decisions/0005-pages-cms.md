# 0005 Pages CMS over a headless CMS

Date: 2026-09-27

**Decision:** Content is files in the repository, edited in the IDE or through Pages CMS, which commits to `main`.

**Why:** One editor who already works in git needs no database, no server and nothing to patch.

**Consequences:** A test keeps `.pages.yml` and the content schemas in sync.
