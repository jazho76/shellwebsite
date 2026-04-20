import { describe, expect, test } from 'vitest';
import { globExpand } from '../../src/core/shell-glob.js';
import { createVfs, dir, file, treeMount } from '../../src/core/vfs.js';

const root = { name: 'root' };

const makeVfs = () => {
  const v = createVfs();
  v.registerMount(
    treeMount('/etc', () =>
      dir({
        passwd: file('p'),
        motd: file('m'),
        hostname: file('h'),
        'os-release': file('o'),
        'resolv.conf': file('r'),
        '.hidden': file('secret'),
      })
    )
  );
  v.registerMount(
    treeMount('/home', () =>
      dir({
        guest: dir(
          {
            'a.txt': file('a'),
            'b.txt': file('b'),
            'c.md': file('c'),
            '.bashrc': file('rc'),
          },
          { owner: 'guest', group: 'guest' }
        ),
      })
    )
  );
  return v;
};

describe('globExpand: no metas', () => {
  test('bare path with no metas is returned unchanged', () => {
    const v = makeVfs();
    expect(globExpand('/etc/passwd', v, '/', root)).toEqual(['/etc/passwd']);
  });

  test('escaped meta is unescaped and passed through literally', () => {
    const v = makeVfs();
    expect(globExpand('/etc/\\*', v, '/', root)).toEqual(['/etc/*']);
  });

  test('relative path with no metas', () => {
    const v = makeVfs();
    expect(globExpand('passwd', v, '/etc', root)).toEqual(['passwd']);
  });
});

describe('globExpand: star/question/class', () => {
  test('* matches visible children only (no dotfiles)', () => {
    const v = makeVfs();
    const out = globExpand('/etc/*', v, '/', root);
    expect(out).toContain('/etc/passwd');
    expect(out).toContain('/etc/motd');
    expect(out).toContain('/etc/resolv.conf');
    expect(out).not.toContain('/etc/.hidden');
  });

  test('.* matches dotfiles', () => {
    const v = makeVfs();
    expect(globExpand('/etc/.*', v, '/', root)).toEqual(['/etc/.hidden']);
  });

  test('suffix *.ext', () => {
    const v = makeVfs();
    const out = globExpand('/etc/*.conf', v, '/', root);
    expect(out).toEqual(['/etc/resolv.conf']);
  });

  test('? matches exactly one char', () => {
    const v = makeVfs();
    const out = globExpand('/etc/pass?d', v, '/', root);
    expect(out).toEqual(['/etc/passwd']);
  });

  test('? does not match zero chars', () => {
    const v = makeVfs();
    // "passwd" has 6 chars; "?passwd" → 7 chars, no match.
    expect(globExpand('/etc/?passwd', v, '/', root)).toEqual(['/etc/?passwd']);
  });

  test('[abc] character class', () => {
    const v = makeVfs();
    const out = globExpand('/etc/[mp]*', v, '/', root);
    expect(out.sort()).toEqual(['/etc/motd', '/etc/passwd'].sort());
  });

  test('[!abc] negation', () => {
    const v = makeVfs();
    const out = globExpand('/etc/[!mp]*', v, '/', root);
    expect(out).toContain('/etc/hostname');
    expect(out).not.toContain('/etc/passwd');
    expect(out).not.toContain('/etc/motd');
  });

  test('[a-z] range', () => {
    const v = makeVfs();
    const out = globExpand('/etc/[a-h]*', v, '/', root);
    // entries starting with a..h: hostname (h)
    expect(out).toContain('/etc/hostname');
    expect(out).not.toContain('/etc/passwd');
  });

  test('escaped * is literal', () => {
    const v = makeVfs();
    // No file literally named `*`, so we get the literal back.
    expect(globExpand('/etc/\\*', v, '/', root)).toEqual(['/etc/*']);
  });
});

describe('globExpand: multi-segment', () => {
  test('cross-segment traversal: */guest/*.txt', () => {
    const v = makeVfs();
    const out = globExpand('/home/*/*.txt', v, '/', root);
    expect(out).toContain('/home/guest/a.txt');
    expect(out).toContain('/home/guest/b.txt');
    expect(out).not.toContain('/home/guest/c.md');
  });

  test('mid-path non-dir blocks traversal', () => {
    const v = makeVfs();
    // /etc/passwd is a file; /etc/passwd/* should match nothing.
    expect(globExpand('/etc/passwd/*', v, '/', root)).toEqual([
      '/etc/passwd/*',
    ]);
  });
});

describe('globExpand: no matches', () => {
  test('literal pattern preserved when no match', () => {
    const v = makeVfs();
    expect(globExpand('/etc/*.xyz', v, '/', root)).toEqual(['/etc/*.xyz']);
  });

  test('nonexistent parent dir preserves literal', () => {
    const v = makeVfs();
    expect(globExpand('/nonexistent/*.txt', v, '/', root)).toEqual([
      '/nonexistent/*.txt',
    ]);
  });
});

describe('globExpand: sorting and tilde', () => {
  test('results are sorted alphabetically', () => {
    const v = makeVfs();
    const out = globExpand('/etc/*', v, '/', root);
    const sorted = [...out].sort();
    expect(out).toEqual(sorted);
  });

  test('~/ at pattern start expands to HOME', () => {
    const v = makeVfs();
    const guest = { name: 'guest' };
    const out = globExpand('~/*.txt', v, '/', guest);
    expect(out).toContain('/home/guest/a.txt');
    expect(out).toContain('/home/guest/b.txt');
  });
});
