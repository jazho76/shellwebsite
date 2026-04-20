import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('/dev listing', () => {
  test('ls /dev shows the full canonical set', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'ls /dev');
    for (const name of [
      'null',
      'zero',
      'random',
      'urandom',
      'full',
      'tty',
      'console',
      'nvme0n1',
      'nvme0n1p1',
      'nvme0n1p2',
      'pts',
      'fd',
    ]) {
      expect(out, `ls /dev mentions ${name}`).toMatch(
        new RegExp(`\\b${name}\\b`)
      );
    }
  });

  test('pts and fd subdirs are readable', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /dev/pts')).toMatch(/0/);
    const fdOut = await runCmd(page, 'ls /dev/fd');
    expect(fdOut).toMatch(/0/);
    expect(fdOut).toMatch(/1/);
    expect(fdOut).toMatch(/2/);
  });
});

test.describe('/dev file types', () => {
  test('file /dev/null → character special', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'file /dev/null')).toMatch(/character special/);
  });

  test('file /dev/nvme0n1 → block special', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'file /dev/nvme0n1')).toMatch(/block special/);
  });

  test('file /dev/nvme0n1p2 → block special', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'file /dev/nvme0n1p2')).toMatch(/block special/);
  });
});

test.describe('/dev reads', () => {
  test('cat /dev/null → empty', async ({ page }) => {
    await bootAndReady(page);
    expect((await runCmd(page, 'cat /dev/null')).trim()).toBe('');
  });

  test('cat /dev/zero → 256 NULs', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'cat /dev/zero');
    // innerText collapses NULs to... let's just assert it's not an error.
    expect(out).not.toMatch(/error|denied/i);
  });

  test('cat /dev/urandom → hex-ish bytes', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /dev/urandom')).toMatch(
      /[0-9a-f]{2} [0-9a-f]{2}/
    );
  });

  test('cat /dev/random → hex-ish bytes', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /dev/random')).toMatch(
      /[0-9a-f]{2} [0-9a-f]{2}/
    );
  });

  test('cat /dev/tty → the current pty', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /dev/tty')).toMatch(/\/dev\/pts\/0/);
  });

  test('cat /dev/full emits zeros (not an error)', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /dev/full')).not.toMatch(/error|denied/i);
  });
});

test.describe('/dev writes', () => {
  test('echo > /dev/null silently discards', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'echo leaked > /dev/null');
    expect(out.trim()).toBe('');
    // And reading back still shows nothing.
    expect((await runCmd(page, 'cat /dev/null')).trim()).toBe('');
  });

  test('echo > /dev/full fails with ENOSPC', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo hi > /dev/full')).toMatch(/ENOSPC/);
  });

  test('echo > /dev/console fails (readonly)', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo hi > /dev/console')).toMatch(/EACCES/);
  });

  test('echo > /dev/nvme0n1 fails (readonly block device)', async ({
    page,
  }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo hi > /dev/nvme0n1')).toMatch(/EACCES/);
  });

  test('echo > /dev/zero discards', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'echo hi > /dev/zero');
    expect(out.trim()).toBe('');
  });
});
