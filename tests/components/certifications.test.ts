import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Certifications from '../../src/components/Certifications.astro';
import type { Certification } from '../../src/lib/certifications';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d('2026-09-27');
const render = async (entries: Certification[]) => (await AstroContainer.create()).renderToString(Certifications, { props: { entries, today } });
const c = (over: Partial<Certification>): Certification => ({ id: 'x', name: 'Cert', issuer: 'ISTQB', issueDate: d('2024-03-01'), ...over });

test('@REQ-STATE-01 zero visible certifications render nothing', async () => {
  expect((await render([c({ hidden: true })])).trim()).toBe('');
  expect((await render([])).trim()).toBe('');
});
test('@REQ-CERT-04 verifiable entries get a tick and a uniquely named verify link', async () => {
  const html = await render([c({ name: 'ISTQB Foundation', verifyUrl: 'https://v.example/1' })]);
  expect(html).toContain('class="tick"');
  expect(html).toContain('aria-label="Verify credential: ISTQB Foundation"');
  expect(html).toContain('>Verify credential</a>');
  expect(html).not.toContain('target=');
});
test('@REQ-CERT-06 the tick note appears only when a tick is shown', async () => {
  expect(await render([c({ verifyUrl: 'https://v.example' })])).toContain('A tick means you can verify it with the issuer.');
  expect(await render([c({})])).not.toContain('A tick means');
});
test('@REQ-CERT-05 validity dates and the expired label', async () => {
  const html = await render([
    c({ id: 'a', name: 'Future', expiryDate: d('2027-03-01') }),
    c({ id: 'b', name: 'Past', expiryDate: d('2024-01-15'), issueDate: d('2021-01-01') }),
  ]);
  expect(html).toContain('Issued by ISTQB, March 2024. Valid until March 2027');
  expect(html).toContain('Issued by ISTQB, January 2021. Expired January 2024');
  expect(html).toMatch(/class="row expired"/);
  expect(html).toContain('<span class="expired-label">Expired</span>');
});
test('@REQ-CERT-01 renders in newest-first order with the credential ID', async () => {
  const html = await render([c({ id: 'o', name: 'Older', issueDate: d('2020-01-01') }), c({ id: 'n', name: 'Newer', credentialId: 'ID-1' })]);
  expect(html.indexOf('Newer')).toBeLessThan(html.indexOf('Older'));
  expect(html).toContain('Credential ID ID-1');
});
test('@REQ-A11Y-04 the section is labelled by its heading', async () => {
  const html = await render([c({})]);
  expect(html).toMatch(/<section[^>]*aria-labelledby="certifications-heading"/);
  expect(html).toContain('id="certifications-heading"');
});
