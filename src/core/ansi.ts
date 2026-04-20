export type Color =
  | { kind: 'indexed'; n: number }
  | { kind: 'indexed256'; n: number }
  | { kind: 'rgb'; r: number; g: number; b: number };

export type Attrs = {
  fg?: Color;
  bg?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strike?: boolean;
};

export type Segment = { text: string; attrs: Attrs };

const ESC = '\x1b';

const applySgr = (attrs: Attrs, params: number[]): Attrs => {
  const next: Attrs = { ...attrs };
  let i = 0;
  while (i < params.length) {
    const p = params[i] as number;
    switch (true) {
      case p === 0:
        return {};
      case p === 1:
        next.bold = true;
        break;
      case p === 2:
        next.dim = true;
        break;
      case p === 3:
        next.italic = true;
        break;
      case p === 4:
        next.underline = true;
        break;
      case p === 7:
        next.inverse = true;
        break;
      case p === 9:
        next.strike = true;
        break;
      case p === 22:
        delete next.bold;
        delete next.dim;
        break;
      case p === 23:
        delete next.italic;
        break;
      case p === 24:
        delete next.underline;
        break;
      case p === 27:
        delete next.inverse;
        break;
      case p === 29:
        delete next.strike;
        break;
      case p >= 30 && p <= 37:
        next.fg = { kind: 'indexed', n: p - 30 };
        break;
      case p === 39:
        delete next.fg;
        break;
      case p >= 40 && p <= 47:
        next.bg = { kind: 'indexed', n: p - 40 };
        break;
      case p === 49:
        delete next.bg;
        break;
      case p >= 90 && p <= 97:
        next.fg = { kind: 'indexed', n: p - 90 + 8 };
        break;
      case p >= 100 && p <= 107:
        next.bg = { kind: 'indexed', n: p - 100 + 8 };
        break;
      case p === 38 || p === 48: {
        const target: 'fg' | 'bg' = p === 38 ? 'fg' : 'bg';
        const mode = params[i + 1];
        if (mode === 5) {
          const n = params[i + 2];
          if (typeof n === 'number') {
            next[target] = { kind: 'indexed256', n };
          }
          i += 2;
        } else if (mode === 2) {
          const r = params[i + 2];
          const g = params[i + 3];
          const b = params[i + 4];
          if (
            typeof r === 'number' &&
            typeof g === 'number' &&
            typeof b === 'number'
          ) {
            next[target] = { kind: 'rgb', r, g, b };
          }
          i += 4;
        }
        break;
      }
      default:
        break;
    }
    i++;
  }
  return next;
};

const XTERM_256: string[] = (() => {
  const pal: string[] = new Array(256);
  for (let i = 0; i < 16; i++) {
    pal[i] = '';
  }
  const levels = [0, 95, 135, 175, 215, 255];
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  let idx = 16;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        pal[idx++] =
          `#${hex(levels[r] as number)}${hex(levels[g] as number)}${hex(levels[b] as number)}`;
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const v = 8 + 10 * i;
    pal[idx++] = `#${hex(v)}${hex(v)}${hex(v)}`;
  }
  return pal;
})();

const colorToCss = (c: Color): string => {
  switch (c.kind) {
    case 'indexed':
      return `var(--ansi-${c.n})`;
    case 'indexed256':
      if (c.n < 16) {
        return `var(--ansi-${c.n})`;
      }
      if (c.n >= 0 && c.n < 256) {
        return XTERM_256[c.n] as string;
      }
      return '';
    case 'rgb':
      return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
};

export type SpanStyle = { style: string; classes: string[] };

export const styleFor = (attrs: Attrs): SpanStyle | null => {
  const empty =
    attrs.fg === undefined &&
    attrs.bg === undefined &&
    !attrs.bold &&
    !attrs.dim &&
    !attrs.italic &&
    !attrs.underline &&
    !attrs.inverse &&
    !attrs.strike;
  if (empty) {
    return null;
  }

  const fg = attrs.inverse ? attrs.bg : attrs.fg;
  const bg = attrs.inverse ? attrs.fg : attrs.bg;
  const styles: string[] = [];
  if (fg) {
    styles.push(`color: ${colorToCss(fg)}`);
  } else if (attrs.inverse) {
    styles.push('color: var(--bg)');
  }
  if (bg) {
    styles.push(`background-color: ${colorToCss(bg)}`);
  } else if (attrs.inverse) {
    styles.push('background-color: var(--fg)');
  }

  const classes: string[] = [];
  if (attrs.bold) {
    classes.push('ansi-bold');
  }
  if (attrs.dim) {
    classes.push('ansi-dim');
  }
  if (attrs.italic) {
    classes.push('ansi-italic');
  }
  if (attrs.underline) {
    classes.push('ansi-underline');
  }
  if (attrs.strike) {
    classes.push('ansi-strike');
  }

  return { style: styles.join('; '), classes };
};

export function parseAnsi(input: string): Segment[] {
  const segments: Segment[] = [];
  let attrs: Attrs = {};
  let buf = '';
  let i = 0;
  const n = input.length;

  const flush = () => {
    if (buf === '') {
      return;
    }
    segments.push({ text: buf, attrs });
    buf = '';
  };

  while (i < n) {
    if (input[i] === ESC && input[i + 1] === '[') {
      flush();
      i += 2;
      const start = i;
      while (i < n) {
        const code = (input[i] as string).charCodeAt(0);
        if (code >= 0x40 && code <= 0x7e) {
          break;
        }
        i++;
      }
      if (i >= n) {
        // unterminated CSI — drop the partial sequence
        return segments;
      }
      const final = input[i] as string;
      const body = input.slice(start, i);
      i++;
      if (final === 'm') {
        const params =
          body === ''
            ? [0]
            : body.split(';').map(p => {
                const v = Number.parseInt(p, 10);
                return Number.isFinite(v) ? v : 0;
              });
        attrs = applySgr(attrs, params);
      }
      continue;
    }
    if (input[i] === ESC) {
      // A lone ESC or non-CSI escape; skip it plus the next char.
      i += 2;
      continue;
    }
    buf += input[i];
    i++;
  }
  flush();
  return segments;
}
