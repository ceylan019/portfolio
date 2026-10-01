import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TopLine from '../../src/components/TopLine.astro';
import DataBlock from '../../src/components/DataBlock.astro';
import QualityReport from '../../src/components/QualityReport.astro';

const render = async (C: any, props: Record<string, unknown>) => (await AstroContainer.create()).renderToString(C, { props });
// The report body takes the profile as props, so these tests never need Astro's
// content store (under Vitest, Astro reads the store only `astro dev` writes).
const renderPage = async () => (await AstroContainer.create()).renderToString(QualityReport, {
  props: { name: 'Ceylan Akyol', year: 2026, repo: 'https://github.com/example/ceylan-akyol-site' },
});

test('@REQ-NAV-01 the top line links home and to the CV', async () => {
  const html = await render(TopLine, { name: 'Ceylan Akyol' });
  expect(html).toMatch(/<a class="homelink" href="\/">Ceylan Akyol<\/a>/);
  expect(html).toContain('download="Ceylan-Akyol-CV.pdf"');
  expect(html).toMatch(/<nav[^>]*aria-label="Site"/);
});

test('@REQ-QUAL-01 a data block renders its fallback, an empty live slot and the unavailable state', async () => {
  const html = await render(DataBlock, { name: 'matrix', fallback: 'Requirement coverage is unavailable right now.' });
  expect(html).toContain('data-block="matrix" data-state="unavailable"');
  expect(html).toContain('Requirement coverage is unavailable right now.');
  expect(html).toContain('<div data-slot="live"></div>');
});

test('@REQ-QUAL-01 a data block can carry more than one fallback link', async () => {
  const html = await render(DataBlock, {
    name: 'verdict',
    fallback: 'Live results could not be loaded.',
    links: [
      { href: 'https://example.test/repo', label: 'Browse the source' },
      { href: 'https://example.test/repo/actions', label: 'View the CI history' },
    ],
  });
  expect(html).toContain('<a class="lnk" href="https://example.test/repo">Browse the source</a>');
  expect(html).toContain('<a class="lnk" href="https://example.test/repo/actions">View the CI history</a>');
});

test('@REQ-QUAL-01 the verdict fallback links both the repository and its Actions page', async () => {
  const html = await renderPage();
  const block = html.slice(html.indexOf('data-block="verdict"'), html.indexOf('data-block="integrity"'));
  expect(block).toContain('Every promise this site makes is tied to the checks that prove it. Live results could not be loaded; the source and CI history are linked here.');
  expect(block).toMatch(/<a class="lnk" href="https:\/\/github\.com\/example\/ceylan-akyol-site">Browse the source<\/a>/);
  expect(block).toMatch(/<a class="lnk" href="https:\/\/github\.com\/example\/ceylan-akyol-site\/actions\/workflows\/ci\.yml">View the CI history<\/a>/);
});

test('@REQ-QUAL-01 the duration block has a true, number-free fallback that is never empty', async () => {
  const html = await renderPage();
  const block = html.slice(html.indexOf('data-block="duration"'));
  expect(block).toContain('data-state="unavailable"');
  const fallback = block.slice(block.indexOf('data-slot="fallback"'), block.indexOf('data-slot="live"'));
  expect(fallback).not.toMatch(/\d/);
  expect(fallback.replace(/<[^>]+>/g, '').trim().length).toBeGreaterThan(0);
  expect(fallback).toContain('Pipeline duration is unavailable right now.');
  expect(fallback).toContain('See the CI run history');
});

test('@REQ-QUAL-01 the matrix, integrity, trends and mutation fallbacks each link the CI run history, labelled as such', async () => {
  const html = await renderPage();
  for (const name of ['matrix', 'integrity', 'trends', 'mutation']) {
    const start = html.indexOf(`data-block="${name}"`);
    const end = html.indexOf('data-slot="live"', start);
    const block = html.slice(start, end);
    expect(block).toContain('unavailable right now.');
    expect(block).toMatch(/<a class="lnk" href="https:\/\/github\.com\/example\/ceylan-akyol-site\/actions\/workflows\/ci\.yml">See the CI run history<\/a>/);
    expect(block).not.toContain('latest CI run');
  }
});

test('@REQ-NAV-01 /quality follows the spec order: top line, verdict, matrix, integrity, trends, mutation, suites, duration', async () => {
  const html = await renderPage();
  const order = [
    'class="topline"',
    'data-block="verdict"',
    'id="req-heading"',
    'data-block="integrity"',
    'id="trend-heading"',
    'id="mut-heading"',
    'id="suites-heading"',
    'data-block="duration"',
  ].map((marker) => html.indexOf(marker));
  expect(order.every((i) => i > -1)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test('@REQ-A11Y-04 every labelled section on /quality points at its own heading', async () => {
  const html = await renderPage();
  for (const id of ['req-heading', 'trend-heading', 'mut-heading', 'suites-heading']) {
    expect(html).toMatch(new RegExp(`<section class="sec" aria-labelledby="${id}">`));
    expect(html).toContain(`id="${id}"`);
  }
});

test('@REQ-QUAL-01 the requirements section says there is no pass or fail column', async () => {
  const html = await renderPage();
  expect(html).toContain('There is no pass or fail column, because only fully green builds deploy.');
});

test('@REQ-QUAL-01 the suites section names every suite from spec section 8, in words that match the pipeline', async () => {
  const html = await renderPage();
  const suites = html.slice(html.indexOf('class="suites"'), html.indexOf('data-block="duration"'));
  for (const name of ['Unit', 'Component', 'Build', 'Mutation', 'End to end', '@real', 'Accessibility', 'Visual regression', 'Performance', 'Links', 'Smoke']) {
    expect(suites).toContain(`<dt>${name}</dt>`);
  }
  expect(suites).toContain('mutation-tested business logic');
  expect(suites).not.toContain('mutation-tested site');
  expect(suites).toContain('desktop Chromium and emulated Pixel');
  expect(suites).toContain('light and dark themes');
  expect(suites).toContain('mobile, 3 runs');
});

test('@REQ-QUAL-01 the smoke suite says the live file check runs after each deploy, not daily', async () => {
  const html = await renderPage();
  const smoke = html.slice(html.indexOf('<dt>Smoke</dt>'), html.indexOf('data-block="duration"'));
  const dd = smoke.slice(smoke.indexOf('<dd>'), smoke.indexOf('</dd>'));
  expect(dd).toContain('after each deploy and daily: the home page, the CV, 404, headers, quality.json and the preview image.');
  expect(dd).toContain('After each deploy, every live file is also checked against the tested build.');
  expect(dd).not.toMatch(/daily[^.]*live file/);
});

test('@REQ-QUAL-01 the glossary line uses the spec terms for tests, test runs, browser engines and device profiles', async () => {
  const html = await renderPage();
  const gloss = html.slice(html.indexOf('class="gloss"'), html.indexOf('data-block="integrity"'));
  expect(gloss).toContain('one test case');
  expect(gloss).toContain('one test in one device profile');
  expect(gloss).toContain('Browser engines: Chromium, Firefox and WebKit.');
  expect(gloss).toContain('Device profiles: desktop Chromium, desktop Firefox, desktop WebKit, emulated iPhone (WebKit) and emulated Pixel (Chromium).');
});
