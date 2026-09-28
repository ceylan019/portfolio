import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Hero from '../../src/components/Hero.astro';
import ProofStrip from '../../src/components/ProofStrip.astro';
import Contact from '../../src/components/Contact.astro';
import Footer from '../../src/components/Footer.astro';
import photo from '../fixtures/content/assets/photo.webp';
const profile = {
  name: 'Ceylan Akyol', title: 'QA Automation Engineer', tagline: 'I build test automation that teams can read, trust and keep running.',
  photo, photoAlt: 'Portrait', email: 'hi@example.com', linkedinUrl: 'https://linkedin.example/c', githubUrl: 'https://github.example/c',
  cv: 'x.pdf', showAvailability: false, placeholder: false,
};
const render = async (C: any, props: Record<string, unknown>) => (await AstroContainer.create()).renderToString(C, { props });

test('@REQ-HERO-01 hero shows name as h1, title and tagline', async () => {
  const html = await render(Hero, { profile });
  expect(html).toMatch(/<h1 class="name">Ceylan Akyol<\/h1>/);
  expect(html).toContain('QA Automation Engineer');
  expect(html).toContain('I build test automation');
});
test('@REQ-CV-02 the hero CV button downloads with the owner name', async () => {
  expect(await render(Hero, { profile })).toContain('<a class="btn" href="/cv.pdf" download="Ceylan-Akyol-CV.pdf">Download CV (PDF)</a>');
});
test('@REQ-CONTACT-01 hero links are Email, LinkedIn, GitHub in that order', async () => {
  const html = await render(Hero, { profile });
  const order = ['mailto:hi@example.com', 'https://linkedin.example/c', 'https://github.example/c'].map((h) => html.indexOf(h));
  expect(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1]!))).toBe(true);
});
test('@REQ-AVAIL-01 the availability line shows only when switched on', async () => {
  expect(await render(Hero, { profile: { ...profile, availability: 'Open to remote.' } })).not.toContain('Open to remote.');
  expect(await render(Hero, { profile: { ...profile, availability: 'Open to remote.', showAvailability: true } })).toContain('<p class="avail">Open to remote.</p>');
});
test('@REQ-QUAL-01 the proof strip ships a true fallback sentence and an empty live slot', async () => {
  const html = await render(ProofStrip, {});
  expect(html).toContain('data-block="proof-strip" data-state="unavailable"');
  expect(html).toContain('Every change runs through automated tests in 3 browser engines and 5 device profiles before it deploys.');
  expect(html).toContain('<div data-slot="live"></div>');
  expect(html).toContain('href="/quality"');
});
test('@REQ-CV-02 contact starts with the CV link', async () => {
  const html = await render(Contact, { profile });
  expect(html.indexOf('download="Ceylan-Akyol-CV.pdf"')).toBeLessThan(html.indexOf('mailto:'));
});
test('@REQ-A11Y-04 the footer is a landmark with only name and year', async () => {
  const html = await render(Footer, { name: 'Ceylan Akyol', year: 2026 });
  expect(html).toMatch(/<footer class="foot">\s*Ceylan Akyol, 2026\s*<\/footer>/);
});
