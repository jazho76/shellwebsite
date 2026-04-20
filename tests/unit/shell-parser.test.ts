import { describe, expect, test } from 'vitest';
import type { ExpandEnv } from '../../src/core/shell-parser.js';
import {
  ShellParseError,
  expandWord,
  parse,
  parseCommandLine,
  tokenize,
} from '../../src/core/shell-parser.js';

const env: ExpandEnv = {
  HOME: '/home/guest',
  USER: 'guest',
  PWD: '/home/guest',
  PATH: '/bin',
  HOSTNAME: 'jpinillos.dev',
  '?': '0',
};

describe('tokenize: words and quotes', () => {
  test('simple words', () => {
    const toks = tokenize('ls /etc');
    expect(toks).toHaveLength(2);
    expect(toks[0]).toEqual({
      kind: 'WORD',
      parts: [{ kind: 'expandable', text: 'ls' }],
    });
    expect(toks[1]).toEqual({
      kind: 'WORD',
      parts: [{ kind: 'expandable', text: '/etc' }],
    });
  });

  test('single quotes → literal part', () => {
    const toks = tokenize("echo 'hello world'");
    expect(toks[1]).toEqual({
      kind: 'WORD',
      parts: [{ kind: 'literal', text: 'hello world' }],
    });
  });

  test('double quotes → expandable (quoted) part', () => {
    const toks = tokenize('echo "hello world"');
    expect(toks[1]).toEqual({
      kind: 'WORD',
      parts: [{ kind: 'expandable', text: 'hello world', quoted: true }],
    });
  });

  test('unterminated single quote throws', () => {
    expect(() => tokenize("echo 'oops")).toThrow(ShellParseError);
  });

  test('unterminated double quote throws', () => {
    expect(() => tokenize('echo "oops')).toThrow(ShellParseError);
  });

  test('backslash escape outside quotes', () => {
    const toks = tokenize('echo a\\ b');
    expect(toks).toHaveLength(2);
    const word = toks[1];
    expect(word?.kind).toBe('WORD');
  });

  test('backslash before dollar inside double quote prevents expansion', () => {
    const toks = tokenize('echo "\\$HOME"');
    const word = toks[1];
    expect(word?.kind).toBe('WORD');
    if (word?.kind !== 'WORD') {
      return;
    }
    expect(word.parts.length).toBeGreaterThan(0);
  });

  test('quote boundaries force fresh parts', () => {
    const toks = tokenize('abc"def"$HOME');
    const word = toks[0];
    expect(word?.kind).toBe('WORD');
    if (word?.kind !== 'WORD') {
      return;
    }
    expect(word.parts).toEqual([
      { kind: 'expandable', text: 'abc' },
      { kind: 'expandable', text: 'def', quoted: true },
      { kind: 'expandable', text: '$HOME' },
    ]);
  });

  test('adjacent quoted $VAR keeps name atomic across concatenation', () => {
    const seq = parseCommandLine('echo "$USER"home', env);
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', 'guesthome']);
  });

  test('\\$ inside double quotes escapes expansion', () => {
    const seq = parseCommandLine('echo "\\$HOME"', env);
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', '$HOME']);
  });
});

describe('tokenize: metacharacters', () => {
  test('pipe', () => {
    const toks = tokenize('a | b');
    expect(toks[1]).toEqual({ kind: 'PIPE' });
  });
  test('redir out + append + in', () => {
    expect(tokenize('a > b')[1]).toEqual({ kind: 'REDIR', op: '>' });
    expect(tokenize('a >> b')[1]).toEqual({ kind: 'REDIR', op: '>>' });
    expect(tokenize('a < b')[1]).toEqual({ kind: 'REDIR', op: '<' });
  });
  test('semicolon', () => {
    expect(tokenize('a ; b')[1]).toEqual({ kind: 'SEMI' });
  });
  test('and + or', () => {
    expect(tokenize('a && b')[1]).toEqual({ kind: 'AND' });
    expect(tokenize('a || b')[1]).toEqual({ kind: 'OR' });
  });
  test('stray ampersand throws', () => {
    expect(() => tokenize('a &')).toThrow(ShellParseError);
  });
  test("metacharacters don't need whitespace", () => {
    const toks = tokenize('a|b');
    expect(toks.map(t => t.kind)).toEqual(['WORD', 'PIPE', 'WORD']);
  });
});

describe('expandWord', () => {
  test('plain $VAR', () => {
    expect(expandWord([{ kind: 'expandable', text: '$HOME' }], env)).toBe(
      '/home/guest'
    );
  });
  test('${VAR} braces', () => {
    expect(expandWord([{ kind: 'expandable', text: '${USER}x' }], env)).toBe(
      'guestx'
    );
  });
  test('unknown var → empty string', () => {
    expect(expandWord([{ kind: 'expandable', text: '$NOPE' }], env)).toBe('');
  });
  test('$? special variable', () => {
    const e2: ExpandEnv = { ...env, '?': '42' };
    expect(expandWord([{ kind: 'expandable', text: '$?' }], e2)).toBe('42');
  });
  test('literal part is not expanded', () => {
    expect(expandWord([{ kind: 'literal', text: '$HOME' }], env)).toBe('$HOME');
  });
  test('mixed literal and expandable', () => {
    expect(
      expandWord(
        [
          { kind: 'literal', text: '$HOME=' },
          { kind: 'expandable', text: '$HOME' },
        ],
        env
      )
    ).toBe('$HOME=/home/guest');
  });
});

describe('parse', () => {
  test('single command', () => {
    const seq = parse(tokenize('ls /etc'));
    expect(seq).toHaveLength(1);
    const pipeline = seq[0]!.pipeline;
    expect(pipeline).toHaveLength(1);
    expect(pipeline[0]!.argv).toHaveLength(2);
  });

  test('pipeline of three', () => {
    const seq = parse(tokenize('a | b | c'));
    expect(seq).toHaveLength(1);
    expect(seq[0]!.pipeline).toHaveLength(3);
  });

  test('sequence with semicolons', () => {
    const seq = parse(tokenize('a; b; c'));
    expect(seq).toHaveLength(3);
    expect(seq[0]!.connector).toBe(';');
    expect(seq[1]!.connector).toBe(';');
    expect(seq[2]!.connector).toBeNull();
  });

  test('&& and || connectors', () => {
    const seq = parse(tokenize('a && b || c'));
    expect(seq).toHaveLength(3);
    expect(seq[0]!.connector).toBe('&&');
    expect(seq[1]!.connector).toBe('||');
  });

  test('redirections collected per command', () => {
    const seq = parse(tokenize('echo hi > /tmp/out < /dev/null'));
    const cmd = seq[0]!.pipeline[0]!;
    expect(cmd.argv).toHaveLength(2);
    expect(cmd.redirs.map(r => r.op)).toEqual(['>', '<']);
  });

  test('empty command after pipe throws', () => {
    expect(() => parse(tokenize('a |'))).toThrow(ShellParseError);
  });

  test('leading pipe throws', () => {
    expect(() => parse(tokenize('| a'))).toThrow(ShellParseError);
  });

  test('redir without path throws', () => {
    expect(() => parse(tokenize('echo >'))).toThrow(ShellParseError);
  });
});

describe('parseCommandLine', () => {
  test('expands $HOME in echo', () => {
    const seq = parseCommandLine('echo $HOME', env);
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', '/home/guest']);
  });

  test('single quotes prevent expansion', () => {
    const seq = parseCommandLine("echo '$HOME'", env);
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', '$HOME']);
  });

  test('double quotes allow expansion', () => {
    const seq = parseCommandLine('echo "$HOME"', env);
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', '/home/guest']);
  });

  test('expands redir path', () => {
    const seq = parseCommandLine('echo hi > $HOME/out', env);
    expect(seq[0]!.pipeline[0]!.redirs[0]!.path).toBe('/home/guest/out');
  });

  test('pipeline with quoted arg', () => {
    const seq = parseCommandLine('echo "hello world" | wc -w', env);
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', 'hello world']);
    expect(seq[0]!.pipeline[1]!.argv).toEqual(['wc', '-w']);
  });

  test('concatenation of quoted and expanded', () => {
    const seq = parseCommandLine('echo "["$USER"]"', env);
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', '[guest]']);
  });

  test('exit-code variable $?', () => {
    const seq = parseCommandLine('echo $?', { ...env, '?': '7' });
    expect(seq[0]!.pipeline[0]!.argv).toEqual(['echo', '7']);
  });

  test('empty input yields empty sequence', () => {
    expect(parseCommandLine('', env)).toEqual([]);
  });
});

describe('assignments', () => {
  test('leading NAME=VALUE with no command is a bare assignment', () => {
    const seq = parseCommandLine('FOO=bar', env);
    const cmd = seq[0]!.pipeline[0]!;
    expect(cmd.argv).toEqual([]);
    expect(cmd.assignments).toEqual([{ name: 'FOO', value: 'bar' }]);
  });

  test('NAME=VALUE before a command is a scoped assignment', () => {
    const seq = parseCommandLine('FOO=bar echo hi', env);
    const cmd = seq[0]!.pipeline[0]!;
    expect(cmd.argv).toEqual(['echo', 'hi']);
    expect(cmd.assignments).toEqual([{ name: 'FOO', value: 'bar' }]);
  });

  test('multiple leading assignments', () => {
    const seq = parseCommandLine('FOO=a BAR=b cmd', env);
    const cmd = seq[0]!.pipeline[0]!;
    expect(cmd.argv).toEqual(['cmd']);
    expect(cmd.assignments).toEqual([
      { name: 'FOO', value: 'a' },
      { name: 'BAR', value: 'b' },
    ]);
  });

  test('assignment value may be empty', () => {
    const seq = parseCommandLine('FOO= cmd', env);
    expect(seq[0]!.pipeline[0]!.assignments).toEqual([
      { name: 'FOO', value: '' },
    ]);
  });

  test('assignment value is expanded at parse time', () => {
    const seq = parseCommandLine('FOO=$HOME cmd', env);
    expect(seq[0]!.pipeline[0]!.assignments).toEqual([
      { name: 'FOO', value: '/home/guest' },
    ]);
  });

  test('NAME= after a command is a regular arg, not an assignment', () => {
    const seq = parseCommandLine('echo FOO=bar', env);
    const cmd = seq[0]!.pipeline[0]!;
    expect(cmd.argv).toEqual(['echo', 'FOO=bar']);
    expect(cmd.assignments).toEqual([]);
  });

  test('quoted assignment prefix is a regular arg', () => {
    const seq = parseCommandLine('"FOO=bar" cmd', env);
    const cmd = seq[0]!.pipeline[0]!;
    expect(cmd.argv).toEqual(['FOO=bar', 'cmd']);
    expect(cmd.assignments).toEqual([]);
  });

  test('lowercase names are valid identifiers', () => {
    const seq = parseCommandLine('foo=1 cmd', env);
    expect(seq[0]!.pipeline[0]!.assignments).toEqual([
      { name: 'foo', value: '1' },
    ]);
  });
});
