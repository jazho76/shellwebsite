import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

test.describe('quoting', () => {
  test('double quotes strip around arg', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo "hello world"')).toMatch(/^hello world$/m);
  });

  test('single quotes prevent $ expansion', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, "echo 'no $HOME here'")).toMatch(
      /no \$HOME here/
    );
  });

  test('backslash escape outside quotes', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo a\\ b\\ c')).toMatch(/a b c/);
  });
});

test.describe('variable expansion', () => {
  test('$HOME expands', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo $HOME')).toMatch(/\/home\/guest/);
  });

  test('${USER} braces expand', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo ${USER}')).toMatch(/^guest$/m);
  });

  test('unknown var expands to empty string', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo before $NOPE after')).toMatch(
      /^before\s+after\s*$/m
    );
  });

  test('$? reflects previous exit code', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'true');
    expect((await runCmd(page, 'echo $?')).trim()).toBe('0');
    await runCmd(page, 'false');
    expect((await runCmd(page, 'echo $?')).trim()).toBe('1');
  });

  test('double quotes allow expansion', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo "user=$USER"')).toMatch(/user=guest/);
  });
});

test.describe('chaining', () => {
  test('semicolon runs sequentially', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'echo first; echo second');
    expect(out).toMatch(/first/);
    expect(out).toMatch(/second/);
  });

  test('&& runs second only if first succeeds', async ({ page }) => {
    await bootAndReady(page);
    const okChain = await runCmd(page, 'true && echo yes');
    expect(okChain).toMatch(/yes/);
    const failChain = await runCmd(page, 'false && echo nope');
    expect(failChain).not.toMatch(/nope/);
  });

  test('|| runs second only if first fails', async ({ page }) => {
    await bootAndReady(page);
    const failRescue = await runCmd(page, 'false || echo rescue');
    expect(failRescue).toMatch(/rescue/);
    const okSkip = await runCmd(page, 'true || echo nope');
    expect(okSkip).not.toMatch(/nope/);
  });

  test('mixed && and ||', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'false && echo skipped || echo rescued');
    expect(out).toMatch(/rescued/);
    expect(out).not.toMatch(/skipped/);
  });
});

test.describe('pipes', () => {
  test('grep filters piped lines', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /etc/passwd | grep root')).toMatch(/root/);
  });

  test('grep -v inverts', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'cat /etc/passwd | grep -v root');
    expect(out).not.toMatch(/root/);
    expect(out).toMatch(/guest/);
  });

  test('wc -l counts stdin lines', async ({ page }) => {
    await bootAndReady(page);
    // /etc/passwd has 2 internal newlines; cat appends one → wc sees 3.
    const out = await runCmd(page, 'cat /etc/passwd | wc -l');
    expect(out.trim()).toBe('3');
  });

  test('three-stage pipeline', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'cat /etc/passwd | grep root | wc -l');
    expect(out.trim()).toBe('1');
  });
});

test.describe('redirection', () => {
  test('> writes stdout to a file', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'cd /tmp');
    await runCmd(page, 'echo hello > out');
    expect(await runCmd(page, 'cat out')).toMatch(/^hello$/m);
  });

  test('>> appends', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'cd /tmp');
    await runCmd(page, 'echo first > log');
    await runCmd(page, 'echo second >> log');
    const out = await runCmd(page, 'cat log');
    expect(out).toMatch(/first/);
    expect(out).toMatch(/second/);
  });

  test('< reads from a file as stdin', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'wc -l < /etc/passwd')).toMatch(/^2$/m);
  });

  test('write denied → shell error', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'echo hi > /etc/hostname');
    expect(out).toMatch(/EACCES|Permission/);
  });
});

test.describe('parse errors', () => {
  test('unterminated double quote', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo "unterminated')).toMatch(
      /shell:.*unterminated/i
    );
  });

  test('empty command after pipe', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'echo hi |')).toMatch(/shell:.*empty/i);
  });
});

test.describe('true / false', () => {
  test('true exits 0', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'true');
    expect((await runCmd(page, 'echo $?')).trim()).toBe('0');
  });

  test('false exits 1', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'false');
    expect((await runCmd(page, 'echo $?')).trim()).toBe('1');
  });
});

test.describe('environment variables', () => {
  test('export FOO=bar then echo $FOO', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'export FOO=bar');
    expect((await runCmd(page, 'echo $FOO')).trim()).toBe('bar');
  });

  test('bare FOO=bar assignment persists', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'FOO=persist');
    expect((await runCmd(page, 'echo $FOO')).trim()).toBe('persist');
  });

  test('FOO=bar cmd scopes to one exec only', async ({ page }) => {
    await bootAndReady(page);
    expect((await runCmd(page, 'FOO=scoped echo $FOO')).trim()).toBe('scoped');
    expect((await runCmd(page, 'echo $FOO')).trim()).toBe('');
  });

  test('unset removes a variable', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'export FOO=bar');
    await runCmd(page, 'unset FOO');
    expect((await runCmd(page, 'echo $FOO')).trim()).toBe('');
  });

  test('env lists entries including HOME and PATH', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'env');
    expect(out).toMatch(/^HOME=\/home\/guest$/m);
    expect(out).toMatch(/^PATH=\/bin$/m);
    expect(out).toMatch(/^USER=guest$/m);
  });

  test('invalid identifier rejected by export', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'export 1FOO=bar')).toMatch(
      /not a valid identifier/
    );
  });

  test('empty PATH → commands not found', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'export PATH=');
    expect(await runCmd(page, 'whoami')).toMatch(/command not found/);
  });

  test('PATH pointing elsewhere → /bin commands stop resolving', async ({
    page,
  }) => {
    await bootAndReady(page);
    await runCmd(page, 'export PATH=/usr/local/bin');
    expect(await runCmd(page, 'whoami')).toMatch(/command not found/);
  });

  test('HOME override shadows the dynamic value', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'export HOME=/override');
    expect((await runCmd(page, 'echo $HOME')).trim()).toBe('/override');
    await runCmd(page, 'unset HOME');
    expect((await runCmd(page, 'echo $HOME')).trim()).toBe('/home/guest');
  });

  test('assignment with $ expansion in value', async ({ page }) => {
    await bootAndReady(page);
    await runCmd(page, 'export COPY=$USER');
    expect((await runCmd(page, 'echo $COPY')).trim()).toBe('guest');
  });
});

test.describe('globbing', () => {
  test('ls /etc/*.conf matches resolv.conf', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /etc/*.conf')).toMatch(/resolv\.conf/);
  });

  test('ls /etc/* lists children (no dotfiles)', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'ls /etc/*');
    expect(out).toMatch(/hostname/);
    expect(out).toMatch(/passwd/);
    expect(out).toMatch(/motd/);
  });

  test('? matches exactly one char', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /etc/pass?d')).toMatch(/passwd/);
  });

  test('[mp]* character class', async ({ page }) => {
    await bootAndReady(page);
    const out = await runCmd(page, 'ls /etc/[mp]*');
    expect(out).toMatch(/motd/);
    expect(out).toMatch(/passwd/);
    expect(out).not.toMatch(/hostname/);
  });

  test('echo "*" is literal', async ({ page }) => {
    await bootAndReady(page);
    expect((await runCmd(page, 'echo "*"')).trim()).toBe('*');
  });

  test("echo '*' is literal", async ({ page }) => {
    await bootAndReady(page);
    expect((await runCmd(page, "echo '*'")).trim()).toBe('*');
  });

  test('no matches → pattern preserved in error', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'ls /nonexistent/*.txt')).toMatch(
      /\/nonexistent\/\*\.txt/
    );
  });

  test('cat /etc/*release* reads os-release', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, 'cat /etc/*release*')).toMatch(/Arch Linux/);
  });
});
