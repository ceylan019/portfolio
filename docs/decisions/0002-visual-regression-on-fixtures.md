# 0002 Visual regression only on fixtures

Date: 2026-09-27

**Decision:** Screenshots are compared only on the fixture build, in desktop Chromium and emulated Pixel, light and dark, inside the official Playwright container.

**Why:** Screenshots of real content change whenever content changes. Rendering differs across machines unless fonts and browsers are identical.

**Consequences:** Baselines are regenerated only by the `visual-baselines` workflow, which runs in the same container as CI and uploads the images as an artifact for review. Playwright itself is configured with `updateSnapshots: 'none'` everywhere else, so a missing baseline fails a local or CI run instead of silently writing one. Baselines are never generated on a laptop.
