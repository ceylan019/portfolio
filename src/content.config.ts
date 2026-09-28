import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { certificationRules, photoProblem, profileObject } from './content-schemas';

// CONTENT_DIR switches between real content and fixtures (spec section 8).
// The glob loader resolves `base` from the working directory; a wrong value
// yields an empty collection, which the @real count check catches.
const base = process.env.CONTENT_DIR ?? 'src/content';

// Astro 6.4.8's content-layer glob loader always parses entries without a plugin
// context (node_modules/astro/dist/content/content-layer.js, parseData), so for a
// loader-based collection image() never returns real { width, height, format } at
// schema time in this Astro version, only a path marker string; real metadata is
// resolved later, when a page actually renders the image. Without this guard,
// photoProblem crashes on that marker string instead of judging it (Task 13 report,
// "Changes from the plan"). Kept here, rather than dropped, in case a future Astro
// release starts passing real metadata through this path; it would then start
// failing the build on a bad photo for free, with no code change needed.
const isImageMeta = (v: unknown): v is { width: number; height: number; format: string } =>
  typeof v === 'object' && v !== null
  && typeof (v as { width: unknown }).width === 'number'
  && typeof (v as { height: unknown }).height === 'number'
  && typeof (v as { format: unknown }).format === 'string';

const profile = defineCollection({
  loader: glob({ pattern: 'profile.md', base: `${base}/profile` }),
  schema: ({ image }) => profileObject(() =>
    image().superRefine((meta, ctx) => {
      if (!isImageMeta(meta)) return;
      const problem = photoProblem(meta);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),
  ),
});

const certifications = defineCollection({
  loader: glob({ pattern: '*.yaml', base: `${base}/certifications` }),
  schema: certificationRules,
});

export const collections = { profile, certifications };
