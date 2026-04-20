import { brightBlue, green } from '../core/color.js';
import type { PluginInstall } from '../core/kernel.js';
import type { FileNode, VfsNode } from '../core/vfs.js';
import { canExec, contentOf } from '../core/vfs.js';

const colorName = (name: string, node: VfsNode): string => {
  if (node.type === 'dir') {
    return brightBlue(name);
  }
  if ((node as FileNode).executable) {
    return green(name);
  }
  return name;
};

const ELF_NOT_STRIPPED =
  'ELF 64-bit LSB executable, x86-64, dynamically linked, not stripped';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

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

const modeString = (node: VfsNode): string => {
  const typeCh = node.type === 'dir' ? 'd' : '-';
  const tri = (b: number) =>
    (b & 4 ? 'r' : '-') + (b & 2 ? 'w' : '-') + (b & 1 ? 'x' : '-');
  return (
    typeCh +
    tri((node.mode >> 6) & 7) +
    tri((node.mode >> 3) & 7) +
    tri(node.mode & 7)
  );
};

const sizeOf = (node: VfsNode): number => {
  if (node.type === 'dir') {
    return 4096;
  }
  const content = contentOf(node);
  if (content === null || content === undefined) {
    return 0;
  }
  if (typeof content === 'string') {
    return content.length;
  }
  return String(content).length;
};

const nlinkOf = (node: VfsNode): number =>
  node.type === 'file'
    ? 1
    : 2 + Object.values(node.children).filter(c => c.type === 'dir').length;

const humanSize = (n: number): string => {
  if (n < 1024) {
    return String(n);
  }
  const units = ['K', 'M', 'G'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (v < 10 ? v.toFixed(1) : String(Math.round(v))) + units[i];
};

const formatMtime = (d: Date): string => {
  const mo = MONTHS[d.getMonth()] as string;
  const day = String(d.getDate()).padStart(2, ' ');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mo} ${day} ${hh}:${mm}`;
};

const renderLsLong = (
  entries: Array<[string, VfsNode]>,
  flags: Set<string>,
  bootTime: number,
  { showTotal }: { showTotal: boolean }
): string => {
  const mtime = formatMtime(new Date(bootTime));
  const rows = entries.map(([name, node]) => ({
    mode: modeString(node),
    nlink: String(nlinkOf(node)),
    owner: node.owner,
    group: node.group,
    size: flags.has('h') ? humanSize(sizeOf(node)) : String(sizeOf(node)),
    name: colorName(name + (node.type === 'dir' ? '/' : ''), node),
  }));
  const widthOf = (k: keyof (typeof rows)[number]) =>
    Math.max(1, ...rows.map(r => r[k].length));
  const w = {
    nlink: widthOf('nlink'),
    owner: widthOf('owner'),
    group: widthOf('group'),
    size: widthOf('size'),
  };
  const out: string[] = [];
  if (showTotal) {
    const total = entries.reduce(
      (a, [, n]) => a + Math.ceil(sizeOf(n) / 1024),
      0
    );
    out.push(`total ${total}`);
  }
  for (const r of rows) {
    out.push(
      `${r.mode} ${r.nlink.padStart(w.nlink)} ${r.owner.padEnd(w.owner)} ${r.group.padEnd(w.group)} ${r.size.padStart(w.size)} ${mtime} ${r.name}`
    );
  }
  return out.join('\n');
};

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/help', {
    describe: 'list available commands',
    exec(ctx) {
      const seen = new Set<string>();
      const visible: Array<{ name: string; describe: string }> = [];
      for (const dir of kernel.getPath()) {
        const prefixLen = (dir.endsWith('/') ? dir : dir + '/').length;
        for (const e of kernel.listExecutablesOn(dir)) {
          if (!e.describe) {
            continue;
          }
          const base = e.absPath.slice(prefixLen);
          if (seen.has(base)) {
            continue;
          }
          seen.add(base);
          visible.push({ name: base, describe: e.describe });
        }
      }
      const width = Math.max(...visible.map(v => v.name.length));
      const lines = visible.map(
        v => `  ${v.name.padEnd(width + 2, ' ')}${v.describe}`
      );
      ctx.out(lines.join('\n') + '\n');
      return 0;
    },
  });

  kernel.installExecutable('/bin/ls', {
    describe: 'list directory contents',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      const flags = parseFlags(args);
      const showHidden = flags.has('a');
      const long = flags.has('l');
      const targets = args.filter(a => !a.startsWith('-'));
      if (targets.length === 0) {
        targets.push('.');
      }

      let anyError = false;
      const showHeaders = targets.length > 1;
      const chunks: string[] = [];

      for (const target of targets) {
        const result = ctx.fs.resolve(target);
        if (!result.ok) {
          const msg: Record<string, string> = {
            ENOENT: `ls: cannot access '${target}': no such file or directory`,
            EACCES: `ls: cannot access '${target}': Permission denied`,
          };
          ctx.stderr(
            (msg[result.error] ??
              `ls: cannot access '${target}': ${result.error}`) + '\n'
          );
          anyError = true;
          continue;
        }
        if (result.node.type === 'file') {
          if (long) {
            chunks.push(
              renderLsLong(
                [[target, result.node]],
                flags,
                kernel.getBootTime(),
                {
                  showTotal: false,
                }
              )
            );
          } else {
            chunks.push(target);
          }
          continue;
        }
        const listResult = ctx.fs.list(target);
        if (!listResult.ok) {
          ctx.stderr(
            `ls: cannot open directory '${target}': Permission denied\n`
          );
          anyError = true;
          continue;
        }
        const entries = listResult.entries.filter(
          ([name]) => showHidden || !name.startsWith('.')
        );
        const header = showHeaders ? `${target}:\n` : '';
        if (long) {
          chunks.push(
            header +
              renderLsLong(entries, flags, kernel.getBootTime(), {
                showTotal: true,
              })
          );
        } else if (entries.length) {
          chunks.push(
            header +
              entries
                .map(([name, node]) =>
                  colorName(name + (node.type === 'dir' ? '/' : ''), node)
                )
                .join('  ')
          );
        } else if (showHeaders) {
          chunks.push(header.trimEnd());
        }
      }

      if (chunks.length) {
        ctx.out(chunks.join('\n\n') + '\n');
      }
      return anyError ? (targets.length === 1 ? 1 : 1) : 0;
    },
  });

  kernel.installExecutable('/bin/cd', {
    describe: 'change directory',
    exec(ctx) {
      const target = ctx.argv[1] ?? '~';
      const result = ctx.fs.resolve(target);
      if (!result.ok) {
        const msg: Record<string, string> = {
          ENOENT: `cd: no such file or directory: ${target}`,
          EACCES: `bash: cd: ${target}: Permission denied`,
        };
        ctx.out((msg[result.error] ?? `cd: ${target}: ${result.error}`) + '\n');
        return 1;
      }
      if (result.node.type !== 'dir') {
        ctx.out(`cd: not a directory: ${target}\n`);
        return 1;
      }
      if (!canExec(result.node, kernel.identity.current().name)) {
        ctx.out(`bash: cd: ${target}: Permission denied\n`);
        return 1;
      }
      kernel.setCwd(result.abs);
      return 0;
    },
  });

  kernel.installExecutable('/bin/pwd', {
    describe: 'print working directory',
    exec(ctx) {
      ctx.out(kernel.getCwd() + '\n');
      return 0;
    },
  });

  kernel.installExecutable('/bin/echo', {
    describe: 'echo arguments',
    exec(ctx) {
      ctx.out(ctx.argv.slice(1).join(' ') + '\n');
      return 0;
    },
  });

  kernel.installExecutable('/bin/cat', {
    describe: 'print file contents',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      if (args.length === 0) {
        if (ctx.stdin) {
          ctx.stdout(ctx.stdin);
        }
        return 0;
      }
      let anyError = false;
      for (const target of args) {
        const result = ctx.fs.read(target);
        if (!result.ok) {
          const msg: Record<string, string> = {
            ENOENT: `cat: ${target}: no such file or directory`,
            EACCES: `cat: ${target}: Permission denied`,
            EISDIR: `cat: ${target}: is a directory`,
          };
          ctx.stderr(
            (msg[result.error] ?? `cat: ${target}: ${result.error}`) + '\n'
          );
          anyError = true;
          continue;
        }
        ctx.out(result.content + '\n');
      }
      return anyError ? 1 : 0;
    },
  });

  kernel.installExecutable('/bin/file', {
    describe: 'determine file type',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      if (args.length === 0) {
        ctx.out('file: missing operand\n');
        return 1;
      }
      const target = args[0] as string;
      const result = ctx.fs.resolve(target);
      if (!result.ok) {
        const msg: Record<string, string> = {
          ENOENT: `file: cannot open '${target}' (No such file or directory)`,
          EACCES: `file: ${target}: Permission denied`,
        };
        ctx.out(
          (msg[result.error] ?? `file: ${target}: ${result.error}`) + '\n'
        );
        return 1;
      }
      const { node } = result;
      if (node.type === 'dir') {
        ctx.out(`${target}: directory\n`);
        return 0;
      }
      const fileNode = node as FileNode;
      if (fileNode.fileType) {
        ctx.out(`${target}: ${fileNode.fileType}\n`);
        return 0;
      }
      if (fileNode.executable) {
        ctx.out(`${target}: ${ELF_NOT_STRIPPED}\n`);
        return 0;
      }
      if (fileNode.content === '') {
        ctx.out(`${target}: empty\n`);
        return 0;
      }
      ctx.out(`${target}: ASCII text\n`);
      return 0;
    },
  });

  kernel.installExecutable('/bin/clear', {
    describe: 'clear the terminal',
    exec(ctx) {
      ctx.term.clear();
      return 0;
    },
  });

  kernel.installExecutable('/bin/history', {
    describe: 'command history',
    exec(ctx) {
      const h = kernel.term.getHistory();
      if (h.length === 0) {
        return 0;
      }
      const width = String(h.length).length;
      ctx.out(
        h
          .map((cmd, i) => `${String(i + 1).padStart(width)}  ${cmd}`)
          .join('\n') + '\n'
      );
      return 0;
    },
  });

  kernel.installExecutable('/bin/rm', {
    describe: 'remove files or directories',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      const flags = parseFlags(args);
      const paths = args.filter(a => !a.startsWith('-'));
      const recurse = flags.has('r') || flags.has('R');
      const force = flags.has('f');

      if (paths.length === 0) {
        ctx.out('rm: missing operand\n');
        return 1;
      }

      const errors: string[] = [];
      for (const p of paths) {
        const result = ctx.fs.rm(p, { recurse });
        if (result.ok) {
          continue;
        }
        const msg: Record<string, string> = {
          EROOT: `rm: it is dangerous to operate recursively on '/'`,
          EACCES: `rm: cannot remove '${p}': Permission denied`,
          EISDIR: `rm: cannot remove '${p}': Is a directory`,
          ENOENT: `rm: cannot remove '${p}': No such file or directory`,
        };
        if (result.error === 'ENOENT' && force) {
          continue;
        }
        errors.push(
          msg[result.error] ?? `rm: cannot remove '${p}': ${result.error}`
        );
      }

      const cwdCheck = ctx.fs.resolve(kernel.getCwd());
      if (!cwdCheck.ok || cwdCheck.node.type !== 'dir') {
        kernel.setCwd('/');
      }

      if (errors.length) {
        ctx.out(errors.join('\n') + '\n');
        return 1;
      }
      return 0;
    },
  });

  kernel.installExecutable('/bin/true', {
    describe: 'exit with status 0',
    exec() {
      return 0;
    },
  });

  kernel.installExecutable('/bin/false', {
    describe: 'exit with status 1',
    exec() {
      return 1;
    },
  });

  kernel.installExecutable('/bin/env', {
    describe: 'print environment variables',
    exec(ctx) {
      const entries = ctx.listEnv();
      if (entries.length) {
        ctx.stdout(entries.map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
      }
      return 0;
    },
  });

  kernel.installExecutable('/bin/export', {
    describe: 'set or mark an environment variable for export',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      if (args.length === 0) {
        const entries = ctx.listEnv();
        if (entries.length) {
          ctx.stdout(
            entries.map(([k, v]) => `export ${k}=${v}`).join('\n') + '\n'
          );
        }
        return 0;
      }
      for (const a of args) {
        const eq = a.indexOf('=');
        if (eq === -1) {
          // `export NAME` only validates the identifier — we don't track
          // the exported-vs-set distinction.
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(a)) {
            ctx.stderr(`export: \`${a}': not a valid identifier\n`);
            return 1;
          }
          continue;
        }
        const name = a.slice(0, eq);
        const value = a.slice(eq + 1);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          ctx.stderr(`export: \`${a}': not a valid identifier\n`);
          return 1;
        }
        ctx.setEnv(name, value);
      }
      return 0;
    },
  });

  kernel.installExecutable('/bin/unset', {
    describe: 'remove environment variables',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      if (args.length === 0) {
        return 0;
      }
      let exit = 0;
      for (const name of args) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          ctx.stderr(`unset: \`${name}': not a valid identifier\n`);
          exit = 1;
          continue;
        }
        ctx.unsetEnv(name);
      }
      return exit;
    },
  });
};

export default install;
