import type { PluginInstall } from '../core/kernel.js';
import type { Ctx } from '../core/shell.js';

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

const basename = (p: string): string => {
  const parts = p.split('/').filter(Boolean);
  return parts.length === 0 ? '' : (parts[parts.length - 1] as string);
};

const joinPath = (dir: string, name: string): string => {
  if (dir === '/') {
    return '/' + name;
  }
  return dir.replace(/\/+$/, '') + '/' + name;
};

const abs = (ctx: Ctx, p: string): string => ctx.fs.normalize(p) ?? p;

const isSelfOrDescendant = (srcAbs: string, destAbs: string): boolean =>
  destAbs === srcAbs || destAbs.startsWith(srcAbs + '/');

const mkdirOne = (
  ctx: Ctx,
  p: string
): { ok: true } | { ok: false; msg: string } => {
  const r = ctx.fs.mkdir(p);
  if (r.ok) {
    return { ok: true };
  }
  const errMsg: Record<string, string> = {
    ENOENT: `mkdir: cannot create directory '${p}': No such file or directory`,
    EEXIST: `mkdir: cannot create directory '${p}': File exists`,
    EACCES: `mkdir: cannot create directory '${p}': Permission denied`,
    ENOTDIR: `mkdir: cannot create directory '${p}': Not a directory`,
    ENOSYS: `mkdir: cannot create directory '${p}': Operation not supported`,
  };
  return { ok: false, msg: errMsg[r.error] ?? `mkdir: ${p}: ${r.error}` };
};

const mkdirWithParents = (ctx: Ctx, target: string): string | null => {
  const normalized = abs(ctx, target);
  if (normalized === '/') {
    return null;
  }
  const parts = normalized.split('/').filter(Boolean);
  let cur = '';
  for (const seg of parts) {
    cur += '/' + seg;
    const stat = ctx.fs.stat(cur);
    if (stat.ok && stat.type === 'dir') {
      continue;
    }
    if (stat.ok && stat.type !== 'dir') {
      return `mkdir: cannot create directory '${target}': Not a directory`;
    }
    const r = mkdirOne(ctx, cur);
    if (!r.ok) {
      return r.msg;
    }
  }
  return null;
};

const copyFile = (
  ctx: Ctx,
  src: string,
  dst: string,
  label: 'cp' | 'mv'
): string | null => {
  const rd = ctx.fs.read(src);
  if (!rd.ok) {
    return `${label}: cannot read '${src}': ${rd.error}`;
  }
  const wr = ctx.fs.write(dst, rd.content);
  if (!wr.ok) {
    return `${label}: cannot create '${dst}': ${wr.error}`;
  }
  return null;
};

const copyDirRecursive = (
  ctx: Ctx,
  src: string,
  dst: string,
  label: 'cp' | 'mv',
  errors: string[]
): void => {
  const dstStat = ctx.fs.stat(dst);
  if (!dstStat.ok) {
    const mkErr = mkdirOne(ctx, dst);
    if (!mkErr.ok) {
      errors.push(mkErr.msg.replace(/^mkdir:/, `${label}:`));
      return;
    }
  } else if (dstStat.type !== 'dir') {
    errors.push(
      `${label}: cannot overwrite non-directory '${dst}' with directory '${src}'`
    );
    return;
  }

  const listing = ctx.fs.list(src);
  if (!listing.ok) {
    errors.push(`${label}: cannot list '${src}': ${listing.error}`);
    return;
  }
  for (const [name, node] of listing.entries) {
    const childSrc = joinPath(src, name);
    const childDst = joinPath(dst, name);
    if (node.type === 'dir') {
      copyDirRecursive(ctx, childSrc, childDst, label, errors);
    } else {
      const err = copyFile(ctx, childSrc, childDst, label);
      if (err) {
        errors.push(err);
      }
    }
  }
};

const resolveTargets = (
  ctx: Ctx,
  sources: string[],
  dst: string,
  label: 'cp' | 'mv'
): Array<[string, string]> | { error: string } => {
  const dstStat = ctx.fs.stat(dst);
  const dstIsDir = dstStat.ok && dstStat.type === 'dir';
  if (sources.length > 1 && !dstIsDir) {
    return {
      error: `${label}: target '${dst}' is not a directory`,
    };
  }
  if (sources.length === 1 && !dstIsDir) {
    return [[sources[0] as string, dst]];
  }
  return sources.map(s => [s, joinPath(dst, basename(abs(ctx, s)))]);
};

const install: PluginInstall = kernel => {
  kernel.installExecutable('/bin/mkdir', {
    describe: 'create directories',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      const flags = parseFlags(args);
      const parents = flags.has('p');
      const paths = args.filter(a => !a.startsWith('-'));
      if (paths.length === 0) {
        ctx.stderr('mkdir: missing operand\n');
        return 1;
      }
      let exit = 0;
      for (const p of paths) {
        if (parents) {
          const err = mkdirWithParents(ctx, p);
          if (err) {
            ctx.stderr(err + '\n');
            exit = 1;
          }
        } else {
          const r = mkdirOne(ctx, p);
          if (!r.ok) {
            ctx.stderr(r.msg + '\n');
            exit = 1;
          }
        }
      }
      return exit;
    },
  });

  kernel.installExecutable('/bin/touch', {
    describe: 'create empty files or refresh existing ones',
    exec(ctx) {
      const paths = ctx.argv.slice(1).filter(a => !a.startsWith('-'));
      if (paths.length === 0) {
        ctx.stderr('touch: missing operand\n');
        return 1;
      }
      let exit = 0;
      for (const p of paths) {
        const stat = ctx.fs.stat(p);
        if (stat.ok) {
          continue;
        }
        if (stat.error !== 'ENOENT') {
          ctx.stderr(`touch: cannot touch '${p}': ${stat.error}\n`);
          exit = 1;
          continue;
        }
        const wr = ctx.fs.write(p, '');
        if (!wr.ok) {
          const msg: Record<string, string> = {
            ENOENT: `touch: cannot touch '${p}': No such file or directory`,
            EACCES: `touch: cannot touch '${p}': Permission denied`,
            EISDIR: `touch: cannot touch '${p}': Is a directory`,
            ENOSYS: `touch: cannot touch '${p}': Operation not supported`,
          };
          ctx.stderr((msg[wr.error] ?? `touch: ${p}: ${wr.error}`) + '\n');
          exit = 1;
        }
      }
      return exit;
    },
  });

  kernel.installExecutable('/bin/cp', {
    describe: 'copy files and directories',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      const flags = parseFlags(args);
      const recurse = flags.has('r') || flags.has('R');
      const positional = args.filter(a => !a.startsWith('-'));
      if (positional.length < 2) {
        ctx.stderr('cp: missing file operand\n');
        return 1;
      }
      const dst = positional[positional.length - 1] as string;
      const sources = positional.slice(0, -1);

      const targets = resolveTargets(ctx, sources, dst, 'cp');
      if ('error' in targets) {
        ctx.stderr(targets.error + '\n');
        return 1;
      }

      let exit = 0;
      for (const [src, dest] of targets) {
        const stat = ctx.fs.stat(src);
        if (!stat.ok) {
          ctx.stderr(`cp: cannot stat '${src}': ${stat.error}\n`);
          exit = 1;
          continue;
        }
        if (stat.type === 'dir') {
          if (!recurse) {
            ctx.stderr(`cp: -r not specified; omitting directory '${src}'\n`);
            exit = 1;
            continue;
          }
          if (isSelfOrDescendant(abs(ctx, src), abs(ctx, dest))) {
            ctx.stderr(
              `cp: cannot copy a directory, '${src}', into itself, '${dest}'\n`
            );
            exit = 1;
            continue;
          }
          const errors: string[] = [];
          copyDirRecursive(ctx, src, dest, 'cp', errors);
          if (errors.length) {
            ctx.stderr(errors.join('\n') + '\n');
            exit = 1;
          }
        } else {
          const err = copyFile(ctx, src, dest, 'cp');
          if (err) {
            ctx.stderr(err + '\n');
            exit = 1;
          }
        }
      }
      return exit;
    },
  });

  kernel.installExecutable('/bin/mv', {
    describe: 'move or rename files and directories',
    exec(ctx) {
      const args = ctx.argv.slice(1);
      const positional = args.filter(a => !a.startsWith('-'));
      if (positional.length < 2) {
        ctx.stderr('mv: missing file operand\n');
        return 1;
      }
      const dst = positional[positional.length - 1] as string;
      const sources = positional.slice(0, -1);

      const targets = resolveTargets(ctx, sources, dst, 'mv');
      if ('error' in targets) {
        ctx.stderr(targets.error + '\n');
        return 1;
      }

      let exit = 0;
      for (const [src, dest] of targets) {
        if (isSelfOrDescendant(abs(ctx, src), abs(ctx, dest))) {
          ctx.stderr(
            `mv: cannot move '${src}' to a subdirectory of itself, '${dest}'\n`
          );
          exit = 1;
          continue;
        }

        const stat = ctx.fs.stat(src);
        if (!stat.ok) {
          ctx.stderr(`mv: cannot stat '${src}': ${stat.error}\n`);
          exit = 1;
          continue;
        }

        if (stat.type === 'dir') {
          const errors: string[] = [];
          copyDirRecursive(ctx, src, dest, 'mv', errors);
          if (errors.length) {
            ctx.stderr(errors.join('\n') + '\n');
            exit = 1;
            continue;
          }
        } else {
          const err = copyFile(ctx, src, dest, 'mv');
          if (err) {
            ctx.stderr(err + '\n');
            exit = 1;
            continue;
          }
        }

        const rm = ctx.fs.rm(src, { recurse: true });
        if (!rm.ok) {
          ctx.stderr(`mv: cannot remove '${src}': ${rm.error}\n`);
          exit = 1;
        }
      }
      return exit;
    },
  });
};

export default install;
