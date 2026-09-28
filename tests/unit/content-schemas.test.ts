import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import {
  certificationRules, photoProblem, profileObject, PROFILE_FIELDS, CERTIFICATION_FIELDS,
} from '../../src/content-schemas';

const cert = (over: Record<string, unknown>) => ({ name: 'A', issuer: 'ISTQB', issueDate: '2024-03-01', ...over });

test('@REQ-CONTENT-01 a minimal certification is valid and defaults are applied', () => {
  const r = certificationRules.safeParse(cert({}));
  expect(r.success).toBe(true);
  if (r.success) expect(r.data).toMatchObject({ hidden: false, placeholder: false });
});
test('@REQ-CONTENT-01 an expiry before the issue date is rejected with a plain message', () => {
  const r = certificationRules.safeParse(cert({ expiryDate: '2023-01-01' }));
  expect(r.success).toBe(false);
  if (!r.success) expect(r.error.issues[0]!.message).toBe('The expiry date cannot be before the issue date.');
});
test('@REQ-CONTENT-01 a malformed verify URL is rejected', () => {
  expect(certificationRules.safeParse(cert({ verifyUrl: 'not a url' })).success).toBe(false);
});
test('@REQ-CONTENT-01 badge images are no longer accepted (G1)', () => {
  expect(CERTIFICATION_FIELDS.map((f) => f.name)).not.toContain('badge');
});
test('@REQ-CONTENT-01 photos must be JPG, PNG, WebP or AVIF and at least 800px on the short side', () => {
  expect(photoProblem({ width: 900, height: 1200, format: 'jpg' })).toBeNull();
  expect(photoProblem({ width: 799, height: 1200, format: 'webp' })).toBe('The photo must be at least 800px on its shorter side (it is 799px).');
  expect(photoProblem({ width: 900, height: 900, format: 'heic' })).toBe('The photo must be JPG, PNG, WebP or AVIF.');
});
test('@REQ-AVAIL-01 availability is optional, switched off by default, and short', () => {
  const schema = profileObject(() => z.any());
  const base = { name: 'N', title: 'T', tagline: 'Tag', photo: 'x', photoAlt: 'Alt', email: 'a@b.co', linkedinUrl: 'https://l.example', githubUrl: 'https://g.example', cv: 'src/assets/uploads/cv.pdf' };
  // Ruling T13-B (P13): assert ok.success before reading ok.data, so this cannot pass
  // vacuously when the base object fails to parse (`false && x` is `false`).
  const ok = schema.safeParse(base);
  expect(ok.success).toBe(true);
  if (ok.success) expect(ok.data.showAvailability).toBe(false);
  expect(schema.safeParse({ ...base, availability: 'x'.repeat(101) }).success).toBe(false);
  expect(schema.safeParse({ ...base, cv: 'cv.docx' }).success).toBe(false);
});
test('@REQ-CONTENT-02 .pages.yml defines exactly the schema fields with the same required flags', () => {
  const cms = parse(readFileSync('.pages.yml', 'utf8')) as { content: { name: string; fields: { name: string; required?: boolean }[] }[] };
  const fields = (name: string) => cms.content.find((c) => c.name === name)!.fields
    .filter((f) => f.name !== 'body')
    .map((f) => ({ name: f.name, required: f.required === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sorted = (xs: { name: string; required: boolean }[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name));
  expect(fields('profile')).toEqual(sorted(PROFILE_FIELDS));
  expect(fields('certifications')).toEqual(sorted(CERTIFICATION_FIELDS));
});
