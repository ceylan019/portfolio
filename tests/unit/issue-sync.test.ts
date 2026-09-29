import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { issueSync } from '../../scripts/issue-sync';
import { LINKS_TITLE, SMOKE_TITLE, parseLinkState, renderLinksBody } from '../../src/lib/issue-state';

// scripts/issue-sync.ts with a recording stand-in for gh: every call is kept, and
// "gh issue list" answers with the issues given. Files are real temp files.
const SITE = 'https://site.example';
const NOW = new Date('2026-09-28T07:41:00Z');
const quiet = { log: () => {}, error: () => {} };

let dir: string;
let calls: string[][];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'issue-sync-'));
  calls = [];
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const file = (name: string, content: string) => {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
};
const path = (name: string) => join(dir, name);
const read = (name: string) => JSON.parse(readFileSync(path(name), 'utf8'));
const gh = (issues: { number: number; body: string }[] = []) => (args: string[]) => {
  calls.push(args);
  return args[0] === 'issue' && args[1] === 'list' ? JSON.stringify(issues) : '';
};
/** gh calls that change an issue, without the issue list lookups. */
const writes = () => calls.filter((a) => !(a[0] === 'issue' && a[1] === 'list'));
const arg = (call: string[], flag: string) => call[call.indexOf(flag) + 1];

// The shape linkinator 8.1.0 prints with --format json (checked against a real run).
const report = (links: { url: string; state: string }[]) => JSON.stringify({ passed: false, links: links.map((l) => ({ ...l, status: l.state === 'OK' ? 200 : 404, parent: `${SITE}/` })) });
const page = { url: `${SITE}/`, state: 'OK' };
const brokenReport = report([
  page,
  { url: `${SITE}/quality`, state: 'OK' },
  { url: 'https://issuer.example/verify/1', state: 'BROKEN' },
  { url: 'https://ok.example/', state: 'OK' },
]);
const passingReport = report([page, { url: 'https://issuer.example/verify/1', state: 'OK' }, { url: 'https://ok.example/', state: 'OK' }]);

describe('issue-sync smoke', () => {
  test('@REQ-OPS-01 a failure with no open issue creates one with the details and the smoke-alert label', () => {
    expect(issueSync(['smoke', 'true', file('d.md', 'CV returned 404')], gh(), NOW, quiet)).toBe(0);
    expect(calls[0]).toEqual(['issue', 'list', '--label', 'smoke-alert', '--state', 'open', '--json', 'number,body', '--limit', '1']);
    expect(writes()).toHaveLength(1);
    const [create] = writes();
    expect(create!.slice(0, 2)).toEqual(['issue', 'create']);
    expect(arg(create!, '--title')).toBe(SMOKE_TITLE);
    expect(arg(create!, '--label')).toBe('smoke-alert');
    expect(arg(create!, '--body')).toContain('CV returned 404');
    expect(arg(create!, '--body')).toContain('2026-09-28 07:41 UTC');
  });

  test('@REQ-OPS-01 a failure with an open issue updates that issue', () => {
    expect(issueSync(['smoke', 'true', file('d.md', 'still 404')], gh([{ number: 7, body: 'old' }]), NOW, quiet)).toBe(0);
    expect(writes()).toEqual([['issue', 'edit', '7', '--body', expect.stringContaining('still 404')]]);
  });

  test('@REQ-OPS-01 a pass with an open issue closes it with a comment', () => {
    expect(issueSync(['smoke', 'false', file('d.md', '')], gh([{ number: 7, body: 'old' }]), NOW, quiet)).toBe(0);
    expect(writes()).toEqual([['issue', 'close', '7', '--comment', 'Passing again at 2026-09-28 07:41 UTC.']]);
  });

  test('@REQ-OPS-01 a pass with no open issue changes nothing', () => {
    expect(issueSync(['smoke', 'false', path('missing.md')], gh(), NOW, quiet)).toBe(0);
    expect(writes()).toEqual([]);
  });

  test('@REQ-OPS-01 the details are cut to 5000 characters', () => {
    issueSync(['smoke', 'true', file('d.md', 'x'.repeat(6000))], gh(), NOW, quiet);
    expect(arg(writes()[0]!, '--body')).toContain(`${'x'.repeat(5000)}\n`);
    expect(arg(writes()[0]!, '--body')).not.toContain('x'.repeat(5001));
  });

  test('@REQ-OPS-01 anything but true or false is a usage error that calls no gh', () => {
    expect(issueSync(['smoke', 'maybe', path('d.md')], gh(), NOW, quiet)).toBe(2);
    expect(issueSync(['nonsense'], gh(), NOW, quiet)).toBe(2);
    expect(calls).toEqual([]);
  });
});

describe('issue-sync links', () => {
  const links = (reportText: string, stateIn: string, issues: { number: number; body: string }[] = []) =>
    issueSync(['links', file('links.json', reportText), SITE, stateIn, path('out.json')], gh(issues), NOW, quiet);

  test('@REQ-OPS-01 a first failure with no issue and no saved state only records a count of 1', () => {
    expect(links(brokenReport, path('none.json'))).toBe(0);
    expect(calls[0]).toEqual(['issue', 'list', '--label', 'link-alert', '--state', 'open', '--json', 'number,body', '--limit', '1']);
    expect(writes()).toEqual([]);
    expect(read('out.json')).toEqual({ failures: { 'https://issuer.example/verify/1': 1 } });
  });

  test('@REQ-OPS-01 a second failure in a row, read from the previous run artifact, opens the issue', () => {
    const stateIn = file('in.json', JSON.stringify({ failures: { 'https://issuer.example/verify/1': 1 } }));
    expect(links(brokenReport, stateIn)).toBe(0);
    const state = { failures: { 'https://issuer.example/verify/1': 2 } };
    expect(read('out.json')).toEqual(state);
    expect(writes()).toEqual([['issue', 'create', '--title', LINKS_TITLE, '--body', renderLinksBody(state), '--label', 'link-alert']]);
  });

  test('@REQ-OPS-01 an open issue body holds the state and wins over a stale artifact', () => {
    const body = renderLinksBody({ failures: { 'https://issuer.example/verify/1': 2 } });
    const stale = file('in.json', JSON.stringify({ failures: { 'https://issuer.example/verify/1': 9 } }));
    expect(links(brokenReport, stale, [{ number: 12, body }])).toBe(0);
    const state = { failures: { 'https://issuer.example/verify/1': 3 } };
    expect(read('out.json')).toEqual(state);
    expect(writes()).toEqual([['issue', 'edit', '12', '--body', renderLinksBody(state)]]);
    expect(parseLinkState(arg(writes()[0]!, '--body')!)).toEqual(state);
  });

  test('@REQ-OPS-01 an open issue whose body lost its state falls back to the artifact', () => {
    const stateIn = file('in.json', JSON.stringify({ failures: { 'https://issuer.example/verify/1': 1 } }));
    expect(links(brokenReport, stateIn, [{ number: 12, body: 'edited by hand' }])).toBe(0);
    expect(read('out.json')).toEqual({ failures: { 'https://issuer.example/verify/1': 2 } });
    expect(writes()[0]!.slice(0, 3)).toEqual(['issue', 'edit', '12']);
  });

  test('@REQ-OPS-01 when every link passes, the open issue closes and the saved state is empty', () => {
    const body = renderLinksBody({ failures: { 'https://issuer.example/verify/1': 3 } });
    expect(links(passingReport, path('none.json'), [{ number: 12, body }])).toBe(0);
    expect(read('out.json')).toEqual({ failures: {} });
    expect(writes()).toEqual([['issue', 'close', '12', '--comment', 'All external links passed or recovered at 2026-09-28 07:41 UTC.']]);
  });

  test('@REQ-OPS-01 when every link passes and no issue is open, nothing changes', () => {
    const stateIn = file('in.json', JSON.stringify({ failures: { 'https://issuer.example/verify/1': 1 } }));
    expect(links(passingReport, stateIn)).toBe(0);
    expect(read('out.json')).toEqual({ failures: {} });
    expect(writes()).toEqual([]);
  });

  test('@REQ-OPS-01 an invalid saved state is ignored and the counts start again', () => {
    const stateIn = file('in.json', JSON.stringify({ failures: { 'https://issuer.example/verify/1': -1 } }));
    expect(links(brokenReport, stateIn)).toBe(0);
    expect(read('out.json')).toEqual({ failures: { 'https://issuer.example/verify/1': 1 } });
    expect(links(brokenReport, file('in.json', 'not json'))).toBe(0);
    expect(read('out.json')).toEqual({ failures: { 'https://issuer.example/verify/1': 1 } });
  });

  test('@REQ-OPS-01 skipped links, non-web links and broken pages of the site itself are not counted', () => {
    const text = report([
      page,
      { url: `${SITE}/broken-page`, state: 'BROKEN' },
      { url: 'https://www.linkedin.com/in/someone', state: 'SKIPPED' },
      { url: 'mailto:someone@site.example', state: 'BROKEN' },
      { url: 'https://issuer.example/verify/1', state: 'BROKEN' },
    ]);
    expect(links(text, path('none.json'))).toBe(0);
    expect(read('out.json')).toEqual({ failures: { 'https://issuer.example/verify/1': 1 } });
  });

  const carriedForward = (reportText: string) => {
    const saved = { failures: { 'https://issuer.example/verify/1': 1 } };
    expect(links(reportText, file('in.json', JSON.stringify(saved)))).toBe(1);
    expect(read('out.json')).toEqual(saved);
    expect(writes()).toEqual([]);
  };
  test('@REQ-OPS-01 a report that is not linkinator JSON carries the state forward and fails', () => {
    carriedForward('linkinator crashed');
    carriedForward(JSON.stringify({ links: [{ url: 1 }] }));
  });
  test('@REQ-OPS-01 a crawl that never loaded the site carries the state forward and fails (E15)', () => {
    carriedForward(report([{ url: `${SITE}/`, state: 'BROKEN' }, { url: 'https://issuer.example/verify/1', state: 'BROKEN' }]));
  });
  test('@REQ-OPS-01 a crawl that found no external links carries the state forward and fails (E15)', () => {
    carriedForward(report([page, { url: 'https://www.linkedin.com/in/someone', state: 'SKIPPED' }]));
  });

  test('@REQ-OPS-01 missing arguments are a usage error that calls no gh', () => {
    expect(issueSync(['links', path('links.json'), SITE], gh(), NOW, quiet)).toBe(2);
    expect(calls).toEqual([]);
  });
});
