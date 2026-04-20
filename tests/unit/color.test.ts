import { describe, expect, test } from 'vitest';
import { parseAnsi } from '../../src/core/ansi.js';
import {
  bold,
  brightBlue,
  cyan,
  dim,
  green,
  italic,
  red,
  strike,
  underline,
} from '../../src/core/color.js';

describe('color helpers', () => {
  test('fg closes with turn-off 39, not full reset', () => {
    expect(red('x')).toBe('\x1b[31mx\x1b[39m');
  });

  test('bright fg uses 94 + 39', () => {
    expect(brightBlue('x')).toBe('\x1b[94mx\x1b[39m');
  });

  test('bold uses 22 as turn-off', () => {
    expect(bold('x')).toBe('\x1b[1mx\x1b[22m');
  });

  test('dim uses 22 as turn-off', () => {
    expect(dim('x')).toBe('\x1b[2mx\x1b[22m');
  });

  test('italic uses 23', () => {
    expect(italic('x')).toBe('\x1b[3mx\x1b[23m');
  });

  test('underline uses 24', () => {
    expect(underline('x')).toBe('\x1b[4mx\x1b[24m');
  });

  test('strike uses 29', () => {
    expect(strike('x')).toBe('\x1b[9mx\x1b[29m');
  });

  test('single helper round-trips to one styled segment', () => {
    const segs = parseAnsi(green('hi'));
    const inner = segs.find(s => s.text === 'hi');
    expect(inner?.attrs.fg).toEqual({ kind: 'indexed', n: 2 });
  });

  test('nested bold inside red: outer color preserved after inner close', () => {
    const segs = parseAnsi(red('a' + bold('b') + 'c'));
    const byChar = Object.fromEntries(
      segs.filter(s => s.text).map(s => [s.text, s.attrs])
    );
    expect(byChar['a']?.fg).toEqual({ kind: 'indexed', n: 1 });
    expect(byChar['b']?.fg).toEqual({ kind: 'indexed', n: 1 });
    expect(byChar['b']?.bold).toBe(true);
    expect(byChar['c']?.fg).toEqual({ kind: 'indexed', n: 1 });
    expect(byChar['c']?.bold).toBeUndefined();
  });

  test("three-level nest: cyan(bold(red('x'))) — all attrs on x", () => {
    const segs = parseAnsi(cyan(bold(red('x'))));
    const x = segs.find(s => s.text === 'x');
    expect(x?.attrs.fg).toEqual({ kind: 'indexed', n: 1 });
    expect(x?.attrs.bold).toBe(true);
  });
});
