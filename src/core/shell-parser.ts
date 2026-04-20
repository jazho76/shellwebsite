export type WordPart =
  | { kind: 'literal'; text: string }
  | { kind: 'expandable'; text: string; quoted?: boolean };

export type Token =
  | { kind: 'WORD'; parts: WordPart[] }
  | { kind: 'PIPE' }
  | { kind: 'REDIR'; op: '>' | '>>' | '<' }
  | { kind: 'SEMI' }
  | { kind: 'AND' }
  | { kind: 'OR' };

export type ParsedRedir = { op: '>' | '>>' | '<'; parts: WordPart[] };
export type ParsedAssignment = { name: string; value: WordPart[] };
export type ParsedCommand = {
  argv: WordPart[][];
  redirs: ParsedRedir[];
  assignments: ParsedAssignment[];
};
export type ParsedPipeline = ParsedCommand[];
export type ParsedItem = {
  pipeline: ParsedPipeline;
  connector: ';' | '&&' | '||' | null;
};
export type ParsedSequence = ParsedItem[];

export type Redir = { op: '>' | '>>' | '<'; path: string };
export type Assignment = { name: string; value: string };
export type Command = {
  argv: string[];
  redirs: Redir[];
  assignments: Assignment[];
};
export type Pipeline = Command[];
export type Item = {
  pipeline: Pipeline;
  connector: ';' | '&&' | '||' | null;
};
export type Sequence = Item[];

export class ShellParseError extends Error {}

const META = new Set(['|', '>', '<', ';', '&']);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i] as string;

    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }

    if (c === '|') {
      if (input[i + 1] === '|') {
        tokens.push({ kind: 'OR' });
        i += 2;
      } else {
        tokens.push({ kind: 'PIPE' });
        i++;
      }
      continue;
    }

    if (c === '&' && input[i + 1] === '&') {
      tokens.push({ kind: 'AND' });
      i += 2;
      continue;
    }

    if (c === '>') {
      if (input[i + 1] === '>') {
        tokens.push({ kind: 'REDIR', op: '>>' });
        i += 2;
      } else {
        tokens.push({ kind: 'REDIR', op: '>' });
        i++;
      }
      continue;
    }
    if (c === '<') {
      tokens.push({ kind: 'REDIR', op: '<' });
      i++;
      continue;
    }

    if (c === ';') {
      tokens.push({ kind: 'SEMI' });
      i++;
      continue;
    }

    if (c === '&') {
      throw new ShellParseError(
        "unexpected '&' (background jobs not supported)"
      );
    }

    // Crossing a quote boundary forces a fresh part so `"$USER"home` keeps
    // $USER atomic for expansion.
    const parts: WordPart[] = [];
    let freshNext = false;
    const addLit = (s: string) => {
      if (s === '') {
        return;
      }
      if (!freshNext) {
        const last = parts[parts.length - 1];
        if (last && last.kind === 'literal') {
          last.text += s;
          return;
        }
      }
      parts.push({ kind: 'literal', text: s });
      freshNext = false;
    };
    const addExp = (s: string, quoted: boolean) => {
      if (s === '') {
        return;
      }
      if (!freshNext) {
        const last = parts[parts.length - 1];
        if (last && last.kind === 'expandable' && !!last.quoted === quoted) {
          last.text += s;
          return;
        }
      }
      const part: WordPart = { kind: 'expandable', text: s };
      if (quoted) {
        part.quoted = true;
      }
      parts.push(part);
      freshNext = false;
    };

    while (i < n) {
      const ch = input[i] as string;
      if (ch === ' ' || ch === '\t' || ch === '\n') {
        break;
      }
      if (META.has(ch)) {
        break;
      }

      if (ch === '\\') {
        if (i + 1 >= n) {
          throw new ShellParseError('trailing backslash');
        }
        addLit(input[i + 1] as string);
        i += 2;
        continue;
      }

      if (ch === "'") {
        i++;
        let quoted = '';
        while (i < n && input[i] !== "'") {
          quoted += input[i];
          i++;
        }
        if (i >= n) {
          throw new ShellParseError('unterminated single quote');
        }
        i++;
        freshNext = true;
        addLit(quoted);
        freshNext = true;
        continue;
      }

      if (ch === '"') {
        i++;
        freshNext = true;
        while (i < n && input[i] !== '"') {
          const qc = input[i] as string;
          if (qc === '\\') {
            if (i + 1 >= n) {
              throw new ShellParseError('trailing backslash in double quote');
            }
            const next = input[i + 1] as string;
            if (
              next === '$' ||
              next === '"' ||
              next === '\\' ||
              next === '\n'
            ) {
              addLit(next);
            } else {
              addExp('\\' + next, true);
            }
            i += 2;
            continue;
          }
          addExp(qc, true);
          i++;
        }
        if (i >= n) {
          throw new ShellParseError('unterminated double quote');
        }
        i++;
        freshNext = true;
        continue;
      }

      addExp(ch, false);
      i++;
    }

    tokens.push({ kind: 'WORD', parts });
  }

  return tokens;
}

export type ExpandEnv = Record<string, string> & { '?'?: string };

const VAR_RE = /\$(\?|\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)/g;

export function expandWord(parts: WordPart[], env: ExpandEnv): string {
  let out = '';
  for (const p of parts) {
    if (p.kind === 'literal') {
      out += p.text;
    } else {
      out += p.text.replace(VAR_RE, (_m, group1: string) => {
        let name = group1;
        if (name.startsWith('{') && name.endsWith('}')) {
          name = name.slice(1, -1);
        }
        return env[name] ?? '';
      });
    }
  }
  return out;
}

/** Produces a glob pattern where literal and quoted parts have metas escaped
 *  so globExpand (in shell-glob.ts) treats them as literal. */
export function expandForGlob(parts: WordPart[], env: ExpandEnv): string {
  let out = '';
  for (const p of parts) {
    if (p.kind === 'literal') {
      out += p.text.replace(/[*?[\\]/g, '\\$&');
      continue;
    }
    const substituted = p.text.replace(VAR_RE, (_m, group1: string) => {
      let name = group1;
      if (name.startsWith('{') && name.endsWith('}')) {
        name = name.slice(1, -1);
      }
      return env[name] ?? '';
    });
    out += p.quoted ? substituted.replace(/[*?[\\]/g, '\\$&') : substituted;
  }
  return out;
}

export function parse(tokens: Token[]): ParsedSequence {
  const sequence: ParsedSequence = [];
  let i = 0;

  const peek = (): Token | undefined => tokens[i];

  const parseCommand = (): ParsedCommand => {
    const argv: WordPart[][] = [];
    const redirs: ParsedRedir[] = [];
    const assignments: ParsedAssignment[] = [];

    while (i < tokens.length) {
      const t = tokens[i]!;
      if (t.kind === 'WORD') {
        if (argv.length === 0) {
          const split = splitAssignment(t.parts);
          if (split) {
            assignments.push(split);
            i++;
            continue;
          }
        }
        argv.push(t.parts);
        i++;
        continue;
      }
      if (t.kind === 'REDIR') {
        const op = t.op;
        i++;
        const next = tokens[i];
        if (!next || next.kind !== 'WORD') {
          throw new ShellParseError(`expected path after '${op}'`);
        }
        redirs.push({ op, parts: next.parts });
        i++;
        continue;
      }
      break;
    }

    return { argv, redirs, assignments };
  };

  const parsePipeline = (): ParsedPipeline => {
    const pipeline: ParsedPipeline = [];
    const first = parseCommand();
    if (first.argv.length === 0 && first.assignments.length === 0) {
      throw new ShellParseError('empty command');
    }
    pipeline.push(first);

    while (peek()?.kind === 'PIPE') {
      i++;
      const next = parseCommand();
      // Pipe segments must be real commands — bare assignments don't count.
      if (next.argv.length === 0) {
        throw new ShellParseError("empty command after '|'");
      }
      pipeline.push(next);
    }

    return pipeline;
  };

  if (tokens.length === 0) {
    return sequence;
  }
  const start = tokens[0]!;
  if (
    start.kind === 'PIPE' ||
    start.kind === 'SEMI' ||
    start.kind === 'AND' ||
    start.kind === 'OR'
  ) {
    throw new ShellParseError(`unexpected '${tokenText(start)}' at start`);
  }

  while (i < tokens.length) {
    const pipeline = parsePipeline();
    let connector: ParsedItem['connector'] = null;
    const after = peek();
    if (after?.kind === 'SEMI') {
      connector = ';';
      i++;
    } else if (after?.kind === 'AND') {
      connector = '&&';
      i++;
    } else if (after?.kind === 'OR') {
      connector = '||';
      i++;
    }
    sequence.push({ pipeline, connector });
  }

  return sequence;
}

const ASSIGN_PREFIX = /^([A-Za-z_][A-Za-z0-9_]*)=/;

const splitAssignment = (parts: WordPart[]): ParsedAssignment | null => {
  const first = parts[0];
  if (!first || first.kind !== 'expandable' || first.quoted) {
    return null;
  }
  const m = first.text.match(ASSIGN_PREFIX);
  if (!m) {
    return null;
  }
  const name = m[1] as string;
  const valueFirst: WordPart = {
    kind: 'expandable',
    text: first.text.slice(m[0].length),
  };
  const value: WordPart[] = [valueFirst, ...parts.slice(1)];
  return { name, value };
};

const tokenText = (t: Token): string => {
  switch (t.kind) {
    case 'WORD':
      return '<word>';
    case 'PIPE':
      return '|';
    case 'REDIR':
      return t.op;
    case 'SEMI':
      return ';';
    case 'AND':
      return '&&';
    case 'OR':
      return '||';
  }
};

export function expandSequence(seq: ParsedSequence, env: ExpandEnv): Sequence {
  return seq.map(item => ({
    connector: item.connector,
    pipeline: item.pipeline.map(cmd => ({
      argv: cmd.argv.map(parts => expandWord(parts, env)),
      redirs: cmd.redirs.map(r => ({
        op: r.op,
        path: expandWord(r.parts, env),
      })),
      assignments: cmd.assignments.map(a => ({
        name: a.name,
        value: expandWord(a.value, env),
      })),
    })),
  }));
}

/** Throws ShellParseError on invalid input. */
export function parseCommandLine(input: string, env: ExpandEnv): Sequence {
  return expandSequence(parse(tokenize(input)), env);
}
