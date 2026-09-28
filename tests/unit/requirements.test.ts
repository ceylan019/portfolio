import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REQUIREMENTS } from '../requirements';
import { req } from '../tag';
import { tagsIn } from '../../src/lib/traceability';

const SPEC = 'docs/superpowers/specs/2026-09-27-personal-website-design.md';

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

// Rows of the spec's "Initial requirements" table (section 8), with Markdown
// backticks removed because the registry text is shown publicly on /quality.
interface SpecRow { id: string; text: string; coveredBy: string }
function specRows(): SpecRow[] {
  const spec = readFileSync(SPEC, 'utf8');
  return [...spec.matchAll(/^\| (REQ-[A-Z0-9]+-\d{2}) \| (.+) \| (.+) \|$/gm)].map((m) => ({
    id: m[1]!,
    text: m[2]!.replaceAll('`', ''),
    coveredBy: m[3]!,
  }));
}

test('@REQ-TRACE-01 requirement IDs are unique and well formed', () => {
  const ids = REQUIREMENTS.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^REQ-[A-Z0-9]+-\d{2}$/);
});

test('@REQ-TRACE-01 every tag used in a test file exists in the registry', () => {
  const known = new Set(REQUIREMENTS.map((r) => r.id));
  const files = walk('tests').filter((f) => /\.(test|spec)\.ts$/.test(f));
  const unknown = files.flatMap((f) => tagsIn(readFileSync(f, 'utf8')).filter((t) => !known.has(t)).map((t) => `${f}: ${t}`));
  expect(unknown).toEqual([]);
});

test('@REQ-TRACE-01 every requirement in the spec table is registered', () => {
  const inSpec = specRows().map((r) => r.id);
  const registered = new Set(REQUIREMENTS.map((r) => r.id));
  expect(inSpec.length).toBeGreaterThan(0);
  expect(inSpec.filter((id) => !registered.has(id))).toEqual([]);
});

test('@REQ-TRACE-01 every registry entry matches the spec table word for word', () => {
  const rows = specRows();
  expect(REQUIREMENTS.map((r) => ({ id: r.id, text: r.text })).sort((a, b) => a.id.localeCompare(b.id)))
    .toEqual(rows.map((r) => ({ id: r.id, text: r.text })).sort((a, b) => a.id.localeCompare(b.id)));
});

test('@REQ-TRACE-01 declared checks and phase follow the spec table', () => {
  const rows = new Map(specRows().map((r) => [r.id, r]));
  for (const r of REQUIREMENTS) {
    const coveredBy = rows.get(r.id)!.coveredBy;
    const check = /^check: ([a-z-]+)$/.exec(coveredBy)?.[1];
    expect({ id: r.id, checks: r.checks }).toEqual({ id: r.id, checks: check ? [check] : undefined });
    const postDeploy = coveredBy.includes('post-deploy');
    expect({ id: r.id, phase: r.phase }).toEqual({ id: r.id, phase: postDeploy ? 'post-deploy' : undefined });
  }
});

test('@REQ-TRACE-01 req() turns requirement ids into Playwright tags', () => {
  expect(req('REQ-CV-01')).toEqual({ tag: ['@REQ-CV-01'] });
  expect(req('REQ-CV-01', 'REQ-CV-02')).toEqual({ tag: ['@REQ-CV-01', '@REQ-CV-02'] });
  expect(req()).toEqual({ tag: [] });
});
