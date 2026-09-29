import type { Requirement } from '../src/lib/traceability';

// The requirement registry (spec section 8, "Initial requirements"). Each text
// is the spec table's wording with Markdown backticks removed, because it is
// shown publicly on /quality. tests/unit/requirements.test.ts keeps the two in
// step. Every test tag must name an id listed here.
//
// REQ-PERF-02 is the one exception: the owner raised its budget from 5 KB to
// 10 KB brotli on 2026-09-28 (docs/superpowers/plans/2026-09-27-personal-website-notes.md),
// ahead of a spec update. tests/unit/requirements.test.ts carries a narrow,
// owner-approved override for this one id until the spec table is updated.
export const REQUIREMENTS: Requirement[] = [
  { id: 'REQ-HERO-01', text: 'Hero shows name, title, tagline and photo with alt text', source: '§4' },
  { id: 'REQ-CV-01', text: 'CV downloads in one click from the hero; /cv.pdf is served as application/pdf', source: '§4' },
  { id: 'REQ-CONTACT-01', text: 'Email, LinkedIn and GitHub links are present in the hero and in Contact', source: '§4' },
  { id: 'REQ-CERT-01', text: 'Visible certifications are sorted newest first', source: '§5' },
  { id: 'REQ-CERT-02', text: 'Hidden certifications are not rendered', source: '§5' },
  { id: 'REQ-CERT-03', text: 'Expired only when expiry is strictly before today; expired entries are labeled', source: '§5' },
  { id: 'REQ-CERT-04', text: 'Tick and Verify link appear only when verifyUrl is present', source: '§5' },
  { id: 'REQ-CERT-05', text: 'Entries with an expiry date show "Valid until" or "Expired" with the month and year; expired titles are muted', source: 'G4' },
  { id: 'REQ-CERT-06', text: 'The tick note appears only when at least one visible entry has a tick', source: 'G5' },
  { id: 'REQ-CV-02', text: 'Both CV links download as Ceylan-Akyol-CV.pdf; Contact includes the CV link', source: 'G8' },
  { id: 'REQ-NAV-01', text: '/quality has a top line linking home and to the CV', source: 'G7' },
  { id: 'REQ-AVAIL-01', text: 'The availability line renders only when switched on', source: 'G6' },
  { id: 'REQ-CONTENT-03', text: 'About is at most about 90 words and shares no sentence with the tagline', source: 'G1' },
  { id: 'REQ-A11Y-04', text: 'Landmarks are present and repeated links have unique accessible names', source: 'G11' },
  { id: 'REQ-STATE-01', text: 'Empty, sparse and overflow states render as specified (D19)', source: 'D19' },
  { id: 'REQ-CONTENT-01', text: 'Invalid content, including disallowed file types and small photos, fails the build', source: 'D14' },
  { id: 'REQ-CONTENT-02', text: 'CMS config and content schemas define the same fields', source: '§5' },
  { id: 'REQ-PRIV-01', text: 'Images with GPS or identifying EXIF data fail the build', source: 'E18' },
  { id: 'REQ-A11Y-01', text: 'Zero automated WCAG 2.2 AA axe violations in light and dark themes', source: '§1' },
  { id: 'REQ-A11Y-02', text: 'Skip link, logical tab order and visible focus', source: '§6' },
  { id: 'REQ-A11Y-03', text: 'Reduced motion shows the brush mark without animation', source: '§6' },
  { id: 'REQ-PERF-01', text: 'Mobile Lighthouse in CI: performance at least 95, other categories 100, byte budgets met', source: '§1', checks: ['lighthouse'] },
  { id: 'REQ-PERF-02', text: 'First-party JavaScript under 10 KB brotli, and never inlined', source: 'E22' },
  { id: 'REQ-LINK-01', text: 'No broken internal links', source: '§8', checks: ['links'] },
  { id: 'REQ-NF-01', text: 'Unknown paths return the custom 404 page with status 404', source: '§4' },
  { id: 'REQ-URL-01', text: '/quality and /quality/ resolve to one canonical URL without a trailing slash', source: 'E22' },
  { id: 'REQ-SEC-01', text: 'Security headers are present on every page', source: '§9' },
  { id: 'REQ-SEC-02', text: 'Data rendered from quality.json cannot inject markup', source: 'D24' },
  { id: 'REQ-CSP-01', text: 'Built HTML has no style attributes, no <style> elements, no inline scripts other than JSON-LD, and no states page in the real build', source: 'D21', checks: ['dist-scan'] },
  { id: 'REQ-CACHE-01', text: 'Mutable files revalidate; fingerprinted assets are cached immutably', source: 'D18' },
  { id: 'REQ-QUAL-01', text: '/quality and the proof strip render data, and degrade to a clear message when data is missing, invalid or oversized', source: 'G3' },
  { id: 'REQ-QUAL-02', text: 'quality.json conforms to its schema and limits, and older versions upgrade without losing history', source: 'E10' },
  { id: 'REQ-QUAL-03', text: 'History survives transient fetch failures (retry, last-main fallback) and resets only when no history exists', source: 'E19' },
  { id: 'REQ-PREV-01', text: 'Pages have Open Graph and JSON-LD metadata, and the preview image is served', source: 'D7' },
  { id: 'REQ-HEALTH-01', text: 'No console errors (including CSP violations) on any page and data state', source: '§8' },
  { id: 'REQ-VIS-01', text: 'Pages match approved visual baselines for each viewport and theme', source: '§8' },
  { id: 'REQ-TRACE-01', text: 'The traceability builder, evidence checks and gate compute coverage correctly', source: 'D6' },
  { id: 'REQ-GATE-01', text: 'The dist scanner detects every forbidden pattern', source: 'E8' },
  { id: 'REQ-GATE-02', text: 'Manifest verification rejects any changed, missing or extra file', source: 'E8' },
  { id: 'REQ-GATE-03', text: 'The placeholder check finds any placeholder: true content', source: 'E8' },
  { id: 'REQ-GATE-04', text: 'The stale-SHA check skips deploys of superseded commits', source: 'E8' },
  { id: 'REQ-OPS-01', text: 'Issue logic opens, updates and closes the monitoring issues correctly', source: 'E8' },
  { id: 'REQ-DEPLOY-01', text: 'Every file served live matches the tested build (post-deploy)', source: 'E15', phase: 'post-deploy' },
];
