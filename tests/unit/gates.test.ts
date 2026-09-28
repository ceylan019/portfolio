import { diffManifest, manifestMatches, parseManifest } from '../../src/lib/manifest';
import { findPlaceholders } from '../../src/lib/placeholders';
import { isStale, parseLsRemote } from '../../src/lib/stale-sha';

const h = (c: string) => c.repeat(64);

describe('manifest', () => {
  const expected = { 'index.html': h('a'), 'quality.html': h('b') };
  test('@REQ-GATE-02 identical trees match', () => {
    const d = diffManifest(expected, { ...expected });
    expect(d).toEqual({ changed: [], missing: [], extra: [] });
    expect(manifestMatches(d)).toBe(true);
  });
  test('@REQ-GATE-02 a changed file is rejected', () => {
    const d = diffManifest(expected, { ...expected, 'index.html': h('c') });
    expect(d.changed).toEqual(['index.html']);
    expect(manifestMatches(d)).toBe(false);
  });
  test('@REQ-GATE-02 missing and extra files are rejected', () => {
    const d = diffManifest(expected, { 'index.html': h('a'), 'evil.js': h('d') });
    expect(d).toEqual({ changed: [], missing: ['quality.html'], extra: ['evil.js'] });
    expect(manifestMatches(d)).toBe(false);
  });
  test('@REQ-GATE-02 quality.json is the only ignored difference', () => {
    expect(manifestMatches(diffManifest(expected, { ...expected, 'quality.json': h('e') }))).toBe(true);
    expect(manifestMatches(diffManifest(expected, { ...expected, 'nested/quality.json': h('e') }))).toBe(false);
  });
  test('@REQ-GATE-02 paths are compared exactly, case included', () => {
    const d = diffManifest({ 'Index.html': h('a') }, { 'index.html': h('a') });
    expect(d).toEqual({ changed: [], missing: ['Index.html'], extra: ['index.html'] });
    expect(manifestMatches(d)).toBe(false);
  });
  test('@REQ-GATE-02 trailing whitespace in a hash is a change, never trimmed away', () => {
    const d = diffManifest(expected, { ...expected, 'index.html': `${h('a')} ` });
    expect(d.changed).toEqual(['index.html']);
    expect(manifestMatches(d)).toBe(false);
  });
  test('@REQ-GATE-02 parseManifest accepts only path to 64-hex maps', () => {
    expect(parseManifest(JSON.stringify(expected))).toEqual(expected);
    expect(parseManifest('{"a": "short"}')).toBeNull();
    expect(parseManifest('[]')).toBeNull();
    expect(parseManifest('not json')).toBeNull();
    expect(parseManifest('{}')).toBeNull();
  });
  test('@REQ-GATE-02 parseManifest rejects a hash with trailing whitespace', () => {
    expect(parseManifest(JSON.stringify({ 'index.html': `${h('a')} ` }))).toBeNull();
  });
});

describe('placeholders', () => {
  test('@REQ-GATE-03 finds placeholder frontmatter in Markdown and YAML', () => {
    const files = [
      { path: 'src/content/profile/profile.md', text: '---\nname: X\nplaceholder: true\n---\nBody' },
      { path: 'src/content/certifications/a.yaml', text: 'name: A\nplaceholder: true\n' },
      { path: 'src/content/certifications/b.yaml', text: 'name: B\nplaceholder: false\n' },
      { path: 'src/content/certifications/c.yaml', text: 'name: C\n' },
    ];
    expect(findPlaceholders(files)).toEqual(['src/content/profile/profile.md', 'src/content/certifications/a.yaml']);
  });
  test('@REQ-GATE-03 ignores the phrase in Markdown body text', () => {
    expect(findPlaceholders([{ path: 'p.md', text: '---\nname: X\n---\nplaceholder: true' }])).toEqual([]);
  });
  test('@REQ-GATE-03 tolerates quoting and spacing', () => {
    expect(findPlaceholders([{ path: 'a.yaml', text: 'placeholder:   true   \n' }])).toEqual(['a.yaml']);
    expect(findPlaceholders([{ path: 'b.yaml', text: "placeholder: 'true'\n" }])).toEqual(['b.yaml']);
    expect(findPlaceholders([{ path: 'c.yaml', text: 'placeholder: "true"\n' }])).toEqual(['c.yaml']);
  });
  test('@REQ-GATE-03 a false flag or an empty value never trigger it', () => {
    expect(findPlaceholders([{ path: 'a.yaml', text: 'placeholder: false\n' }])).toEqual([]);
    expect(findPlaceholders([{ path: 'b.yaml', text: 'placeholder:\n' }])).toEqual([]);
    expect(findPlaceholders([{ path: 'c.md', text: '---\nname: X\nplaceholder: false\n---\nBody' }])).toEqual([]);
  });
  test('@REQ-GATE-03 Markdown with no frontmatter fence is never a placeholder', () => {
    expect(findPlaceholders([{ path: 'p.md', text: 'placeholder: true\nJust a body.' }])).toEqual([]);
  });
});

describe('stale commit guard', () => {
  test('@REQ-GATE-04 reads the head of main from ls-remote output', () => {
    const out = 'abc123\tHEAD\n' + 'def456def456def456def456def456def456def4\trefs/heads/main\n';
    expect(parseLsRemote(out)).toBe('def456def456def456def456def456def456def4');
    expect(parseLsRemote('')).toBeNull();
  });
  test('@REQ-GATE-04 picks main out of several refs, in any position', () => {
    const out = [
      'aaa1aaa1aaa1aaa1aaa1aaa1aaa1aaa1aaa1aaa1\tHEAD',
      'bbb2bbb2bbb2bbb2bbb2bbb2bbb2bbb2bbb2bbb2\trefs/heads/feat/other',
      'ccc3ccc3ccc3ccc3ccc3ccc3ccc3ccc3ccc3ccc3\trefs/tags/v1.0.0',
      'def456def456def456def456def456def456def4\trefs/heads/main',
      'eee5eee5eee5eee5eee5eee5eee5eee5eee5eee5\trefs/heads/feat/another',
    ].join('\n');
    expect(parseLsRemote(out)).toBe('def456def456def456def456def456def456def4');
  });
  test('@REQ-GATE-04 returns null when the ref is absent', () => {
    const out = 'aaa1aaa1aaa1aaa1aaa1aaa1aaa1aaa1aaa1aaa1\trefs/heads/other\n';
    expect(parseLsRemote(out)).toBeNull();
  });
  test('@REQ-GATE-04 a run is stale only when main has moved on', () => {
    expect(isStale('aaa', 'aaa')).toBe(false);
    expect(isStale('aaa', 'bbb')).toBe(true);
    expect(isStale('aaa', null)).toBe(false);
  });
});
