# 0008 Quality history lives in quality.json

Date: 2026-09-27

**Decision:** Before each deploy, CI reads the live `quality.json` (10 second timeout, 3 retries), falls back to the last successful main run's artifact, and restarts history only if neither is valid. One point per commit; the last 50 are kept.

**Why:** No git writes from CI, and a transient error must not erase weeks of trends.

**Consequences:** Two runs deploying close together can drop one history point. This is accepted. History never blocks a deploy: a failing lookup logs a warning in the report job summary and the run continues to deploy.
