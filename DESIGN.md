# Design system

The single design reference for this site. Every page, including future ones (projects, study hub), follows it. Approved visuals: `docs/superpowers/specs/assets/final-mockups.png` (home and `/quality`), `quality-mockups.png` (matrix at 375px, dark mode), `photo-mark.svg` (the brush ring).

## Direction

"Proof marks": a reviewer's rose ink on warm petal paper. Calm, left-aligned, typographic. One bold element per page (the brush ring on `/`, the matrix ticks on `/quality`). No cards, no gradients behind text, no icons in circles, no decorative shadows.

## Color tokens

Defined as CSS custom properties on `:root`, switched by `prefers-color-scheme`. No manual toggle.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FFF6F5` | `#1E1117` | page background |
| `--ink` | `#2C1822` | `#F8E8EB` | main text |
| `--muted` | `#7D5F69` | `#B8949F` | secondary text, expired titles |
| `--rose-mark` | `#CF3F68` | `#F0729A` | brush mark, ticks, primary button |
| `--rose-mark-hover` | `#B8325A` | `#F48FB0` | primary button hover |
| `--rose-mark-active` | `#9E2A4E` | `#E0678E` | primary button pressed |
| `--on-rose` | `#FFFFFF` | `#1E1117` | primary button text |
| `--rose-text` | `#B8325A` | `#F0729A` | links |
| `--visited` | `#8A2447` | `#E8B89A` | visited links (underline switches to `--muted`) |
| `--coral` | `#F08A5D` | `#F4A07C` | end of the brush gradient |
| `--peach` | `#F7B596` | `#C9785C` | second brush pass |
| `--blush` | `#FBE1E3` | `#2E1A23` | behind the photo, reserved photo square |
| `--line` | `#F1D9DC` | `#3A2530` | hairlines between rows |

Contrast (checked): ink on bg 15.7 / 15.5; muted 5.3 / 6.8; rose-text 5.4 / 6.6; visited 8.2 / 10.2; button text on rose-mark 4.6 / 6.6, on hover 5.8 / 8.2, on active 7.3 / 5.7. `--rose-mark` on the light background (4.3) is never used for text smaller than 24px.

## Type

- **Family:** Schibsted Grotesk only, weights 400, 500, 700 and 800, self-hosted, Latin subset. Only 800 is preloaded.
- **Scale:**

| Role | Desktop | Mobile | Weight | Line height |
|---|---|---|---|---|
| Name (`h1` on `/`) | 96px | 60px | 800, tracking about -0.035em | 0.92 |
| Page title (`h1` on `/quality`) | 64px | 40px | 800 | 0.95 |
| Section heading (`h2`) | 24px | 24px | 700 | 1.2 |
| Proof sentence, verdict | 24px / 21px | 20px / 18px | 500, numbers 800 | 1.45 |
| Role, tagline | 20px | 18px | 500 / 400 | 1.5 |
| Body | 18px | 17px | 400 | 1.6 |
| Meta (dates, issuer) | 16px | 16px | 400 | 1.5 |
| Labels, IDs, glossary | 14px | 14px | 400 to 700 | 1.5 |

- Sentence case everywhere. No all-caps. Numbers use tabular figures. Prose paragraphs are capped at 62 characters; lists and tables are not.
- **Dates:** always month and year in words: "March 2024".

## Spacing

4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Section gap: 96 desktop, 64 mobile. Row padding: 16. Page gutter: 64 desktop, 16 mobile. Max content width about 1120px.
- **Section layout:** a 220px label column (the `h2`, plus an optional 14px note) and a content column, 48px apart. Below 900px the label sits above the content.

## Components

- **Hero (`/`):** name, role, optional availability line, tagline, then the action row: the CV button followed by Email, LinkedIn, GitHub in one row (desktop) or on one row below the full-width button (mobile). The ring and photo sit on the right; on mobile they move above the name.
- **Primary button:** `--rose-mark` background, `--on-rose` text, weight 700, at least 48px tall, 10px radius. Hover and pressed use the tokens above. Only one primary button per page.
- **Links:** `--rose-text`, 2px underline at 40% opacity, offset 4px. Visited uses `--visited` with a `--muted` underline. Every link target is at least 44px tall. All links open in the same tab.
- **Tick row (certifications, requirements):** 40px tick column, content, optional right-aligned action. Hairline between rows. Below 900px the action moves under the meta line. Expired entries: title in `--muted`, a quiet outlined "Expired" label, and the dates in words.
- **Brush tick:** the tapered rose-to-coral mark. It means one thing everywhere: this was checked.
- **Data block:** server-rendered with a true, number-free fallback sentence in reserved space (`data-state="unavailable"`), upgraded to numbers when `quality.json` loads (`ready`), always marked `data-settled` when the loader finishes. Each block settles independently.
- **Top line (`/quality` and future inner pages):** the name on the left, linking home, and "Download CV (PDF)" on the right. No menu.
- **Footer:** name and year only.

## Motion

One moment per page load: the brush ring draws itself (about 900ms, CSS only, via an SVG mask). Nothing else animates; images appear without fades. With `prefers-reduced-motion: reduce` the ring is shown complete.

## Accessibility

- Landmarks: `header`, `main`, `footer`; each `section` is labelled by its heading. One `h1` per page. A skip link.
- Focus ring: 2px `--rose-text` outline with an offset, on every interactive element.
- Repeated links carry unique accessible names ("Verify credential: ISTQB Certified Tester, Foundation Level").
- Photo square is reserved (blush circle and ring) so nothing shifts while it loads; alt text is required content.
- Automated WCAG 2.2 AA checks (axe) run in both themes on every change.

## Copy rules

- Every section says one new thing. The About text never repeats the tagline and stays under about 90 words.
- Claims about testing must match what the pipeline does, word for word ("test", "test run", "browser engines", "device profiles", "automated (axe)", "in CI").
- Errors and fallbacks explain what happened and where to go, without apology.
