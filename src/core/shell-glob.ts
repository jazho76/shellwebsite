import type { IdentityLike, Vfs } from './vfs.js';

const unescape = (s: string): string => {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      out += s[i + 1];
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
};

const hasMeta = (segment: string): boolean => {
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '*' || c === '?' || c === '[') {
      return true;
    }
  }
  return false;
};

const REGEX_META = /[.+^${}()|\\]/g;

export const compileSegment = (segment: string): RegExp => {
  let re = '^';
  let i = 0;
  while (i < segment.length) {
    const c = segment[i] as string;
    if (c === '\\' && i + 1 < segment.length) {
      const next = segment[i + 1] as string;
      re += next.replace(REGEX_META, '\\$&');
      i += 2;
      continue;
    }
    if (c === '*') {
      re += '[^/]*';
      i++;
      continue;
    }
    if (c === '?') {
      re += '[^/]';
      i++;
      continue;
    }
    if (c === '[') {
      const close = segment.indexOf(']', i + 1);
      if (close === -1) {
        re += '\\[';
        i++;
        continue;
      }
      let cls = segment.slice(i + 1, close);
      if (cls.startsWith('!')) {
        cls = '^' + cls.slice(1);
      }
      re += `[${cls}]`;
      i = close + 1;
      continue;
    }
    re += c.replace(REGEX_META, '\\$&');
    i++;
  }
  re += '$';
  return new RegExp(re);
};

const segmentMatchesDotfiles = (segment: string): boolean =>
  segment.startsWith('.') || segment.startsWith('\\.');

const joinPath = (base: string, name: string): string =>
  base === '/' ? '/' + name : base + '/' + name;

/** No matches returns [pattern] literally (bash's nullglob-off default). */
export function globExpand(
  pattern: string,
  vfs: Vfs,
  cwd: string,
  identity: IdentityLike
): string[] {
  if (!hasMeta(pattern)) {
    return [unescape(pattern)];
  }

  let root = '/';
  let rest = pattern;
  if (pattern.startsWith('/')) {
    rest = pattern.slice(1);
  } else if (pattern === '~' || pattern.startsWith('~/')) {
    const resolved = vfs.normalize('~', cwd);
    if (resolved === null) {
      return [unescape(pattern)];
    }
    root = resolved;
    rest = pattern === '~' ? '' : pattern.slice(2);
  } else {
    root = cwd;
  }

  const segments = rest.split('/').filter(s => s.length > 0);

  let currentPaths: string[] = [root];
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx] as string;
    const isLast = segIdx === segments.length - 1;

    if (!hasMeta(segment)) {
      const lit = unescape(segment);
      currentPaths = currentPaths.map(p => joinPath(p, lit));
      continue;
    }

    const re = compileSegment(segment);
    const allowDot = segmentMatchesDotfiles(segment);
    const next: string[] = [];

    for (const parent of currentPaths) {
      const listResult = vfs.list(parent, '/', identity);
      if (!listResult.ok) {
        continue;
      }
      const entries = listResult.entries.filter(
        ([name]) => (allowDot || !name.startsWith('.')) && re.test(name)
      );
      entries.sort(([a], [b]) => a.localeCompare(b));
      for (const [name, node] of entries) {
        if (!isLast && node.type !== 'dir') {
          continue;
        }
        next.push(joinPath(parent, name));
      }
    }

    currentPaths = next;
  }

  if (currentPaths.length === 0) {
    return [unescape(pattern)];
  }
  currentPaths.sort();
  return currentPaths;
}
