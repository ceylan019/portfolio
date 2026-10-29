import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const LONG_SIDE_PX = 2400;
const PDF = /\.pdf$/i;

export function certificateImagePath(pdf: string): string {
  if (!PDF.test(pdf)) throw new Error(`${pdf} is not a PDF.`);
  return pdf.replace(PDF, '.webp');
}

export function yamlLines(repoRoot: string, pdf: string): string {
  const fromRoot = (file: string) => `/${relative(repoRoot, resolve(file))}`;
  return `certificate: ${fromRoot(pdf)}\ncertificateImage: ${fromRoot(certificateImagePath(pdf))}`;
}

export async function makeCertificateImage(pdf: string): Promise<string> {
  if (process.platform !== 'darwin') throw new Error('This command needs macOS: it renders the PDF with sips.');
  const out = certificateImagePath(pdf);
  const dir = mkdtempSync(join(tmpdir(), 'certificate-'));
  try {
    const png = join(dir, 'page.png');
    execFileSync('sips', ['-s', 'format', 'png', '-Z', String(LONG_SIDE_PX), pdf, '--out', png], { stdio: 'ignore' });
    await sharp(png).webp({ quality: 85 }).toFile(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

async function main(): Promise<void> {
  const pdf = process.argv[2];
  if (!pdf) {
    console.error('Usage: pnpm certificate:image <certificate.pdf>');
    process.exit(1);
  }
  const out = await makeCertificateImage(pdf);
  console.log(`Wrote ${out}. Add these lines to the certification's YAML file:\n${yamlLines(process.cwd(), pdf)}`);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
