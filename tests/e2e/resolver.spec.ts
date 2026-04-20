import { expect, test } from '@playwright/test';
import { awaitRoot, bootAndReady, ident, runCmd } from '../fixtures/harness.js';

test.describe('resolver: bare names via $PATH', () => {
  const cases: Array<[string, RegExp]> = [
    ['help', /ls/],
    ['ls', /about\.txt/],
    ['pwd', /\/home\/guest/],
    ['whoami', /guest/],
    ['id', /uid=1000/],
    ['echo hi', /hi/],
    ['cat /etc/hostname', /jpinillos\.dev/],
    ['uname', /Linux/],
    ['date', /\d{4}/],
    ['file /bin/ls', /ELF/],
    ['koan', /\S/],
    ['about', /software engineer/i],
  ];
  for (const [cmd, re] of cases) {
    test(`bare \`${cmd}\``, async ({ page }) => {
      await bootAndReady(page);
      expect(await runCmd(page, cmd)).toMatch(re);
    });
  }

  test('unknown command → command not found', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'foobarbaz')).toMatch(/command not found/);
  });
});

test.describe('resolver: /bin/<name> absolute path', () => {
  const cases: Array<[string, RegExp]> = [
    ['/bin/help', /ls/],
    ['/bin/ls', /about\.txt/],
    ['/bin/pwd', /\/home\/guest/],
    ['/bin/whoami', /guest/],
    ['/bin/id', /uid=1000/],
    ['/bin/uname', /Linux/],
    ['/bin/ps', /sshd/],
    ['/bin/who', /guest/],
    ['/bin/date', /\d{4}/],
    ['/bin/history', /ls -la/],
    ['/bin/koan', /\S/],
    ['/bin/about', /software engineer/i],
    ['/bin/exit', /logout/],
    ['/bin/rm', /missing operand/],
  ];
  for (const [cmd, re] of cases) {
    test(`\`${cmd}\``, async ({ page }) => {
      await bootAndReady(page);
      expect(await runCmd(page, cmd)).toMatch(re);
    });
  }
});

test.describe('resolver: .pwn path scoping', () => {
  for (const cwd of [
    '/',
    '/etc',
    '/home',
    '/home/guest',
    '/proc',
    '/usr',
    '/var',
    '/tmp',
  ]) {
    test(`bare .pwn from ${cwd} is not found`, async ({ page }) => {
      await bootAndReady(page);
      await runCmd(page, `cd ${cwd}`);
      expect(await runCmd(page, '.pwn')).toMatch(/command not found: \.pwn/);
      expect(await ident(page)).toBe('guest@jpinillos.dev');
    });
  }
});

test.describe('resolver: /tmp/.pwn path variants escalate', () => {
  test('/tmp/.pwn from /', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, 'cd /');
    await runCmd(page, '/tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
  });

  test('./.pwn from /tmp', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, 'cd /tmp');
    await runCmd(page, './.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
  });

  test('/tmp/./.pwn normalizes and escalates', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, 'cd /');
    await runCmd(page, '/tmp/./.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
  });

  test('/etc/../tmp/.pwn normalizes and escalates', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, 'cd /');
    await runCmd(page, '/etc/../tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
  });

  test('../tmf/../tmp/.pwn from /home escalates', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, 'cd /home');
    await runCmd(page, '../tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
  });
});
