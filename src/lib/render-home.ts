import type { Renderer } from './quality-client';
import { el } from './dom';
import { plural } from './format';

export const renderProofStrip: Renderer = (live, d) => {
  const p = el('p', undefined, { class: 'big' });
  p.append(
    "This site's code passed ",
    el('b', plural(d.counts.testRuns, 'test run', 'test runs')),
    ' across 3 browser engines and 5 device profiles, with ',
    el('b', plural(d.counts.axeViolations, 'automated accessibility violation', 'automated accessibility violations')),
    ' (axe) and a Lighthouse mobile score of ',
    el('b', String(d.lighthouse.performance)),
    ' in CI.',
  );
  live.append(p);
};
