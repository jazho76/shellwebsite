import { expect, test } from '@playwright/test';
import { allOutput, bootAndReady } from '../fixtures/harness.js';

test.describe('easter eggs', () => {
  test('rm -rf / plays the shutdown animation and recovers', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await bootAndReady(page);
    await page.evaluate(() => {
      const input = document.getElementById('input') as HTMLInputElement;
      input.focus();
      input.value = 'rm -rf /';
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });
    let saw = false;
    for (let i = 0; i < 60; i++) {
      if (
        (await page.evaluate(() => document.body.className)).includes('rm-egg')
      ) {
        saw = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    expect(saw).toBe(true);
    await page.waitForTimeout(7_000);
    expect(await allOutput(page)).toContain('just kidding');
  });
});
