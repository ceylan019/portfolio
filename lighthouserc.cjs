// LHCI_BUILD selects which local server to audit. Results land in .lighthouseci/
// (assertion-results.json) and .lighthouseci/<build>/ (manifest.json plus reports).
const build = process.env.LHCI_BUILD === 'fixture' ? 'fixture' : 'real';
const base = build === 'fixture' ? 'http://localhost:8787' : 'http://localhost:8788';

// Only the real build ever emits the Cloudflare beacon <script>, and only when
// CF_BEACON_TOKEN is set (Base.astro gates it on BUILD_KIND === 'real'). Chrome
// still logs a Network request for it even though blockedUrlPatterns blocks the
// beacon from actually loading (T21-B: Chrome emits a request/failure pair for
// a client-blocked request regardless, and Lighthouse's resource-summary counts
// every logged record). So once a real token is configured, one third-party
// request against the real build is the correct, spec-allowed count (the
// beacon is the one third-party script the spec permits). Checked against
// `build` too, not just the env var, so a token present in the environment
// during a fixture run (which never emits the tag) doesn't loosen that budget.
const thirdPartyCount = build === 'real' && process.env.CF_BEACON_TOKEN ? 1 : 0;

module.exports = {
  ci: {
    collect: {
      url: [`${base}/`, `${base}/quality`],
      numberOfRuns: 3,
      settings: {
        // --disable-dev-shm-usage: in Docker, /dev/shm is 64 MB and Chrome's tab
        // crashed during Lighthouse's full-page screenshot; this keeps that memory on disk.
        chromeFlags: '--no-sandbox --headless=new --disable-dev-shm-usage',
        blockedUrlPatterns: ['*cloudflareinsights.com*'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'resource-summary:font:size': ['error', { maxNumericValue: 120000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 256000 }],
        'resource-summary:third-party:count': ['error', { maxNumericValue: thirdPartyCount }],
      },
    },
    upload: { target: 'filesystem', outputDir: `.lighthouseci/${build}` },
  },
};
