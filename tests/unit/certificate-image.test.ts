import { certificateImagePath, yamlLines } from '../../scripts/certificate-image';

test('@REQ-CERT-07 the certificate image is written next to its PDF as WebP', () => {
  expect(certificateImagePath('src/assets/uploads/a.pdf')).toBe('src/assets/uploads/a.webp');
  expect(certificateImagePath('/x/B.PDF')).toBe('/x/B.webp');
});

test('@REQ-CERT-07 only a PDF is turned into a certificate image', () => {
  expect(() => certificateImagePath('a.png')).toThrow('a.png is not a PDF.');
});

test('@REQ-CERT-07 the printed YAML lines point at both files from the repo root', () => {
  expect(yamlLines('/repo', '/repo/src/assets/uploads/a.pdf')).toBe(
    'certificate: /src/assets/uploads/a.pdf\ncertificateImage: /src/assets/uploads/a.webp',
  );
});
