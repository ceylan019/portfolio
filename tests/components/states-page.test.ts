import { req } from '../tag';

test('@REQ-STATE-01 the states page is generated only in the fixture build', async () => {
  const mod = await import('../../src/pages/[states].astro');
  process.env.BUILD_KIND = 'real';
  expect(await mod.getStaticPaths()).toEqual([]);
  process.env.BUILD_KIND = 'fixture';
  expect(await mod.getStaticPaths()).toEqual([{ params: { states: '__states' } }]);
  delete process.env.BUILD_KIND;
});
