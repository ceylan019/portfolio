export type FindingRule = 'style-attr' | 'style-element' | 'inline-script' | 'states-page';
export interface Finding { file: string; rule: FindingRule; excerpt: string }

export const STATES_PAGE = '__states.html';

const STYLE_ATTR = /<[a-z][^>]*?\sstyle\s*=/gi;
const STYLE_ELEMENT = /<style[\s>]/gi;
const SCRIPT_OPEN = /<script\b([^>]*)>/gi;
const HAS_SRC = /\ssrc\s*=/i;
const IS_JSON_LD = /\stype\s*=\s*["']?application\/ld\+json["']?/i;

const excerpt = (html: string, index: number | undefined) => html.slice(index ?? 0, (index ?? 0) + 80);

export function scanHtml(file: string, html: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of html.matchAll(STYLE_ATTR)) findings.push({ file, rule: 'style-attr', excerpt: excerpt(html, m.index) });
  for (const m of html.matchAll(STYLE_ELEMENT)) findings.push({ file, rule: 'style-element', excerpt: excerpt(html, m.index) });
  for (const m of html.matchAll(SCRIPT_OPEN)) {
    const attrs = m[1] ?? '';
    if (!HAS_SRC.test(attrs) && !IS_JSON_LD.test(attrs)) {
      findings.push({ file, rule: 'inline-script', excerpt: excerpt(html, m.index) });
    }
  }
  return findings;
}

export function scanFiles(
  files: { path: string; html: string }[],
  opts: { forbidStatesPage: boolean },
): { scanned: string[]; findings: Finding[] } {
  const html = files.filter((f) => f.path.endsWith('.html'));
  const findings = html.flatMap((f) => scanHtml(f.path, f.html));
  if (opts.forbidStatesPage) {
    for (const f of html) {
      if (f.path === STATES_PAGE || f.path.endsWith(`/${STATES_PAGE}`)) {
        findings.push({ file: f.path, rule: 'states-page', excerpt: '' });
      }
    }
  }
  return { scanned: html.map((f) => f.path), findings };
}
