import { describe, expect, test } from 'vitest';
import type { DirNode, FileNode, Mount } from '../../src/core/vfs.js';
import {
  canExec,
  canRead,
  canWrite,
  contentOf,
  createVfs,
  dir,
  file,
  HOME,
  treeMount,
} from '../../src/core/vfs.js';

const guest = { name: 'guest' };
const root = { name: 'root' };
const other = { name: 'mallory' };

describe('permission bits', () => {
  const node = file('', undefined, {
    owner: 'alice',
    group: 'staff',
    mode: 0o750,
  });

  test('root bypasses all checks', () => {
    const noAccess = file('', undefined, {
      owner: 'alice',
      group: 'staff',
      mode: 0o000,
    });
    expect(canRead(noAccess, 'root')).toBe(true);
    expect(canWrite(noAccess, 'root')).toBe(true);
    expect(canExec(noAccess, 'root')).toBe(true);
  });

  test('owner bits apply when user matches owner', () => {
    expect(canRead(node, 'alice')).toBe(true);
    expect(canWrite(node, 'alice')).toBe(true);
    expect(canExec(node, 'alice')).toBe(true);
  });

  test('group bits apply when user matches group name', () => {
    expect(canRead(node, 'staff')).toBe(true);
    expect(canWrite(node, 'staff')).toBe(false); // 0o750 group is r-x
    expect(canExec(node, 'staff')).toBe(true);
  });

  test('other bits apply when user matches neither', () => {
    expect(canRead(node, 'bob')).toBe(false);
    expect(canWrite(node, 'bob')).toBe(false);
    expect(canExec(node, 'bob')).toBe(false);
  });

  test('0o644 => owner rw, group r, other r', () => {
    const n = file('', undefined, { owner: 'a', group: 'g', mode: 0o644 });
    expect(canRead(n, 'a')).toBe(true);
    expect(canWrite(n, 'a')).toBe(true);
    expect(canExec(n, 'a')).toBe(false);
    expect(canWrite(n, 'g')).toBe(false);
    expect(canRead(n, 'x')).toBe(true);
    expect(canWrite(n, 'x')).toBe(false);
  });

  test('0o700 denies group and other entirely', () => {
    const n = file('', undefined, { owner: 'a', group: 'g', mode: 0o700 });
    expect(canRead(n, 'a')).toBe(true);
    expect(canRead(n, 'g')).toBe(false);
    expect(canRead(n, 'x')).toBe(false);
    expect(canExec(n, 'x')).toBe(false);
  });
});

describe('dir/file factories', () => {
  test('dir defaults to 0o755, owner/group root', () => {
    const d = dir({});
    expect(d.type).toBe('dir');
    expect(d.mode).toBe(0o755);
    expect(d.owner).toBe('root');
    expect(d.group).toBe('root');
  });

  test('file defaults to 0o644, owner/group root', () => {
    const f = file('hi');
    expect(f.type).toBe('file');
    expect(f.mode).toBe(0o644);
    expect(f.content).toBe('hi');
  });

  test('file fileType arg is preserved when provided, omitted when undefined', () => {
    expect(file('x', 'ASCII text').fileType).toBe('ASCII text');
    expect('fileType' in file('x')).toBe(false);
  });

  test('contentOf resolves function content lazily', () => {
    let calls = 0;
    const f = file(() => {
      calls++;
      return 'hello';
    });
    expect(calls).toBe(0);
    expect(contentOf(f)).toBe('hello');
    expect(contentOf(f)).toBe('hello');
    expect(calls).toBe(2);
  });

  test('opts override defaults', () => {
    const f = file('x', undefined, {
      owner: 'alice',
      group: 'staff',
      mode: 0o600,
    });
    expect(f.owner).toBe('alice');
    expect(f.group).toBe('staff');
    expect(f.mode).toBe(0o600);
  });
});

describe('treeMount', () => {
  const build = () =>
    dir(
      {
        hello: file('world', undefined, {
          owner: 'guest',
          group: 'guest',
          mode: 0o644,
        }),
        readonly: file('locked', undefined, {
          owner: 'root',
          group: 'root',
          mode: 0o400,
        }),
        sub: dir(
          {
            inner: file('nested', undefined, {
              owner: 'guest',
              group: 'guest',
              mode: 0o644,
            }),
          },
          { owner: 'guest', group: 'guest' }
        ),
        noperm: dir({}, { owner: 'root', group: 'root', mode: 0o700 }),
      },
      { owner: 'guest', group: 'guest', mode: 0o755 }
    );

  test('resolve walks a known path', () => {
    const m = treeMount('/m', build);
    const node = m.resolve('hello') as FileNode;
    expect(node.content).toBe('world');
  });

  test('resolve returns null for missing path', () => {
    const m = treeMount('/m', build);
    expect(m.resolve('missing')).toBeNull();
  });

  test('resolve returns null when walking through a file', () => {
    const m = treeMount('/m', build);
    expect(m.resolve('hello/nope')).toBeNull();
  });

  test('write creates a new file with owner/group from identity', () => {
    const m = treeMount('/m', build);
    const r = m.write!('fresh', 'payload', guest);
    expect(r.ok).toBe(true);
    const node = m.resolve('fresh') as FileNode;
    expect(node.content).toBe('payload');
    expect(node.owner).toBe('guest');
  });

  test('write overwrites existing file preserving perms', () => {
    const m = treeMount('/m', build);
    m.write!('hello', 'replaced', guest);
    const node = m.resolve('hello') as FileNode;
    expect(node.content).toBe('replaced');
    expect(node.mode).toBe(0o644);
    expect(node.owner).toBe('guest');
  });

  test('write on a directory returns EISDIR', () => {
    const m = treeMount('/m', build);
    const r = m.write!('sub', 'x', guest);
    expect(r).toEqual({ ok: false, error: 'EISDIR' });
  });

  test('write denied without parent write perm', () => {
    const m = treeMount('/m', build);
    const r = m.write!('noperm/file', 'x', guest);
    expect(r).toEqual({ ok: false, error: 'EACCES' });
  });

  test('write to missing parent returns ENOENT', () => {
    const m = treeMount('/m', build);
    const r = m.write!('ghost/file', 'x', guest);
    expect(r).toEqual({ ok: false, error: 'ENOENT' });
  });

  test('mkdir creates a new directory', () => {
    const m = treeMount('/m', build);
    const r = m.mkdir!('newdir', guest);
    expect(r.ok).toBe(true);
    const node = m.resolve('newdir') as DirNode;
    expect(node.type).toBe('dir');
    expect(node.owner).toBe('guest');
  });

  test('mkdir on existing name returns EEXIST', () => {
    const m = treeMount('/m', build);
    const r = m.mkdir!('hello', guest);
    expect(r).toEqual({ ok: false, error: 'EEXIST' });
  });

  test('mkdir denied without parent write perm', () => {
    const m = treeMount('/m', build);
    const r = m.mkdir!('noperm/child', guest);
    expect(r).toEqual({ ok: false, error: 'EACCES' });
  });

  test('rm removes a file', () => {
    const m = treeMount('/m', build);
    expect(m.rm!('hello', {}, guest).ok).toBe(true);
    expect(m.resolve('hello')).toBeNull();
  });

  test('rm on missing returns ENOENT', () => {
    const m = treeMount('/m', build);
    expect(m.rm!('missing', {}, guest)).toEqual({ ok: false, error: 'ENOENT' });
  });

  test('rm on directory without recurse returns EISDIR', () => {
    const m = treeMount('/m', build);
    expect(m.rm!('sub', {}, guest)).toEqual({ ok: false, error: 'EISDIR' });
  });

  test('rm on directory with recurse succeeds', () => {
    const m = treeMount('/m', build);
    expect(m.rm!('sub', { recurse: true }, guest).ok).toBe(true);
    expect(m.resolve('sub')).toBeNull();
  });

  test('rm denied without parent write perm', () => {
    const m = treeMount('/m', build);
    expect(m.rm!('hello', {}, other)).toEqual({ ok: false, error: 'EACCES' });
  });

  test('rebuild resets mount state', () => {
    const m = treeMount('/m', build);
    m.rm!('hello', {}, guest);
    expect(m.resolve('hello')).toBeNull();
    m.rebuild!();
    const node = m.resolve('hello') as FileNode;
    expect(node.content).toBe('world');
  });
});

const fileRoMount = (path: string, node: FileNode | DirNode): Mount => ({
  path,
  resolve: rel => (rel === '' || rel === '/' ? node : null),
  rebuild() {},
});

describe('createVfs.normalize', () => {
  const v = createVfs();

  test('empty string returns null', () => {
    expect(v.normalize('', '/')).toBeNull();
  });

  test('~ expands to HOME', () => {
    expect(v.normalize('~', '/')).toBe(HOME);
  });

  test('~/foo expands to HOME/foo', () => {
    expect(v.normalize('~/foo', '/')).toBe(HOME + '/foo');
  });

  test('absolute path passes through', () => {
    expect(v.normalize('/a/b', '/nowhere')).toBe('/a/b');
  });

  test('relative path joins cwd', () => {
    expect(v.normalize('sub', '/a')).toBe('/a/sub');
  });

  test('.. pops segment', () => {
    expect(v.normalize('/a/../b', '/')).toBe('/b');
  });

  test('. is dropped', () => {
    expect(v.normalize('/a/./b', '/')).toBe('/a/b');
  });

  test('double slashes collapse', () => {
    expect(v.normalize('//tmp', '/')).toBe('/tmp');
    expect(v.normalize('///tmp', '/')).toBe('/tmp');
  });

  test("leading ..'s above root don't underflow", () => {
    expect(v.normalize('/../../a', '/')).toBe('/a');
  });
});

describe('createVfs mount management', () => {
  test('registerMount sorts by path length descending', () => {
    const v = createVfs();
    v.registerMount(treeMount('/a', () => dir({})));
    v.registerMount(treeMount('/abc', () => dir({})));
    v.registerMount(treeMount('/ab', () => dir({})));
    expect(v.listMounts()).toEqual(['/abc', '/ab', '/a']);
  });

  test('virtual root lists every registered top-level mount', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({ hostname: file('h') })));
    v.registerMount(treeMount('/home', () => dir({ guest: dir({}) })));
    const r = v.list('/', '/', root);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const names = r.entries.map(([n]) => n).sort();
    expect(names).toEqual(['etc', 'home']);
  });
});

describe('createVfs.resolve', () => {
  test('resolves a file through a mount', () => {
    const v = createVfs();
    v.registerMount(
      treeMount('/etc', () => dir({ hostname: file('host.local') }))
    );
    const r = v.resolve('/etc/hostname', '/', root);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.abs).toBe('/etc/hostname');
    expect(r.node.type).toBe('file');
  });

  test('missing path returns ENOENT', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({})));
    expect(v.resolve('/etc/nope', '/', root)).toEqual({
      ok: false,
      error: 'ENOENT',
    });
  });

  test("parent that's a file returns ENOTDIR on the parent prefix", () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({ hostname: file('x') })));
    const r = v.resolve('/etc/hostname/bad', '/', root);
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toBe('ENOTDIR');
    expect(r.path).toBe('/etc/hostname');
  });

  test('parent without exec perm returns EACCES at prefix', () => {
    const v = createVfs();
    v.registerMount(
      treeMount('/root', () =>
        dir(
          { secret: file('hidden') },
          { owner: 'root', group: 'root', mode: 0o700 }
        )
      )
    );
    const r = v.resolve('/root/secret', '/', guest);
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toBe('EACCES');
    expect(r.path).toBe('/root');
  });

  test('resolving / returns the virtual root dir', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({})));
    const r = v.resolve('/', '/', root);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.node.type).toBe('dir');
  });
});

describe('createVfs.read/list/stat', () => {
  test('read returns file content', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({ hostname: file('hi') })));
    const r = v.read('/etc/hostname', '/', root);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.content).toBe('hi');
  });

  test('read on directory returns EISDIR', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({})));
    expect(v.read('/etc', '/', root)).toEqual({ ok: false, error: 'EISDIR' });
  });

  test('read without read perm returns EACCES', () => {
    const v = createVfs();
    v.registerMount(
      treeMount('/etc', () =>
        dir({
          shadow: file('locked', undefined, {
            owner: 'root',
            group: 'root',
            mode: 0o600,
          }),
        })
      )
    );
    expect(v.read('/etc/shadow', '/', guest)).toEqual({
      ok: false,
      error: 'EACCES',
    });
  });

  test('list returns entries sorted alphabetically', () => {
    const v = createVfs();
    v.registerMount(
      treeMount('/etc', () =>
        dir({ zebra: file(''), alpha: file(''), mike: file('') })
      )
    );
    const r = v.list('/etc', '/', root);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.entries.map(([n]) => n)).toEqual(['alpha', 'mike', 'zebra']);
  });

  test('list on a file returns a single-entry result', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({ hostname: file('x') })));
    const r = v.list('/etc/hostname', '/', root);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.entries.length).toBe(1);
  });

  test('stat returns shape with node', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({ hostname: file('h') })));
    const r = v.stat('/etc/hostname', '/', root);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.type).toBe('file');
    expect(r.mode).toBe(0o644);
  });
});

describe('createVfs.write/mkdir/rm', () => {
  test('write to a read-only mount returns ENOSYS', () => {
    const v = createVfs();
    v.registerMount(fileRoMount('/r', dir({})));
    expect(v.write('/r/foo', '/', root, 'x')).toEqual({
      ok: false,
      error: 'ENOSYS',
    });
  });

  test('mkdir on a read-only mount returns ENOSYS', () => {
    const v = createVfs();
    v.registerMount(fileRoMount('/r', dir({})));
    expect(v.mkdir('/r/foo', '/', root)).toEqual({
      ok: false,
      error: 'ENOSYS',
    });
  });

  test('rm on a read-only mount returns ENOSYS', () => {
    const v = createVfs();
    v.registerMount(fileRoMount('/r', dir({ f: file('x') })));
    expect(v.rm('/r/f', '/', root)).toEqual({ ok: false, error: 'ENOSYS' });
  });

  test('rm / is forbidden (EROOT)', () => {
    const v = createVfs();
    v.registerMount(treeMount('/etc', () => dir({})));
    expect(v.rm('/', '/', root)).toEqual({ ok: false, error: 'EROOT' });
  });

  test('rm on a mount root returns EACCES for guest', () => {
    const v = createVfs();
    v.registerMount(
      treeMount('/home', () =>
        dir(
          { guest: dir({}, { owner: 'guest', group: 'guest' }) },
          { owner: 'root', group: 'root', mode: 0o755 }
        )
      )
    );
    expect(v.rm('/home', '/', guest, { recurse: true })).toEqual({
      ok: false,
      error: 'EACCES',
    });
  });

  test('rm on a mount root returns EACCES even for root', () => {
    const v = createVfs();
    v.registerMount(treeMount('/home', () => dir({})));
    expect(v.rm('/home', '/', root, { recurse: true })).toEqual({
      ok: false,
      error: 'EACCES',
    });
  });

  test('rm inside a mount still uses normal parent-write perms', () => {
    const v = createVfs();
    v.registerMount(
      treeMount('/home', () =>
        dir(
          {
            file: file('x', undefined, { owner: 'guest', group: 'guest' }),
          },
          { owner: 'guest', group: 'guest', mode: 0o755 }
        )
      )
    );
    expect(v.rm('/home/file', '/', guest).ok).toBe(true);
  });

  test('write then read round-trips through a treeMount', () => {
    const v = createVfs();
    v.registerMount(
      treeMount('/tmp', () =>
        dir({}, { owner: 'guest', group: 'guest', mode: 0o755 })
      )
    );
    expect(v.write('/tmp/hi', '/', guest, 'hello').ok).toBe(true);
    const r = v.read('/tmp/hi', '/', guest);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toBe('hello');
    }
  });
});

describe('createVfs.displayPath', () => {
  const v = createVfs();
  test('HOME collapses to ~', () => {
    expect(v.displayPath(HOME)).toBe('~');
  });

  test('HOME subpath collapses to ~/…', () => {
    expect(v.displayPath(HOME + '/about.txt')).toBe('~/about.txt');
  });

  test('non-HOME path passes through', () => {
    expect(v.displayPath('/etc/hostname')).toBe('/etc/hostname');
  });
});
