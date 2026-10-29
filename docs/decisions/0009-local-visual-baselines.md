# 0009 Visual baselines can also be made locally in CI's container

Date: 2026-10-29

**Decision:** `pnpm test:visual` and `pnpm test:visual:update` run the `@visual` tests through Docker in the same `mcr.microsoft.com/playwright` image as CI, as `linux/amd64`. The `visual-baselines` workflow stays as the way to do the same without Docker.

**Why:** Making baselines only on GitHub meant pushing the visual change, letting CI fail, running the workflow, downloading its artifact and pushing again. On an Apple silicon Mac, running the image as amd64 under emulation gives the same pixels as the GitHub runners: the 24 baselines it regenerated were byte-identical to the workflow's.

**Consequences:** Local visual runs need Docker. Emulation is slower, so the local run allows 120 seconds per test instead of 30. A plain `playwright test` still never writes baselines, because `updateSnapshots` stays `'none'`.
