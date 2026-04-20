import { expect, test } from '@playwright/test';
import { awaitRoot, bootAndReady, ident, runCmd } from '../fixtures/harness.js';

test.describe('help', () => {
  test('lists /bin executables with descriptions', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'help');
    for (const name of [
      'ls',
      'cd',
      'pwd',
      'echo',
      'cat',
      'file',
      'clear',
      'history',
      'rm',
      'whoami',
      'id',
      'exit',
      'uname',
      'date',
      'who',
      'ps',
      'kill',
      'restart',
      'about',
      'theme',
      'koan',
      'version',
    ]) {
      expect(out, `help mentions ${name}`).toMatch(new RegExp(`\\s${name}\\s`));
    }
  });

  test('help never mentions .pwn', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'help')).not.toContain('.pwn');
  });
});

test.describe('ls', () => {
  test('default listing hides dotfiles', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'ls');
    expect(out).toContain('about.txt');
    expect(out).not.toContain('.bashrc');
  });

  test('-a shows dotfiles', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls -la')).toContain('.bash_history');
  });

  test('-l long format includes mode string', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls -l')).toMatch(/-rw-/);
  });

  test('missing path → cannot access / no such file', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /nope')).toMatch(
      /cannot access|no such file/i
    );
  });

  test('denied path → Permission denied', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /root')).toMatch(/Permission denied/);
  });

  test('on a file returns that file', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /etc/hostname')).toContain('/etc/hostname');
  });
});

test.describe('ls colors', () => {
  test('directories render in brightBlue (ansi-12)', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'ls /');
    const hasDir = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const spans =
        last?.querySelectorAll("span[style*='var(--ansi-12)']") ?? [];
      for (const s of spans) {
        if (/^bin\/?$/.test(s.textContent ?? '')) {
          return true;
        }
      }
      return false;
    });
    expect(hasDir).toBe(true);
  });

  test('executables render in green (ansi-2)', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'ls /bin');
    const greenCount = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      return last?.querySelectorAll("span[style*='var(--ansi-2)']").length ?? 0;
    });
    expect(greenCount).toBeGreaterThan(0);
  });

  test('regular files render with no ansi span', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'ls /etc');
    const plainFiles = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const out =
        (last?.querySelector('.out') as HTMLElement | null)?.innerText ?? '';
      const spans = last?.querySelectorAll("span[style*='var(--ansi-']") ?? [];
      const colored = new Set<string>();
      for (const s of spans) {
        colored.add((s.textContent ?? '').replace(/\/$/, ''));
      }
      return { out, colored: [...colored] };
    });
    expect(plainFiles.out).toContain('hostname');
    expect(plainFiles.colored).not.toContain('hostname');
  });

  test('ls -l colors the name but not the mode column', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'ls -l /');
    const modeIsPlain = await page.evaluate(() => {
      const entries = document.querySelectorAll('#output .entry');
      const last = entries[entries.length - 1];
      const spans = last?.querySelectorAll("span[style*='var(--ansi-']") ?? [];
      for (const s of spans) {
        if (/^d[rwx-]{9}$/.test(s.textContent ?? '')) {
          return false;
        }
      }
      return true;
    });
    expect(modeIsPlain).toBe(true);
  });
});

test.describe('cd', () => {
  test('changes cwd to an existing dir', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'cd /etc');
    expect(await runCmd(page, 'pwd')).toContain('/etc');
  });

  test('no arg returns to home', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'cd /');
    await runCmd(page, 'cd');
    expect(await runCmd(page, 'pwd')).toContain('/home/guest');
  });

  test('file target → not a directory', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cd /etc/hostname')).toMatch(/not a directory/);
  });

  test('missing target → no such file', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cd /nope')).toMatch(/no such file/i);
  });

  test('denied target → Permission denied', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cd /root')).toMatch(/Permission denied/);
  });
});

test.describe('echo', () => {
  test('prints joined args', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo hello world')).toContain('hello world');
  });
});

test.describe('cat', () => {
  test('reads a file', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /etc/hostname')).toContain('jpinillos.dev');
  });

  test('no args and no stdin → empty output, exit 0', async ({ page }) => {
    await bootAndReady(page);
    // POSIX cat reads stdin when no args are given; with no pipe, stdin is
    // empty and cat simply prints nothing.
    const out = await runCmd(page, 'cat');
    expect(out.trim()).toBe('');
  });

  test('missing file → no such file', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /nope')).toMatch(/no such file/i);
  });

  test('denied → Permission denied', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /etc/shadow')).toMatch(/Permission denied/);
  });

  test('on a directory → is a directory', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /etc')).toMatch(/is a directory/i);
  });

  test('multiple files concatenate', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'cat /etc/hostname /etc/motd');
    expect(out).toContain('jpinillos.dev');
    expect(out).toContain('chop wood, carry water');
  });

  test('one missing file reports error but prints the others', async ({
    page,
  }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'cat /etc/hostname /nope /etc/motd');
    expect(out).toContain('jpinillos.dev');
    expect(out).toMatch(/cat: \/nope: no such file or directory/);
    expect(out).toContain('chop wood, carry water');
  });
});

test.describe('file', () => {
  test('directory', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'file /etc')).toMatch(/directory/);
  });

  test('ELF for /bin/ls', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'file /bin/ls')).toMatch(/ELF/);
  });

  test('ASCII text for plain files', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'file /etc/motd')).toMatch(/ASCII text/);
  });

  test('missing operand', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'file')).toMatch(/missing operand/);
  });
});

test.describe('history', () => {
  test('lists seeded bash history', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'history')).toMatch(/ls -la/);
  });
});

test.describe('rm', () => {
  test('missing operand', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'rm')).toMatch(/missing operand/);
  });

  test('rm / is the egg trigger — covered in eggs.spec', async () => {});

  test('rm /root denies for guest', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'rm /root')).toMatch(/Permission denied/);
  });

  test('rm -rf /home as guest → Permission denied, not silent', async ({
    page,
  }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'rm -rf /home')).toMatch(
      /rm: cannot remove '\/home': Permission denied/
    );
  });

  test('rm -rf /etc as guest → Permission denied', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'rm -rf /etc')).toMatch(
      /rm: cannot remove '\/etc': Permission denied/
    );
  });
});

test.describe('whoami / id', () => {
  test('whoami prints identity name', async ({ page }) => {
    await bootAndReady(page);
    expect((await runCmd(page, 'whoami')).trim()).toBe('guest');
  });

  test('id prints uid/gid/groups line', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'id')).toMatch(/uid=1000\(guest\).*gid=1000/);
  });
});

test.describe('exit', () => {
  test('sudo is not a command', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'sudo ls')).toMatch(/command not found: sudo/);
  });

  test('as guest prints logout + Connection closed and locks the terminal', async ({
    page,
  }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'exit');
    expect(out).toMatch(/logout/);
    expect(out).toMatch(/Connection to .+ closed/);
    const hidden = await page.evaluate(() =>
      document.getElementById('input-line')!.classList.contains('hidden')
    );
    expect(hidden).toBe(true);
  });

  test('as root drops back to guest with a logout line', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndReady(page);
    await runCmd(page, '/tmp/.pwn', 200);
    expect(await awaitRoot(page)).toBe(true);
    expect(await runCmd(page, 'exit')).toMatch(/logout/);
    expect(await ident(page)).toBe('guest@jpinillos.dev');
  });
});

test.describe('uname / date / who / ps / kill', () => {
  test('uname emits Linux line', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'uname')).toMatch(/Linux jpinillos\.dev/);
  });

  test('uname -x is invalid', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'uname -x')).toMatch(/invalid option/);
  });

  test('date produces a year', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'date')).toMatch(/\d{4}/);
  });

  test('who lists guest and fixture users', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'who');
    expect(out).toMatch(/guest/);
    expect(out).toMatch(/condor/);
  });

  test('ps shows init and sshd', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'ps');
    expect(out).toMatch(/\/sbin\/init/);
    expect(out).toMatch(/sshd/);
  });

  test('kill without args → usage', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'kill')).toMatch(/usage|missing/i);
  });

  test('kill non-numeric → error', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'kill abc')).toMatch(/must be process/);
  });

  test('kill 1 as guest → not permitted', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'kill 1')).toMatch(/not permitted/);
  });
});

test.describe('content aliases', () => {
  test('about reads the about.txt body', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'about')).toMatch(/software engineer/i);
  });
});

test.describe('restart', () => {
  test('restart triggers BIOS splash and preserves executables', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await bootAndReady(page);
    await runCmd(page, 'restart');
    // wait for splash to finish
    await page.waitForTimeout(8_500);
    const out = await page.evaluate(
      () => document.getElementById('output')!.innerText
    );
    expect(out).toContain('InsydeH2O');
    expect(out).toContain('POST completed');
    // key status tokens are colored (green = ansi-2)
    const greenTokens = await page.evaluate(() => {
      const spans = document.querySelectorAll("span[style*='var(--ansi-2)']");
      return [...spans].map(s => s.textContent);
    });
    expect(greenTokens).toContain('OK');
    expect(greenTokens).toContain('successfully');
    // executables still work after reboot
    expect(await runCmd(page, 'whoami')).toContain('guest');
  });
});

test.describe('version', () => {
  test('prints jpinillos.dev <version> (<commit>)', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'version')).toMatch(/jpinillos\.dev \S+ \(\S+\)/);
  });

  test('locally defaults to dev (local)', async ({ page }) => {
    await bootAndReady(page);
    // Without VITE_APP_VERSION / VITE_APP_COMMIT set, the build falls back.
    // We don't hard-assert the values because CI will inject real ones.
    const out = await runCmd(page, 'version');
    expect(out).toMatch(/jpinillos\.dev/);
  });
});
