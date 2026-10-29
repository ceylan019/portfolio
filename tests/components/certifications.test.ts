import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Certifications from '../../src/components/Certifications.astro';
import type { Certification } from '../../src/lib/certifications';
import certificateImage from '../fixtures/content/assets/certificate.webp';

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
  expect(await render([c({ verifyUrl: 'https://v.example' })])).toContain('A tick means you can verify it with the issuer or view the certificate.');
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
  // The ID sits in its own unbreakable token after a wrappable label.
  expect(html).toContain('Credential ID <span class="cid-token">ID-1</span>');
});
test('@REQ-A11Y-04 the section is labelled by its heading', async () => {
  const html = await render([c({})]);
  expect(html).toMatch(/<section[^>]*aria-labelledby="certifications-heading"/);
  expect(html).toContain('id="certifications-heading"');
});
test('@REQ-CERT-04 a certificate image earns the tick but no Verify link', async () => {
  const html = await render([c({ name: 'AT*SQA API Testing', certificateImage })]);
  expect(html).toContain('class="tick"');
  expect(html).not.toContain('Verify credential');
  expect(html).toContain('A tick means you can verify it with the issuer or view the certificate.');
});
test('@REQ-CERT-07 a certificate shows a WebP thumbnail that opens its preview, with the PDF linked', async () => {
  const html = await render([c({ id: 'atsqa', name: 'AT*SQA API Testing', certificateImage, certificate: '/u/a.pdf' })]);
  expect(html).toMatch(/<a class="cert-thumb" href="\/certificates\/atsqa\.pdf" data-certificate="certificate-atsqa" aria-label="View certificate: AT\*SQA API Testing">/);
  expect(html).toMatch(/<dialog id="certificate-atsqa" class="cert-dialog" aria-labelledby="certificate-atsqa-title">/);
  expect(html).toContain('<p id="certificate-atsqa-title" class="cert-dialog-title">AT*SQA API Testing</p>');
  expect(html).toContain('<button type="button" class="cert-close" data-close>Close</button>');
  expect(html).toContain('alt="Certificate: AT*SQA API Testing, issued by ISTQB"');
  expect(html).toContain('<a class="lnk" href="/certificates/atsqa.pdf" aria-label="Open PDF: AT*SQA API Testing">Open PDF</a>');
  expect(html).not.toMatch(/\sstyle=/);
});
test('@REQ-CERT-07 every certificate image is WebP and loads only when needed', async () => {
  const html = await render([c({ id: 'atsqa', certificateImage, certificate: '/u/a.pdf' })]);
  const imgs = html.match(/<img [^>]*>/g) ?? [];
  expect(imgs).toHaveLength(2);
  for (const img of imgs) {
    expect(img).toContain('loading="lazy"');
    const urls = [...img.matchAll(/(?:src|srcset)="([^"]+)"/g)].flatMap((m) => m[1]!.split(',').map((u) => u.trim().split(' ')[0]!));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/[.=]webp(&|$)|\.webp$/);
  }
});
test('@REQ-CERT-07 an image without a PDF links the thumbnail to the full image and offers no PDF', async () => {
  const html = await render([c({ id: 'udemy', name: 'Playwright', certificateImage })]);
  expect(html).toMatch(/<a class="cert-thumb" href="[^"]+webp[^"]*" data-certificate="certificate-udemy"/);
  expect(html).not.toContain('Open PDF');
});
test('@REQ-CERT-07 an entry without a certificate has no thumbnail and no preview', async () => {
  const html = await render([c({ verifyUrl: 'https://v.example' })]);
  expect(html).not.toContain('cert-thumb');
  expect(html).not.toContain('<dialog');
});
test('@REQ-LAYOUT-01 the certifications section is a list section, so its heading lines up with the first row', async () => {
  expect(await render([c({})])).toMatch(/<section class="sec sec-list" aria-labelledby="certifications-heading">/);
});
test('@REQ-CERT-07 the thumbnail comes after the title, the meta lines and the credential ID', async () => {
  const html = await render([c({ id: 'atsqa', name: 'AT*SQA API Testing', credentialId: 'ID-9', certificateImage, certificate: '/u/a.pdf' })]);
  const thumb = html.indexOf('class="cert-thumb"');
  expect(thumb).toBeGreaterThan(-1);
  for (const marker of ['class="title"', 'class="meta"', 'Credential ID']) {
    expect(html.indexOf(marker)).toBeGreaterThan(-1);
    expect(html.indexOf(marker)).toBeLessThan(thumb);
  }
  expect(html).not.toContain('cert-body');
});
