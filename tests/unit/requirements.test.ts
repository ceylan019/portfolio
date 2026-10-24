import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REQUIREMENTS } from '../requirements';
import { req } from '../tag';
import { tagsIn } from '../../src/lib/traceability';

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

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

test('@REQ-TRACE-01 req() turns requirement ids into Playwright tags', () => {
  expect(req('REQ-CV-01')).toEqual({ tag: ['@REQ-CV-01'] });
  expect(req('REQ-CV-01', 'REQ-CV-02')).toEqual({ tag: ['@REQ-CV-01', '@REQ-CV-02'] });
  expect(req()).toEqual({ tag: [] });
});
