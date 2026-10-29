# Design system

The single design reference for this site. Every page, including future ones (projects, study hub), follows it. The brush ring artwork is `docs/design/photo-mark.svg`.

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

In dark mode the certificate thumbnail is dimmed (brightness 0.8) so a white certificate does not glare against the page. The preview in the dialog stays at full brightness.

## Type

- **Family:** Schibsted Grotesk only, weights 400, 500, 700 and 800, self-hosted, Latin subset. Only 800 is preloaded.
- **Scale:**

| Role | Desktop | Mobile | Weight | Line height |
|---|---|---|---|---|
| Name (`h1` on `/`) | 96px | 60px | 800, tracking about -0.035em | 0.92 |
| Page title (`h1` on `/quality`) | 64px | 40px | 800 | 0.95 |
| Section heading (`h2`) | 24px | 24px | 700 | 1.2 |
| Verdict (`/quality`) | 21px | 18px | 500, numbers 800 | 1.45 |
| Trend value (`/quality`) | 40px | 32px | 800, tracking -0.02em | 1.1 |
| Role, tagline | 20px | 18px | 500 / 400 | 1.5 |
| Body, proof sentence | 18px | 17px | 400, proof numbers 800 | 1.6 |
| Meta (dates, issuer) | 16px | 16px | 400 | 1.5 |
| Labels, IDs, glossary | 14px | 14px | 400 to 700 | 1.5 |

- Sentence case everywhere. No all-caps. Numbers that are compared (the proof sentence and verdict figures) use tabular figures. Trend values and running text do not, because tabular figures widen decimal points, commas, full stops and colons to the width of a digit. Prose paragraphs are capped at 62 characters; lists and tables are not.
- Headings (`h1`, `h2`) wrap balanced, so no heading ends on a single word. The phrase "How this site is tested" breaks the same way wherever it wraps: after "site", so the second line reads "is tested". The `/quality` title carries that break on every width. The home heading carries it at 900px and up, where its label column is 220px wide, and stays on one line below 900px.
- **Dates:** always month and year in words: "March 2024".

## Spacing

4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Section gap: 96 desktop, 64 mobile. Row padding: 16. Page gutter: 64 desktop, 16 mobile. Max content width about 1120px.
- **Section layout:** a 220px label column (the `h2`, plus an optional 14px note) and a content column, 48px apart. Below 900px the label sits above the content.
- **Scale:** every margin, padding and gap is a step of this scale or 0. No other value is used.
- **Separators:** a rule means exactly one of two things. A hairline between the rows of a list, spanning the content column. Or the page frame: the line under the top line on inner pages and the line above the footer, spanning the full page width. Nothing else carries a top or bottom rule. A section has no border and no padding of its own.
- **Alignment:** in a section with a label column, the label heading and the content share one top edge. When the content is a ruled list, the heading's first line centers on the first line of the first row's text instead. Every title in a list starts at one left edge: media such as the certificate thumbnail go under the meta lines in the same column, never beside the title. The brush ring's visible outer edge meets the content edge it faces: right on desktop, left on mobile. A sparkline starts at its column's left edge and spans the column. The three trend columns sit one column gap (48px) apart, the same as the suites list.

## Radii

- 10px for controls and surfaces: the primary button, the certificate dialog and its close button, the skip link and the dashed note.
- 6px for small inline items: the certificate thumbnail, the Expired label and the focus ring.
- The photo is a circle, not a radius.

## Components

- **Hero (`/`):** name, role, optional availability line, tagline, then the action row: the CV button followed by Email, LinkedIn, GitHub in one row (desktop) or on one row below the full-width button (mobile). The ring and photo sit on the right; on mobile they move above the name. The ring's frame is trimmed to its visible edge, so the ring meets the right edge of the content on desktop and the left edge on mobile.
- **Primary button:** `--rose-mark` background, `--on-rose` text, weight 700, at least 48px tall, 10px radius. Hover and pressed use the tokens above. Only one primary button per page.
- **Links:** `--rose-text`, 2px underline at 40% opacity, offset 4px. Visited uses `--visited` with a `--muted` underline. Every link target is at least 44px tall. A wrapped standalone link is balanced, so it never leaves one word alone on its last line in any browser engine. All links open in the same tab. A standalone link (hero action row, Contact, Verify credential, the proof strip link, the top line links, the verdict links row, the 404 home link) uses the body size, 18px desktop and 17px mobile; the CV button does too. A link inside a run of smaller text (the verdict meta line, the live check sentence when it links the CI history, the coverage column, fallback sentences) takes that text's size, and keeps its 44px target through padding so the text's line spacing stays even when the line wraps. That target never overlaps another link's target: the element after it leaves room for the padding. Rose text that toggles content, such as the test list summary, is underlined like a link, shows a marker that turns when open, and changes its label from "Show" to "Hide".
- **Tick row (certifications, requirements):** a 40px tick column (32px below 900px), the same in both row kinds, then the content, then an optional right-aligned action (the Verify link, or the coverage column). Hairline between rows. Below 900px the action moves under the text. A certificate thumbnail sits under the meta lines, in the content column, so every title in the list starts at one left edge. Expired entries: title in `--muted`, a quiet outlined "Expired" label, and the dates in words.
- **Brush tick:** the tapered rose-to-coral mark. It means one thing everywhere: this was checked.
- **Data block:** server-rendered with a true, number-free fallback sentence in reserved space (`data-state="unavailable"`), upgraded to numbers when `quality.json` loads (`ready`), always marked `data-settled` when the loader finishes. Each block settles independently. The verdict block holds its height with a hidden copy of the ready verdict (the sentence, the meta line and the links row) built from the same wording with the largest plausible figures: it is not read aloud, cannot be focused or selected, is skipped by search snippets, carries no link targets, and shares one grid cell with the fallback and live content. The largest figures are 200 requirements (the most the report allows), 9,999 tests, 9,999 test runs, the widest month and the widest digits, and the meta line uses tabular figures so no live date, time or commit can be wider. The block is as tall as the tallest of the three at every width in every browser engine, so the numbers arriving never move the page for counts up to 9,999 tests and 9,999 test runs. When the live text is shorter, the space under the links row is what the largest figures need. Above 9,999 the reservation can fall one line short.
- **Top line (`/quality` and future inner pages):** the name on the left, linking home, and "Download CV (PDF)" on the right. No menu.
- **`/quality` header:** the page title, then the verdict as one left-aligned column on every width: the verdict sentence, one muted 16px meta line ("Deployed 29 October 2026, 05:39 UTC, commit abc1234") and a links row ("View this CI run", "Browse the source"). The glossary follows, then the live check line, which is capped at the same 62 character measure as the glossary. The pipeline duration sits under the suites list, in its content column.
- **Footer:** name and year only.
- **Not found page (`/404`):** the numeral, the sentence and the home link, centered horizontally and vertically in the viewport. The page has no top line or footer.

## Motion

One moment per page load: the brush ring draws itself (about 900ms, CSS only, via an SVG mask). Nothing else animates; images appear without fades. With `prefers-reduced-motion: reduce` the ring is shown complete.

## Accessibility

- Landmarks: `header`, `main`, `footer`; each `section` is labelled by its heading. One `h1` per page. A skip link.
- Focus ring: 2px `--rose-text` outline with an offset, on every interactive element.
- Repeated links carry unique accessible names ("Verify credential: ISTQB Certified Tester, Foundation Level").
- Photo square is reserved (blush circle and ring) so nothing shifts while it loads; alt text is required content.
- Automated WCAG 2.2 AA checks (axe) run in both themes on every change.

## Copy rules

- **Typographic punctuation:** every visible string, page title, meta description, alt text, requirement text and test title shown on `/quality` uses curly apostrophes and quotation marks, written as the character itself. Markdown body text may keep straight quotes in source because the renderer converts them.
- Every section says one new thing. The About text never repeats the tagline and stays under about 90 words.
- Claims about testing must match what the pipeline does, word for word ("test", "test run", "browser engines", "device profiles", "automated (axe)", "in CI").
- Errors and fallbacks explain what happened and where to go, without apology.
