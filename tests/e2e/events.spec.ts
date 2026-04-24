import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('kernel events', () => {
  test('boot-ready fires on initial load (bash-history seeds)', async ({
    page,
  }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'history');
    expect(out).toMatch(/ls -la/);
    expect(out).toMatch(/\/tmp\/\.pwn/);
    expect(out).toMatch(/sudo su/);
  });

  test('boot-ready fires again on restart (BIOS splash visible)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await bootAndReady(page);
    await runCmd(page, 'restart');
    await page.waitForTimeout(8_500);
    const out = await page.evaluate(
      () => document.getElementById('output')!.innerText
    );
    expect(out).toContain('InsydeH2O');
  });
});
