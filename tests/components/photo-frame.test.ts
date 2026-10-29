import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import PhotoFrame from '../../src/components/PhotoFrame.astro';
import Tick from '../../src/components/Tick.astro';
// A real image module, so <Picture> can process it.
import photo from '../fixtures/content/assets/photo.webp';

test('@REQ-HERO-01 the frame reserves the square and renders the photo with alt text', async () => {
  const c = await AstroContainer.create();
  const html = await c.renderToString(PhotoFrame, { props: { photo, alt: 'Portrait of Ceylan' } });
  expect(html).toContain('class="photo-frame"');
  expect(html).toContain('alt="Portrait of Ceylan"');
  expect(html).toContain('fetchpriority="high"');
  expect(html).not.toMatch(/\sstyle=/);
});
// Tagged @REQ-HERO-01 rather than @REQ-A11Y-03: this test
// checks the mask driven draw-in markup, not reduced motion. REQ-A11Y-03
// ("Reduced motion shows the brush mark without animation") stays covered by
// a later E2E test.
test('@REQ-HERO-01 the ring is decorative and its draw-in uses masks, not inline styles', async () => {
  const c = await AstroContainer.create();
  const html = await c.renderToString(PhotoFrame, { props: { photo, alt: 'x' } });
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('<mask id="ring-mask-main"');
  expect(html).not.toContain('<style');
});
test('@REQ-CERT-04 the tick is decorative', async () => {
  const c = await AstroContainer.create();
  const html = await c.renderToString(Tick, { props: { size: 30 } });
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('class="tick-ink"');
});
test('@REQ-LAYOUT-01 the ring viewBox is cropped to the ring, so the frame edge is the ring edge', async () => {
  const c = await AstroContainer.create();
  const html = await c.renderToString(PhotoFrame, { props: { photo, alt: 'x' } });
  expect(html).toContain('viewBox="15.7 15.7 268.3 268.3"');
});
