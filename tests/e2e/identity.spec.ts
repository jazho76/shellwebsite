import { expect, test } from '@playwright/test';
import { awaitRoot, bootAndReady, ident, runCmd } from '../fixtures/harness.js';

test.describe('identity', () => {
  test('default identity is guest, uid 1000', async ({ page }) => {
    await bootAndReady(page);
    expect(await ident(page)).toMatch(/^guest@\S+$/);
    expect(await runCmd(page, 'id')).toMatch(/uid=1000\(guest\)/);
  });

  test('/tmp/.pwn escalates to root', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, '/tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
    expect(await ident(page)).toMatch(/^root@\S+$/);
    expect(await runCmd(page, 'id')).toMatch(/uid=0\(root\)/);
  });

  test('root prompt uses #', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, '/tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
    const priv = await page.evaluate(
      () => document.querySelector('#input-line .priv')?.textContent
    );
    expect(priv).toBe('#');
  });

  test('root can read the flag; guest cannot', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /root/flag.txt')).toMatch(
      /Permission denied/
    );
    await runCmd(page, '/tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
    const rootRead = await runCmd(page, 'cat /root/flag.txt');
    expect(rootRead).not.toMatch(/permission denied/i);
    expect(rootRead.trim().length).toBeGreaterThan(0);
  });

  test('exit as root drops back to guest and $HOME', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, '/tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
    await runCmd(page, 'exit');
    expect(await ident(page)).toMatch(/^guest@\S+$/);
    expect(await runCmd(page, 'pwd')).toContain('/home/guest');
  });
});
