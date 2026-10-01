import { z } from 'astro/zod';

const PHOTO_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);

/** Rejects a photo that is the wrong file type or too small on its short side (D14).
 * Returns null when the photo passes. */
export function photoProblem(meta: { width: number; height: number; format: string }): string | null {
  if (!PHOTO_FORMATS.has(meta.format.toLowerCase())) return 'The photo must be JPG, PNG, WebP or AVIF.';
  const short = Math.min(meta.width, meta.height);
  if (short < 800) return `The photo must be at least 800px on its shorter side (it is ${short}px).`;
  return null;
}

export const certificationObject = z.object({
  name: z.string().min(1).max(120),
  issuer: z.string().min(1).max(80),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  credentialId: z.string().max(60).optional(),
  verifyUrl: z.url().optional(),
  hidden: z.boolean().default(false),
  placeholder: z.boolean().default(false),
});

export const certificationRules = certificationObject.refine(
  (c) => !c.expiryDate || c.expiryDate >= c.issueDate,
  { message: 'The expiry date cannot be before the issue date.', path: ['expiryDate'] },
);

export const profileObject = (image: () => z.ZodType) => z.object({
  name: z.string().min(1).max(60),
  title: z.string().min(1).max(60),
  tagline: z.string().min(1).max(160),
  photo: image(),
  photoAlt: z.string().min(1).max(200),
  email: z.email(),
  linkedinUrl: z.url(),
  githubUrl: z.url(),
  cv: z.string().regex(/\.pdf$/i, 'The CV must be a PDF.'),
  availability: z.string().max(100).optional(),
  showAvailability: z.boolean().default(false),
  placeholder: z.boolean().default(false),
});

const fieldsOf = (shape: Record<string, z.ZodType>) =>
  Object.entries(shape).map(([name, s]) => ({ name, required: !s.safeParse(undefined).success }));

// z.string() stands in for image(): both are required, which is what the drift test compares.
export const PROFILE_FIELDS = fieldsOf(profileObject(() => z.string()).shape);
export const CERTIFICATION_FIELDS = fieldsOf(certificationObject.shape);
