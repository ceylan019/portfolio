import { expect, test } from 'vitest';
import { scanFiles, scanHtml, STATES_PAGE } from '../../src/lib/dist-scan';

const rules = (html: string) => scanHtml('index.html', html).map((f) => f.rule);

test('@REQ-GATE-01 clean HTML has no findings', () => {
  expect(rules('<html><head><link rel="stylesheet" href="/_astro/a.css"><script type="module" src="/_astro/b.js"></script></head><body data-style="x"><p>style=plain text</p><noscript>hi</noscript></body></html>')).toEqual([]);
});
test('@REQ-GATE-01 style attributes in any case are found', () => {
  expect(rules('<div style="color:red">')).toEqual(['style-attr']);
  expect(rules('<DIV STYLE = "x">')).toEqual(['style-attr']);
  expect(rules('<svg><path d="M0" style="fill:red"/></svg>')).toEqual(['style-attr']);
});
test('@REQ-GATE-01 style elements, including inside inline SVG, are found', () => {
  expect(rules('<style>p{}</style>')).toEqual(['style-element']);
  expect(rules('<svg><style>.a{}</style></svg>')).toEqual(['style-element']);
  expect(rules('<STYLE media="x">')).toEqual(['style-element']);
});
test('@REQ-GATE-01 inline scripts are found; external and JSON-LD scripts are allowed', () => {
  expect(rules('<script>alert(1)</script>')).toEqual(['inline-script']);
  expect(rules('<script type="module">x()</script>')).toEqual(['inline-script']);
  expect(rules('<script type="application/ld+json">{}</script>')).toEqual([]);
  expect(rules("<script type='application/ld+json'>{}</script>")).toEqual([]);
  expect(rules('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{}"></script>')).toEqual([]);
});
test('@REQ-GATE-01 every occurrence is reported with an excerpt', () => {
  const f = scanHtml('a.html', '<p style="a"></p><p style="b"></p>');
  expect(f).toHaveLength(2);
  expect(f[0]!.excerpt).toContain('style="a"');
});
test('@REQ-GATE-01 scanFiles scans only HTML and lists what it scanned', () => {
  const out = scanFiles([
    { path: 'index.html', html: '<p>ok</p>' },
    { path: 'favicon.svg', html: '<svg><style>@media(prefers-color-scheme:dark){}</style></svg>' },
    { path: 'quality.html', html: '<p style="x">' },
  ], { forbidStatesPage: false });
  expect(out.scanned).toEqual(['index.html', 'quality.html']);
  expect(out.findings.map((f) => f.file)).toEqual(['quality.html']);
});
test('@REQ-GATE-01 the states page is forbidden in the real build only', () => {
  const files = [{ path: 'index.html', html: '' }, { path: STATES_PAGE, html: '' }];
  expect(scanFiles(files, { forbidStatesPage: true }).findings.map((f) => f.rule)).toEqual(['states-page']);
  expect(scanFiles(files, { forbidStatesPage: false }).findings).toEqual([]);
});
test('@REQ-GATE-01 JSON-LD type must match exactly, not as prefix', () => {
  expect(rules('<script type="application/ld+jsonp">alert(1)</script>')).toEqual(['inline-script']);
  expect(rules('<script type="application/ld+json-evil">alert(1)</script>')).toEqual(['inline-script']);
  expect(rules('<script type="application/ld+jsonx">alert(1)</script>')).toEqual(['inline-script']);
  expect(rules('<script type="application/ld+json">alert(1)</script>')).toEqual([]);
  expect(rules("<script type='application/ld+json'>alert(1)</script>")).toEqual([]);
  expect(rules('<script type=application/ld+json>alert(1)</script>')).toEqual([]);
});
test('@REQ-GATE-01 script tag and attribute names are case-insensitive', () => {
  expect(rules('<SCRIPT>alert(1)</SCRIPT>')).toEqual(['inline-script']);
  expect(rules('<SCRIPT SRC="/a.js"></SCRIPT>')).toEqual([]);
  expect(rules('<script TYPE="APPLICATION/LD+JSON">{}</script>')).toEqual([]);
});
test('@REQ-GATE-01 data-src is not treated as src attribute', () => {
  expect(rules('<script data-src="x">alert(1)</script>')).toEqual(['inline-script']);
});
