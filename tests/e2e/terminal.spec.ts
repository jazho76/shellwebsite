import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd, tab, tabTwice } from '../fixtures/harness.js';

test.describe('tab completion: first word', () => {
  test('"hel" → "help "', async ({ page }) => {
    await bootAndReady(page);
    expect(await tab(page, 'hel')).toBe('help ');
  });

  test('"ab" → "about "', async ({ page }) => {
    await bootAndReady(page);
    expect(await tab(page, 'ab')).toBe('about ');
  });

  test('".p" → no match (no .pwn in $PATH)', async ({ page }) => {
    await bootAndReady(page);
    expect(await tab(page, '.p')).toBe('.p');
  });

  test('"k" stays "k" on single Tab (ambiguous kill/koan)', async ({
    page,
  }) => {
    await bootAndReady(page);
    expect(await tab(page, 'k')).toBe('k');
  });

  test('double Tab on "k" lists kill and koan', async ({ page }) => {
    await bootAndReady(page);
    const out = await tabTwice(page, 'k');
    expect(out).toMatch(/kill/);
    expect(out).toMatch(/koan/);
  });
});

test.describe('tab completion: paths', () => {
  test('"ls /et" → "ls /etc/"', async ({ page }) => {
    await bootAndReady(page);
    expect(await tab(page, 'ls /et')).toBe('ls /etc/');
  });

  test('"ls /tmp/.p" completes the file', async ({ page }) => {
    await bootAndReady(page);
    expect(await tab(page, 'ls /tmp/.p')).toMatch(/\/tmp\/\.pwn/);
  });
});

test.describe('input keybindings', () => {
  test('ArrowUp recalls previous command', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'echo probe-token');
    await page.evaluate(() => {
      const input = document.getElementById('input') as HTMLInputElement;
      input.focus();
      input.value = '';
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
      );
    });
    await page.waitForTimeout(100);
    const recalled = await page.evaluate(
      () => (document.getElementById('input') as HTMLInputElement).value
    );
    expect(recalled).toContain('probe-token');
  });

  test('Ctrl+L clears the terminal', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'echo before-clear');
    const before = await page.evaluate(
      () => document.getElementById('output')!.innerText
    );
    expect(before).toContain('before-clear');
    await page.evaluate(() => {
      const input = document.getElementById('input') as HTMLInputElement;
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true })
      );
    });
    await page.waitForTimeout(100);
    const after = await page.evaluate(
      () => document.getElementById('output')!.innerText
    );
    expect(after).not.toContain('before-clear');
  });
});
