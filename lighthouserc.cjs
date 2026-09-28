// LHCI_BUILD selects which local server to audit. Results land in .lighthouseci/
// (assertion-results.json) and .lighthouseci/<build>/ (manifest.json plus reports).
const build = process.env.LHCI_BUILD === 'fixture' ? 'fixture' : 'real';
const base = build === 'fixture' ? 'http://localhost:8787' : 'http://localhost:8788';

module.exports = {
  ci: {
    collect: {
      url: [`${base}/`, `${base}/quality`],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
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
        'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],
      },
    },
    upload: { target: 'filesystem', outputDir: `.lighthouseci/${build}` },
  },
};
