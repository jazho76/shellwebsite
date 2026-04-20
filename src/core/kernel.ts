import { settings } from '../me/settings.js';
import { plugins } from '../plugins/index.js';
import type { Ctx, Shell } from './shell.js';
import { createShell } from './shell.js';
import type { Terminal } from './terminal.js';
import { createTerminal } from './terminal.js';
import type { FileNode, Vfs } from './vfs.js';
import { createVfs, HOME } from './vfs.js';

export type Identity = {
  name: string;
  uid: number;
  gid: number;
  hostname: string;
};

export type Executable = {
  absPath: string;
  describe?: string;
  exec(ctx: Ctx): Promise<number> | number | Promise<void> | void;
  owner?: string;
  group?: string;
  mode?: number;
  fileType?: string;
};

export type ExecOpts = Omit<Executable, 'absPath'>;

export type ExecPayload = {
  name: string;
  args: string[];
  raw: string;
  known: boolean;
};

export type BootReadyPayload = { isReboot: boolean };

export type KernelEvents = {
  'boot-ready': BootReadyPayload;
  reboot: undefined;
  exec: ExecPayload;
  keydown: KeyboardEvent;
};

export type EventName = keyof KernelEvents;
export type EventHandler<E extends EventName> = (
  payload: KernelEvents[E]
) => void | Promise<void>;

export type IdentityApi = {
  current(): Identity;
  switchTo(name: string): void;
};

export interface Kernel {
  vfs: Vfs;
  term: Terminal;
  shell: Shell;
  identity: IdentityApi;
  getCwd(): string;
  setCwd(path: string): void;
  getBootTime(): number;
  installExecutable(absPath: string, opts: ExecOpts): void;
  getExecutable(absPath: string): Executable | undefined;
  listExecutablesOn(dir: string): Executable[];
  getPath(): readonly string[];
  registerMount(mount: Parameters<Vfs['registerMount']>[0]): void;
  listMounts(): string[];
  on<E extends EventName>(event: E, handler: EventHandler<E>): void;
  emit<E extends EventName>(event: E, payload: KernelEvents[E]): Promise<void>;
  resetVfs(): void;
  reboot(): Promise<void>;
}

export type PluginInstall = (kernel: Kernel) => void;

const IDENTITIES: Record<string, { uid: number; gid: number }> = {
  guest: { uid: 1000, gid: 1000 },
  root: { uid: 0, gid: 0 },
};

const BIN_FILE_TYPE =
  'ELF 64-bit LSB executable, x86-64, dynamically linked, stripped';

const PATH: readonly string[] = ['/bin'];

const resolveHostname = (): string => {
  if (settings.hostname) {
    return settings.hostname;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }
  return 'shell.local';
};

const kernel = {} as Kernel;

const vfs = createVfs();
kernel.vfs = vfs;

let currentName = 'guest';
let bootTime = Date.now();
let cwd = HOME;
let cachedHostname = resolveHostname();

const installed = new Map<string, Executable>();

type AnySubscriber = EventHandler<EventName>;
const subscribers = new Map<EventName, Set<AnySubscriber>>();

const readHostname = () => {
  const r = vfs.read('/etc/hostname', '/', { name: 'root' });
  if (r.ok) {
    const h = (r.content || '').trim();
    if (h) {
      cachedHostname = h;
    }
  }
};

kernel.identity = {
  current: () => {
    const info = IDENTITIES[currentName] ?? IDENTITIES.guest!;
    return {
      name: currentName,
      uid: info.uid,
      gid: info.gid,
      hostname: cachedHostname,
    };
  },
  switchTo: (name: string) => {
    if (!IDENTITIES[name]) {
      console.warn(`[kernel] unknown identity: ${name}`);
      return;
    }
    currentName = name;
    kernel.term?.updatePrompt?.();
  },
};

kernel.getCwd = () => cwd;
kernel.setCwd = (path: string) => {
  cwd = path;
  kernel.term?.updatePrompt?.();
};
kernel.getBootTime = () => bootTime;

kernel.installExecutable = (absPath, opts) => {
  if (installed.has(absPath)) {
    console.warn(`[kernel] overriding executable at: ${absPath}`);
  }
  installed.set(absPath, { absPath, ...opts });
};
kernel.getExecutable = absPath => installed.get(absPath);
kernel.listExecutablesOn = dir => {
  const prefix = dir.endsWith('/') ? dir : dir + '/';
  const out: Executable[] = [];
  for (const e of installed.values()) {
    if (!e.absPath.startsWith(prefix)) {
      continue;
    }
    const rest = e.absPath.slice(prefix.length);
    if (rest.includes('/')) {
      continue;
    }
    out.push(e);
  }
  return out.sort((a, b) => a.absPath.localeCompare(b.absPath));
};
kernel.getPath = () => (kernel.shell ? kernel.shell.getPath() : PATH);

kernel.registerMount = mount => vfs.registerMount(mount);
kernel.listMounts = () => vfs.listMounts();

const binFileNode = (name: string, e: Executable): FileNode => ({
  type: 'file',
  owner: e.owner ?? 'root',
  group: e.group ?? 'root',
  mode: e.mode ?? 0o755,
  content: `${name}: built-in shell command`,
  fileType: e.fileType ?? BIN_FILE_TYPE,
  executable: true,
});

vfs.registerMount({
  path: '/bin',
  resolve(rel) {
    if (rel === '' || rel === '/') {
      const children: Record<string, FileNode> = {};
      for (const e of kernel.listExecutablesOn('/bin')) {
        const name = e.absPath.slice('/bin/'.length);
        children[name] = binFileNode(name, e);
      }
      return {
        type: 'dir',
        owner: 'root',
        group: 'root',
        mode: 0o755,
        children,
      };
    }
    const parts = rel.split('/').filter(Boolean);
    if (parts.length === 1) {
      const name = parts[0] as string;
      const e = installed.get(`/bin/${name}`);
      return e ? binFileNode(name, e) : null;
    }
    return null;
  },
  rebuild() {},
});

kernel.on = <E extends EventName>(event: E, handler: EventHandler<E>) => {
  let set = subscribers.get(event);
  if (!set) {
    set = new Set();
    subscribers.set(event, set);
  }
  set.add(handler as AnySubscriber);
};
kernel.emit = async <E extends EventName>(
  event: E,
  payload: KernelEvents[E]
) => {
  const set = subscribers.get(event);
  if (!set) {
    return;
  }
  const pending: Promise<unknown>[] = [];
  for (const h of set) {
    try {
      const r = (h as EventHandler<E>)(payload);
      if (r && typeof (r as Promise<void>).then === 'function') {
        pending.push((r as Promise<void>).catch(e => console.error(e)));
      }
    } catch (e) {
      console.error(e);
    }
  }
  await Promise.all(pending);
};

kernel.resetVfs = () => {
  vfs.resetVfs();
  bootTime = Date.now();
  readHostname();
};

kernel.reboot = async () => {
  kernel.resetVfs();
  kernel.identity.switchTo('guest');
  kernel.setCwd(HOME);
  await kernel.emit('reboot', undefined);
  await kernel.emit('boot-ready', { isReboot: true });
  kernel.term.setPromptVisible(true);
};

const terminal = createTerminal(kernel);
kernel.term = terminal;

const shell = createShell(kernel);
kernel.shell = shell;

for (const install of plugins) {
  install(kernel);
}
readHostname();
terminal.updatePrompt();
await kernel.emit('boot-ready', { isReboot: false });
terminal.setPromptVisible(true);
