// Creates clearly fake assets so the site builds before real content arrives.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;
const square = (hex: string) => sharp({ create: { width: 900, height: 900, channels: 3, background: hex } });

mkdirSync('src/assets/uploads', { recursive: true });
mkdirSync('tests/fixtures/content/assets', { recursive: true });
await square('#FBE1E3').jpeg({ quality: 80 }).toFile('src/assets/uploads/photo.jpg');
await square('#F2B9C4').webp({ quality: 80 }).toFile('tests/fixtures/content/assets/photo.webp');
writeFileSync('src/assets/uploads/cv.pdf', PDF);
writeFileSync('tests/fixtures/content/assets/cv.pdf', PDF);
console.log('Placeholder assets written.');
