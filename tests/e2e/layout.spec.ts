import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, settled, serveQuality, sparseQuality, manyTestsQuality, straightQuotes } from './fixtures';
import { req } from '../tag';
import { REQUIREMENTS } from '../requirements';

const SPACING_SCALE = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96];
const RADII = ['0px', '6px', '10px', '50%'];
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 700, height: 900 };

test.use({ reducedMotion: 'reduce' });

const open = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await settled(page);
};

const bodyFontSize = (page: Page): Promise<string> => page.evaluate(() => getComputedStyle(document.body).fontSize);

const fontSizes = (page: Page, selector: string): Promise<string[]> =>
  page.locator(selector).evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fontSize));

async function expectFontSize(page: Page, selector: string, expected: string): Promise<void> {
  const sizes = await fontSizes(page, selector);
  expect(sizes.length, selector).toBeGreaterThan(0);
  for (const size of sizes) expect(size, selector).toBe(expected);
}

const lineCenters = (locator: ReturnType<Page['locator']>): Promise<number[]> =>
  locator.evaluate((element) => {
    const lines: { center: number }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, word.index!);
        range.setEnd(node, word.index! + word[0].length);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        const center = rect.top + rect.height / 2;
        if (!lines.some((line) => Math.abs(line.center - center) < 6)) lines.push({ center });
      }
    }
    return lines.map((line) => line.center);
  });

const wordsPerLine = (locator: ReturnType<Page['locator']>): Promise<string[]> =>
  locator.evaluate((element) => {
    const lines: { center: number; text: string }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, word.index!);
        range.setEnd(node, word.index! + word[0].length);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        const center = rect.top + rect.height / 2;
        const line = lines.find((l) => Math.abs(l.center - center) < 6);
        if (line) line.text += ` ${word[0]}`;
        else lines.push({ center, text: word[0] });
      }
    }
    return lines.map((line) => line.text);
  });

const rect = async (page: Page, selector: string, nth = 0) => {
  const box = await page.locator(selector).nth(nth).boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height, width: box.width, height: box.height };
};

for (const { name, size } of [{ name: 'desktop', size: DESKTOP }, { name: 'mobile', size: MOBILE }]) {
  test.describe(`${name} layout`, () => {
    test.use({ viewport: size });
    test.skip(({ isMobile }) => name === 'desktop' && isMobile, 'desktop widths run in the desktop engines');
    const desktop = name === 'desktop';

    test('rules are list hairlines in the content column or the page frame', req('REQ-LAYOUT-01'), async ({ page }) => {
      for (const path of ['/', '/quality', '/404']) {
        await open(page, path);
        const stray = await page.evaluate(() => [...document.body.querySelectorAll('*')]
          .filter((element) => {
            const style = getComputedStyle(element);
            const horizontal = parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderBottomWidth) > 0;
            const sides = parseFloat(style.borderLeftWidth) > 0 || parseFloat(style.borderRightWidth) > 0;
            return horizontal && !sides && !element.closest('svg') && !element.matches('.list, .row, .reqs, .req, .topline, .foot');
          })
          .map((element) => `${element.tagName.toLowerCase()}.${element.className}`));
        expect(stray, path).toEqual([]);
      }
      await open(page, '/');
      const sectionBoxes = await page.locator('main section').evaluateAll((sections) => sections.map((section) => {
        const style = getComputedStyle(section);
        return [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth];
      }));
      expect(sectionBoxes.length).toBeGreaterThan(0);
      for (const box of sectionBoxes) expect(box).toEqual(['0px', '0px', '0px', '0px']);
    });

    test('list rules span the content column and frame rules span the page', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/');
      const main = await rect(page, 'main');
      const list = await rect(page, '.list');
      const row = await rect(page, '.list .row', 0);
      expect([row.left, row.right]).toEqual([list.left, list.right]);
      expect(list.right).toBeCloseTo(main.right, 0);
      if (desktop) expect(list.left).toBeGreaterThan(main.left);
      const foot = await rect(page, '.foot');
      expect([foot.left, foot.right]).toEqual([main.left, main.right]);
      await open(page, '/quality');
      const topline = await rect(page, '.topline');
      const qmain = await rect(page, 'main');
      expect([topline.left, topline.right]).toEqual([qmain.left, qmain.right]);
    });

    test('the heading lines up with the first row of a list and with the top of other content', req('REQ-LAYOUT-01'), async ({ page }) => {
      test.skip(!desktop, 'the label sits above the content on mobile');
      for (const path of ['/', '/quality']) {
        await open(page, path);
        for (const section of await page.locator('main section.sec').all()) {
          const heading = section.locator('h2');
          const firstRowText = section.locator('.row .title, .req .rq-id').first();
          const label = await heading.textContent();
          if (await firstRowText.count()) {
            const [headingLine] = await lineCenters(heading);
            const [rowLine] = await lineCenters(firstRowText);
            expect(Math.abs(headingLine! - rowLine!), `${path} ${label}`).toBeLessThanOrEqual(2);
          } else {
            const headingBox = (await heading.boundingBox())!;
            const contentBox = (await section.locator(':scope > :last-child').boundingBox())!;
            expect(Math.abs(headingBox.y - contentBox.y), `${path} ${label}`).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    test('headings wrap balanced and the same phrase breaks the same way', req('REQ-LAYOUT-01'), async ({ page }) => {
      for (const path of ['/', '/quality']) {
        await open(page, path);
        for (const heading of await page.locator('main h2').all()) {
          const lines = await wordsPerLine(heading);
          if (lines.length > 1) expect(lines.at(-1)!.split(' ').length, `${path} ${lines.join(' / ')}`).toBeGreaterThan(1);
        }
      }
      if (!desktop) return;
      await open(page, '/');
      const home = await wordsPerLine(page.locator('[aria-labelledby="proof-heading"] h2'));
      await open(page, '/quality');
      expect(await wordsPerLine(page.locator('.qh1'))).toEqual(home);
    });

    test('every certificate title starts at one left edge and the thumbnail sits under the meta lines', req('REQ-LAYOUT-01', 'REQ-CERT-07'), async ({ page }) => {
      await open(page, '/');
      const lefts = await page.locator('.row .title').evaluateAll((titles) => titles.map((title) => title.getBoundingClientRect().left));
      expect(lefts.length).toBeGreaterThan(1);
      for (const left of lefts) expect(left).toBeCloseTo(lefts[0]!, 0);
      const thumbRow = page.locator('.row', { has: page.locator('.cert-thumb') }).first();
      const thumb = (await thumbRow.locator('.cert-thumb').boundingBox())!;
      const title = (await thumbRow.locator('.title').boundingBox())!;
      const meta = (await thumbRow.locator('.meta').boundingBox())!;
      expect(thumb.x).toBeCloseTo(title.x, 0);
      expect(thumb.y).toBeGreaterThanOrEqual(meta.y + meta.height - 1);
    });

    test('the tick column and the coverage column follow one rule in both row kinds', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/');
      const certTracks = await page.locator('.row').first().evaluate((row) => getComputedStyle(row).gridTemplateColumns.split(' '));
      await open(page, '/quality');
      const reqTracks = await page.locator('.req').first().evaluate((row) => getComputedStyle(row).gridTemplateColumns.split(' '));
      expect(certTracks[0]).toBe(desktop ? '40px' : '32px');
      expect(reqTracks[0]).toBe(certTracks[0]);
      expect(reqTracks.length).toBe(desktop ? 3 : 2);
      if (!desktop) {
        const text = await rect(page, '.req .rq-text');
        const coverage = await rect(page, '.req .rq-cov');
        expect(coverage.left).toBeCloseTo(text.left, 0);
        expect(coverage.top).toBeGreaterThanOrEqual(text.bottom - 1);
      }
    });

    test('an expanded test list has no bullets, no indent and an even gap, with 44px targets', req('REQ-LAYOUT-01'), async ({ page }) => {
      await serveQuality(page, manyTestsQuality());
      await open(page, '/quality');
      const details = page.locator('li.req details').first();
      await details.locator('summary').click();
      const detailsLeft = (await details.boundingBox())!.x;
      const list = await details.locator('ul').evaluate((ul) => {
        const style = getComputedStyle(ul);
        const items = [...ul.querySelectorAll('li')];
        const texts = items.map((item) => {
          const link = item.querySelector('a')!;
          const range = document.createRange();
          range.selectNodeContents(link);
          const rects = [...range.getClientRects()];
          return { top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)), box: link.getBoundingClientRect() };
        });
        return {
          bullets: [style.listStyleType, ...items.map((item) => getComputedStyle(item).listStyleType)],
          padding: style.paddingLeft,
          heights: texts.map((t) => t.box.height),
          lefts: texts.map((t) => t.box.left),
          gaps: texts.slice(1).map((t, i) => t.top - texts[i]!.bottom),
        };
      });
      expect(list.bullets.every((type) => type === 'none')).toBe(true);
      expect(list.padding).toBe('0px');
      for (const left of list.lefts) expect(left).toBeCloseTo(detailsLeft, 0);
      for (const height of list.heights) expect(height).toBeGreaterThanOrEqual(44);
      expect(list.gaps.length).toBe(3);
      expect(Math.max(...list.gaps) - Math.min(...list.gaps)).toBeLessThanOrEqual(1);
    });

    test('the test toggle shows a marker and reads Hide while open, named once', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/quality');
      const details = page.locator('li.req details').first();
      const summary = details.locator('summary');
      expect(await summary.evaluate((element) => getComputedStyle(element, '::before').content)).not.toBe('none');
      expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(summary).toHaveText(/^Show the test/, { useInnerText: true });
      await summary.click();
      await expect(details).toHaveJSProperty('open', true);
      await expect(summary).toHaveText(/^Hide the test/, { useInnerText: true });
      const snapshot = await details.ariaSnapshot();
      expect(snapshot.match(/Hide the test/g)).toHaveLength(1);
      expect(snapshot).not.toContain('Show the test');
    });

    test('links follow the type rule: standalone links use the body size, links in smaller text use that size', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/');
      const body = await bodyFontSize(page);
      for (const selector of ['.acts .btn', '.acts .links a', '.sub a', '[aria-labelledby="contact-heading"] a', '.row > a.lnk']) {
        await expectFontSize(page, selector, body);
      }
      const hero = await fontSizes(page, '.acts .links a');
      const contact = await fontSizes(page, '[aria-labelledby="contact-heading"] a');
      expect(contact.slice(1)).toEqual(hero);
      await open(page, '/quality');
      for (const selector of ['.topline a', '[data-block="verdict"] .links a']) await expectFontSize(page, selector, body);
      await expectFontSize(page, '[data-block="verdict"] .meta2 a', '16px');
      await expectFontSize(page, '.rq-cov details a', '14px');
      await open(page, '/404');
      await expectFontSize(page, '.nf a', body);
    });

    test('trend values use the trend value row with proportional figures', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/quality');
      const values = await page.locator('.trend .now').evaluateAll((elements) => elements.map((element) => {
        const style = getComputedStyle(element);
        return { size: style.fontSize, line: style.lineHeight, weight: style.fontWeight, tracking: style.letterSpacing, numeric: style.fontVariantNumeric };
      }));
      expect(values).toHaveLength(3);
      for (const value of values) {
        expect(value.size).toBe(desktop ? '40px' : '32px');
        expect(parseFloat(value.line)).toBeCloseTo(desktop ? 44 : 35.2, 1);
        expect(value.weight).toBe('800');
        expect(parseFloat(value.tracking)).toBeCloseTo(desktop ? -0.8 : -0.64, 1);
        expect(value.numeric).not.toContain('tabular-nums');
      }
    });

    test('a sparkline starts at its column edge and spans the column without distorting the stroke', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/quality');
      for (const index of [0, 1, 2]) {
        const trend = page.locator('.trend').nth(index);
        const now = (await trend.locator('.now').evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect().left;
        }));
        const svg = await trend.locator('.spark').evaluate((element) => element.getBoundingClientRect().right);
        const line = await trend.locator('.spark-line').evaluate((element) => {
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right, effect: getComputedStyle(element).vectorEffect };
        });
        expect(Math.abs(line.left - now)).toBeLessThanOrEqual(2);
        expect(Math.abs(line.right - svg)).toBeLessThanOrEqual(2);
        expect(line.effect).toBe('non-scaling-stroke');
      }
    });

    test('the ring meets the content edge it faces', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/');
      const edges = await page.evaluate(() => {
        const main = document.querySelector('.ring-main')!.getBoundingClientRect();
        const second = document.querySelector('.ring-second')!.getBoundingClientRect();
        const hero = document.querySelector('.hero')!.getBoundingClientRect();
        return { ringLeft: Math.min(main.left, second.left), ringRight: Math.max(main.right, second.right), heroLeft: hero.left, heroRight: hero.right };
      });
      if (desktop) expect(Math.abs(edges.ringRight - edges.heroRight)).toBeLessThanOrEqual(2);
      else expect(Math.abs(edges.ringLeft - edges.heroLeft)).toBeLessThanOrEqual(2);
    });

    test('the verdict is one left-aligned column with no empty space under it', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/quality');
      const block = await rect(page, '[data-block="verdict"]');
      const children = await page.locator('[data-block="verdict"] [data-slot="live"] > *').evaluateAll((elements) => elements.map((element) => {
        const r = element.getBoundingClientRect();
        return { className: element.className, left: r.left, top: r.top, bottom: r.bottom };
      }));
      expect(children.map((child) => child.className.split(' ')[0])).toEqual(['lede', 'meta2', 'links']);
      for (const [index, child] of children.entries()) {
        expect(child.left).toBeCloseTo(block.left, 0);
        if (index > 0) expect(child.top).toBeGreaterThanOrEqual(children[index - 1]!.bottom - 1);
      }
      expect(Math.abs(block.bottom - children.at(-1)!.bottom)).toBeLessThanOrEqual(1);
      const meta = page.locator('[data-block="verdict"] .meta2');
      await expect(meta).toHaveText(/^Deployed .+ UTC, commit [0-9a-f]{7}$/);
      await expect(meta.locator('time')).toHaveCount(1);
      expect(await meta.locator('time').evaluate((element) => element.getClientRects().length)).toBe(1);
      expect(await meta.evaluate((element) => [getComputedStyle(element).fontSize, getComputedStyle(element).color === getComputedStyle(document.querySelector('.gloss')!).color])).toEqual(['16px', true]);
      await expect(page.locator('[data-block="verdict"] .links a')).toHaveText(['View this CI run', 'Browse the source']);
    });

    test('the live check sits under the glossary, and the duration sits under the suites', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/quality');
      await expect(page.locator('header.qhead [data-block="integrity"]')).toHaveCount(1);
      const gloss = await rect(page, '.gloss');
      const integrity = await rect(page, '[data-block="integrity"]');
      expect(integrity.left).toBeCloseTo(gloss.left, 0);
      expect(integrity.top).toBeGreaterThanOrEqual(gloss.bottom - 1);
      await expect(page.locator('[aria-labelledby="suites-heading"] [data-block="duration"]')).toHaveCount(1);
      const suites = await rect(page, '.suites');
      const duration = await rect(page, '[data-block="duration"]');
      expect(duration.left).toBeCloseTo(suites.left, 0);
      expect(duration.top).toBeGreaterThanOrEqual(suites.bottom - 1);
    });

    test('the live check tick keeps its size and sits on the first line', req('REQ-LAYOUT-01'), async ({ page }) => {
      await open(page, '/quality');
      const result = await page.locator('.integrity').evaluate((element) => {
        const tick = element.querySelector('.tick')!.getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text: Node | null = walker.nextNode();
        while (text && !text.textContent?.trim()) text = walker.nextNode();
        const range = document.createRange();
        range.selectNodeContents(text!);
        const line = range.getClientRects()[0]!;
        return { width: tick.width, height: tick.height, offset: Math.abs(tick.top + tick.height / 2 - (line.top + line.height / 2)) };
      });
      expect(result.width).toBeGreaterThanOrEqual(21.5);
      expect(result.height).toBeGreaterThanOrEqual(17.5);
      expect(result.offset).toBeLessThanOrEqual(4);
    });
  });
}

test.describe('mobile contact', () => {
  test.use({ viewport: MOBILE });

  test('the four contact links sit in a 2 by 2 grid', req('REQ-LAYOUT-01'), async ({ page }) => {
    await open(page, '/');
    const boxes = await page.locator('[aria-labelledby="contact-heading"] a').evaluateAll((links) => links.map((link) => {
      const r = link.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), height: Math.round(r.height) };
    }));
    expect(boxes).toHaveLength(4);
    expect(new Set(boxes.map((box) => box.left)).size).toBe(2);
    expect(new Set(boxes.map((box) => box.top)).size).toBe(2);
    for (const box of boxes) expect(box.height).toBe(44);
  });
});

test.describe('between mobile and desktop', () => {
  test.use({ viewport: TABLET });
  test.skip(({ isMobile }) => isMobile, 'the mobile device profiles keep their own width');

  test('requirement rows use the mobile row layout below 900px', req('REQ-LAYOUT-01'), async ({ page }) => {
    await open(page, '/quality');
    const tracks = await page.locator('.req').first().evaluate((row) => getComputedStyle(row).gridTemplateColumns.split(' '));
    expect(tracks[0]).toBe('32px');
    expect(tracks).toHaveLength(2);
  });
});

test.describe('verdict reservation', () => {
  test('the desktop reservation stays just below the ready verdict', req('REQ-LAYOUT-01'), async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, 'measured at desktop width');
    await page.setViewportSize(DESKTOP);
    await open(page, '/quality');
    await expectReservation(page, testInfo.project.name === 'chromium');
  });

  test('the mobile reservation stays just below the ready verdict', req('REQ-LAYOUT-01'), async ({ page, isMobile }, testInfo) => {
    test.skip(testInfo.project.name !== 'pixel' || !isMobile, 'measured at the Lighthouse mobile width, 412px');
    await open(page, '/quality');
    await expectReservation(page, true);
  });
});

async function expectReservation(page: Page, strictUpperBound: boolean): Promise<void> {
  const { reserved, ready } = await page.locator('[data-block="verdict"]').evaluate((block) => ({
    reserved: parseFloat(getComputedStyle(block).minHeight),
    ready: block.querySelector('[data-slot="live"]')!.lastElementChild!.getBoundingClientRect().bottom - block.getBoundingClientRect().top,
  }));
  expect(reserved).toBeLessThanOrEqual(ready);
  if (strictUpperBound) expect(ready - reserved).toBeLessThanOrEqual(12);
}

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark', viewport: DESKTOP });
  test.skip(({ isMobile }) => isMobile, 'one engine width is enough for a filter');

  test('the certificate thumbnail is dimmed and the full preview is not', req('REQ-LAYOUT-01', 'REQ-CERT-07'), async ({ page }) => {
    await open(page, '/');
    const thumb = page.locator('.cert-thumb img').first();
    expect(await thumb.evaluate((image) => getComputedStyle(image).filter)).toContain('brightness');
    await page.locator('.cert-thumb').first().click();
    expect(await page.locator('.cert-full').first().evaluate((image) => getComputedStyle(image).filter)).toBe('none');
  });
});

test.describe('light mode', () => {
  test.use({ colorScheme: 'light', viewport: DESKTOP });
  test.skip(({ isMobile }) => isMobile, 'one engine width is enough for a filter');

  test('the certificate thumbnail is not dimmed', req('REQ-LAYOUT-01', 'REQ-CERT-07'), async ({ page }) => {
    await open(page, '/');
    expect(await page.locator('.cert-thumb img').first().evaluate((image) => getComputedStyle(image).filter)).toBe('none');
  });
});

for (const { name, size } of [{ name: 'desktop', size: DESKTOP }, { name: 'mobile', size: MOBILE }]) {
  test.describe(`${name} scales`, () => {
    test.use({ viewport: size });
    test.skip(({ isMobile }) => name === 'desktop' && isMobile, 'desktop widths run in the desktop engines');

    test('spacing values sit on the 4px scale', req('REQ-LAYOUT-01'), async ({ page }) => {
      const pages: [string, string | null][] = [['/', null], ['/quality', null], ['/quality', sparseQuality()], ['/404', null], ['/__states', null]];
      for (const [path, data] of pages) {
        if (data) await serveQuality(page, data);
        await open(page, path);
        const off = await page.evaluate((scale) => {
          const properties = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap'] as const;
          const found: string[] = [];
          for (const element of document.body.querySelectorAll('*')) {
            if (element.closest('dialog') || element.parentElement?.closest('svg') || element.matches('.page, .nf-text')) continue;
            const style = getComputedStyle(element);
            for (const property of properties) {
              const value = parseFloat(style[property]);
              if (!Number.isNaN(value) && !scale.includes(value)) found.push(`${element.tagName.toLowerCase()}.${element.className} ${property} ${style[property]}`);
            }
          }
          return found;
        }, SPACING_SCALE);
        expect(off, `${path}${data ? ' sparse' : ''}`).toEqual([]);
      }
    });

    test('radii are 10px for surfaces and controls, 6px for small inline items', req('REQ-LAYOUT-01'), async ({ page, browserName }) => {
      await serveQuality(page, sparseQuality());
      const radii = async (path: string): Promise<string[]> => {
        await open(page, path);
        if (path === '/') await page.locator('.cert-thumb').first().click();
        return page.evaluate((allowed) => [...document.body.querySelectorAll('*')]
          .map((element) => ({ element, radius: getComputedStyle(element).borderTopLeftRadius }))
          .filter(({ radius }) => !allowed.includes(radius))
          .map(({ element, radius }) => `${element.tagName.toLowerCase()}.${element.className} ${radius}`), RADII);
      };
      for (const path of ['/', '/quality', '/404']) expect(await radii(path), path).toEqual([]);
      await open(page, '/');
      const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
      for (let presses = 0; presses < 3; presses++) await page.keyboard.press(tab);
      expect(await page.locator('.hero .links a').first().evaluate((link) => [document.activeElement === link, getComputedStyle(link).borderTopLeftRadius])).toEqual([true, '6px']);
    });
  });
}

test.describe('copy', () => {
  test.use({ viewport: DESKTOP });
  test.skip(({ isMobile }) => isMobile, 'text does not change with the viewport');

  test('every page uses curly apostrophes and quotation marks', req('REQ-COPY-01'), async ({ page }) => {
    for (const path of ['/', '/quality', '/404', '/__states']) {
      await open(page, path);
      expect(await straightQuotes(page), path).toEqual([]);
    }
    await serveQuality(page, sparseQuality());
    await open(page, '/quality');
    expect(await straightQuotes(page), 'sparse /quality').toEqual([]);
  });

  test('requirement texts and test titles use curly apostrophes and quotation marks', req('REQ-COPY-01'), async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'reads files, so one project is enough');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
    const titles = walk('tests')
      .filter((file) => /\.(test|spec)\.ts$/.test(file))
      .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/^\s*(?:test|it)(?:\.\w+)*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/gm)].map((match) => ({ file, title: match[2]! })))
      .filter(({ title }) => /['"]/.test(title))
      .map(({ file, title }) => `${file}: ${title}`);
    expect(titles).toEqual([]);
    expect(REQUIREMENTS.filter((requirement) => /['"]/.test(requirement.text)).map((requirement) => requirement.id)).toEqual([]);
  });
});
