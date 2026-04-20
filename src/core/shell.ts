import { red } from './color.js';
import type { Kernel } from './kernel.js';
import { globExpand } from './shell-glob.js';
import type { ExpandEnv, ParsedItem, ParsedSequence } from './shell-parser.js';
import {
  ShellParseError,
  expandForGlob,
  expandWord,
  parse,
  tokenize,
} from './shell-parser.js';
import type { Terminal } from './terminal.js';
import type {
  ListResult,
  ReadResult,
  ResolveResult,
  RmOpts,
  StatResult,
  VfsResult,
} from './vfs.js';
import { HOME } from './vfs.js';

export type Env = {
  HOME: string;
  USER: string;
  PWD: string;
  PATH: string;
  HOSTNAME: string;
};

export type FsFacade = {
  read(path: string): ReadResult;
  write(path: string, content: string): VfsResult;
  list(path: string): ListResult;
  stat(path: string): StatResult;
  resolve(path: string): ResolveResult;
  mkdir(path: string): VfsResult;
  rm(path: string, opts?: RmOpts): VfsResult;
  normalize(path: string): string | null;
  displayPath(path: string): string;
};

export type CtxTerm = {
  clear(): void;
  toggleClass: Terminal['toggleClass'];
  corrupt: Terminal['corrupt'];
  appendEntry: Terminal['appendEntry'];
};

export type Ctx = {
  argv: string[];
  raw: string;
  readonly env: Env;
  readonly cwd: string;
  fs: FsFacade;
  term: CtxTerm;
  stdin: string;
  stdout(s: string): void;
  stderr(s: string): void;
  /** Alias of stdout. */
  out(s: string): void;
  run(cmdline: string): Promise<number>;
  sleep(ms: number): Promise<void>;
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  unsetEnv(key: string): void;
  listEnv(): Array<[string, string]>;
};

export type Shell = {
  run(cmdline: string): Promise<number>;
  execute(cmdline: string): Promise<number>;
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  unsetEnv(key: string): void;
  listEnv(): Array<[string, string]>;
  getPath(): readonly string[];
};

const DYNAMIC_KEYS = new Set(['HOME', 'USER', 'PWD', 'HOSTNAME']);

export function createShell(kernel: Kernel): Shell {
  const terminal = kernel.term;
  const vfs = kernel.vfs;

  let lastExitCode = 0;

  const shellEnv = new Map<string, string>([['PATH', '/bin']]);

  const readDynamic = (key: string): string | undefined => {
    const id = kernel.identity.current();
    if (key === 'HOME') {
      return id.name === 'root' ? '/root' : HOME;
    }
    if (key === 'USER') {
      return id.name;
    }
    if (key === 'PWD') {
      return kernel.getCwd();
    }
    if (key === 'HOSTNAME') {
      return id.hostname;
    }
    return undefined;
  };

  const readVar = (key: string): string | undefined => {
    const stored = shellEnv.get(key);
    return stored !== undefined ? stored : readDynamic(key);
  };

  const setEnv = (key: string, value: string) => {
    shellEnv.set(key, value);
  };
  const unsetEnv = (key: string) => {
    shellEnv.delete(key);
  };
  const listEnv = (): Array<[string, string]> => {
    const out = new Map<string, string>();
    for (const k of DYNAMIC_KEYS) {
      const v = readDynamic(k);
      if (v !== undefined) {
        out.set(k, v);
      }
    }
    for (const [k, v] of shellEnv) {
      out.set(k, v);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  const getPath = (): readonly string[] => {
    const v = readVar('PATH') ?? '';
    return v === '' ? [] : v.split(':').filter(s => s.length > 0);
  };

  const buildFsFacade = (): FsFacade => ({
    read: path => vfs.read(path, kernel.getCwd(), kernel.identity.current()),
    write: (path, content) =>
      vfs.write(path, kernel.getCwd(), kernel.identity.current(), content),
    list: path => vfs.list(path, kernel.getCwd(), kernel.identity.current()),
    stat: path => vfs.stat(path, kernel.getCwd(), kernel.identity.current()),
    resolve: path =>
      vfs.resolve(path, kernel.getCwd(), kernel.identity.current()),
    mkdir: path => vfs.mkdir(path, kernel.getCwd(), kernel.identity.current()),
    rm: (path, opts) =>
      vfs.rm(path, kernel.getCwd(), kernel.identity.current(), opts),
    normalize: path => vfs.normalize(path, kernel.getCwd()),
    displayPath: path => vfs.displayPath(path),
  });

  const buildEnv = (): Env => ({
    HOME: readVar('HOME') ?? '',
    USER: readVar('USER') ?? '',
    PWD: readVar('PWD') ?? '',
    PATH: readVar('PATH') ?? '',
    HOSTNAME: readVar('HOSTNAME') ?? '',
  });

  const buildExpandEnv = (): ExpandEnv => {
    // Stored entries overwrite dynamic so `PWD=x cmd` reaches cmd with PWD=x.
    const out: ExpandEnv = { '?': String(lastExitCode) };
    for (const k of DYNAMIC_KEYS) {
      const v = readDynamic(k);
      if (v !== undefined) {
        out[k] = v;
      }
    }
    for (const [k, v] of shellEnv) {
      out[k] = v;
    }
    return out;
  };

  type EntryHandle = ReturnType<Terminal['beginEntry']>;

  const buildCtx = (opts: {
    argv: string[];
    raw: string;
    entry: EntryHandle;
    stdin: string;
    stdout: (s: string) => void;
    stderr: (s: string) => void;
  }): Ctx => ({
    argv: opts.argv,
    raw: opts.raw,
    get env() {
      return buildEnv();
    },
    get cwd() {
      return kernel.getCwd();
    },
    fs: buildFsFacade(),
    term: {
      clear: () => {
        opts.entry.detach();
        terminal.clear();
      },
      toggleClass: terminal.toggleClass,
      corrupt: terminal.corrupt,
      appendEntry: terminal.appendEntry,
    },
    stdin: opts.stdin,
    stdout: opts.stdout,
    stderr: opts.stderr,
    out: opts.stdout,
    run: cmdline => run(cmdline),
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    getEnv: readVar,
    setEnv,
    unsetEnv,
    listEnv,
  });

  const resolveProgram = (name: string) => {
    const identity = kernel.identity.current();
    if (!name.includes('/')) {
      for (const dir of getPath()) {
        const abs = `${dir}/${name}`;
        const r = vfs.resolve(abs, kernel.getCwd(), identity);
        if (r.ok && r.node.type === 'file' && r.node.executable) {
          const exe = kernel.getExecutable(abs);
          if (exe) {
            return exe;
          }
        }
      }
      return null;
    }
    const result = vfs.resolve(name, kernel.getCwd(), identity);
    if (!result.ok || result.node.type !== 'file' || !result.node.executable) {
      return null;
    }
    return kernel.getExecutable(result.abs) ?? null;
  };

  const runItem = async (
    item: ParsedItem,
    entry: EntryHandle,
    rawText: string
  ): Promise<number> => {
    const identity = kernel.identity.current();

    let pipedInput = '';
    let exit = 0;

    for (let idx = 0; idx < item.pipeline.length; idx++) {
      const rawCmd = item.pipeline[idx]!;
      const isLast = idx === item.pipeline.length - 1;

      if (rawCmd.argv.length === 0) {
        for (const a of rawCmd.assignments) {
          shellEnv.set(a.name, expandWord(a.value, buildExpandEnv()));
        }
        exit = 0;
        continue;
      }

      const scopedRestore: Array<{ key: string; prior: string | undefined }> =
        [];
      for (const a of rawCmd.assignments) {
        scopedRestore.push({ key: a.name, prior: shellEnv.get(a.name) });
        shellEnv.set(a.name, expandWord(a.value, buildExpandEnv()));
      }

      // Expand argv + redirs after scoped assignments so `A=1 echo $A` works.
      const env = buildExpandEnv();
      const cmd = {
        argv: rawCmd.argv.flatMap(parts => {
          const pat = expandForGlob(parts, env);
          return globExpand(pat, vfs, kernel.getCwd(), identity);
        }),
        redirs: rawCmd.redirs.map(r => ({
          op: r.op,
          path: expandWord(r.parts, env),
        })),
      };
      const name = cmd.argv[0] ?? '';

      let segStdin = pipedInput;
      const inRedir = cmd.redirs.find(r => r.op === '<');
      if (inRedir) {
        const rd = vfs.read(
          inRedir.path,
          kernel.getCwd(),
          kernel.identity.current()
        );
        if (!rd.ok) {
          entry.append(red(`shell: ${inRedir.path}: ${rd.error}`) + '\n');
          return 1;
        }
        segStdin = rd.content;
      }

      const buf: string[] = [];
      let stdout: (s: string) => void;
      let outRedir: { op: '>' | '>>'; path: string } | null = null;
      if (isLast) {
        const r = cmd.redirs.find(x => x.op === '>' || x.op === '>>');
        if (r) {
          outRedir = { op: r.op as '>' | '>>', path: r.path };
        }
        stdout = outRedir
          ? (s: string) => buf.push(s)
          : (s: string) => entry.append(s);
      } else {
        stdout = (s: string) => buf.push(s);
      }

      const stderr = (s: string) => entry.append(s);

      const program = resolveProgram(name);

      kernel.emit('exec', {
        name,
        args: cmd.argv.slice(1),
        raw: rawText,
        known: !!program,
      });

      if (!program) {
        entry.append(`command not found: ${name}\n`);
        exit = 127;
        break;
      }

      try {
        const ctx = buildCtx({
          argv: cmd.argv,
          raw: rawText,
          entry,
          stdin: segStdin,
          stdout,
          stderr,
        });
        exit = (await program.exec(ctx)) ?? 0;
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        entry.append(red(msg) + '\n');
        exit = 1;
      }

      if (isLast && outRedir) {
        const content = buf.join('');
        const identity = kernel.identity.current();
        let toWrite = content;
        if (outRedir.op === '>>') {
          const prior = vfs.read(outRedir.path, kernel.getCwd(), identity);
          if (prior.ok) {
            toWrite = prior.content + content;
          }
        }
        const wr = vfs.write(outRedir.path, kernel.getCwd(), identity, toWrite);
        if (!wr.ok) {
          entry.append(red(`shell: ${outRedir.path}: ${wr.error}`) + '\n');
          exit = 1;
        }
      }

      for (const { key, prior } of scopedRestore) {
        if (prior === undefined) {
          shellEnv.delete(key);
        } else {
          shellEnv.set(key, prior);
        }
      }

      if (!isLast) {
        pipedInput = buf.join('');
      }
    }

    return exit;
  };

  const runSequence = async (
    parsed: ParsedSequence,
    entry: EntryHandle,
    rawText: string
  ): Promise<number> => {
    let exit = 0;
    let skipNext = false;
    for (const item of parsed) {
      if (!skipNext) {
        exit = await runItem(item, entry, rawText);
        lastExitCode = exit;
      }
      if (item.connector === '&&') {
        skipNext = exit !== 0;
      } else if (item.connector === '||') {
        skipNext = exit === 0;
      } else {
        skipNext = false;
      }
    }
    return exit;
  };

  const run = async (cmdline: string): Promise<number> => {
    const trimmed = cmdline.trim();
    if (!trimmed) {
      terminal.appendEntry('', null);
      return 0;
    }

    let parsed: ParsedSequence;
    try {
      parsed = parse(tokenize(trimmed));
    } catch (e) {
      const msg = e instanceof ShellParseError ? e.message : String(e);
      terminal.appendEntry(trimmed, red(`shell: ${msg}`));
      lastExitCode = 2;
      return 2;
    }

    if (parsed.length === 0) {
      terminal.appendEntry('', null);
      return 0;
    }

    const entry = terminal.beginEntry(trimmed);
    terminal.setPromptVisible(false);
    try {
      return await runSequence(parsed, entry, trimmed);
    } finally {
      terminal.setPromptVisible(true);
    }
  };

  const execute = async (cmdline: string): Promise<number> => {
    const trimmed = cmdline.trim();
    if (trimmed) {
      terminal.pushHistory(trimmed);
    }
    return run(cmdline);
  };

  return { run, execute, getEnv: readVar, setEnv, unsetEnv, listEnv, getPath };
}
