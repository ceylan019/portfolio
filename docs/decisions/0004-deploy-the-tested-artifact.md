# 0004 Deploy exactly what was tested, and verify it live

Date: 2026-09-27

**Decision:** The real job hashes every built file. The deploy job refuses if any file differs other than `quality.json`, installs no project dependencies, and fetches only the pinned wrangler with install scripts disabled to run the deploy. After deploy, a smoke job fetches every file from the live site and compares hashes.

**Why:** "We deploy what we tested" should be a checked fact, and the job holding the Cloudflare token should run as little third-party code as possible.

**Consequences:** `/quality` shows the previous deploy's live check.
