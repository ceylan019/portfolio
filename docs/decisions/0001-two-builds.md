# 0001 Two builds: fixture and real

Date: 2026-09-27

**Decision:** Every change builds the site twice. The fixture build uses fixed test content and runs behavior and accessibility tests in 3 browser engines and 5 device profiles (desktop Chromium, desktop Firefox, desktop WebKit, emulated iPhone and emulated Pixel). Visual regression runs on a narrower slice of that same fixture build: desktop Chromium and emulated Pixel only, both themes. The real build uses the real content and runs accessibility, Lighthouse, links and a short `@real` behavior pass before deploy.

**Why:** Real content changes with every CMS edit. Visual and behavior tests on real content would fail on every legitimate edit and get ignored. Fixed content makes those tests deterministic and lets edge cases (expired, hidden, long names) always be tested. Visual regression stays narrower than behavior and accessibility because a screenshot baseline is a committed image tied to one exact rendering: two representative projects, one desktop and one emulated mobile, catch layout regressions without keeping five sets of baselines in sync on every visual change.

**Consequences:** The proof strip says "This site's code passed N test runs", not "this page". The `@real` pass catches problems that only real content shows.
