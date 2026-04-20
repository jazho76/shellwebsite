import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('mounts: guest can read public mounts', () => {
  const cases: Array<[string, RegExp]> = [
    ['ls /etc', /hostname/],
    ['ls /home', /guest/],
    ['ls /usr/share/fortune', /cookies/],
    ['ls /var/log', /syslog/],
    ['ls /dev', /urandom/],
    ['ls -a /tmp', /\.pwn/],
    ['ls /proc', /uptime/],
    ['ls /bin', /\bls\b/],
  ];
  for (const [cmd, re] of cases) {
    test(cmd, async ({ page }) => {
      await bootAndReady(page);
      expect(await runCmd(page, cmd)).toMatch(re);
    });
  }
});

test.describe('mounts: content reads', () => {
  test('/proc/cpuinfo includes Ryzen', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /proc/cpuinfo')).toMatch(/Ryzen/);
  });

  test('/proc/uptime emits a number of seconds', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /proc/uptime')).toMatch(/\d+ seconds/);
  });

  test('/dev/urandom returns hex bytes', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /dev/urandom')).toMatch(
      /[0-9a-f]{2} [0-9a-f]{2}/
    );
  });

  test('/var/log/syslog has kernel lines', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /var/log/syslog')).toMatch(/Linux version/);
  });

  test('/etc/os-release identifies Arch', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /etc/os-release')).toMatch(/Arch Linux/);
  });
});

test.describe('mounts: permission denials', () => {
  test('ls /root denied for guest', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /root')).toMatch(/Permission denied/);
  });

  test('cat /root/flag.txt denied for guest', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /root/flag.txt')).toMatch(
      /Permission denied/
    );
  });

  test('cat /etc/shadow denied for guest', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /etc/shadow')).toMatch(/Permission denied/);
  });
});
