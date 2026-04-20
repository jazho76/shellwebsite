import { describe, expect, test } from 'vitest';
import { parseAnsi, styleFor } from '../../src/core/ansi.js';

const esc = (s: string) => `\x1b[${s}`;

describe('parseAnsi', () => {
  test('plain text produces a single attrless segment', () => {
    const segs = parseAnsi('hello world');
    expect(segs).toEqual([{ text: 'hello world', attrs: {} }]);
  });

  test('empty input produces no segments', () => {
    expect(parseAnsi('')).toEqual([]);
  });

  test('basic foreground color', () => {
    const segs = parseAnsi(`before${esc('31m')}red${esc('0m')}after`);
    expect(segs.length).toBe(3);
    expect(segs[0]).toEqual({ text: 'before', attrs: {} });
    expect(segs[1]?.text).toBe('red');
    expect(segs[1]?.attrs.fg).toEqual({ kind: 'indexed', n: 1 });
    expect(segs[2]).toEqual({ text: 'after', attrs: {} });
  });

  test('bold + color composes', () => {
    const segs = parseAnsi(`${esc('1;32m')}ok`);
    expect(segs[0]?.attrs.bold).toBe(true);
    expect(segs[0]?.attrs.fg).toEqual({ kind: 'indexed', n: 2 });
  });

  test('reset (0) clears all attrs', () => {
    const segs = parseAnsi(`${esc('1;31m')}a${esc('0m')}b`);
    expect(segs[0]?.attrs).toEqual({
      bold: true,
      fg: { kind: 'indexed', n: 1 },
    });
    expect(segs[1]?.attrs).toEqual({});
  });

  test('empty params (ESC[m) resets', () => {
    const segs = parseAnsi(`${esc('31m')}a${esc('m')}b`);
    expect(segs[1]?.attrs).toEqual({});
  });

  test('default fg 39 clears foreground only', () => {
    const segs = parseAnsi(`${esc('1;31m')}a${esc('39m')}b`);
    expect(segs[1]?.attrs).toEqual({ bold: true });
  });

  test('default bg 49 clears background only', () => {
    const segs = parseAnsi(`${esc('41m')}a${esc('49m')}b`);
    expect(segs[1]?.attrs).toEqual({});
  });

  test('bright fg maps to indexed 8-15', () => {
    const segs = parseAnsi(`${esc('91m')}x`);
    expect(segs[0]?.attrs.fg).toEqual({ kind: 'indexed', n: 9 });
  });

  test('bright bg maps to indexed 8-15', () => {
    const segs = parseAnsi(`${esc('102m')}x`);
    expect(segs[0]?.attrs.bg).toEqual({ kind: 'indexed', n: 10 });
  });

  test('256-color fg', () => {
    const segs = parseAnsi(`${esc('38;5;208m')}x`);
    expect(segs[0]?.attrs.fg).toEqual({ kind: 'indexed256', n: 208 });
  });

  test('256-color bg', () => {
    const segs = parseAnsi(`${esc('48;5;16m')}x`);
    expect(segs[0]?.attrs.bg).toEqual({ kind: 'indexed256', n: 16 });
  });

  test('24-bit RGB fg', () => {
    const segs = parseAnsi(`${esc('38;2;10;20;30m')}x`);
    expect(segs[0]?.attrs.fg).toEqual({ kind: 'rgb', r: 10, g: 20, b: 30 });
  });

  test('24-bit RGB bg', () => {
    const segs = parseAnsi(`${esc('48;2;255;0;0m')}x`);
    expect(segs[0]?.attrs.bg).toEqual({ kind: 'rgb', r: 255, g: 0, b: 0 });
  });

  test('mixed bold + underline + fg', () => {
    const segs = parseAnsi(`${esc('1;4;34m')}x`);
    expect(segs[0]?.attrs).toEqual({
      bold: true,
      underline: true,
      fg: { kind: 'indexed', n: 4 },
    });
  });

  test('turn-off: 22 clears bold + dim', () => {
    const segs = parseAnsi(`${esc('1;2m')}a${esc('22m')}b`);
    expect(segs[1]?.attrs.bold).toBeUndefined();
    expect(segs[1]?.attrs.dim).toBeUndefined();
  });

  test('turn-off: 24 clears underline only', () => {
    const segs = parseAnsi(`${esc('1;4m')}a${esc('24m')}b`);
    expect(segs[1]?.attrs).toEqual({ bold: true });
  });

  test('inverse toggle', () => {
    const segs = parseAnsi(`${esc('7m')}a${esc('27m')}b`);
    expect(segs[0]?.attrs.inverse).toBe(true);
    expect(segs[1]?.attrs.inverse).toBeUndefined();
  });

  test('italic + strike', () => {
    const segs = parseAnsi(`${esc('3;9m')}x`);
    expect(segs[0]?.attrs.italic).toBe(true);
    expect(segs[0]?.attrs.strike).toBe(true);
  });

  test('unterminated CSI at end drops partial sequence', () => {
    const segs = parseAnsi(`good${esc('31')}`);
    expect(segs).toEqual([{ text: 'good', attrs: {} }]);
  });

  test('non-SGR CSI sequences are swallowed', () => {
    const segs = parseAnsi(`a${esc('2J')}b`);
    expect(segs.map(s => s.text).join('')).toBe('ab');
  });

  test("unknown SGR params are ignored but don't break parse", () => {
    const segs = parseAnsi(`${esc('99;31m')}x`);
    expect(segs[0]?.attrs.fg).toEqual({ kind: 'indexed', n: 1 });
  });

  test('lone ESC is swallowed with the next char', () => {
    const segs = parseAnsi(`a\x1bXb`);
    expect(segs.map(s => s.text).join('')).toBe('ab');
  });

  test('multiple resets collapse cleanly', () => {
    const segs = parseAnsi(`${esc('31m')}a${esc('0m')}${esc('0m')}b`);
    expect(segs.filter(s => s.text !== '').length).toBe(2);
    expect(segs[1]?.attrs).toEqual({});
  });

  test('empty segments are not emitted', () => {
    const segs = parseAnsi(`${esc('31m')}${esc('32m')}x`);
    expect(segs.length).toBe(1);
    expect(segs[0]?.text).toBe('x');
    expect(segs[0]?.attrs.fg).toEqual({ kind: 'indexed', n: 2 });
  });
});

describe('styleFor', () => {
  test('empty attrs returns null', () => {
    expect(styleFor({})).toBeNull();
  });

  test('indexed fg uses CSS var', () => {
    const s = styleFor({ fg: { kind: 'indexed', n: 1 } });
    expect(s?.style).toContain('color: var(--ansi-1)');
  });

  test('indexed256 fg < 16 uses CSS var', () => {
    const s = styleFor({ fg: { kind: 'indexed256', n: 3 } });
    expect(s?.style).toContain('color: var(--ansi-3)');
  });

  test('indexed256 fg >= 16 uses fixed palette hex', () => {
    const s = styleFor({ fg: { kind: 'indexed256', n: 16 } });
    expect(s?.style).toMatch(/color: #[0-9a-f]{6}/);
  });

  test('rgb fg emits rgb()', () => {
    const s = styleFor({ fg: { kind: 'rgb', r: 1, g: 2, b: 3 } });
    expect(s?.style).toBe('color: rgb(1, 2, 3)');
  });

  test('bold emits ansi-bold class', () => {
    const s = styleFor({ bold: true });
    expect(s?.classes).toContain('ansi-bold');
  });

  test('italic + underline + strike classes', () => {
    const s = styleFor({ italic: true, underline: true, strike: true });
    expect(s?.classes).toEqual(
      expect.arrayContaining(['ansi-italic', 'ansi-underline', 'ansi-strike'])
    );
  });

  test('inverse swaps fg and bg', () => {
    const s = styleFor({
      fg: { kind: 'indexed', n: 1 },
      bg: { kind: 'indexed', n: 4 },
      inverse: true,
    });
    expect(s?.style).toContain('color: var(--ansi-4)');
    expect(s?.style).toContain('background-color: var(--ansi-1)');
  });

  test('bare inverse swaps default fg/bg vars', () => {
    const s = styleFor({ inverse: true });
    expect(s?.style).toContain('color: var(--bg)');
    expect(s?.style).toContain('background-color: var(--fg)');
  });
});
