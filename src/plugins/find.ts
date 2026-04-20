import type { PluginInstall } from '../core/kernel.js';
import { compileSegment } from '../core/shell-glob.js';
import type { Ctx } from '../core/shell.js';
import type { VfsNode } from '../core/vfs.js';

type Opts = {
  name: RegExp | null;
  type: 'f' | 'd' | null;
  maxDepth: number;
};

const joinPath = (base: string, name: string): string =>
  base === '/' ? '/' + name : base + '/' + name;

const basename = (p: string): string => {
  if (p === '/') {
    return '/';
  }
  const parts = p.split('/').filter(Boolean);
  return parts.length === 0 ? p : (parts[parts.length - 1] as string);
};

const matches = (path: string, node: VfsNode, opts: Opts): boolean => {
  if (opts.type === 'f' && node.type !== 'file') {
    return false;
  }
  if (opts.type === 'd' && node.type !== 'dir') {
    return false;
  }
  if (opts.name && !opts.name.test(basename(path))) {
    return false;
  }
  return true;
};

const walk = (
  ctx: Ctx,
  path: string,
  node: VfsNode,
  depth: number,
  opts: Opts,
  errors: string[]
): void => {
  if (matches(path, node, opts)) {
    ctx.stdout(path + '\n');
  }
  if (node.type !== 'dir') {
    return;
  }
  if (depth >= opts.maxDepth) {
    return;
  }
  const listing = ctx.fs.list(path);
  if (!listing.ok) {
    const msg =
      listing.error === 'EACCES'
        ? 'Permission denied'
        : listing.error === 'ENOENT'
          ? 'No such file or directory'
          : listing.error;
    errors.push(`find: '${path}': ${msg}`);
    return;
  }
  for (const [name, child] of listing.entries) {
    walk(ctx, joinPath(path, name), child, depth + 1, opts, errors);
  }
};

const parseArgs = (
  argv: string[]
): { paths: string[]; opts: Opts } | { error: string } => {
  const paths: string[] = [];
  const opts: Opts = { name: null, type: null, maxDepth: Infinity };
  let i = 1;
  while (i < argv.length && !(argv[i] as string).startsWith('-')) {
    paths.push(argv[i] as string);
    i++;
  }
  if (paths.length === 0) {
    paths.push('.');
  }

  while (i < argv.length) {
    const flag = argv[i] as string;
    const value = argv[i + 1];
    if (value === undefined) {
      return { error: `find: missing argument to '${flag}'` };
    }
    if (flag === '-name') {
      opts.name = compileSegment(value);
    } else if (flag === '-type') {
      if (value !== 'f' && value !== 'd') {
        return { error: `find: unknown type '${value}'` };
      }
      opts.type = value;
    } else if (flag === '-maxdepth') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        return { error: `find: invalid maxdepth '${value}'` };
      }
      opts.maxDepth = n;
    } else {
      return { error: `find: unknown predicate '${flag}'` };
    }
    i += 2;
  }
  return { paths, opts };
};

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/find', {
    describe: 'recursively list files and directories',
    exec(ctx) {
      const parsed = parseArgs(ctx.argv);
      if ('error' in parsed) {
        ctx.stderr(parsed.error + '\n');
        return 1;
      }
      const { paths, opts } = parsed;
      const errors: string[] = [];
      let anyError = false;
      for (const p of paths) {
        const resolved = ctx.fs.resolve(p);
        if (!resolved.ok) {
          const msg =
            resolved.error === 'ENOENT'
              ? 'No such file or directory'
              : resolved.error === 'EACCES'
                ? 'Permission denied'
                : resolved.error;
          ctx.stderr(`find: '${p}': ${msg}\n`);
          anyError = true;
          continue;
        }
        walk(ctx, p, resolved.node, 0, opts, errors);
      }
      if (errors.length) {
        ctx.stderr(errors.join('\n') + '\n');
        anyError = true;
      }
      return anyError ? 1 : 0;
    },
  });
};

export default install;
