import type { CheckEvidence } from './traceability';
import { isRecord } from './guards';

const isObj = isRecord;

export type Lhr = { requestedUrl: string; categories: Record<string, { score: number | null }> };

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;

/** One Lighthouse run per entry of an lhci filesystem manifest.json (url plus summary
 * scores from 0 to 1). Entries without a URL are dropped; a missing or non-numeric
 * score reads as null. */
export function lhrsFromManifest(manifest: unknown): Lhr[] {
  if (!Array.isArray(manifest)) return [];
  return manifest.filter(isObj).filter((m) => typeof m.url === 'string').map((m) => {
    const summary = isObj(m.summary) ? m.summary : {};
    const categories: Lhr['categories'] = {};
    for (const key of CATEGORIES) {
      const score = summary[key];
      categories[key] = { score: typeof score === 'number' ? score : null };
    }
    return { requestedUrl: m.url as string, categories };
  });
}

export function lighthouseEvidence(input: {
  lhrs: { requestedUrl: string }[];
  assertions: { level: string; passed: boolean }[];
  expectedUrls: string[];
  runsPerUrl: number;
}): CheckEvidence {
  const short = input.expectedUrls.filter(
    (u) => input.lhrs.filter((l) => l.requestedUrl === u).length < input.runsPerUrl,
  );
  const failedErrors = input.assertions.filter((a) => a.level === 'error' && !a.passed).length;
  const passed = input.lhrs.length > 0 && short.length === 0 && failedErrors === 0;
  const detail = short.length > 0
    ? `Too few Lighthouse runs for: ${short.join(', ')}`
    : failedErrors > 0 ? `${failedErrors} Lighthouse assertion(s) failed` : `${input.lhrs.length} runs`;
  return { name: 'lighthouse', passed, examined: input.lhrs.length, detail };
}

export function linksEvidence(report: unknown): CheckEvidence {
  const links = isObj(report) && Array.isArray(report.links) ? report.links.filter(isObj) : [];
  const checked = links.filter((l) => l.state !== 'SKIPPED').length;
  const passed = isObj(report) && report.passed === true && checked > 0;
  return { name: 'links', passed, examined: checked, detail: `${checked} links checked` };
}

export function distScanEvidence(report: { scanned: string[]; findings: unknown[] }): CheckEvidence {
  const hasIndex = report.scanned.some((f) => f === 'index.html' || f.endsWith('/index.html'));
  const passed = hasIndex && report.findings.length === 0;
  return { name: 'dist-scan', passed, examined: report.scanned.length, detail: `${report.scanned.length} HTML files, ${report.findings.length} findings` };
}

export function combineEvidence(items: CheckEvidence[]): CheckEvidence {
  const [first] = items;
  if (!first) return { name: 'dist-scan', passed: false, examined: 0, detail: 'no evidence' };
  return {
    name: first.name,
    passed: items.every((i) => i.passed),
    examined: items.reduce((s, i) => s + i.examined, 0),
    detail: items.map((i) => i.detail).join('; '),
  };
}

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

export function medianScores(
  lhrs: { requestedUrl: string; categories: Record<string, { score: number | null }> }[],
  url: string,
) {
  const runs = lhrs.filter((l) => l.requestedUrl === url);
  const cat = (key: string) => Math.round(median(runs.map((r) => (r.categories[key]?.score ?? 0) * 100)));
  return { performance: cat('performance'), accessibility: cat('accessibility'), bestPractices: cat('best-practices'), seo: cat('seo') };
}
