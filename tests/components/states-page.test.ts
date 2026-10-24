test('@REQ-STATE-01 the states page is generated only in the fixture build', async () => {
  const mod = await import('../../src/pages/[states].astro');
  const previousBuildKind = process.env.BUILD_KIND;
  try {
    process.env.BUILD_KIND = 'real';
    expect(await mod.getStaticPaths()).toEqual([]);
    process.env.BUILD_KIND = 'fixture';
    expect(await mod.getStaticPaths()).toEqual([{ params: { states: '__states' } }]);
  } finally {
    if (previousBuildKind === undefined) {
      delete process.env.BUILD_KIND;
    } else {
      process.env.BUILD_KIND = previousBuildKind;
    }
  }
});
