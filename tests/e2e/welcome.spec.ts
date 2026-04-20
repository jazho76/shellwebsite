import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('welcome', () => {
  test('prints the portfolio banner and all sections', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'welcome');
    expect(out).toContain('joaquin pinillos');
    expect(out).toContain('software engineer');
    expect(out).toContain('background');
    expect(out).toContain('current focus');
    expect(out).toContain('Forge');
    expect(out).toContain('approach');
    expect(out).toContain('contact');
    expect(out).toContain('tip');
  });

  test('renders clickable github / linkedin / email anchors', async ({
    page,
  }) => {
    await bootAndReady(page);
    await runCmd(page, 'welcome');
    const hrefs = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return [...(last?.querySelectorAll('a') ?? [])].map(a =>
        a.getAttribute('href')
      );
    });
    expect(hrefs).toContain('https://github.com/jazho76');
    expect(hrefs).toContain('https://linkedin.com/in/joaquin-pinillos');
    expect(hrefs).toContain('mailto:hello@jpinillos.dev');
  });

  test('banner renders in brightCyan (ansi-14)', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'welcome');
    const cyanSpans = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return (
        last?.querySelectorAll("span[style*='var(--ansi-14)']").length ?? 0
      );
    });
    expect(cyanSpans).toBeGreaterThan(5);
  });

  test('section headers render in green (ansi-2)', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'welcome');
    const headers = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const spans =
        last?.querySelectorAll("span[style*='var(--ansi-2)']") ?? [];
      return [...spans].map(s => s.textContent);
    });
    expect(headers).toEqual(
      expect.arrayContaining([
        'background',
        'current focus',
        'approach',
        'contact',
        'tip',
      ])
    );
  });
});
