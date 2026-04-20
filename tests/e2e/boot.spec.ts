import { expect, test } from '@playwright/test';
import { allOutput, bootAndReady, ident } from '../fixtures/harness.js';

test.describe('boot', () => {
  test('page loads and prompt becomes visible', async ({ page }) => {
    await bootAndReady(page);
    const hidden = await page.evaluate(() =>
      document.getElementById('input-line')!.classList.contains('hidden')
    );
    expect(hidden).toBe(false);
  });

  test('initial identity is guest', async ({ page }) => {
    await bootAndReady(page);
    expect(await ident(page)).toMatch(/^guest@\S+$/);
  });

  test('initial cwd is ~ (home)', async ({ page }) => {
    await bootAndReady(page);
    const cwd = await page.evaluate(
      () => document.querySelector('#input-line .cwd')?.textContent ?? ''
    );
    expect(cwd).toBe('~');
  });

  test('greet auto-runs `welcome`', async ({ page }) => {
    await bootAndReady(page);
    const out = await allOutput(page);
    expect(out.trim().length).toBeGreaterThan(0);
  });

  test('no BIOS splash on non-reboot load', async ({ page }) => {
    await bootAndReady(page);
    const out = await allOutput(page);
    expect(out).not.toContain('InsydeH2O');
    expect(out).not.toContain('POST completed');
  });
});
