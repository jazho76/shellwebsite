import { expect, test } from '@playwright/test';
import { bootAndReady, runCmd } from '../fixtures/harness.js';

const scratch = (key: string) => `/tmp/fs_${key}`;

test.describe('mkdir', () => {
  test('creates a directory visible to ls', async ({ page }) => {
    await bootAndReady(page);
    const dir = scratch('mk_basic');
    await runCmd(page, `mkdir ${dir}`);
    expect(await runCmd(page, `ls /tmp`)).toMatch(/fs_mk_basic/);
  });

  test('without -p, missing parent → error', async ({ page }) => {
    await bootAndReady(page);
    expect(
      await runCmd(page, `mkdir ${scratch('mkmissing')}/nested/leaf`)
    ).toMatch(/No such file or directory/);
  });

  test('without -p, existing target → error', async ({ page }) => {
    await bootAndReady(page);
    const dir = scratch('mk_exists');
    await runCmd(page, `mkdir ${dir}`);
    expect(await runCmd(page, `mkdir ${dir}`)).toMatch(/File exists/);
  });

  test('-p creates a chain of ancestors', async ({ page }) => {
    await bootAndReady(page);
    const root = scratch('mkp_chain');
    await runCmd(page, `mkdir -p ${root}/a/b/c`);
    expect(await runCmd(page, `ls ${root}/a/b`)).toMatch(/c/);
  });

  test('-p is idempotent on an existing dir', async ({ page }) => {
    await bootAndReady(page);
    const dir = scratch('mkp_idem');
    await runCmd(page, `mkdir -p ${dir}/a`);
    const out = await runCmd(page, `mkdir -p ${dir}/a`);
    expect(out.trim()).toBe('');
  });

  test('/etc/foo denies for guest', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, `mkdir /etc/guestdir`)).toMatch(
      /Permission denied/
    );
  });

  test('multi-arg creates each', async ({ page }) => {
    await bootAndReady(page);
    const a = scratch('mk_multi_a');
    const b = scratch('mk_multi_b');
    await runCmd(page, `mkdir ${a} ${b}`);
    const ls = await runCmd(page, `ls /tmp`);
    expect(ls).toMatch(/fs_mk_multi_a/);
    expect(ls).toMatch(/fs_mk_multi_b/);
  });
});

test.describe('touch', () => {
  test('creates an empty file', async ({ page }) => {
    await bootAndReady(page);
    const p = `${scratch('touch_empty')}`;
    await runCmd(page, `mkdir -p ${p}`);
    const f = `${p}/new`;
    await runCmd(page, `touch ${f}`);
    expect((await runCmd(page, `cat ${f}`)).trim()).toBe('');
  });

  test('preserves existing content', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('touch_keep');
    await runCmd(page, `mkdir -p ${p}`);
    const f = `${p}/note`;
    await runCmd(page, `echo hello > ${f}`);
    await runCmd(page, `touch ${f}`);
    expect((await runCmd(page, `cat ${f}`)).trim()).toBe('hello');
  });

  test('denied target surfaces error', async ({ page }) => {
    await bootAndReady(page);
    expect(await runCmd(page, `touch /etc/newfile`)).toMatch(
      /Permission denied/
    );
  });

  test('multi-arg touches each', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('touch_multi');
    await runCmd(page, `mkdir -p ${p}`);
    await runCmd(page, `touch ${p}/a ${p}/b ${p}/c`);
    const ls = await runCmd(page, `ls ${p}`);
    expect(ls).toMatch(/a/);
    expect(ls).toMatch(/b/);
    expect(ls).toMatch(/c/);
  });
});

test.describe('cp', () => {
  test('copies a file to a new path', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('cp_file');
    await runCmd(page, `mkdir -p ${p}`);
    await runCmd(page, `cp /etc/hostname ${p}/host`);
    expect((await runCmd(page, `cat ${p}/host`)).trim()).toBe('jpinillos.dev');
  });

  test('source is preserved', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('cp_preserve');
    await runCmd(page, `mkdir -p ${p}`);
    await runCmd(page, `echo alive > ${p}/src`);
    await runCmd(page, `cp ${p}/src ${p}/copy`);
    expect((await runCmd(page, `cat ${p}/src`)).trim()).toBe('alive');
  });

  test('copying into an existing dir uses basename', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('cp_into_dir');
    await runCmd(page, `mkdir -p ${p}/dest`);
    await runCmd(page, `cp /etc/hostname ${p}/dest`);
    expect((await runCmd(page, `cat ${p}/dest/hostname`)).trim()).toBe(
      'jpinillos.dev'
    );
  });

  test('dir source without -r errors and does not copy', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('cp_nor');
    await runCmd(page, `mkdir -p ${p}/src`);
    await runCmd(page, `echo in > ${p}/src/f`);
    expect(await runCmd(page, `cp ${p}/src ${p}/dst`)).toMatch(
      /-r not specified/
    );
  });

  test('cp -r copies directory tree', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('cp_recurse');
    await runCmd(page, `mkdir -p ${p}/src/inner`);
    await runCmd(page, `echo outer > ${p}/src/a`);
    await runCmd(page, `echo deep > ${p}/src/inner/b`);
    await runCmd(page, `cp -r ${p}/src ${p}/dst`);
    expect((await runCmd(page, `cat ${p}/dst/a`)).trim()).toBe('outer');
    expect((await runCmd(page, `cat ${p}/dst/inner/b`)).trim()).toBe('deep');
  });

  test('multi-source into destdir', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('cp_multi');
    await runCmd(page, `mkdir -p ${p}/dest`);
    await runCmd(page, `echo a > ${p}/a`);
    await runCmd(page, `echo b > ${p}/b`);
    await runCmd(page, `cp ${p}/a ${p}/b ${p}/dest`);
    expect((await runCmd(page, `cat ${p}/dest/a`)).trim()).toBe('a');
    expect((await runCmd(page, `cat ${p}/dest/b`)).trim()).toBe('b');
  });

  test('refuses copying a directory into its own subdirectory', async ({
    page,
  }) => {
    await bootAndReady(page);
    const p = scratch('cp_selfrec');
    await runCmd(page, `mkdir -p ${p}/dir`);
    expect(await runCmd(page, `cp -r ${p}/dir ${p}/dir/inside`)).toMatch(
      /cannot copy.*into itself/
    );
  });

  test('reading a denied file → stderr', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('cp_denied');
    await runCmd(page, `mkdir -p ${p}`);
    expect(await runCmd(page, `cp /etc/shadow ${p}/leak`)).toMatch(
      /Permission denied|EACCES/
    );
  });
});

test.describe('mv', () => {
  test('renames a file', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('mv_rename');
    await runCmd(page, `mkdir -p ${p}`);
    await runCmd(page, `echo hi > ${p}/a`);
    await runCmd(page, `mv ${p}/a ${p}/b`);
    expect((await runCmd(page, `cat ${p}/b`)).trim()).toBe('hi');
    expect(await runCmd(page, `cat ${p}/a`)).toMatch(/no such file/i);
  });

  test('moves into an existing dir', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('mv_into');
    await runCmd(page, `mkdir -p ${p}/dest`);
    await runCmd(page, `echo hi > ${p}/f`);
    await runCmd(page, `mv ${p}/f ${p}/dest`);
    expect((await runCmd(page, `cat ${p}/dest/f`)).trim()).toBe('hi');
    expect(await runCmd(page, `cat ${p}/f`)).toMatch(/no such file/i);
  });

  test('renames a directory', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('mv_dir');
    await runCmd(page, `mkdir -p ${p}/src`);
    await runCmd(page, `echo x > ${p}/src/a`);
    await runCmd(page, `mv ${p}/src ${p}/renamed`);
    expect((await runCmd(page, `cat ${p}/renamed/a`)).trim()).toBe('x');
    expect(await runCmd(page, `ls ${p}/src`)).toMatch(
      /no such file|cannot access/i
    );
  });

  test('refuses move into own subdirectory', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('mv_self');
    await runCmd(page, `mkdir -p ${p}/d`);
    expect(await runCmd(page, `mv ${p}/d ${p}/d/inside`)).toMatch(
      /subdirectory of itself/
    );
  });

  test('multi-source into destdir', async ({ page }) => {
    await bootAndReady(page);
    const p = scratch('mv_multi');
    await runCmd(page, `mkdir -p ${p}/dest`);
    await runCmd(page, `echo one > ${p}/a`);
    await runCmd(page, `echo two > ${p}/b`);
    await runCmd(page, `mv ${p}/a ${p}/b ${p}/dest`);
    expect((await runCmd(page, `cat ${p}/dest/a`)).trim()).toBe('one');
    expect((await runCmd(page, `cat ${p}/dest/b`)).trim()).toBe('two');
    expect(await runCmd(page, `cat ${p}/a`)).toMatch(/no such file/i);
  });
});
