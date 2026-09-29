# 0006 Cloudflare Workers static assets over Railway and Vercel

Date: 2026-09-27

**Decision:** The site is static and deploys to Workers static assets.

**Why:** Railway has no meaningful free tier and would run a server for pages that never change. Vercel's free plan does not allow commercial use, which matters if tools are sold later.

**Consequences:** Hosting is free; headers come from `public/_headers`.
