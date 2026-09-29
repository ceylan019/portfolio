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

// Narrow, owner-approved override: the owner raised the REQ-PERF-02 first-party
// JavaScript budget from 5 KB to 10 KB brotli on 2026-09-28, because zod/mini's
// runtime validation core alone (required in the browser by spec E6) measures
// about 6.6 KB brotli minified, before any DOM wiring or rendering code, so
// 5 KB was never achievable. The decision is recorded in
// docs/superpowers/plans/2026-09-27-personal-website-notes.md. The spec table
// itself is not edited here; remove this override once section 8's REQ-PERF-02
// row is updated to say 10 KB, so this test goes back to checking the raw spec
// text for every requirement, with no exceptions.
const OWNER_TEXT_OVERRIDES: Readonly<Record<string, string>> = {
  'REQ-PERF-02': 'First-party JavaScript under 10 KB brotli, and never inlined',
};

test('@REQ-TRACE-01 every registry entry matches the spec table word for word', () => {
  const rows = specRows();
  const expected = rows.map((r) => ({ id: r.id, text: OWNER_TEXT_OVERRIDES[r.id] ?? r.text }));
  expect(REQUIREMENTS.map((r) => ({ id: r.id, text: r.text })).sort((a, b) => a.id.localeCompare(b.id)))
    .toEqual(expected.sort((a, b) => a.id.localeCompare(b.id)));
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
