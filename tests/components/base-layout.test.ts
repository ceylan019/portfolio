import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Base from '../../src/layouts/Base.astro';

const render = async (props: Record<string, unknown>) => {
  const c = await AstroContainer.create();
  return c.renderToString(Base, {
    props: { title: 'T', description: 'D', path: '/quality', ...props },
    slots: { default: '<main id="main">x</main>' },
  });
};

test('@REQ-PREV-01 canonical and Open Graph URLs are absolute and have no trailing slash', async () => {
  const html = await render({});
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/quality">/);
  expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+\/og\.png">/);
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
});

test('@REQ-PREV-01 JSON-LD is escaped and not executable', async () => {
  const html = await render({ jsonLd: { name: '</script><b>x' } });
  expect(html).toContain('<script type="application/ld+json">');
  expect(html).not.toContain('</script><b>');
});

test('@REQ-NF-01 noindex pages get a robots tag and no preview metadata', async () => {
  const html = await render({ noindex: true });
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).not.toContain('og:image');
});

test('@REQ-A11Y-02 every page starts with a skip link to main', async () => {
  expect(await render({})).toMatch(/<body[^>]*>\s*<a class="skip" href="#main">Skip to content<\/a>/);
});

// Retagged from the brief's @REQ-CSP-01 to @REQ-HEALTH-01 (T12-A): a tokenless
// beacon is a console and CSP error, which REQ-HEALTH-01 covers. No test in
// this suite carries @REQ-CSP-01 or @REQ-PERF-01.
test('@REQ-HEALTH-01 no analytics beacon unless the real build has a token', async () => {
  expect(await render({})).not.toContain('cloudflareinsights');
});
