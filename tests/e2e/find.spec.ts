import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('find', () => {
  test('lists the dir itself plus every child', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find /etc');
    expect(out).toMatch(/^\/etc$/m);
    expect(out).toMatch(/^\/etc\/hostname$/m);
  });

  test('no args defaults to cwd', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find');
    expect(out).toMatch(/^\.$/m);
  });

  test('-name filters by basename glob', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, "find /bin -name 'sh*'");
    const lines = out.split('\n').filter(l => l.startsWith('/bin/'));
    for (const l of lines) {
      const base = l.split('/').pop();
      expect(base?.startsWith('sh')).toBe(true);
    }
    expect(out).not.toMatch(/^\/bin$/m);
  });

  test('-type d returns only directories', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find / -type d');
    expect(out).toMatch(/^\/$/m);
    expect(out).toMatch(/^\/etc$/m);
    expect(out).not.toMatch(/^\/etc\/hostname$/m);
  });

  test('-type f returns only files', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find /etc -type f');
    expect(out).toMatch(/^\/etc\/hostname$/m);
    expect(out).not.toMatch(/^\/etc$/m);
  });

  test('-maxdepth 0 emits only the start path', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find /etc -maxdepth 0');
    const lines = out.split('\n').filter(l => l.length > 0);
    expect(lines).toEqual(['/etc']);
  });

  test('-maxdepth 1 adds only first-level children', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find /bin -maxdepth 1');
    expect(out).toMatch(/^\/bin$/m);
    // an executable like /bin/ls exists at depth 1
    expect(out).toMatch(/^\/bin\/ls$/m);
  });

  test('missing path reports ENOENT', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find /nope');
    expect(out).toMatch(/No such file or directory/);
  });

  test('permission-denied subtree is skipped without aborting', async ({
    page,
  }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'find /root');
    expect(out).toMatch(/Permission denied/);
  });

  test('-name without a value reports missing argument', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'find / -name')).toMatch(/missing argument/);
  });

  test('-type with an unknown value is rejected', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'find / -type z')).toMatch(/unknown type/);
  });

  test('-maxdepth non-integer is rejected', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'find / -maxdepth abc')).toMatch(
      /invalid maxdepth/
    );
  });
});
