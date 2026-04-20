import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

const ESC = '\x1b';

test.describe('ansi colors', () => {
  test('plain echo produces no ansi spans', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'echo hello');
    const ansiSpans = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return (
        last?.querySelectorAll('span[class*="ansi-"], span[style*="--ansi"]')
          .length ?? 0
      );
    });
    expect(ansiSpans).toBe(0);
  });

  test('red escape renders a span with --ansi-1 color', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, `echo ${ESC}[31mred${ESC}[0m`);
    const hasRedSpan = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const spans = last?.querySelectorAll('span') ?? [];
      for (const s of spans) {
        const style = s.getAttribute('style') ?? '';
        if (style.includes('var(--ansi-1)') && s.textContent === 'red') {
          return true;
        }
      }
      return false;
    });
    expect(hasRedSpan).toBe(true);
  });

  test('bold attribute adds ansi-bold class', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, `echo ${ESC}[1mbold${ESC}[0m`);
    const hasBold = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const span = last?.querySelector('span.ansi-bold');
      return span?.textContent === 'bold';
    });
    expect(hasBold).toBe(true);
  });

  test('attributes do not leak into the next command', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, `echo ${ESC}[31mred`);
    await runCmd(page, 'echo plain');
    const plainHasStyledSpan = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return (
        (last?.querySelectorAll('span[class*="ansi-"], span[style*="--ansi"]')
          .length ?? 0) > 0
      );
    });
    expect(plainHasStyledSpan).toBe(false);
  });

  test('computed color changes with theme', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, `echo ${ESC}[32mgreen${ESC}[0m`);
    const selector = "#output .entry:last-child span[style*='var(--ansi-2)']";
    const defaultColor = await page.evaluate(sel => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).color : '';
    }, selector);
    await runCmd(page, 'theme crt');
    await runCmd(page, `echo ${ESC}[32mgreen${ESC}[0m`);
    const crtColor = await page.evaluate(_sel => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const el = last?.querySelector("span[style*='var(--ansi-2)']");
      return el ? getComputedStyle(el).color : '';
    }, selector);
    expect(defaultColor).toBeTruthy();
    expect(crtColor).toBeTruthy();
    expect(defaultColor).not.toBe(crtColor);
  });

  test('24-bit rgb emits rgb() inline style', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, `echo "${ESC}[38;2;10;20;30mx${ESC}[0m"`);
    const hasRgb = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const spans = last?.querySelectorAll('span') ?? [];
      for (const s of spans) {
        const style = s.getAttribute('style') ?? '';
        if (
          /rgb\(\s*10,\s*20,\s*30\s*\)/.test(style) &&
          s.textContent === 'x'
        ) {
          return true;
        }
      }
      return false;
    });
    expect(hasRgb).toBe(true);
  });

  test('ansi escapes do not render literally in the DOM', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, `echo ${ESC}[31mred${ESC}[0m`);
    const text = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return (
        (last?.querySelector('.out') as HTMLElement | null)?.innerText ?? ''
      );
    });
    expect(text).toContain('red');
    expect(text).not.toContain('\x1b');
    expect(text).not.toContain('[31m');
  });

  test('colortest produces spans for all 16 basic colors', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'colortest');
    const colorsCovered = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const spans = last?.querySelectorAll('span') ?? [];
      const seen = new Set<number>();
      for (const s of spans) {
        const style = s.getAttribute('style') ?? '';
        const m = style.match(/var\(--ansi-(\d+)\)/);
        if (m) {
          seen.add(Number(m[1]));
        }
      }
      return [...seen].sort((a, b) => a - b);
    });
    for (let i = 0; i < 16; i++) {
      expect(colorsCovered).toContain(i);
    }
  });

  test('unknown non-SGR CSI is silently swallowed', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, `echo a${ESC}[2Jb`);
    const text = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return (
        (last?.querySelector('.out') as HTMLElement | null)?.innerText ?? ''
      );
    });
    expect(text.replace(/\s+$/, '')).toBe('ab');
  });
});
