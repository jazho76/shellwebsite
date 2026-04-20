import type { PluginInstall } from '../core/kernel.js';

const parseFlags = (args: string[]): Set<string> => {
  const flags = new Set<string>();
  for (const a of args) {
    if (!a.startsWith('-') || a === '-') {
      continue;
    }
    for (const c of a.slice(1)) {
      flags.add(c);
    }
  }
  return flags;
};

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/grep', {
    describe: 'filter lines matching a pattern',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      const flags = parseFlags(args);
      const positional = args.filter(a => !a.startsWith('-') || a === '-');
      if (positional.length === 0) {
        ctx.stderr('grep: missing pattern\n');
        return 2;
      }
      const pattern = positional[0] as string;
      const files = positional.slice(1);
      const invert = flags.has('v');
      const count = flags.has('c');
      const ignoreCase = flags.has('i');

      let re: RegExp;
      try {
        re = new RegExp(pattern, ignoreCase ? 'i' : '');
      } catch {
        re = new RegExp(escapeRegex(pattern), ignoreCase ? 'i' : '');
      }

      const streams: Array<{ label: string; content: string }> = [];
      if (files.length === 0) {
        streams.push({ label: '', content: ctx.stdin });
      } else {
        for (const f of files) {
          const r = ctx.fs.read(f);
          if (!r.ok) {
            const msg: Record<string, string> = {
              ENOENT: `grep: ${f}: No such file or directory`,
              EACCES: `grep: ${f}: Permission denied`,
              EISDIR: `grep: ${f}: Is a directory`,
            };
            ctx.stderr((msg[r.error] ?? `grep: ${f}: ${r.error}`) + '\n');
            continue;
          }
          streams.push({ label: f, content: r.content });
        }
        if (streams.length === 0) {
          return 2;
        }
      }

      let matched = 0;
      const showLabels = files.length > 1;
      const out: string[] = [];
      for (const s of streams) {
        const lines = s.content.split('\n');
        // Drop the ghost empty tail from trailing-newline strings.
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.pop();
        }
        for (const line of lines) {
          const hit = re.test(line);
          if (hit !== invert) {
            matched++;
            if (!count) {
              out.push(showLabels ? `${s.label}:${line}` : line);
            }
          }
        }
      }

      if (count) {
        ctx.stdout(`${matched}\n`);
      } else if (out.length) {
        ctx.stdout(out.join('\n') + '\n');
      }
      return matched > 0 ? 0 : 1;
    },
  });

  kernel.installExecutable('/bin/wc', {
    describe: 'count lines, words, and bytes',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      const flags = parseFlags(args);
      const files = args.filter(a => !a.startsWith('-') || a === '-');
      const onlyLines = flags.has('l') && !flags.has('w') && !flags.has('c');
      const onlyWords = flags.has('w') && !flags.has('l') && !flags.has('c');
      const onlyBytes = flags.has('c') && !flags.has('l') && !flags.has('w');

      const count = (content: string) => {
        let lines = 0;
        for (const ch of content) {
          if (ch === '\n') {
            lines++;
          }
        }
        const words =
          content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
        const bytes = content.length;
        return { lines, words, bytes };
      };

      const fmt = (
        c: { lines: number; words: number; bytes: number },
        label?: string
      ): string => {
        if (onlyLines) {
          return `${c.lines}${label ? ' ' + label : ''}`;
        }
        if (onlyWords) {
          return `${c.words}${label ? ' ' + label : ''}`;
        }
        if (onlyBytes) {
          return `${c.bytes}${label ? ' ' + label : ''}`;
        }
        return `${c.lines} ${c.words} ${c.bytes}${label ? ' ' + label : ''}`;
      };

      if (files.length === 0) {
        const c = count(ctx.stdin);
        ctx.stdout(fmt(c) + '\n');
        return 0;
      }

      let anyError = false;
      let totalLines = 0,
        totalWords = 0,
        totalBytes = 0;
      const lines: string[] = [];
      for (const f of files) {
        const r = ctx.fs.read(f);
        if (!r.ok) {
          ctx.stderr(`wc: ${f}: ${r.error}\n`);
          anyError = true;
          continue;
        }
        const c = count(r.content);
        totalLines += c.lines;
        totalWords += c.words;
        totalBytes += c.bytes;
        lines.push(fmt(c, f));
      }
      if (files.length > 1) {
        lines.push(
          fmt(
            { lines: totalLines, words: totalWords, bytes: totalBytes },
            'total'
          )
        );
      }
      if (lines.length) {
        ctx.stdout(lines.join('\n') + '\n');
      }
      return anyError ? 1 : 0;
    },
  });
};

export default install;
