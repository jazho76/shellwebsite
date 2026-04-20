import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('theme command', () => {
  test('boot starts with tokyo-night theme applied', async ({ page }) => {
    await bootAndReady(page);
    expect(await page.evaluate(() => document.body.dataset.theme)).toBe(
      'tokyo-night'
    );
  });

  test('theme (no args) lists all themes and marks current', async ({
    page,
  }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'theme');
    expect(out).toMatch(/\*\s+tokyo-night/);
    for (const name of [
      'crt',
      'cappuccino',
      'dracula',
      'nord',
      'gruvbox',
      'graphite',
      'matrix',
      'synthwave',
    ]) {
      expect(out).toContain(name);
    }
  });

  for (const name of [
    'dracula',
    'nord',
    'gruvbox',
    'tokyo-night',
    'matrix',
    'synthwave',
  ]) {
    test(`theme ${name} applies the ${name} theme`, async ({ page }) => {
      await bootAndReady(page);
      await runCmd(page, `theme ${name}`);
      expect(await page.evaluate(() => document.body.dataset.theme)).toBe(name);
    });
  }

  test('theme crt applies the crt theme', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'theme crt');
    expect(await page.evaluate(() => document.body.dataset.theme)).toBe('crt');
  });

  test('theme cappuccino applies the cappuccino theme', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'theme cappuccino');
    expect(await page.evaluate(() => document.body.dataset.theme)).toBe(
      'cappuccino'
    );
  });

  test('theme graphite switches to graphite', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'theme crt');
    await runCmd(page, 'theme graphite');
    expect(await page.evaluate(() => document.body.dataset.theme)).toBe(
      'graphite'
    );
  });

  test('unknown theme name surfaces an error', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'theme solarized')).toMatch(
      /unknown theme 'solarized'/
    );
  });

  test('CSS variables actually change when theme switches', async ({
    page,
  }) => {
    await bootAndReady(page);
    const defaultBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    await runCmd(page, 'theme cappuccino');
    const cappuccinoBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    expect(defaultBg).not.toBe(cappuccinoBg);
  });

  test('bare `crt` is not a command (theme crt is the single entry point)', async ({
    page,
  }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'crt')).toMatch(/command not found: crt/);
  });
});
